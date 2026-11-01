import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateProductDto } from './create-product.dto';
import { UpdateProductDto } from './update-product.dto';
import { ListProductsDto } from './list-products.dto';

describe('Products DTO contract', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const valid = {
    name: 'Produto',
    categoryId: '550e8400-e29b-41d4-a716-446655440000',
    salePrice: '0.10',
  };
  it('trims names and codes without converting money to numbers', async () => {
    expect(
      await pipe.transform(
        { ...valid, name: ' Produto ', internalCode: ' X ' },
        { type: 'body', metatype: CreateProductDto },
      ),
    ).toMatchObject({ name: 'Produto', internalCode: 'X', salePrice: '0.10' });
  });
  it.each([
    { salePrice: -1 },
    { salePrice: 0.1 },
    { salePrice: '-1.00' },
    { salePrice: '1.001' },
    { salePrice: '1e3' },
    { salePrice: '10000000000.00' },
    { salePrice: null },
    { purchasePrice: '-1' },
    { minimumStock: -1 },
    { minimumStock: 1.5 },
    { minimumStock: null },
    { isActive: null },
    { name: null },
    { internalCode: '  ' },
    { companyId: 'bad' },
    { stockQuantity: 1 },
    { createdAt: 'now' },
    { updatedAt: 'now' },
    { version: 1 },
  ])('rejects invalid creation %j', async (invalid) => {
    await expect(
      pipe.transform(
        { ...valid, ...invalid },
        { type: 'body', metatype: CreateProductDto },
      ),
    ).rejects.toThrow(BadRequestException);
  });
  it.each([
    { version: undefined },
    { version: 0 },
    { version: '1' },
    { version: null },
    { salePrice: null },
    { categoryId: null },
    { stockQuantity: 3 },
    { companyId: 'x' },
    { createdAt: 'x' },
    { updatedAt: 'x' },
  ])('rejects invalid update %j', async (invalid) => {
    await expect(
      pipe.transform(
        { version: 1, ...invalid },
        { type: 'body', metatype: UpdateProductDto },
      ),
    ).rejects.toThrow(BadRequestException);
  });
  it('allows explicit null only for nullable code and purchase price', async () => {
    expect(
      await pipe.transform(
        { version: 1, internalCode: null, purchasePrice: null },
        { type: 'body', metatype: UpdateProductDto },
      ),
    ).toMatchObject({ internalCode: null, purchasePrice: null });
  });
  it('parses false correctly and applies pagination defaults', async () => {
    expect(
      await pipe.transform(
        { isActive: 'false' },
        { type: 'query', metatype: ListProductsDto },
      ),
    ).toMatchObject({ isActive: false, page: 1, limit: 20 });
  });
  it.each([
    { page: '0' },
    { limit: '101' },
    { page: '1.5' },
    { page: '1e3' },
    { isActive: 'yes' },
    { categoryId: 'bad' },
    { companyId: 'bad' },
  ])('rejects invalid filters %j', async (query) => {
    await expect(
      pipe.transform(query, { type: 'query', metatype: ListProductsDto }),
    ).rejects.toThrow(BadRequestException);
  });
});
