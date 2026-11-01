import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class IdempotencyKeyPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    if (typeof value !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(value)) {
      throw new BadRequestException(
        'Idempotency-Key obrigatório: 1–128 caracteres ASCII sem espaços.',
      );
    }
    return value;
  }
}
