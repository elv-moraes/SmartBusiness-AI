import 'reflect-metadata';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { AuthenticatedRequest } from '../auth/authenticated-request.interface';
import { ROLES_KEY } from '../auth/roles.decorator';
import { UserRole } from '../generated/prisma/enums';
import { ListProductsDto } from './dto/list-products.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';

describe('ProductsController', () => {
  const service = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const controller = new ProductsController(
    service as unknown as ProductsService,
  );
  const request = {
    user: { companyId: 'jwt-company' },
  } as AuthenticatedRequest;
  beforeEach(() => jest.clearAllMocks());

  it('delegates creation with tenant from JWT', async () => {
    const dto = { categoryId: 'cat', name: 'Produto', salePrice: '1.00' };
    await controller.create(request, dto);
    expect(service.create).toHaveBeenCalledWith('jwt-company', dto);
  });
  it('delegates list filters with tenant from JWT', async () => {
    const query = new ListProductsDto();
    await controller.findAll(request, query);
    expect(service.findAll).toHaveBeenCalledWith('jwt-company', query);
  });
  it('delegates read with tenant from JWT', async () => {
    await controller.findOne(request, 'id');
    expect(service.findOne).toHaveBeenCalledWith('id', 'jwt-company');
  });
  it('delegates update and version with tenant from JWT', async () => {
    const dto = { version: 1, isActive: false };
    await controller.update(request, 'id', dto);
    expect(service.update).toHaveBeenCalledWith('id', 'jwt-company', dto);
  });
  it.each(['create', 'update'] as const)(
    'limits %s to OWNER and MANAGER',
    (method) => {
      expect(
        Reflect.getMetadata(
          ROLES_KEY,
          ProductsController.prototype[method],
        ) as unknown,
      ).toEqual([UserRole.OWNER, UserRole.MANAGER]);
    },
  );
  it('requires both guards and permits the three roles to read', () => {
    expect(
      Reflect.getMetadata('__guards__', ProductsController) as unknown,
    ).toEqual([AuthGuard, RolesGuard]);
    expect(
      Reflect.getMetadata(ROLES_KEY, ProductsController) as unknown,
    ).toEqual([UserRole.OWNER, UserRole.MANAGER, UserRole.EMPLOYEE]);
  });
});
