import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private readonly publicUserSelect = {
    id: true,
    companyId: true,
    name: true,
    email: true,
    role: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto & { companyId: string }) {
    const { password, ...userData } = createUserDto;

    await this.ensureCompanyExists(userData.companyId);

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    });

    try {
      return await this.prisma.user.create({
        data: {
          ...userData,
          passwordHash,
        },
        select: this.publicUserSelect,
      });
    } catch (error: unknown) {
      this.handlePrismaError(error);
    }
  }

  async findAll(companyId: string) {
    await this.ensureCompanyExists(companyId);

    return this.prisma.user.findMany({
      where: {
        companyId,
      },
      select: this.publicUserSelect,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string, companyId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        companyId,
      },
      select: this.publicUserSelect,
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    return user;
  }

  async update(id: string, companyId: string, updateUserDto: UpdateUserDto) {
    await this.findOne(id, companyId);

    const { password, ...userData } = updateUserDto;

    const passwordHash = password
      ? await argon2.hash(password, {
          type: argon2.argon2id,
        })
      : undefined;

    try {
      return await this.prisma.user.update({
        where: {
          id,
        },
        data: {
          ...userData,
          ...(passwordHash ? { passwordHash } : {}),
        },
        select: this.publicUserSelect,
      });
    } catch (error: unknown) {
      this.handlePrismaError(error);
    }
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);

    return this.prisma.user.update({
      where: {
        id,
      },
      data: {
        isActive: false,
      },
      select: this.publicUserSelect,
    });
  }

  private async ensureCompanyExists(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: {
        id: companyId,
      },
      select: {
        id: true,
      },
    });

    if (!company) {
      throw new NotFoundException('Empresa não encontrada.');
    }
  }

  private handlePrismaError(error: unknown): never {
    if (this.hasPrismaErrorCode(error, 'P2002')) {
      throw new ConflictException(
        'Já existe um usuário cadastrado com este e-mail.',
      );
    }

    if (this.hasPrismaErrorCode(error, 'P2003')) {
      throw new NotFoundException('Empresa não encontrada.');
    }

    throw error;
  }

  private hasPrismaErrorCode(error: unknown, code: string): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === code
    );
  }
}
