import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { MAX_QUANTITY, MONEY_PATTERN, trimString } from './product-validation';

export class UpdateProductDto {
  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY - 1)
  version: number;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUUID('4')
  categoryId?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ValidateIf(
    (_object, value: unknown) => value !== undefined && value !== null,
  )
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  internalCode?: string | null;

  @ValidateIf(
    (_object, value: unknown) => value !== undefined && value !== null,
  )
  @IsString()
  @Matches(MONEY_PATTERN)
  purchasePrice?: string | null;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Matches(MONEY_PATTERN)
  salePrice?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(MAX_QUANTITY)
  minimumStock?: number;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
}
