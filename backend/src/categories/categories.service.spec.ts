import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriesService } from './categories.service';

describe('CategoriesService', () => {
  let service: CategoriesService;

  const prismaServiceMock = {
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

  it('should create a category with companyId received separately', async () => {
    const dto = {
      name: 'Bebidas',
    };

    prismaServiceMock.category.create.mockResolvedValue(category);

    await expect(service.create(companyId, dto)).resolves.toEqual(category);

    expect(prismaServiceMock.category.create).toHaveBeenCalledWith({
      data: {
        companyId,
        name: dto.name,
      },
    });
  });

  it('should throw ConflictException when creating a duplicated category name', async () => {
    prismaServiceMock.category.create.mockRejectedValue({
      code: 'P2002',
    });

    await expect(
      service.create(companyId, {
        name: 'Bebidas',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should list only categories from the informed company ordered by name', async () => {
    prismaServiceMock.category.findMany.mockResolvedValue([category]);

    await expect(service.findAll(companyId)).resolves.toEqual([category]);

    expect(prismaServiceMock.category.findMany).toHaveBeenCalledWith({
      where: {
        companyId,
      },
      orderBy: {
        name: 'asc',
      },
    });
  });

  it('should find one category by id and companyId', async () => {
    prismaServiceMock.category.findFirst.mockResolvedValue(category);

    await expect(service.findOne(categoryId, companyId)).resolves.toEqual(
      category,
    );

    expect(prismaServiceMock.category.findFirst).toHaveBeenCalledWith({
      where: {
        id: categoryId,
        companyId,
      },
    });
  });

  it('should throw NotFoundException when category does not exist', async () => {
    prismaServiceMock.category.findFirst.mockResolvedValue(null);

    await expect(service.findOne(categoryId, companyId)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should not access a category from another company', async () => {
    prismaServiceMock.category.findFirst.mockResolvedValue(null);

    await expect(service.findOne(categoryId, otherCompanyId)).rejects.toThrow(
      NotFoundException,
    );

    expect(prismaServiceMock.category.findFirst).toHaveBeenCalledWith({
      where: {
        id: categoryId,
        companyId: otherCompanyId,
      },
    });
  });

  it('should update a category scoped by id and companyId', async () => {
    const updatedCategory = {
      ...category,
      name: 'Alimentos',
    };

    prismaServiceMock.category.updateMany.mockResolvedValue({
      count: 1,
    });
    prismaServiceMock.category.findFirst.mockResolvedValue(updatedCategory);

    await expect(
      service.update(categoryId, companyId, {
        name: 'Alimentos',
      }),
    ).resolves.toEqual(updatedCategory);

    expect(prismaServiceMock.category.updateMany).toHaveBeenCalledWith({
      where: {
        id: categoryId,
        companyId,
      },
      data: {
        name: 'Alimentos',
      },
    });
  });

  it('should throw NotFoundException when updating a category from another company', async () => {
    prismaServiceMock.category.updateMany.mockResolvedValue({
      count: 0,
    });

    await expect(
      service.update(categoryId, otherCompanyId, {
        name: 'Alimentos',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(prismaServiceMock.category.findFirst).not.toHaveBeenCalled();
  });

  it('should throw ConflictException when renaming to a duplicated name', async () => {
    prismaServiceMock.category.updateMany.mockRejectedValue({
      code: 'P2002',
    });

    await expect(
      service.update(categoryId, companyId, {
        name: 'Bebidas',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should remove a category scoped by id and companyId', async () => {
    prismaServiceMock.category.deleteMany.mockResolvedValue({
      count: 1,
    });

    await expect(
      service.remove(categoryId, companyId),
    ).resolves.toBeUndefined();

    expect(prismaServiceMock.category.deleteMany).toHaveBeenCalledWith({
      where: {
        id: categoryId,
        companyId,
      },
    });
  });

  it('should throw NotFoundException when removing a category from another company', async () => {
    prismaServiceMock.category.deleteMany.mockResolvedValue({
      count: 0,
    });

    await expect(service.remove(categoryId, otherCompanyId)).rejects.toThrow(
      NotFoundException,
    );
  });
});
