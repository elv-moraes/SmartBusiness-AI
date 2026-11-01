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
import { StockMovementsService } from '../src/stock-movements/stock-movements.service';
import { StockMovementType } from '../src/generated/prisma/enums';
import type { StockMovement } from '../src/generated/prisma/client';

describe('Stock movements: PostgreSQL, API and concurrency', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let service: StockMovementsService;
  let sql: Client;
  let cleanup: Client;
  let a: string;
  let b: string;
  let catA: string;
  let catB: string;
  let productA: string;
  let productB: string;
  let actor: string;
  let owner: string;
  let other: string;
  let manager: string;
  let employee: string;
  let baseline: StockMovement;
  let fixtures = false;

  beforeAll(async () => {
    const runtime = process.env.DATABASE_URL;
    const migration = process.env.MIGRATION_DATABASE_URL;
    if (!runtime || !migration)
      throw new Error(
        'Local runtime and migration connections required for fixtures',
      );
    const urls = [new URL(runtime), new URL(migration)];
    if (
      urls.some(
        (u) => !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname),
      ) ||
      urls[0].host !== urls[1].host ||
      urls[0].pathname !== urls[1].pathname
    )
      throw new Error('Connections must target the same local database');
    sql = new Client({ connectionString: runtime });
    cleanup = new Client({ connectionString: migration });
    await sql.connect();
    await cleanup.connect();
    expect(
      (
        await sql.query(
          'SELECT current_user,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user',
        )
      ).rows,
    ).toEqual([
      {
        current_user: 'smartbusiness_app',
        rolsuper: false,
        rolbypassrls: false,
      },
    ]);
    expect((await cleanup.query('SELECT current_user')).rows).toEqual([
      { current_user: 'smartbusiness_migrate' },
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
    service = app.get(StockMovementsService);
    expect(await prisma.$queryRaw`SELECT current_user`).toEqual([
      { current_user: 'smartbusiness_app' },
    ]);
  });
  beforeEach(async () => {
    [a, b, catA, catB, productA, productB, actor] = Array.from(
      { length: 7 },
      () => randomUUID(),
    );
    const jwt = app.get(JwtService);
    const token = (companyId: string, role: string) =>
      jwt.sign({ sub: actor, companyId, role });
    owner = token(a, 'OWNER');
    other = token(b, 'OWNER');
    manager = token(a, 'MANAGER');
    employee = token(a, 'EMPLOYEE');
    await sql.query('BEGIN');
    try {
      await sql.query(
        'INSERT INTO companies (id,name,updated_at) VALUES ($1,$3,now()),($2,$3,now())',
        [a, b, 'Stock movement temporary fixture'],
      );
      for (const [company, category, product] of [
        [a, catA, productA],
        [b, catB, productB],
      ]) {
        await sql.query("SELECT set_config('app.company_id',$1,true)", [
          company,
        ]);
        await sql.query(
          'INSERT INTO categories (id,company_id,name,updated_at) VALUES ($1,$2,$3,now())',
          [category, company, 'Stock category'],
        );
        await sql.query(
          'INSERT INTO products (id,company_id,category_id,name,sale_price,updated_at) VALUES ($1,$2,$3,$4,$5,now())',
          [product, company, category, 'Stock product', '1.00'],
        );
      }
      await sql.query('COMMIT');
      fixtures = true;
    } catch (error) {
      await sql.query('ROLLBACK');
      throw error;
    }
    baseline = await service.create(a, actor, 'baseline', {
      productId: productA,
      type: StockMovementType.ENTRY,
      quantity: 10,
    });
    await service.create(b, actor, 'baseline', {
      productId: productB,
      type: StockMovementType.ENTRY,
      quantity: 10,
    });
  });
  afterEach(async () => {
    if (!fixtures) return;
    // Owner connection is used ONLY to remove this test's exact UUID tenants.
    // Runtime privileges remain SELECT/INSERT on the immutable ledger.
    await cleanup.query('BEGIN');
    try {
      await cleanup.query(
        'DELETE FROM stock_movements WHERE company_id IN ($1,$2)',
        [a, b],
      );
      await cleanup.query('DELETE FROM products WHERE company_id IN ($1,$2)', [
        a,
        b,
      ]);
      await cleanup.query(
        'DELETE FROM categories WHERE company_id IN ($1,$2)',
        [a, b],
      );
      await cleanup.query('DELETE FROM companies WHERE id IN ($1,$2)', [a, b]);
      await cleanup.query('COMMIT');
      fixtures = false;
      expect(
        (
          await cleanup.query(
            'SELECT id FROM stock_movements WHERE company_id IN ($1,$2)',
            [a, b],
          )
        ).rows,
      ).toEqual([]);
      expect(
        (
          await cleanup.query('SELECT id FROM companies WHERE id IN ($1,$2)', [
            a,
            b,
          ])
        ).rows,
      ).toEqual([]);
    } catch (error) {
      await cleanup.query('ROLLBACK');
      throw error;
    }
  });
  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      await sql?.end();
      await cleanup?.end();
    }
  });
  function post(
    type: StockMovementType = StockMovementType.ENTRY,
    quantity = 3,
    key = randomUUID(),
    token = owner,
    fields: Record<string, unknown> = {},
  ) {
    return request(app.getHttpServer())
      .post('/stock-movements')
      .auth(token, { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send({ productId: productA, type, quantity, ...fields });
  }
  async function state(company = a, product = productA) {
    return prisma.withCompanyContext(company, async (tx) => ({
      product: await tx.product.findFirstOrThrow({
        where: { id: product, companyId: company },
      }),
      movements: await tx.stockMovement.findMany({
        where: { companyId: company },
      }),
    }));
  }
  async function rollback<T>(company: string, callback: () => Promise<T>) {
    await sql.query('BEGIN');
    try {
      await sql.query("SELECT set_config('app.company_id',$1,true)", [company]);
      return await callback();
    } finally {
      await sql.query('ROLLBACK');
    }
  }
  function insert(
    company = a,
    product = productA,
    quantity = 1,
    previous = 0,
    next = 1,
    key = randomUUID(),
  ) {
    return sql.query(
      "INSERT INTO stock_movements (id,company_id,product_id,type,quantity,previous_quantity,new_quantity,idempotency_key,created_by_user_id) VALUES ($1,$2,$3,'ENTRY',$4,$5,$6,$7,$8)",
      [randomUUID(), company, product, quantity, previous, next, key, actor],
    );
  }

  it('1: missing/empty context fail closed on fresh and reused connections', async () => {
    expect((await sql.query('SELECT id FROM stock_movements')).rows).toEqual(
      [],
    );
    await rollback('', async () =>
      expect((await sql.query('SELECT id FROM stock_movements')).rows).toEqual(
        [],
      ),
    );
    const fresh = new Client({ connectionString: process.env.DATABASE_URL });
    try {
      await fresh.connect();
      expect(
        (await fresh.query('SELECT id FROM stock_movements')).rows,
      ).toEqual([]);
    } finally {
      await fresh.end();
    }
  });
  it('2–3: only matching tenant sees movements without application filters', async () => {
    await rollback(a, async () =>
      expect((await sql.query('SELECT id FROM stock_movements')).rows).toEqual([
        { id: baseline.id },
      ]),
    );
    await rollback(b, async () => {
      const rows = await sql.query<{ company_id: string }>(
        'SELECT company_id FROM stock_movements',
      );
      expect(rows.rows).toEqual([{ company_id: b }]);
    });
  });
  it('4: cross-tenant INSERT is rejected by RLS', async () => {
    await expect(rollback(a, () => insert(b, productB))).rejects.toMatchObject({
      code: '42501',
    });
  });
  it('5: ledger is immutable to runtime, with exactly SELECT/INSERT policies and privileges', async () => {
    expect(
      (
        await sql.query(
          "SELECT pg_get_userbyid(relowner) AS owner,relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='public.stock_movements'::regclass",
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
      "SELECT policyname,cmd,roles::text AS roles,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename='stock_movements' ORDER BY cmd",
    );
    expect(policies.rows.map((p) => [p.policyname, p.cmd, p.roles])).toEqual([
      ['stock_movements_insert', 'INSERT', '{smartbusiness_app}'],
      ['stock_movements_select', 'SELECT', '{smartbusiness_app}'],
    ]);
    expect(policies.rows[0].with_check).toContain(
      "NULLIF(current_setting('app.company_id'::text, true), ''::text)",
    );
    expect(policies.rows[1].qual).toContain(
      "NULLIF(current_setting('app.company_id'::text, true), ''::text)",
    );
    const permissions = [
      'SELECT',
      'INSERT',
      'UPDATE',
      'DELETE',
      'TRUNCATE',
      'REFERENCES',
      'TRIGGER',
    ];
    for (const p of permissions) {
      expect(
        (
          await sql.query(
            "SELECT has_table_privilege(current_user,'public.stock_movements',$1) AS allowed",
            [p],
          )
        ).rows,
      ).toEqual([{ allowed: ['SELECT', 'INSERT'].includes(p) }]);
    }
    await expect(
      rollback(a, () =>
        sql.query('UPDATE stock_movements SET note=$1 WHERE id=$2', [
          'tampered',
          baseline.id,
        ]),
      ),
    ).rejects.toMatchObject({ code: '42501' });
    await expect(
      rollback(a, () =>
        sql.query('DELETE FROM stock_movements WHERE id=$1', [baseline.id]),
      ),
    ).rejects.toMatchObject({ code: '42501' });
    await expect(
      sql.query('SELECT * FROM _prisma_migrations LIMIT 0'),
    ).rejects.toMatchObject({ code: '42501' });
  });
  it.each([
    [StockMovementType.ENTRY, 13],
    [StockMovementType.ADJUSTMENT_IN, 13],
    [StockMovementType.ADJUSTMENT_OUT, 7],
    [StockMovementType.LOSS, 7],
    [StockMovementType.RETURN, 13],
  ])(
    '6–10: %s changes stock and records the audit trail',
    async (type, expected) => {
      await post(type)
        .expect(201)
        .expect((response) =>
          expect(response.body as unknown).toMatchObject({
            companyId: a,
            createdByUserId: actor,
            quantity: 3,
            previousQuantity: 10,
            newQuantity: expected,
          }),
        );
      const result = await state();
      expect(result.product.stockQuantity).toBe(expected);
      expect(result.product.version).toBe(1);
      expect(result.movements).toHaveLength(2);
    },
  );
  it('11: insufficient stock returns 409, no movement and no reserved key', async () => {
    await post(StockMovementType.LOSS, 11, 'retry').expect(409);
    const result = await state();
    expect(result.product.stockQuantity).toBe(10);
    expect(result.movements).toHaveLength(1);
    await post(StockMovementType.LOSS, 10, 'retry').expect(201);
  });
  it('12: foreign/missing product returns 404 and FK also enforces tenant safety', async () => {
    await post(StockMovementType.ENTRY, 1, randomUUID(), owner, {
      productId: productB,
    }).expect(404);
    await post(StockMovementType.ENTRY, 1, randomUUID(), owner, {
      productId: randomUUID(),
    }).expect(404);
    await expect(rollback(a, () => insert(a, productB))).rejects.toMatchObject({
      code: '23503',
    });
  });
  it('13: a real failed ledger INSERT rolls back the prior balance UPDATE', async () => {
    const before = await state();
    // Deliberately bypass DTO validation to trigger a real PostgreSQL varchar
    // failure AFTER the service has updated stock; no database/RLS mocks.
    await expect(
      service.create(a, actor, 'failed-insert', {
        productId: productA,
        type: StockMovementType.ENTRY,
        quantity: 3,
        note: 'x'.repeat(501),
      }),
    ).rejects.toBeDefined();
    const after = await state();
    expect(after.product).toEqual(before.product);
    expect(after.movements).toEqual(before.movements);
    await post(StockMovementType.ENTRY, 3, 'failed-insert').expect(201);
  });
  it('14: rollback after both writes removes the movement and restores balance', async () => {
    const failure = new Error('intentional rollback');
    await expect(
      prisma.withCompanyContext(a, async (tx) => {
        await tx.product.updateMany({
          where: { id: productA, companyId: a },
          data: { stockQuantity: { increment: 2 } },
        });
        await tx.stockMovement.create({
          data: {
            companyId: a,
            productId: productA,
            type: StockMovementType.ENTRY,
            quantity: 2,
            previousQuantity: 10,
            newQuantity: 12,
            idempotencyKey: 'rollback',
            createdByUserId: actor,
          },
        });
        throw failure;
      }),
    ).rejects.toBe(failure);
    const result = await state();
    expect(result.product.stockQuantity).toBe(10);
    expect(result.movements).toHaveLength(1);
  });
  it('15: same normalized command replays the original movement without another effect', async () => {
    const first = await post(StockMovementType.LOSS, 10, 'replay', owner, {
      note: ' note ',
    }).expect(201);
    const second = await post(StockMovementType.LOSS, 10, 'replay', manager, {
      note: 'note',
      productId: productA.toUpperCase(),
    }).expect(201);
    expect(second.body as unknown).toEqual(first.body as unknown);
    const result = await state();
    expect(result.product.stockQuantity).toBe(0);
    expect(result.movements).toHaveLength(2);
  });
  it('16: same key with different product/type/quantity/note returns 409', async () => {
    await post(StockMovementType.ENTRY, 3, 'different').expect(201);
    for (const fields of [
      { quantity: 4 },
      { type: StockMovementType.LOSS },
      { note: 'different' },
      { productId: productB },
    ])
      await post(StockMovementType.ENTRY, 3, 'different', owner, fields).expect(
        409,
      );
    expect((await state()).product.stockQuantity).toBe(13);
  });
  it('17: concurrent same-key requests have exactly one stock effect even when replay would be insufficient', async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        post(StockMovementType.LOSS, 10, 'concurrent-key'),
      ),
    );
    expect(results.map((r) => r.status)).toEqual(Array(6).fill(201));
    expect(new Set(results.map((r) => (r.body as StockMovement).id)).size).toBe(
      1,
    );
    const result = await state();
    expect(result.product.stockQuantity).toBe(0);
    expect(result.movements).toHaveLength(2);
  });
  it('17b: concurrent different payloads with same key produce one success and one conflict', async () => {
    const results = await Promise.all([
      post(StockMovementType.ENTRY, 1, 'race'),
      post(StockMovementType.ENTRY, 2, 'race'),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const winner = results.find((r) => r.status === 201)?.body as StockMovement;
    expect((await state()).product.stockQuantity).toBe(10 + winner.quantity);
  });
  it('18: competing withdrawals never produce negative stock or lost audit records', async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () => post(StockMovementType.LOSS, 3)),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(results.filter((r) => r.status === 409)).toHaveLength(5);
    const result = await state();
    expect(result.product.stockQuantity).toBe(1);
    expect(result.movements).toHaveLength(4);
    expect(
      result.movements
        .filter((m) => m.type === StockMovementType.LOSS)
        .map((m) => [m.previousQuantity, m.newQuantity])
        .sort((x, y) => y[0] - x[0]),
    ).toEqual([
      [10, 7],
      [7, 4],
      [4, 1],
    ]);
  });
  it('19: authenticated roles and immutable HTTP routes', async () => {
    await request(app.getHttpServer()).get('/stock-movements').expect(401);
    await post(StockMovementType.ENTRY, 1, randomUUID(), employee).expect(403);
    await post(StockMovementType.ENTRY, 1, randomUUID(), manager).expect(201);
    await request(app.getHttpServer())
      .get('/stock-movements')
      .auth(employee, { type: 'bearer' })
      .expect(200);
    await request(app.getHttpServer())
      .get(`/stock-movements/${baseline.id}`)
      .auth(employee, { type: 'bearer' })
      .expect(200);
    await request(app.getHttpServer())
      .get(`/stock-movements/${baseline.id}`)
      .auth(other, { type: 'bearer' })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/stock-movements/${baseline.id}`)
      .auth(owner, { type: 'bearer' })
      .send({ note: 'tamper' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/stock-movements/${baseline.id}`)
      .auth(owner, { type: 'bearer' })
      .expect(404);
  });
  it('20: pagination, product/type/date filters and inclusive dates', async () => {
    for (let i = 0; i < 3; i++)
      await service.create(a, actor, `filter-${i}`, {
        productId: productA,
        type: StockMovementType.RETURN,
        quantity: 1,
      });
    const list = (page: number) =>
      request(app.getHttpServer())
        .get('/stock-movements')
        .auth(owner, { type: 'bearer' })
        .query({
          page,
          limit: 2,
          productId: productA,
          type: 'RETURN',
          startDate: '2000-01-01T00:00:00Z',
          endDate: '2100-01-01T00:00:00Z',
        });
    const first = await list(1).expect(200);
    const second = await list(2).expect(200);
    const one = first.body as { data: StockMovement[]; meta: unknown };
    const two = second.body as { data: StockMovement[] };
    expect(one.meta).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect(new Set([...one.data, ...two.data].map((m) => m.id)).size).toBe(3);
    expect(
      [...one.data, ...two.data].every(
        (m) => m.companyId === a && m.type === StockMovementType.RETURN,
      ),
    ).toBe(true);
    await request(app.getHttpServer())
      .get('/stock-movements')
      .auth(owner, { type: 'bearer' })
      .query({
        startDate: baseline.createdAt.toISOString(),
        endDate: baseline.createdAt.toISOString(),
        type: 'ENTRY',
      })
      .expect(200)
      .expect((response) =>
        expect(
          (response.body as { data: StockMovement[] }).data.map((m) => m.id),
        ).toEqual([baseline.id]),
      );
    await request(app.getHttpServer())
      .get('/stock-movements')
      .auth(owner, { type: 'bearer' })
      .query({
        startDate: '2026-02-01T00:00:00Z',
        endDate: '2026-01-01T00:00:00Z',
      })
      .expect(400);
  });
  it('21: concurrent tenant contexts remain isolated; key namespace is per company', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, (_, i) =>
        service.create(i % 2 ? a : b, actor, 'shared-key', {
          productId: i % 2 ? productA : productB,
          type: StockMovementType.ENTRY,
          quantity: 2,
        }),
      ),
    );
    for (const result of results)
      if (result.status === 'rejected') throw result.reason;
    expect((await state()).product.stockQuantity).toBe(12);
    expect((await state(b, productB)).product.stockQuantity).toBe(12);
    let active = 0;
    let maximum = 0;
    const contexts = await Promise.allSettled(
      Array.from({ length: 12 }, (_, i) =>
        prisma.withCompanyContext(i % 2 ? a : b, async (tx) => {
          active++;
          maximum = Math.max(maximum, active);
          try {
            await tx.$queryRaw`SELECT 1 AS waited FROM pg_sleep(0.02)`;
            const rows = await tx.stockMovement.findMany();
            expect(rows).toHaveLength(2);
            expect(rows.every((m) => m.companyId === (i % 2 ? a : b))).toBe(
              true,
            );
          } finally {
            active--;
          }
        }),
      ),
    );
    for (const result of contexts)
      if (result.status === 'rejected') throw result.reason;
    expect(maximum).toBeGreaterThan(1);
    expect(await prisma.stockMovement.findMany()).toEqual([]);
  });
  it('22: Products still rejects stock overrides and metadata version remains independent', async () => {
    await request(app.getHttpServer())
      .post('/products')
      .auth(owner, { type: 'bearer' })
      .send({
        name: 'Bad',
        categoryId: catA,
        salePrice: '1.00',
        stockQuantity: 3,
      })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/products/${productA}`)
      .auth(owner, { type: 'bearer' })
      .send({ version: 1, stockQuantity: 3 })
      .expect(400);
    const results = await Promise.all([
      post(StockMovementType.ENTRY, 3),
      request(app.getHttpServer())
        .patch(`/products/${productA}`)
        .auth(owner, { type: 'bearer' })
        .send({ version: 1, name: 'Updated metadata' }),
    ]);
    expect(results.map((r) => r.status)).toEqual([201, 200]);
    expect((await state()).product).toMatchObject({
      stockQuantity: 13,
      version: 2,
      name: 'Updated metadata',
    });
  });
  it('rejects missing header and forged tenant/actor/balance fields', async () => {
    await request(app.getHttpServer())
      .post('/stock-movements')
      .auth(owner, { type: 'bearer' })
      .send({ productId: productA, type: 'ENTRY', quantity: 1 })
      .expect(400);
    for (const field of [
      'companyId',
      'createdByUserId',
      'previousQuantity',
      'newQuantity',
    ])
      await post(StockMovementType.ENTRY, 1, randomUUID(), owner, {
        [field]: a,
      }).expect(400);
  });
  it('prevents integer overflow with 409 and no partial movement', async () => {
    await post(StockMovementType.ENTRY, 2147483647).expect(409);
    expect((await state()).product.stockQuantity).toBe(10);
  });
  it.each([
    [0, 0, 0],
    [1, -1, 0],
    [2, 0, 1],
    [1, 0, -1],
  ])(
    'CHECKs reject invalid quantity/balance %j %j %j',
    async (quantity, previous, next) => {
      await expect(
        rollback(a, () => insert(a, productA, quantity, previous, next)),
      ).rejects.toMatchObject({ code: '23514' });
    },
  );
  it('database rejects empty idempotency key and duplicate tenant key', async () => {
    await expect(
      rollback(a, () => insert(a, productA, 1, 0, 1, '')),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      rollback(a, () => insert(a, productA, 1, 0, 1, 'baseline')),
    ).rejects.toMatchObject({ code: '23505' });
  });
});
