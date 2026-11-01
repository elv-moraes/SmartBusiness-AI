import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  StockMovement,
  StockMovementType,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateStockMovementDto,
  normalizeNote,
} from './dto/create-stock-movement.dto';
import { ListStockMovementsDto } from './dto/list-stock-movements.dto';

@Injectable()
export class StockMovementsService {
  constructor(private readonly prisma: PrismaService) {}

  create(
    companyId: string,
    createdByUserId: string,
    idempotencyKey: string,
    dto: CreateStockMovementDto,
  ) {
    return this.prisma.withCompanyContext(companyId, async (tx) => {
      // Serialize only replays of this tenant/key. Transaction-scoped locks are
      // released on commit/rollback; hash collisions cause contention, not leaks.
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`${companyId.toLowerCase()}:${idempotencyKey}`}, 0))`;
      const previous = await tx.stockMovement.findFirst({
        where: { companyId, idempotencyKey },
      });
      const note = normalizeNote(dto.note);
      if (previous) {
        this.requireSameCommand(previous, dto, note);
        return previous;
      }

      const outgoing =
        dto.type === StockMovementType.ADJUSTMENT_OUT ||
        dto.type === StockMovementType.LOSS;
      const delta = outgoing ? -dto.quantity : dto.quantity;
      // One UPDATE both checks capacity and changes the balance. RETURNING is
      // the balance protected by this row's write lock, never a stale pre-read.
      const rows = await tx.$queryRaw<{ newQuantity: number }[]>`
        UPDATE public.products
        SET stock_quantity = stock_quantity + ${delta}::integer,
            updated_at = clock_timestamp()
        WHERE id = ${dto.productId}::uuid AND company_id = ${companyId}::uuid
          AND stock_quantity >= ${outgoing ? dto.quantity : 0}::integer
          AND stock_quantity <= ${outgoing ? 2147483647 : 2147483647 - dto.quantity}::integer
        RETURNING stock_quantity AS "newQuantity"
      `;
      if (rows.length === 0) {
        const product = await tx.product.findFirst({
          where: { id: dto.productId, companyId },
          select: { id: true },
        });
        if (!product) throw new NotFoundException('Produto não encontrado.');
        throw new ConflictException(
          outgoing
            ? 'Saldo de estoque insuficiente.'
            : 'Limite de quantidade de estoque excedido.',
        );
      }
      const newQuantity = rows[0].newQuantity;
      return tx.stockMovement.create({
        data: {
          companyId,
          productId: dto.productId,
          type: dto.type,
          quantity: dto.quantity,
          previousQuantity: newQuantity - delta,
          newQuantity,
          note,
          idempotencyKey,
          createdByUserId,
        },
      });
    });
  }

  findAll(companyId: string, query: ListStockMovementsDto) {
    if (
      query.startDate &&
      query.endDate &&
      new Date(query.startDate) > new Date(query.endDate)
    ) {
      throw new BadRequestException(
        'Data inicial deve ser anterior ou igual à data final.',
      );
    }
    return this.prisma.withCompanyContext(companyId, async (tx) => {
      const where: Prisma.StockMovementWhereInput = {
        companyId,
        productId: query.productId,
        type: query.type,
        createdAt: {
          gte: query.startDate ? new Date(query.startDate) : undefined,
          lte: query.endDate ? new Date(query.endDate) : undefined,
        },
      };
      const [data, total] = await Promise.all([
        tx.stockMovement.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        tx.stockMovement.count({ where }),
      ]);
      return {
        data,
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
    return this.prisma.withCompanyContext(companyId, async (tx) => {
      const movement = await tx.stockMovement.findFirst({
        where: { id, companyId },
      });
      if (!movement)
        throw new NotFoundException('Movimentação não encontrada.');
      return movement;
    });
  }

  private requireSameCommand(
    previous: StockMovement,
    dto: CreateStockMovementDto,
    note: string | null,
  ) {
    if (
      previous.productId !== dto.productId.toLowerCase() ||
      previous.type !== dto.type ||
      previous.quantity !== dto.quantity ||
      previous.note !== note
    ) {
      throw new ConflictException(
        'Idempotency-Key já utilizada com outro comando.',
      );
    }
  }
}
