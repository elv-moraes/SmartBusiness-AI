import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriesService } from './categories.service';

describe('CategoriesService', () => {
  let service: CategoriesService;

  const txMock = {
    category: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const prismaServiceMock = {
    withCompanyContext: jest.fn(),
    category: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const companyId = '550e8400-e29b-41d4-a716-446655440000';
  const otherCompanyId = '550e8400-e29b-41d4-a716-446655440001';
  const categoryId = '123e4567-e89b-42d3-a456-426614174000';

  const category = {
    id: categoryId,
    companyId,
    name: 'Bebidas',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prismaServiceMock.withCompanyContext.mockImplementation(
      (_companyId: string, callback: (tx: typeof txMock) => unknown) => {
        return Promise.resolve(callback(txMock));
      },
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a category with companyId received separately using tx', async () => {
    const dto = {
      name: 'Bebidas',
    };

    txMock.category.create.mockResolvedValue(category);

    await expect(service.create(companyId, dto)).resolves.toEqual(category);

    expect(prismaServiceMock.withCompanyContext).toHaveBeenCalledWith(
      companyId,
      expect.any(Function),
    );
    expect(txMock.category.create).toHaveBeenCalledWith({
      data: {
        companyId,
        name: dto.name,
      },
    });
    expect(prismaServiceMock.category.create).not.toHaveBeenCalled();
  });

  it('should throw ConflictException when creating a duplicated category name', async () => {
    txMock.category.create.mockRejectedValue({
      code: 'P2002',
    });

    await expect(
      service.create(companyId, {
        name: 'Bebidas',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should list only categories from the informed company ordered by name using tx', async () => {
    txMock.category.findMany.mockResolvedValue([category]);

    await expect(service.findAll(companyId)).resolves.toEqual([category]);

    expect(prismaServiceMock.withCompanyContext).toHaveBeenCalledWith(
      companyId,
      expect.any(Function),
    );
    expect(txMock.category.findMany).toHaveBeenCalledWith({
      where: {
        companyId,
      },
      orderBy: {
        name: 'asc',
      },
    });
    expect(prismaServiceMock.category.findMany).not.toHaveBeenCalled();
  });

  it('should find one category by id and companyId using tx', async () => {
    txMock.category.findFirst.mockResolvedValue(category);

    await expect(service.findOne(categoryId, companyId)).resolves.toEqual(
      category,
    );

    expect(prismaServiceMock.withCompanyContext).toHaveBeenCalledWith(
      companyId,
      expect.any(Function),
    );
    expect(txMock.category.findFirst).toHaveBeenCalledWith({
      where: {
        id: categoryId,
        companyId,
      },
    });
    expect(prismaServiceMock.category.findFirst).not.toHaveBeenCalled();
  });

  it('should throw NotFoundException when category does not exist', async () => {
    txMock.category.findFirst.mockResolvedValue(null);

    await expect(service.findOne(categoryId, companyId)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should not access a category from another company', async () => {
    txMock.category.findFirst.mockResolvedValue(null);

    await expect(service.findOne(categoryId, otherCompanyId)).rejects.toThrow(
      NotFoundException,
    );

    expect(txMock.category.findFirst).toHaveBeenCalledWith({
      where: {
        id: categoryId,
        companyId: otherCompanyId,
      },
    });
  });

  it('should update a category scoped by id and companyId using tx', async () => {
    const updatedCategory = {
      ...category,
      name: 'Alimentos',
    };

    txMock.category.updateMany.mockResolvedValue({
      count: 1,
    });
    txMock.category.findFirst.mockResolvedValue(updatedCategory);

    await expect(
      service.update(categoryId, companyId, {
        name: 'Alimentos',
      }),
    ).resolves.toEqual(updatedCategory);

    expect(prismaServiceMock.withCompanyContext).toHaveBeenCalledWith(
      companyId,
      expect.any(Function),
    );
    expect(txMock.category.updateMany).toHaveBeenCalledWith({
      where: {
        id: categoryId,
        companyId,
      },
      data: {
        name: 'Alimentos',
      },
    });
    expect(txMock.category.findFirst).toHaveBeenCalledWith({
      where: {
        id: categoryId,
        companyId,
      },
    });
    expect(prismaServiceMock.category.updateMany).not.toHaveBeenCalled();
    expect(prismaServiceMock.category.findFirst).not.toHaveBeenCalled();
  });

  it('should throw NotFoundException when updating a category from another company', async () => {
    txMock.category.updateMany.mockResolvedValue({
      count: 0,
    });

    await expect(
      service.update(categoryId, otherCompanyId, {
        name: 'Alimentos',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(txMock.category.updateMany).toHaveBeenCalledWith({
      where: {
        id: categoryId,
        companyId: otherCompanyId,
      },
      data: {
        name: 'Alimentos',
      },
    });
    expect(txMock.category.findFirst).not.toHaveBeenCalled();
  });

  it('should throw ConflictException when renaming to a duplicated name', async () => {
    txMock.category.updateMany.mockRejectedValue({
      code: 'P2002',
    });

    await expect(
      service.update(categoryId, companyId, {
        name: 'Bebidas',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should remove a category scoped by id and companyId using tx', async () => {
    txMock.category.deleteMany.mockResolvedValue({
      count: 1,
    });

    await expect(
      service.remove(categoryId, companyId),
    ).resolves.toBeUndefined();

    expect(prismaServiceMock.withCompanyContext).toHaveBeenCalledWith(
      companyId,
      expect.any(Function),
    );
    expect(txMock.category.deleteMany).toHaveBeenCalledWith({
      where: {
        id: categoryId,
        companyId,
      },
    });
    expect(prismaServiceMock.category.deleteMany).not.toHaveBeenCalled();
  });

  it('should throw NotFoundException when removing a category from another company', async () => {
    txMock.category.deleteMany.mockResolvedValue({
      count: 0,
    });

    await expect(service.remove(categoryId, otherCompanyId)).rejects.toThrow(
      NotFoundException,
    );

    expect(txMock.category.deleteMany).toHaveBeenCalledWith({
      where: {
        id: categoryId,
        companyId: otherCompanyId,
      },
    });
  });
});
