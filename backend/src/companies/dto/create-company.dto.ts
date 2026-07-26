import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  document?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}
