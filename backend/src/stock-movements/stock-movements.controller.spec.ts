import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/authenticated-request.interface';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import { StockMovementType, UserRole } from '../generated/prisma/enums';
import { StockMovementsService } from './stock-movements.service';
import { StockMovementsController } from './stock-movements.controller';
import { ListStockMovementsDto } from './dto/list-stock-movements.dto';

describe('StockMovementsController', () => {
  const service = { create: jest.fn(), findAll: jest.fn(), findOne: jest.fn() };
  const controller = new StockMovementsController(
    service as unknown as StockMovementsService,
  );
  const req = {
    user: { companyId: 'tenant', sub: 'actor' },
  } as AuthenticatedRequest;
  beforeEach(() => jest.clearAllMocks());
  it('rejects missing idempotency header before invoking the service', () => {
    expect(() =>
      controller.create(req, undefined, {
        productId: 'product',
        type: StockMovementType.ENTRY,
        quantity: 1,
      }),
    ).toThrow(BadRequestException);
    expect(service.create).not.toHaveBeenCalled();
  });
  it('derives tenant and author only from JWT', async () => {
    const dto = {
      productId: 'product',
      type: StockMovementType.ENTRY,
      quantity: 1,
    };
    await controller.create(req, 'key', dto);
    expect(service.create).toHaveBeenCalledWith('tenant', 'actor', 'key', dto);
  });
  it('passes tenant and filters for list', async () => {
    const query = new ListStockMovementsDto();
    await controller.findAll(req, query);
    expect(service.findAll).toHaveBeenCalledWith('tenant', query);
  });
  it('passes tenant for read', async () => {
    await controller.findOne(req, 'id');
    expect(service.findOne).toHaveBeenCalledWith('id', 'tenant');
  });
  it('requires guards and limits writes to managers and owners', () => {
    expect(
      Reflect.getMetadata('__guards__', StockMovementsController) as unknown,
    ).toEqual([AuthGuard, RolesGuard]);
    expect(
      Reflect.getMetadata(ROLES_KEY, StockMovementsController) as unknown,
    ).toEqual([UserRole.OWNER, UserRole.MANAGER, UserRole.EMPLOYEE]);
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        // Metadata inspection does not invoke the unbound method.
        // eslint-disable-next-line @typescript-eslint/unbound-method
        StockMovementsController.prototype.create,
      ) as unknown,
    ).toEqual([UserRole.OWNER, UserRole.MANAGER]);
  });
});
