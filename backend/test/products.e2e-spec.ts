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

interface ProductResponse {
  id: string;
  companyId: string;
  categoryId: string;
  name: string;
  internalCode: string | null;
  salePrice: string;
  purchasePrice: string | null;
  stockQuantity: number;
  minimumStock: number;
  version: number;
  isActive: boolean;
}

describe('Products API and RLS (real local PostgreSQL)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sql: Client;
  let a: string;
  let b: string;
  let catA: string;
  let catB: string;
  let prodA: string;
  let prodB: string;
  let ownerA: string;
  let ownerB: string;
  let employee: string;
  let manager: string;
  let fixtures = false;

  beforeAll(async () => {
    const url = process.env.DATABASE_URL;
    if (
      !url ||
      !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)
    )
      throw new Error('Local DATABASE_URL required');
    sql = new Client({ connectionString: url });
    await sql.connect();
    const identity = await sql.query(
      'SELECT current_user,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user',
    );
    expect(identity.rows).toEqual([
      {
        current_user: 'smartbusiness_app',
        rolsuper: false,
        rolbypassrls: false,
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
    expect(await prisma.$queryRaw`SELECT current_user`).toEqual([
      { current_user: 'smartbusiness_app' },
    ]);
  });

  beforeEach(async () => {
    [a, b, catA, catB, prodA, prodB] = Array.from({ length: 6 }, () =>
      randomUUID(),
    );
    const jwt = app.get(JwtService);
    const token = (companyId: string, role: string) =>
      jwt.sign({ sub: randomUUID(), companyId, role });
    ownerA = token(a, 'OWNER');
    ownerB = token(b, 'OWNER');
    employee = token(a, 'EMPLOYEE');
    manager = token(a, 'MANAGER');
    await sql.query('BEGIN');
    try {
      await sql.query(
        'INSERT INTO companies (id,name,updated_at) VALUES ($1,$3,now()),($2,$3,now())',
        [a, b, 'Products temporary fixture'],
      );
      for (const [company, category, product] of [
        [a, catA, prodA],
        [b, catB, prodB],
      ]) {
        await sql.query("SELECT set_config('app.company_id',$1,true)", [
          company,
        ]);
        await sql.query(
          'INSERT INTO categories (id,company_id,name,updated_at) VALUES ($1,$2,$3,now())',
          [category, company, 'Products category'],
        );
        await sql.query(
          'INSERT INTO products (id,company_id,category_id,name,internal_code,sale_price,updated_at) VALUES ($1,$2,$3,$4,$5,$6,now())',
          [product, company, category, 'Baseline product', 'BASE', '0.10'],
        );
      }
      await sql.query('COMMIT');
      fixtures = true;
    } catch (error) {
      await sql.query('ROLLBACK');
      throw error;
    }
  });

  afterEach(async () => {
    if (!fixtures) return;
    await sql.query('BEGIN');
    try {
      for (const company of [a, b]) {
        await sql.query("SELECT set_config('app.company_id',$1,true)", [
          company,
        ]);
        await sql.query('DELETE FROM products WHERE company_id=$1', [company]);
        await sql.query('DELETE FROM categories WHERE company_id=$1', [
          company,
        ]);
      }
      await sql.query('DELETE FROM companies WHERE id IN ($1,$2)', [a, b]);
      await sql.query('COMMIT');
      fixtures = false;
      expect(
        (
          await sql.query('SELECT id FROM companies WHERE id IN ($1,$2)', [
            a,
            b,
          ])
        ).rows,
      ).toEqual([]);
    } catch (error) {
      await sql.query('ROLLBACK');
      throw error;
    }
  });
  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      await sql?.end();
    }
  });

  async function rollback<T>(company: string, action: () => Promise<T>) {
    await sql.query('BEGIN');
    try {
      await sql.query("SELECT set_config('app.company_id',$1,true)", [company]);
      return await action();
    } finally {
      await sql.query('ROLLBACK');
    }
  }
  function insert(company = a, category = catA) {
    return sql.query(
      'INSERT INTO products (id,company_id,category_id,name,sale_price,updated_at) VALUES ($1,$2,$3,$4,$5,now())',
      [randomUUID(), company, category, 'Inserted product', '2.00'],
    );
  }
  function post(token = ownerA, fields: Record<string, unknown> = {}) {
    return request(app.getHttpServer())
      .post('/products')
      .auth(token, { type: 'bearer' })
      .send({
        categoryId: catA,
        name: 'API product',
        salePrice: '12.30',
        ...fields,
      });
  }
  function patch(id: string, fields: Record<string, unknown>, token = ownerA) {
    return request(app.getHttpServer())
      .patch(`/products/${id}`)
      .auth(token, { type: 'bearer' })
      .send(fields);
  }

  it('checks owner, RLS, four policies, grants and migration denial', async () => {
    expect(
      (
        await sql.query(
          "SELECT pg_get_userbyid(relowner) AS owner,relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='public.products'::regclass",
        )
      ).rows,
    ).toEqual([
      {
        owner: 'smartbusiness_migrate',
        relrowsecurity: true,
        relforcerowsecurity: false,
      },
    ]);
    const policies = await sql.query<{
      policyname: string;
      cmd: string;
      roles: string;
      qual: string | null;
      with_check: string | null;
    }>(
      "SELECT policyname,cmd,roles::text AS roles,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename='products' ORDER BY cmd",
    );
    expect(policies.rows.map((p) => [p.policyname, p.cmd, p.roles])).toEqual([
      ['products_delete', 'DELETE', '{smartbusiness_app}'],
      ['products_insert', 'INSERT', '{smartbusiness_app}'],
      ['products_select', 'SELECT', '{smartbusiness_app}'],
      ['products_update', 'UPDATE', '{smartbusiness_app}'],
    ]);
    for (const policy of policies.rows) {
      if (policy.cmd !== 'INSERT')
        expect(policy.qual).toContain(
          "NULLIF(current_setting('app.company_id'::text, true), ''::text)",
        );
      if (['INSERT', 'UPDATE'].includes(policy.cmd))
        expect(policy.with_check).toContain(
          "NULLIF(current_setting('app.company_id'::text, true), ''::text)",
        );
    }
    const privileges = await sql.query(
      "SELECT p,has_table_privilege(current_user,'public.products',p) AS allowed FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p",
    );
    expect(privileges.rows).toEqual(
      [
        'SELECT',
        'INSERT',
        'UPDATE',
        'DELETE',
        'TRUNCATE',
        'REFERENCES',
        'TRIGGER',
      ].map((p, i) => ({ p, allowed: i < 4 })),
    );
    await expect(
      sql.query('SELECT * FROM _prisma_migrations LIMIT 0'),
    ).rejects.toMatchObject({ code: '42501' });
  });
  it('A: missing and empty context fail closed', async () => {
    expect((await sql.query('SELECT id FROM products')).rows).toEqual([]);
    await rollback('', async () =>
      expect((await sql.query('SELECT id FROM products')).rows).toEqual([]),
    );
    const fresh = new Client({ connectionString: process.env.DATABASE_URL });
    try {
      await fresh.connect();
      expect((await fresh.query('SELECT id FROM products')).rows).toEqual([]);
    } finally {
      await fresh.end();
    }
  });
  it('B: matching tenant sees its product without application filters', async () => {
    await rollback(a, async () =>
      expect((await sql.query('SELECT id FROM products')).rows).toEqual([
        { id: prodA },
      ]),
    );
  });
  it('C: other tenant cannot see product A', async () => {
    await rollback(b, async () =>
      expect((await sql.query('SELECT id FROM products')).rows).toEqual([
        { id: prodB },
      ]),
    );
  });
  it('D: matching insert allowed with stock default zero', async () => {
    await rollback(a, async () => {
      expect((await insert()).rowCount).toBe(1);
      expect(
        (await sql.query('SELECT stock_quantity FROM products')).rows,
      ).toEqual([{ stock_quantity: 0 }, { stock_quantity: 0 }]);
    });
  });
  it('E: cross-company insert denied by RLS', async () => {
    await expect(rollback(a, () => insert(b, catB))).rejects.toMatchObject({
      code: '42501',
    });
  });
  it('F: cross-company update affects zero rows', async () => {
    await rollback(b, async () =>
      expect(
        (
          await sql.query('UPDATE products SET name=$1 WHERE id=$2', [
            'Blocked',
            prodA,
          ])
        ).rowCount,
      ).toBe(0),
    );
  });
  it('G: changing company is rejected by WITH CHECK', async () => {
    await expect(
      rollback(a, () =>
        sql.query(
          'UPDATE products SET company_id=$1,category_id=$2 WHERE id=$3',
          [b, catB, prodA],
        ),
      ),
    ).rejects.toMatchObject({ code: '42501' });
  });
  it('H: cross-company delete affects zero rows', async () => {
    await rollback(b, async () =>
      expect(
        (await sql.query('DELETE FROM products WHERE id=$1', [prodA])).rowCount,
      ).toBe(0),
    );
  });
  it('I: composite FK rejects foreign category even with valid product tenant', async () => {
    await expect(rollback(a, () => insert(a, catB))).rejects.toMatchObject({
      code: '23503',
    });
    await expect(
      rollback(a, () =>
        sql.query('UPDATE products SET category_id=$1 WHERE id=$2', [
          catB,
          prodA,
        ]),
      ),
    ).rejects.toMatchObject({ code: '23503' });
    await post(ownerA, { categoryId: catB }).expect(404);
    await patch(prodA, { version: 1, categoryId: catB }).expect(404);
  });
  it('J: authenticated API supports create/read/update/deactivation without hard delete', async () => {
    await request(app.getHttpServer()).get('/products').expect(401);
    const response = await post().expect(201);
    const product = response.body as ProductResponse;
    expect(product).toMatchObject({
      companyId: a,
      salePrice: '12.30',
      purchasePrice: null,
      version: 1,
      isActive: true,
    });
    await request(app.getHttpServer())
      .get(`/products/${product.id}`)
      .auth(ownerA, { type: 'bearer' })
      .expect(200);
    await request(app.getHttpServer())
      .get(`/products/${product.id}`)
      .auth(ownerB, { type: 'bearer' })
      .expect(404);
    await patch(product.id, {
      version: 1,
      name: 'Updated',
      purchasePrice: '0.10',
      isActive: false,
    })
      .expect(200)
      .expect((response) =>
        expect(response.body as unknown).toMatchObject({
          version: 2,
          name: 'Updated',
          purchasePrice: '0.10',
          isActive: false,
        }),
      );
    await patch(product.id, { version: 2 }, ownerB).expect(404);
    await request(app.getHttpServer())
      .delete(`/products/${product.id}`)
      .auth(ownerA, { type: 'bearer' })
      .expect(404);
    await patch(product.id, {
      version: 2,
      purchasePrice: null,
      isActive: true,
    }).expect(200);
  });
  it('K: EMPLOYEE can only read; MANAGER can create/update', async () => {
    await request(app.getHttpServer())
      .get('/products')
      .auth(employee, { type: 'bearer' })
      .expect(200);
    await request(app.getHttpServer())
      .get(`/products/${prodA}`)
      .auth(employee, { type: 'bearer' })
      .expect(200);
    await post(employee).expect(403);
    await patch(prodA, { version: 1, name: 'Blocked' }, employee).expect(403);
    const response = await post(manager).expect(201);
    await patch(
      (response.body as ProductResponse).id,
      { version: 1, isActive: false },
      manager,
    ).expect(200);
  });
  it('L: internal codes are trimmed, nullable and unique only within company', async () => {
    await post(ownerA, { internalCode: ' SHARED ' })
      .expect(201)
      .expect((response) =>
        expect((response.body as ProductResponse).internalCode).toBe('SHARED'),
      );
    await post(ownerA, { internalCode: 'SHARED' }).expect(409);
    await post(ownerB, { internalCode: 'SHARED', categoryId: catB }).expect(
      201,
    );
    await post().expect(201);
    await post().expect(201);
    await patch(prodA, { version: 1, internalCode: 'SHARED' }).expect(409);
    await patch(prodA, { version: 1, internalCode: null }).expect(200);
  });
  it('M: concurrent edits of the same version produce one success and one 409', async () => {
    const results = await Promise.all([
      patch(prodA, { version: 1, name: 'Winner one' }),
      patch(prodA, { version: 1, name: 'Winner two' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const winner = results.find((r) => r.status === 200)
      ?.body as ProductResponse;
    expect(winner.version).toBe(2);
    await request(app.getHttpServer())
      .get(`/products/${prodA}`)
      .auth(ownerA, { type: 'bearer' })
      .expect(200)
      .expect((response) =>
        expect(response.body as unknown).toMatchObject({
          name: winner.name,
          version: 2,
        }),
      );
  });
  it('N: stock always starts zero and forbidden fields are rejected', async () => {
    await post()
      .expect(201)
      .expect((response) =>
        expect(response.body as unknown).toMatchObject({
          stockQuantity: 0,
          minimumStock: 0,
        }),
      );
    for (const field of [
      'stockQuantity',
      'companyId',
      'createdAt',
      'updatedAt',
    ]) {
      await post(ownerA, { [field]: field === 'stockQuantity' ? 3 : a }).expect(
        400,
      );
      await patch(prodA, {
        version: 1,
        [field]: field === 'stockQuantity' ? 3 : a,
      }).expect(400);
    }
  });
  it('O: concurrent transactions overlap with isolated context; commit/rollback do not leak', async () => {
    let active = 0;
    let maximum = 0;
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) =>
        prisma.withCompanyContext(i % 2 ? a : b, async (tx) => {
          active++;
          maximum = Math.max(maximum, active);
          try {
            await tx.$queryRaw`SELECT 1 AS waited FROM pg_sleep(0.02)`;
            expect(await tx.product.findMany({ select: { id: true } })).toEqual(
              [{ id: i % 2 ? prodA : prodB }],
            );
          } finally {
            active--;
          }
        }),
      ),
    );
    for (const result of results)
      if (result.status === 'rejected') throw result.reason;
    expect(maximum).toBeGreaterThan(1);
    const failure = new Error('rollback');
    await expect(
      prisma.withCompanyContext(a, () => Promise.reject(failure)),
    ).rejects.toBe(failure);
    expect(await prisma.product.findMany()).toEqual([]);
    for (const tenant of [a, b, a, b]) {
      await rollback(tenant, async () =>
        expect(
          (await sql.query('SELECT company_id FROM products')).rows,
        ).toEqual([{ company_id: tenant }]),
      );
      expect((await sql.query('SELECT id FROM products')).rows).toEqual([]);
    }
  });
  it('paginates with deterministic filters, including inactive and code search', async () => {
    for (let i = 0; i < 3; i++)
      await post(ownerA, {
        name: 'Same name',
        internalCode: `FILTER-${i}`,
        isActive: false,
      }).expect(201);
    const list = (page: number) =>
      request(app.getHttpServer())
        .get('/products')
        .query({
          page,
          limit: 2,
          search: 'filter-',
          categoryId: catA,
          isActive: 'false',
        })
        .auth(ownerA, { type: 'bearer' });
    const first = await list(1).expect(200);
    const second = await list(2).expect(200);
    const result = first.body as { data: ProductResponse[]; meta: unknown };
    expect(result.meta).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
    const combined = [
      ...result.data,
      ...(second.body as { data: ProductResponse[] }).data,
    ];
    expect(combined).toHaveLength(3);
    expect(new Set(combined.map((p) => p.id)).size).toBe(3);
    expect(combined.every((p) => p.companyId === a && !p.isActive)).toBe(true);
    expect(combined.map((p) => p.id)).toEqual(combined.map((p) => p.id).sort());
  });
  it.each([
    'sale_price',
    'purchase_price',
    'minimum_stock',
    'stock_quantity',
    'version',
  ])('database rejects invalid %s', async (column) => {
    // Column comes only from the fixed test matrix, never from client input.
    await expect(
      rollback(a, () =>
        sql.query(`UPDATE products SET ${column}=-1 WHERE id=$1`, [prodA]),
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });
  it('category deletion remains restricted and returns a friendly conflict', async () => {
    await request(app.getHttpServer())
      .delete(`/categories/${catA}`)
      .auth(ownerA, { type: 'bearer' })
      .expect(409);
    await rollback(a, async () =>
      expect((await sql.query('SELECT id FROM products')).rows).toEqual([
        { id: prodA },
      ]),
    );
  });
});
