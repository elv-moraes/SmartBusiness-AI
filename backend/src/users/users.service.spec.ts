import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { UserRole } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

jest.mock('argon2', () => ({
  argon2id: 2,
  hash: jest.fn(),
  verify: jest.fn(),
}));

describe('UsersService', () => {
  let service: UsersService;

  const argon2Mock = argon2 as unknown as {
    argon2id: number;
    hash: jest.Mock;
  };

  const prismaServiceMock = {
    company: {
      findUnique: jest.fn(),
    },
    user: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const companyId = '550e8400-e29b-41d4-a716-446655440000';
  const userId = '123e4567-e89b-42d3-a456-426614174000';

  const publicUser = {
    id: userId,
    companyId,
    name: 'Usuário Teste',
    email: 'usuario@empresa.com',
    role: UserRole.OWNER,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a user with a password hash', async () => {
    const dto = {
      companyId,
      name: 'Usuário Teste',
      email: 'usuario@empresa.com',
      password: 'SenhaTeste123!',
      role: UserRole.OWNER,
    };

    prismaServiceMock.company.findUnique.mockResolvedValue({
      id: companyId,
    });

    argon2Mock.hash.mockResolvedValue('hashed-password');
    prismaServiceMock.user.create.mockResolvedValue(publicUser);

    await expect(service.create(dto)).resolves.toEqual(publicUser);

    expect(argon2Mock.hash).toHaveBeenCalledWith(dto.password, {
      type: argon2Mock.argon2id,
    });

    expect(prismaServiceMock.user.create).toHaveBeenCalledWith({
      data: {
        companyId,
        name: dto.name,
        email: dto.email,
        role: dto.role,
        passwordHash: 'hashed-password',
      },
      select: {
        id: true,
        companyId: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it('should reject user creation when company does not exist', async () => {
    prismaServiceMock.company.findUnique.mockResolvedValue(null);

    await expect(
      service.create({
        companyId,
        name: 'Usuário Teste',
        email: 'usuario@empresa.com',
        password: 'SenhaTeste123!',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(argon2Mock.hash).not.toHaveBeenCalled();
    expect(prismaServiceMock.user.create).not.toHaveBeenCalled();
  });

  it('should throw ConflictException for duplicated email', async () => {
    prismaServiceMock.company.findUnique.mockResolvedValue({
      id: companyId,
    });

    argon2Mock.hash.mockResolvedValue('hashed-password');

    prismaServiceMock.user.create.mockRejectedValue({
      code: 'P2002',
    });

    await expect(
      service.create({
        companyId,
        name: 'Usuário Teste',
        email: 'usuario@empresa.com',
        password: 'SenhaTeste123!',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should list only users from the informed company', async () => {
    prismaServiceMock.company.findUnique.mockResolvedValue({
      id: companyId,
    });

    prismaServiceMock.user.findMany.mockResolvedValue([publicUser]);

    await expect(service.findAll(companyId)).resolves.toEqual([publicUser]);

    expect(prismaServiceMock.user.findMany).toHaveBeenCalledWith({
      where: {
        companyId,
      },
      select: {
        id: true,
        companyId: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  });

  it('should throw NotFoundException when user does not exist', async () => {
    prismaServiceMock.user.findFirst.mockResolvedValue(null);

    await expect(service.findOne(userId, companyId)).rejects.toThrow(
      NotFoundException,
    );

    expect(prismaServiceMock.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: userId,
        companyId,
      },
      select: {
        id: true,
        companyId: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it('should hash a new password when updating a user', async () => {
    prismaServiceMock.user.findFirst.mockResolvedValue(publicUser);
    argon2Mock.hash.mockResolvedValue('new-password-hash');

    const updatedUser = {
      ...publicUser,
      name: 'Usuário Atualizado',
    };

    prismaServiceMock.user.update.mockResolvedValue(updatedUser);

    await expect(
      service.update(userId, companyId, {
        name: 'Usuário Atualizado',
        password: 'NovaSenha123!',
      }),
    ).resolves.toEqual(updatedUser);

    expect(prismaServiceMock.user.update).toHaveBeenCalledWith({
      where: {
        id: userId,
      },
      data: {
        name: 'Usuário Atualizado',
        passwordHash: 'new-password-hash',
      },
      select: {
        id: true,
        companyId: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it('should deactivate the user instead of deleting it', async () => {
    prismaServiceMock.user.findFirst.mockResolvedValue(publicUser);

    const inactiveUser = {
      ...publicUser,
      isActive: false,
    };

    prismaServiceMock.user.update.mockResolvedValue(inactiveUser);

    await expect(service.remove(userId, companyId)).resolves.toEqual(
      inactiveUser,
    );

    expect(prismaServiceMock.user.update).toHaveBeenCalledWith({
      where: {
        id: userId,
      },
      data: {
        isActive: false,
      },
      select: {
        id: true,
        companyId: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });
});
