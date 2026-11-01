import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { StockMovementType } from '../../generated/prisma/enums';

function integerQuery({ value }: { value: unknown }): unknown {
  return typeof value === 'string' && /^\d+$/.test(value)
    ? Number(value)
    : value;
}

export class ListStockMovementsDto {
  @Transform(integerQuery)
  @IsInt()
  @Min(1)
  @Max(21474836)
  page = 1;

  @Transform(integerQuery)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUUID('4')
  productId?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(StockMovementType)
  type?: StockMovementType;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  startDate?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  endDate?: string;
}
