import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Categories RLS (local PostgreSQL)', () => {
  const companyA = randomUUID();
  const companyB = randomUUID();
  const categoryA = randomUUID();
  const categoryB = randomUUID();
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sql: Client;
  let tokenA: string;
  let tokenB: string;
  let fixturesCreated = false;

  beforeAll(async () => {
    const url = process.env.DATABASE_URL;
    if (
      !url ||
      !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)
    ) {
      throw new Error('RLS integration tests require a local DATABASE_URL');
    }
    sql = new Client({ connectionString: url });
    await sql.connect();
    const identity = await sql.query<{
      current_user: string;
      rolbypassrls: boolean;
      rolsuper: boolean;
    }>(
      'SELECT current_user, rolbypassrls, rolsuper FROM pg_roles WHERE rolname = current_user',
    );
    expect(identity.rows).toEqual([
      {
        current_user: 'smartbusiness_app',
        rolbypassrls: false,
        rolsuper: false,
      },
    ]);
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    const jwt = app.get(JwtService);
    tokenA = jwt.sign({
      sub: randomUUID(),
      companyId: companyA,
      role: 'OWNER',
    });
    tokenB = jwt.sign({
      sub: randomUUID(),
      companyId: companyB,
      role: 'OWNER',
    });
    await sql.query('BEGIN');
    try {
      await sql.query(
        'INSERT INTO companies (id, name, updated_at) VALUES ($1, $3, now()), ($2, $3, now())',
        [companyA, companyB, 'RLS temporary fixture'],
      );
      for (const [company, category] of [
        [companyA, categoryA],
        [companyB, categoryB],
      ]) {
        await sql.query("SELECT set_config('app.company_id', $1, true)", [
          company,
        ]);
        await sql.query(
          'INSERT INTO categories (id, company_id, name, updated_at) VALUES ($1, $2, $3, now())',
          [category, company, 'RLS fixture'],
        );
      }
      await sql.query('COMMIT');
      fixturesCreated = true;
    } catch (error) {
      await sql.query('ROLLBACK');
      throw error;
    }
  });

  afterAll(async () => {
    try {
      if (fixturesCreated) {
        await sql.query('BEGIN');
        try {
          for (const company of [companyA, companyB]) {
            await sql.query("SELECT set_config('app.company_id', $1, true)", [
              company,
            ]);
            await sql.query('DELETE FROM categories WHERE company_id = $1', [
              company,
            ]);
          }
          await sql.query('DELETE FROM companies WHERE id IN ($1, $2)', [
            companyA,
            companyB,
          ]);
          await sql.query('COMMIT');
          const remaining = await sql.query(
            'SELECT id FROM companies WHERE id IN ($1, $2)',
            [companyA, companyB],
          );
          expect(remaining.rows).toEqual([]);
        } catch (error) {
          await sql.query('ROLLBACK');
          throw error;
        }
      }
    } finally {
      await app?.close();
      await sql?.end();
    }
  });

  async function rollback<T>(
    company: string | undefined,
    action: () => Promise<T>,
  ): Promise<T> {
    await sql.query('BEGIN');
    try {
      if (company !== undefined)
        await sql.query("SELECT set_config('app.company_id', $1, true)", [
          company,
        ]);
      return await action();
    } finally {
      await sql.query('ROLLBACK');
    }
  }

  it('installs exactly four runtime policies without FORCE or privileged runtime', async () => {
    const table = await sql.query(
      "SELECT pg_get_userbyid(relowner) AS owner, relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid='public.categories'::regclass",
    );
    expect(table.rows).toEqual([
      {
        owner: 'smartbusiness_migrate',
        relrowsecurity: true,
        relforcerowsecurity: false,
      },
    ]);
    const policies = await sql.query(
      "SELECT policyname, cmd, roles::text AS roles, qual, with_check FROM pg_policies WHERE schemaname='public' AND tablename='categories' ORDER BY cmd",
    );
    expect(policies.rows).toEqual([
      expect.objectContaining({
        policyname: 'categories_delete',
        cmd: 'DELETE',
        roles: '{smartbusiness_app}',
        qual: expect.stringContaining('NULLIF') as unknown,
        with_check: null,
      }),
      expect.objectContaining({
        policyname: 'categories_insert',
        cmd: 'INSERT',
        roles: '{smartbusiness_app}',
        qual: null,
        with_check: expect.stringContaining('NULLIF') as unknown,
      }),
      expect.objectContaining({
        policyname: 'categories_select',
        cmd: 'SELECT',
        roles: '{smartbusiness_app}',
        qual: expect.stringContaining('NULLIF') as unknown,
        with_check: null,
      }),
      expect.objectContaining({
        policyname: 'categories_update',
        cmd: 'UPDATE',
        roles: '{smartbusiness_app}',
        qual: expect.stringContaining('NULLIF') as unknown,
        with_check: expect.stringContaining('NULLIF') as unknown,
      }),
    ]);
    await expect(
      sql.query('SELECT * FROM public._prisma_migrations LIMIT 0'),
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('A: no context and empty context fail closed', async () => {
    expect((await sql.query('SELECT id FROM categories')).rows).toEqual([]);
    await rollback('', async () =>
      expect((await sql.query('SELECT id FROM categories')).rows).toEqual([]),
    );
    // Also prove a genuinely fresh connection, before any set_config call.
    const fresh = new Client({ connectionString: process.env.DATABASE_URL });
    try {
      await fresh.connect();
      expect((await fresh.query('SELECT id FROM categories')).rows).toEqual([]);
    } finally {
      await fresh.end();
    }
  });

  it('B: context A sees only A without application tenant filters', async () => {
    await rollback(companyA, async () =>
      expect((await sql.query('SELECT id FROM categories')).rows).toEqual([
        { id: categoryA },
      ]),
    );
  });

  it('C: context B cannot see A', async () => {
    await rollback(companyB, async () =>
      expect((await sql.query('SELECT id FROM categories')).rows).toEqual([
        { id: categoryB },
      ]),
    );
  });

  it('D: matching insert succeeds', async () => {
    await rollback(companyA, async () => {
      const result = await sql.query(
        'INSERT INTO categories (id, company_id, name, updated_at) VALUES ($1, $2, $3, now())',
        [randomUUID(), companyA, 'allowed'],
      );
      expect(result.rowCount).toBe(1);
    });
  });

  it('E: cross-tenant insert is rejected by RLS', async () => {
    await expect(
      rollback(companyA, () =>
        sql.query(
          'INSERT INTO categories (id, company_id, name, updated_at) VALUES ($1, $2, $3, now())',
          [randomUUID(), companyB, 'blocked'],
        ),
      ),
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('F: cross-tenant update affects zero rows', async () => {
    await rollback(companyB, async () =>
      expect(
        (
          await sql.query('UPDATE categories SET name = $1 WHERE id = $2', [
            'blocked',
            categoryA,
          ])
        ).rowCount,
      ).toBe(0),
    );
  });

  it('G: changing tenant is rejected by WITH CHECK', async () => {
    await expect(
      rollback(companyA, () =>
        sql.query('UPDATE categories SET company_id = $1 WHERE id = $2', [
          companyB,
          categoryA,
        ]),
      ),
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('H: cross-tenant delete affects zero rows', async () => {
    await rollback(companyB, async () =>
      expect(
        (await sql.query('DELETE FROM categories WHERE id = $1', [categoryA]))
          .rowCount,
      ).toBe(0),
    );
  });

  it('I: authenticated HTTP CRUD, validation, permissions and isolation still work', async () => {
    const server = app.getHttpServer();
    await request(server).get('/categories').expect(401);
    await request(server)
      .post('/categories')
      .auth(tokenA, { type: 'bearer' })
      .send({ name: 'bad', companyId: companyB })
      .expect(400);
    const employee = app
      .get(JwtService)
      .sign({ sub: randomUUID(), companyId: companyA, role: 'EMPLOYEE' });
    await request(server)
      .post('/categories')
      .auth(employee, { type: 'bearer' })
      .send({ name: 'bad' })
      .expect(403);
    const created = await request(server)
      .post('/categories')
      .auth(tokenA, { type: 'bearer' })
      .send({ name: 'HTTP fixture' })
      .expect(201);
    const category = created.body as { id: string; companyId: string };
    expect(category.companyId).toBe(companyA);
    await request(server)
      .post('/categories')
      .auth(tokenA, { type: 'bearer' })
      .send({ name: 'HTTP fixture' })
      .expect(409);
    await request(server)
      .get('/categories')
      .auth(tokenA, { type: 'bearer' })
      .expect(200)
      .expect((response) => {
        const rows = response.body as { id: string; companyId: string }[];
        expect(rows.some((row) => row.id === category.id)).toBe(true);
        expect(rows.every((row) => row.companyId === companyA)).toBe(true);
      });
    await request(server)
      .get(`/categories/${category.id}`)
      .auth(tokenA, { type: 'bearer' })
      .expect(200);
    await request(server)
      .get(`/categories/${category.id}`)
      .auth(tokenB, { type: 'bearer' })
      .expect(404);
    await request(server)
      .patch(`/categories/${category.id}`)
      .auth(tokenB, { type: 'bearer' })
      .send({ name: 'blocked' })
      .expect(404);
    await request(server)
      .delete(`/categories/${category.id}`)
      .auth(tokenB, { type: 'bearer' })
      .expect(404);
    await request(server)
      .patch(`/categories/${category.id}`)
      .auth(tokenA, { type: 'bearer' })
      .send({ name: 'updated' })
      .expect(200)
      .expect((response) =>
        expect((response.body as { name: string }).name).toBe('updated'),
      );
    await request(server)
      .delete(`/categories/${category.id}`)
      .auth(tokenA, { type: 'bearer' })
      .expect(200);
    await request(server)
      .get(`/categories/${category.id}`)
      .auth(tokenA, { type: 'bearer' })
      .expect(404);
  });

  it('J: concurrent Prisma transactions and reused connections do not leak context', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, index) => {
        const company = index % 2 ? companyA : companyB;
        const id = index % 2 ? categoryA : categoryB;
        return prisma.withCompanyContext(company, async (tx) => {
          await tx.$queryRaw`SELECT 1 AS waited FROM pg_sleep(0.01)`;
          expect(await tx.category.findMany({ select: { id: true } })).toEqual([
            { id },
          ]);
        });
      }),
    );
    for (const result of results) {
      if (result.status === 'rejected') throw result.reason;
    }
    const failure = new Error('intentional rollback');
    await expect(
      prisma.withCompanyContext(companyA, () => Promise.reject(failure)),
    ).rejects.toBe(failure);
    expect(await prisma.category.findMany()).toEqual([]);
    for (const company of [companyA, companyB, companyA, companyB]) {
      await rollback(company, async () =>
        expect(
          (
            await sql.query(
              "SELECT current_setting('app.company_id') AS company",
            )
          ).rows,
        ).toEqual([{ company }]),
      );
      expect((await sql.query('SELECT id FROM categories')).rows).toEqual([]);
    }
  });
});
