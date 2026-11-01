import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Product } from '../generated/prisma/client';
import {
  PrismaService,
  PrismaTransactionClient,
} from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsDto } from './dto/list-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateProductDto) {
    try {
      return await this.prisma.withCompanyContext(companyId, async (tx) => {
        await this.requireCategory(tx, companyId, dto.categoryId);
        const product = await tx.product.create({
          data: {
            companyId,
            categoryId: dto.categoryId,
            name: dto.name,
            internalCode: dto.internalCode,
            purchasePrice: dto.purchasePrice,
            salePrice: dto.salePrice,
            minimumStock: dto.minimumStock,
            isActive: dto.isActive,
            stockQuantity: 0,
          },
        });
        return this.serialize(product);
      });
    } catch (error: unknown) {
      this.handleError(error);
    }
  }

  findAll(companyId: string, query: ListProductsDto) {
    return this.prisma.withCompanyContext(companyId, async (tx) => {
      const where: Prisma.ProductWhereInput = {
        companyId,
        categoryId: query.categoryId,
        isActive: query.isActive,
        ...(query.search
          ? {
              OR: [
                {
                  name: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  internalCode: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
              ],
            }
          : {}),
      };
      const [data, total] = await Promise.all([
        tx.product.findMany({
          where,
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        }),
        tx.product.count({ where }),
      ]);
      return {
        data: data.map((product) => this.serialize(product)),
        meta: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      };
    });
  }

  findOne(id: string, companyId: string) {
    return this.prisma.withCompanyContext(companyId, async (tx) =>
      this.serialize(await this.requireProduct(tx, id, companyId)),
    );
  }

  async update(id: string, companyId: string, dto: UpdateProductDto) {
    try {
      return await this.prisma.withCompanyContext(companyId, async (tx) => {
        // Preserve 404 for foreign IDs even when another supplied field conflicts.
        await this.requireProduct(tx, id, companyId);
        if (dto.categoryId !== undefined)
          await this.requireCategory(tx, companyId, dto.categoryId);
        const result = await tx.product.updateMany({
          where: { id, companyId, version: dto.version },
          data: {
            categoryId: dto.categoryId,
            name: dto.name,
            internalCode: dto.internalCode,
            purchasePrice: dto.purchasePrice,
            salePrice: dto.salePrice,
            minimumStock: dto.minimumStock,
            isActive: dto.isActive,
            version: { increment: 1 },
          },
        });
        if (result.count === 0) {
          await this.requireProduct(tx, id, companyId);
          throw new ConflictException(
            'Versão desatualizada. Recarregue o produto.',
          );
        }
        return this.serialize(await this.requireProduct(tx, id, companyId));
      });
    } catch (error: unknown) {
      this.handleError(error);
    }
  }

  private async requireCategory(
    tx: PrismaTransactionClient,
    companyId: string,
    id: string,
  ) {
    if (
      !(await tx.category.findFirst({
        where: { id, companyId },
        select: { id: true },
      }))
    ) {
      throw new NotFoundException('Categoria não encontrada.');
    }
  }

  private async requireProduct(
    tx: PrismaTransactionClient,
    id: string,
    companyId: string,
  ) {
    const product = await tx.product.findFirst({ where: { id, companyId } });
    if (!product) throw new NotFoundException('Produto não encontrado.');
    return product;
  }

  private serialize(product: Product) {
    return {
      ...product,
      purchasePrice: product.purchasePrice?.toFixed(2) ?? null,
      salePrice: product.salePrice.toFixed(2),
    };
  }

  private handleError(error: unknown): never {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      if (error.code === 'P2002')
        throw new ConflictException(
          'Código interno já cadastrado nesta empresa.',
        );
      if (error.code === 'P2003')
        throw new ConflictException(
          'Categoria indisponível. Recarregue os dados.',
        );
    }
    throw error;
  }
}
