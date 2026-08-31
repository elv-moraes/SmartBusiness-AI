import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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

  it('should return 429 when login rate limit is exceeded', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [
            {
              ttl: 60_000,
              limit: 100,
            },
          ],
        }),
      ],
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
        {
          provide: APP_GUARD,
          useClass: ThrottlerGuard,
        },
      ],
    }).compile();

    const app: INestApplication<App> = module.createNestApplication();
    await app.init();

    try {
      authServiceMock.login.mockResolvedValue({
        accessToken: 'jwt-token',
        user: {
          id: '123e4567-e89b-42d3-a456-426614174000',
          companyId: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Usuario Teste',
          email: 'usuario@empresa.com',
          role: 'OWNER',
        },
      });

      const payload = {
        email: 'usuario@empresa.com',
        password: 'SenhaTeste123!',
      };

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send(payload)
          .expect(201);
      }

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(payload)
        .expect(429);
    } finally {
      await app.close();
    }
  });
});
