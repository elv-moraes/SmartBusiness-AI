import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, createCategoryDto: CreateCategoryDto) {
    try {
      return await this.prisma.category.create({
        data: {
          companyId,
          name: createCategoryDto.name,
        },
      });
    } catch (error: unknown) {
      this.handlePrismaError(error);
    }
  }

  findAll(companyId: string) {
    return this.prisma.category.findMany({
      where: {
        companyId,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findOne(id: string, companyId: string) {
    const category = await this.prisma.category.findFirst({
      where: {
        id,
        companyId,
      },
    });

    if (!category) {
      throw new NotFoundException('Categoria não encontrada.');
    }

    return category;
  }

  async update(
    id: string,
    companyId: string,
    updateCategoryDto: UpdateCategoryDto,
  ) {
    try {
      const result = await this.prisma.category.updateMany({
        where: {
          id,
          companyId,
        },
        data: updateCategoryDto,
      });

      if (result.count === 0) {
        throw new NotFoundException('Categoria não encontrada.');
      }

      return this.findOne(id, companyId);
    } catch (error: unknown) {
      this.handlePrismaError(error);
    }
  }

  async remove(id: string, companyId: string): Promise<void> {
    const result = await this.prisma.category.deleteMany({
      where: {
        id,
        companyId,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Categoria não encontrada.');
    }
  }

  private handlePrismaError(error: unknown): never {
    if (this.hasPrismaErrorCode(error, 'P2002')) {
      throw new ConflictException(
        'Já existe uma categoria cadastrada com este nome nesta empresa.',
      );
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
