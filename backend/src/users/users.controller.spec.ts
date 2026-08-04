import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '../generated/prisma/enums';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;

  const usersServiceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

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
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delegate user creation to the service', async () => {
    const dto = {
      companyId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Usuário Teste',
      email: 'usuario@empresa.com',
      password: 'SenhaTeste123!',
      role: UserRole.OWNER,
    };

    const user = {
      id: '123e4567-e89b-42d3-a456-426614174000',
      companyId: dto.companyId,
      name: dto.name,
      email: dto.email,
      role: dto.role,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    usersServiceMock.create.mockResolvedValue(user);

    await expect(controller.create(dto)).resolves.toEqual(user);

    expect(usersServiceMock.create).toHaveBeenCalledWith(dto);
  });

  it('should delegate company user listing to the service', async () => {
    const companyId = '550e8400-e29b-41d4-a716-446655440000';

    usersServiceMock.findAll.mockResolvedValue([]);

    await expect(controller.findAll(companyId)).resolves.toEqual([]);

    expect(usersServiceMock.findAll).toHaveBeenCalledWith(companyId);
  });
});
