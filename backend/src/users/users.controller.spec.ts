import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request.interface';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../generated/prisma/enums';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;

  const usersServiceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
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
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: usersServiceMock,
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

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delegate user creation using companyId from JWT', async () => {
    const dto = {
      name: 'Usuário Teste',
      email: 'usuario@empresa.com',
      password: 'SenhaTeste123!',
      role: UserRole.EMPLOYEE,
    };

    const result = {
      id: userId,
      companyId,
      name: dto.name,
      email: dto.email,
      role: dto.role,
      isActive: true,
    };

    usersServiceMock.create.mockResolvedValue(result);

    await expect(controller.create(request, dto)).resolves.toEqual(result);

    expect(usersServiceMock.create).toHaveBeenCalledWith({
      ...dto,
      companyId,
    });
  });

  it('should delegate company user listing using companyId from JWT', async () => {
    const result = [
      {
        id: userId,
        companyId,
        name: 'Usuário Teste',
        email: 'usuario@empresa.com',
        role: UserRole.EMPLOYEE,
        isActive: true,
      },
    ];

    usersServiceMock.findAll.mockResolvedValue(result);

    await expect(controller.findAll(request)).resolves.toEqual(result);

    expect(usersServiceMock.findAll).toHaveBeenCalledWith(companyId);
  });
});
