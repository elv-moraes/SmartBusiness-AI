import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { UserRole } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

jest.mock('argon2', () => ({
  verify: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;

  const argon2Mock = argon2 as unknown as {
    verify: jest.Mock;
  };

  const prismaServiceMock = {
    user: {
      findUnique: jest.fn(),
    },
  };

  const jwtServiceMock = {
    signAsync: jest.fn(),
  };

  const user = {
    id: '123e4567-e89b-42d3-a456-426614174000',
    companyId: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Usuário Teste',
    email: 'usuario@empresa.com',
    passwordHash: 'hashed-password',
    role: UserRole.OWNER,
    isActive: true,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
        {
          provide: JwtService,
          useValue: jwtServiceMock,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should login an active user with valid credentials', async () => {
    prismaServiceMock.user.findUnique.mockResolvedValue(user);
    argon2Mock.verify.mockResolvedValue(true);
    jwtServiceMock.signAsync.mockResolvedValue('jwt-token');

    await expect(
      service.login({
        email: 'usuario@empresa.com',
        password: 'SenhaTeste123!',
      }),
    ).resolves.toEqual({
      accessToken: 'jwt-token',
      user: {
        id: user.id,
        companyId: user.companyId,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    expect(argon2Mock.verify).toHaveBeenCalledWith(
      user.passwordHash,
      'SenhaTeste123!',
    );

    expect(jwtServiceMock.signAsync).toHaveBeenCalledWith({
      sub: user.id,
      companyId: user.companyId,
      role: user.role,
    });
  });

  it('should reject login when user does not exist', async () => {
    prismaServiceMock.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({
        email: 'inexistente@empresa.com',
        password: 'SenhaTeste123!',
      }),
    ).rejects.toThrow(UnauthorizedException);

    expect(argon2Mock.verify).not.toHaveBeenCalled();
    expect(jwtServiceMock.signAsync).not.toHaveBeenCalled();
  });

  it('should reject login when user is inactive', async () => {
    prismaServiceMock.user.findUnique.mockResolvedValue({
      ...user,
      isActive: false,
    });

    await expect(
      service.login({
        email: user.email,
        password: 'SenhaTeste123!',
      }),
    ).rejects.toThrow(UnauthorizedException);

    expect(argon2Mock.verify).not.toHaveBeenCalled();
    expect(jwtServiceMock.signAsync).not.toHaveBeenCalled();
  });

  it('should reject login when password is incorrect', async () => {
    prismaServiceMock.user.findUnique.mockResolvedValue(user);
    argon2Mock.verify.mockResolvedValue(false);

    await expect(
      service.login({
        email: user.email,
        password: 'SenhaErrada123!',
      }),
    ).rejects.toThrow(UnauthorizedException);

    expect(jwtServiceMock.signAsync).not.toHaveBeenCalled();
  });
});
