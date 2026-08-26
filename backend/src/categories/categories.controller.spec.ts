import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request.interface';
import { ROLES_KEY } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../generated/prisma/enums';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

describe('CategoriesController', () => {
  let controller: CategoriesController;

  const categoriesServiceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const companyId = '550e8400-e29b-41d4-a716-446655440000';
  const userId = '123e4567-e89b-42d3-a456-426614174000';
  const categoryId = '323e4567-e89b-42d3-a456-426614174000';

  const request = {
    user: {
      sub: userId,
      companyId,
      role: UserRole.OWNER,
    },
  } as unknown as AuthenticatedRequest;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        {
          provide: CategoriesService,
          useValue: categoriesServiceMock,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: () => true,
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: () => true,
      })
      .compile();

    controller = module.get<CategoriesController>(CategoriesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delegate category creation using companyId from JWT', async () => {
    const dto = {
      name: 'Bebidas',
    };

    const result = {
      id: categoryId,
      companyId,
      name: dto.name,
    };

    categoriesServiceMock.create.mockResolvedValue(result);

    await expect(controller.create(request, dto)).resolves.toEqual(result);

    expect(categoriesServiceMock.create).toHaveBeenCalledWith(companyId, dto);
  });

  it('should delegate category listing using companyId from JWT', async () => {
    const result = [
      {
        id: categoryId,
        companyId,
        name: 'Bebidas',
      },
    ];

    categoriesServiceMock.findAll.mockResolvedValue(result);

    await expect(controller.findAll(request)).resolves.toEqual(result);

    expect(categoriesServiceMock.findAll).toHaveBeenCalledWith(companyId);
  });

  it('should delegate category lookup using id and companyId from JWT', async () => {
    const result = {
      id: categoryId,
      companyId,
      name: 'Bebidas',
    };

    categoriesServiceMock.findOne.mockResolvedValue(result);

    await expect(controller.findOne(request, categoryId)).resolves.toEqual(
      result,
    );

    expect(categoriesServiceMock.findOne).toHaveBeenCalledWith(
      categoryId,
      companyId,
    );
  });

  it('should delegate category update using id and companyId from JWT', async () => {
    const dto = {
      name: 'Alimentos',
    };

    const result = {
      id: categoryId,
      companyId,
      name: dto.name,
    };

    categoriesServiceMock.update.mockResolvedValue(result);

    await expect(controller.update(request, categoryId, dto)).resolves.toEqual(
      result,
    );

    expect(categoriesServiceMock.update).toHaveBeenCalledWith(
      categoryId,
      companyId,
      dto,
    );
  });

  it('should delegate category removal using id and companyId from JWT', async () => {
    categoriesServiceMock.remove.mockResolvedValue(undefined);

    await expect(
      controller.remove(request, categoryId),
    ).resolves.toBeUndefined();

    expect(categoriesServiceMock.remove).toHaveBeenCalledWith(
      categoryId,
      companyId,
    );
  });

  it('should require OWNER and MANAGER roles for create', () => {
    expect(getRolesMetadata('create')).toEqual([
      UserRole.OWNER,
      UserRole.MANAGER,
    ]);
  });

  it('should require OWNER and MANAGER roles for update', () => {
    expect(getRolesMetadata('update')).toEqual([
      UserRole.OWNER,
      UserRole.MANAGER,
    ]);
  });

  it('should require OWNER and MANAGER roles for remove', () => {
    expect(getRolesMetadata('remove')).toEqual([
      UserRole.OWNER,
      UserRole.MANAGER,
    ]);
  });

  it('should not require specific roles for findAll and findOne', () => {
    expect(getRolesMetadata('findAll')).toBeUndefined();
    expect(getRolesMetadata('findOne')).toBeUndefined();
  });

  function getRolesMetadata(methodName: keyof CategoriesController) {
    return Reflect.getMetadata(
      ROLES_KEY,
      CategoriesController.prototype[methodName],
    ) as UserRole[] | undefined;
  }
});
