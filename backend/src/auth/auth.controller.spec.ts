import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  const authServiceMock = {
    login: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delegate login to AuthService', async () => {
    const dto = {
      email: 'usuario@empresa.com',
      password: 'SenhaTeste123!',
    };

    const result = {
      accessToken: 'jwt-token',
      user: {
        id: '123e4567-e89b-42d3-a456-426614174000',
        companyId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Usuário Teste',
        email: 'usuario@empresa.com',
        role: 'OWNER',
      },
    };

    authServiceMock.login.mockResolvedValue(result);

    await expect(controller.login(dto)).resolves.toEqual(result);

    expect(authServiceMock.login).toHaveBeenCalledWith(dto);
  });
});
