import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { StockMovementType } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { StockMovementsService } from './stock-movements.service';
import { ListStockMovementsDto } from './dto/list-stock-movements.dto';

describe('StockMovementsService', () => {
  const tx = {
    $queryRaw: jest.fn(),
    stockMovement: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    product: { findFirst: jest.fn() },
  };
  const prisma = {
    withCompanyContext: jest.fn(),
    stockMovement: { create: jest.fn() },
  };
  const dto = {
    productId: 'product',
    type: StockMovementType.ENTRY,
    quantity: 5,
    note: ' note ',
  };
  const movement = {
    id: 'movement',
    companyId: 'company',
    ...dto,
    note: 'note',
    previousQuantity: 0,
    newQuantity: 5,
    idempotencyKey: 'key',
    createdByUserId: 'actor',
  };
  let service: StockMovementsService;
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.withCompanyContext.mockImplementation(
      (_company: string, callback: (client: typeof tx) => unknown) =>
        callback(tx),
    );
    tx.$queryRaw
      .mockResolvedValueOnce([{ locked: 1 }])
      .mockResolvedValue([{ newQuantity: 5 }]);
    tx.stockMovement.findFirst.mockResolvedValue(null);
    tx.stockMovement.create.mockResolvedValue(movement);
    tx.product.findFirst.mockResolvedValue({ id: 'product' });
    service = new StockMovementsService(prisma as unknown as PrismaService);
  });
  it.each([
    StockMovementType.ENTRY,
    StockMovementType.ADJUSTMENT_IN,
    StockMovementType.RETURN,
  ])(
    '%s increments and records both balances in the same transaction',
    async (type) => {
      await service.create('company', 'actor', 'key', { ...dto, type });
      expect(prisma.withCompanyContext).toHaveBeenCalledWith(
        'company',
        expect.any(Function),
      );
      expect(tx.stockMovement.create).toHaveBeenCalledWith({
        data: {
          companyId: 'company',
          productId: 'product',
          type,
          quantity: 5,
          previousQuantity: 0,
          newQuantity: 5,
          note: 'note',
          idempotencyKey: 'key',
          createdByUserId: 'actor',
        },
      });
      expect(prisma.stockMovement.create).not.toHaveBeenCalled();
    },
  );
  it.each([StockMovementType.ADJUSTMENT_OUT, StockMovementType.LOSS])(
    '%s decrements atomically without changing metadata version',
    async (type) => {
      await service.create('company', 'actor', 'key', { ...dto, type });
      const [strings, ...params] = tx.$queryRaw.mock.calls[1] as [
        TemplateStringsArray,
        ...unknown[],
      ];
      expect(strings.join('?')).toContain('stock_quantity = stock_quantity +');
      expect(strings.join('?')).not.toContain('version');
      expect(params).toEqual([-5, 'product', 'company', 5, 2147483647]);
      expect(tx.stockMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          previousQuantity: 10,
          newQuantity: 5,
        }) as unknown,
      });
    },
  );
  it('locks the tenant/key before checking a replay', async () => {
    await service.create('company', 'actor', 'key', dto);
    const [strings, key] = tx.$queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      string,
    ];
    expect(strings.join('?')).toContain('pg_advisory_xact_lock');
    expect(key).toBe('company:key');
    expect(tx.stockMovement.findFirst).toHaveBeenCalledWith({
      where: { companyId: 'company', idempotencyKey: 'key' },
    });
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.stockMovement.findFirst.mock.invocationCallOrder[0],
    );
  });
  it('replays normalized commands without updating stock or author', async () => {
    tx.stockMovement.findFirst.mockResolvedValue(movement);
    expect(
      await service.create('company', 'another-actor', 'key', dto),
    ).toEqual(movement);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });
  it.each([
    { quantity: 6 },
    { productId: 'other' },
    { type: StockMovementType.LOSS },
    { note: 'other' },
  ])('rejects changed command %j', async (change) => {
    tx.stockMovement.findFirst.mockResolvedValue(movement);
    await expect(
      service.create('company', 'actor', 'key', { ...dto, ...change }),
    ).rejects.toThrow(ConflictException);
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });
  it('returns 404 for foreign/missing product', async () => {
    tx.$queryRaw.mockReset().mockResolvedValueOnce([]).mockResolvedValue([]);
    tx.product.findFirst.mockResolvedValue(null);
    await expect(
      service.create('company', 'actor', 'key', dto),
    ).rejects.toThrow(NotFoundException);
    expect(tx.product.findFirst).toHaveBeenCalledWith({
      where: { id: 'product', companyId: 'company' },
      select: { id: true },
    });
  });
  it.each([StockMovementType.ENTRY, StockMovementType.LOSS])(
    'returns domain conflict for unavailable balance/capacity on %s',
    async (type) => {
      tx.$queryRaw.mockReset().mockResolvedValue([]);
      await expect(
        service.create('company', 'actor', 'key', { ...dto, type }),
      ).rejects.toThrow(ConflictException);
      expect(tx.stockMovement.create).not.toHaveBeenCalled();
    },
  );
  it('propagates ledger failure through transaction rather than swallowing it', async () => {
    const failure = new Error('insert failed');
    tx.stockMovement.create.mockRejectedValue(failure);
    await expect(service.create('company', 'actor', 'key', dto)).rejects.toBe(
      failure,
    );
  });
  it('scopes reads to company and handles missing movement', async () => {
    await expect(service.findOne('id', 'company')).rejects.toThrow(
      NotFoundException,
    );
    expect(tx.stockMovement.findFirst).toHaveBeenCalledWith({
      where: { id: 'id', companyId: 'company' },
    });
  });
  it('paginates deterministically with tenant, product, type and dates', async () => {
    tx.stockMovement.findMany.mockResolvedValue([movement]);
    tx.stockMovement.count.mockResolvedValue(3);
    const query = Object.assign(new ListStockMovementsDto(), {
      page: 2,
      limit: 2,
      productId: 'product',
      type: StockMovementType.ENTRY,
      startDate: '2026-01-01T00:00:00Z',
      endDate: '2026-12-31T23:59:59Z',
    });
    const where = {
      companyId: 'company',
      productId: 'product',
      type: StockMovementType.ENTRY,
      createdAt: {
        gte: new Date(query.startDate),
        lte: new Date(query.endDate),
      },
    };
    expect((await service.findAll('company', query)).meta).toEqual({
      page: 2,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
    expect(tx.stockMovement.findMany).toHaveBeenCalledWith({
      where,
      skip: 2,
      take: 2,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    expect(tx.stockMovement.count).toHaveBeenCalledWith({ where });
  });
  it('rejects inverted date interval before querying', () => {
    expect(() =>
      service.findAll(
        'company',
        Object.assign(new ListStockMovementsDto(), {
          startDate: '2026-02-01T00:00:00Z',
          endDate: '2026-01-01T00:00:00Z',
        }),
      ),
    ).toThrow(BadRequestException);
    expect(prisma.withCompanyContext).not.toHaveBeenCalled();
  });
});
