import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from './products.service';
import { ListProductsDto } from './dto/list-products.dto';

describe('ProductsService', () => {
  const companyId = 'company-a';
  const product = {
    id: 'product-a',
    companyId,
    categoryId: 'category-a',
    name: 'Produto',
    internalCode: null,
    purchasePrice: new Prisma.Decimal('0.10'),
    salePrice: new Prisma.Decimal('10.20'),
    stockQuantity: 0,
    minimumStock: 0,
    isActive: true,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const tx = {
    product: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    category: { findFirst: jest.fn() },
  };
  const prisma = {
    withCompanyContext: jest.fn(),
    product: { create: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
  };
  let service: ProductsService;
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.withCompanyContext.mockImplementation(
      (_id: string, callback: (client: typeof tx) => unknown) => callback(tx),
    );
    tx.category.findFirst.mockResolvedValue({ id: product.categoryId });
    tx.product.create.mockResolvedValue(product);
    tx.product.findFirst.mockResolvedValue(product);
    tx.product.findMany.mockResolvedValue([product]);
    tx.product.count.mockResolvedValue(3);
    tx.product.updateMany.mockResolvedValue({ count: 1 });
    service = new ProductsService(prisma as unknown as PrismaService);
  });

  it('creates with authenticated company, category validation, zero stock and exact decimal serialization', async () => {
    const result = await service.create(companyId, {
      categoryId: product.categoryId,
      name: product.name,
      salePrice: '10.20',
    });
    expect(result).toMatchObject({
      companyId,
      salePrice: '10.20',
      purchasePrice: '0.10',
      stockQuantity: 0,
    });
    expect(tx.category.findFirst).toHaveBeenCalledWith({
      where: { id: product.categoryId, companyId },
      select: { id: true },
    });
    expect(tx.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ companyId, stockQuantity: 0 }) as unknown,
    });
    expect(prisma.withCompanyContext).toHaveBeenCalledWith(
      companyId,
      expect.any(Function),
    );
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('rejects foreign/missing category before creating', async () => {
    tx.category.findFirst.mockResolvedValue(null);
    await expect(
      service.create(companyId, {
        categoryId: 'foreign',
        name: 'Produto',
        salePrice: '1',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(tx.product.create).not.toHaveBeenCalled();
  });

  it.each(['P2002', 'P2003'])(
    'maps database conflict %s without leaking details',
    async (code) => {
      tx.product.create.mockRejectedValue({
        code,
        message: 'private SQL detail',
      });
      await expect(
        service.create(companyId, {
          categoryId: product.categoryId,
          name: 'Produto',
          salePrice: '1',
        }),
      ).rejects.toThrow(ConflictException);
    },
  );

  it('paginates deterministically and filters all reads by company', async () => {
    const query = Object.assign(new ListProductsDto(), {
      page: 2,
      limit: 2,
      search: 'abc',
      categoryId: 'cat',
      isActive: false,
    });
    const result = await service.findAll(companyId, query);
    const where = {
      companyId,
      categoryId: 'cat',
      isActive: false,
      OR: [
        { name: { contains: 'abc', mode: 'insensitive' } },
        { internalCode: { contains: 'abc', mode: 'insensitive' } },
      ],
    };
    expect(tx.product.findMany).toHaveBeenCalledWith({
      where,
      skip: 2,
      take: 2,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    expect(tx.product.count).toHaveBeenCalledWith({ where });
    expect(result.meta).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
    expect(prisma.product.findMany).not.toHaveBeenCalled();
  });

  it('returns zero pages for empty results', async () => {
    tx.product.count.mockResolvedValue(0);
    tx.product.findMany.mockResolvedValue([]);
    expect(
      await service.findAll(companyId, new ListProductsDto()),
    ).toMatchObject({ data: [], meta: { total: 0, totalPages: 0 } });
  });

  it('reads only an ID within the authenticated company', async () => {
    await service.findOne(product.id, companyId);
    expect(tx.product.findFirst).toHaveBeenCalledWith({
      where: { id: product.id, companyId },
    });
  });

  it('returns 404 for missing/foreign product', async () => {
    tx.product.findFirst.mockResolvedValue(null);
    await expect(service.findOne('foreign', companyId)).rejects.toThrow(
      NotFoundException,
    );
    await expect(
      service.update('foreign', companyId, { version: 1 }),
    ).rejects.toThrow(NotFoundException);
    expect(tx.product.updateMany).not.toHaveBeenCalled();
  });

  it('updates atomically by id/company/version and increments version without touching stock', async () => {
    tx.product.findFirst
      .mockResolvedValueOnce(product)
      .mockResolvedValueOnce({ ...product, version: 2 });
    expect(
      await service.update(product.id, companyId, {
        version: 1,
        isActive: false,
      }),
    ).toMatchObject({ version: 2 });
    const [args] = tx.product.updateMany.mock.calls[0] as [
      {
        where: unknown;
        data: Record<string, unknown>;
      },
    ];
    expect(args.where).toEqual({ id: product.id, companyId, version: 1 });
    expect(args.data.version).toEqual({ increment: 1 });
    expect(args.data).not.toHaveProperty('stockQuantity');
    expect(args.data).not.toHaveProperty('companyId');
    expect(prisma.product.updateMany).not.toHaveBeenCalled();
  });

  it('returns 409 for stale version', async () => {
    tx.product.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.update(product.id, companyId, { version: 1 }),
    ).rejects.toThrow(ConflictException);
  });

  it('returns 404 if removed between lookup and update', async () => {
    tx.product.updateMany.mockResolvedValue({ count: 0 });
    tx.product.findFirst
      .mockResolvedValueOnce(product)
      .mockResolvedValueOnce(null);
    await expect(
      service.update(product.id, companyId, { version: 1 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('validates a replacement category in the same transaction', async () => {
    tx.category.findFirst.mockResolvedValue(null);
    await expect(
      service.update(product.id, companyId, {
        version: 1,
        categoryId: 'foreign',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(tx.product.updateMany).not.toHaveBeenCalled();
  });

  it('maps duplicate code on update to conflict', async () => {
    tx.product.updateMany.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.update(product.id, companyId, {
        version: 1,
        internalCode: 'existing',
      }),
    ).rejects.toThrow(ConflictException);
  });
});
