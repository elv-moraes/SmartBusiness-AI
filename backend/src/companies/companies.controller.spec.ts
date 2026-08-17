import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request.interface';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../generated/prisma/enums';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';

describe('CompaniesController', () => {
  let controller: CompaniesController;

  const companiesServiceMock = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const companyId = '550e8400-e29b-41d4-a716-446655440000';
  const userId = '123e4567-e89b-42d3-a456-426614174000';

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
      controllers: [CompaniesController],
      providers: [
        {
          provide: CompaniesService,
          useValue: companiesServiceMock,
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

    controller = module.get<CompaniesController>(CompaniesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should find the authenticated user company using companyId from JWT', async () => {
    const result = {
      id: companyId,
      name: 'Empresa Teste',
      document: null,
      email: 'empresa@teste.com',
      phone: null,
    };

    companiesServiceMock.findOne.mockResolvedValue(result);

    await expect(controller.findCurrent(request)).resolves.toEqual(result);

    expect(companiesServiceMock.findOne).toHaveBeenCalledWith(companyId);
  });

  it('should update the authenticated user company using companyId from JWT', async () => {
    const dto = {
      name: 'Empresa Atualizada',
    };

    const result = {
      id: companyId,
      name: dto.name,
    };

    companiesServiceMock.update.mockResolvedValue(result);

    await expect(controller.updateCurrent(request, dto)).resolves.toEqual(
      result,
    );

    expect(companiesServiceMock.update).toHaveBeenCalledWith(companyId, dto);
  });
});
