import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { StockMovementType } from '../../generated/prisma/enums';

export function normalizeNote(note?: string | null): string | null {
  return note?.trim() || null;
}

export class CreateStockMovementDto {
  @IsUUID('4')
  productId: string;

  @IsEnum(StockMovementType)
  type: StockMovementType;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  quantity: number;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeNote(value) : value,
  )
  @ValidateIf(
    (_object, value: unknown) => value !== undefined && value !== null,
  )
  @IsString()
  @MaxLength(500)
  note?: string | null;
}
