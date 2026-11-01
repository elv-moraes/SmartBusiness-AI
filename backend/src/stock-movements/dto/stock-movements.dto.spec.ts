import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateStockMovementDto } from './create-stock-movement.dto';
import { ListStockMovementsDto } from './list-stock-movements.dto';
import { IdempotencyKeyPipe } from '../idempotency-key.pipe';

describe('StockMovement contract', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const valid = {
    productId: '550e8400-e29b-41d4-a716-446655440000',
    type: 'ENTRY',
    quantity: 1,
  };
  it.each([
    { quantity: 0 },
    { quantity: -1 },
    { quantity: 1.5 },
    { quantity: '1' },
    { quantity: 2147483648 },
    { type: 'SALE' },
    { type: null },
    { productId: 'bad' },
    { note: 3 },
    { note: 'x'.repeat(501) },
    { companyId: 'x' },
    { createdByUserId: 'x' },
    { previousQuantity: 1 },
    { newQuantity: 2 },
    { stockQuantity: 1 },
    { idempotencyKey: 'body-key' },
    { createdAt: 'now' },
  ])('rejects invalid body %j', async (change) => {
    await expect(
      pipe.transform(
        { ...valid, ...change },
        { type: 'body', metatype: CreateStockMovementDto },
      ),
    ).rejects.toThrow(BadRequestException);
  });
  it.each([
    [' note ', 'note'],
    ['  ', null],
    [null, null],
  ])('normalizes note %s', async (note, expected) => {
    expect(
      await pipe.transform(
        { ...valid, note },
        { type: 'body', metatype: CreateStockMovementDto },
      ),
    ).toMatchObject({ note: expected });
  });
  it.each([undefined, null, '', ' ', 'key space', 'x'.repeat(129), ['a', 'b']])(
    'rejects bad idempotency header %j',
    (value) => {
      expect(() => new IdempotencyKeyPipe().transform(value)).toThrow(
        BadRequestException,
      );
    },
  );
  it('accepts a bounded opaque idempotency header', () =>
    expect(new IdempotencyKeyPipe().transform('abc-123')).toBe('abc-123'));
  it.each([
    { page: '0' },
    { limit: '101' },
    { page: '1.5' },
    { type: 'SALE' },
    { productId: 'bad' },
    { startDate: 'yesterday' },
    { endDate: '2026-02-30T00:00:00Z' },
    { startDate: '2026-01-01' },
    { startDate: '2026-01-01T12:00:00' },
    { companyId: 'bad' },
  ])('rejects invalid query %j', async (query) => {
    await expect(
      pipe.transform(query, { type: 'query', metatype: ListStockMovementsDto }),
    ).rejects.toThrow(BadRequestException);
  });
  it('accepts timezone-explicit date range and defaults', async () => {
    expect(
      await pipe.transform(
        { startDate: '2026-01-01T12:00:00-03:00' },
        { type: 'query', metatype: ListStockMovementsDto },
      ),
    ).toMatchObject({ page: 1, limit: 20 });
  });
});
