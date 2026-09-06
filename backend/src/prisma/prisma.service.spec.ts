import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  const companyId = '550e8400-e29b-41d4-a716-446655440000';

  const configServiceMock = {
    getOrThrow: jest.fn().mockReturnValue('postgresql://localhost/test'),
  } as unknown as ConfigService;

  let service: PrismaService;
  let txMock: {
    $queryRaw: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new PrismaService(configServiceMock);
    txMock = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          set_config: companyId,
        },
      ]),
    };
  });

  it('should open an interactive transaction and return the callback result', async () => {
    const result = { ok: true };
    const callback = jest.fn().mockResolvedValue(result);
    const transactionSpy = jest
      .spyOn(service, '$transaction')
      .mockImplementation((handler: never) => {
        return (handler as (tx: typeof txMock) => Promise<typeof result>)(
          txMock,
        );
      });

    await expect(
      service.withCompanyContext(companyId, callback),
    ).resolves.toEqual(result);

    expect(transactionSpy).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(txMock);
  });

  it('should configure app.company_id locally before running the callback query', async () => {
    const calls: string[] = [];
    txMock.$queryRaw.mockImplementation(() => {
      calls.push('set_config');
      return Promise.resolve([
        {
          set_config: companyId,
        },
      ]);
    });
    const callback = jest.fn().mockImplementation(() => {
      calls.push('callback');
      return Promise.resolve('done');
    });
    jest.spyOn(service, '$transaction').mockImplementation((handler) => {
      return (handler as (tx: typeof txMock) => Promise<string>)(txMock);
    });

    await expect(service.withCompanyContext(companyId, callback)).resolves.toBe(
      'done',
    );

    expect(calls).toEqual(['set_config', 'callback']);
  });

  it('should use a tagged, parameterized set_config call with transaction-local scope', async () => {
    jest.spyOn(service, '$transaction').mockImplementation((handler) => {
      return (handler as (tx: typeof txMock) => Promise<void>)(txMock);
    });

    await service.withCompanyContext(companyId, () =>
      Promise.resolve(undefined),
    );

    expect(txMock.$queryRaw).toHaveBeenCalledTimes(1);

    const [strings, parameterizedCompanyId] = txMock.$queryRaw.mock
      .calls[0] as [TemplateStringsArray, string];

    expect(Array.from(strings).join('?')).toBe(
      "SELECT set_config('app.company_id', ?, true)",
    );
    expect(parameterizedCompanyId).toBe(companyId);
  });

  it('should pass the same TransactionClient to set_config and callback', async () => {
    let transactionClientSeenByTransaction: typeof txMock | undefined;
    const callback = jest.fn().mockResolvedValue('ok');

    jest.spyOn(service, '$transaction').mockImplementation((handler) => {
      transactionClientSeenByTransaction = txMock;
      return (handler as (tx: typeof txMock) => Promise<string>)(txMock);
    });

    await service.withCompanyContext(companyId, callback);

    expect(txMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(transactionClientSeenByTransaction);
  });

  it('should propagate callback errors through the Prisma transaction', async () => {
    const error = new Error('callback failed');
    const transactionSpy = jest
      .spyOn(service, '$transaction')
      .mockImplementation((handler) => {
        return (handler as (tx: typeof txMock) => Promise<never>)(txMock);
      });

    await expect(
      service.withCompanyContext(companyId, () => Promise.reject(error)),
    ).rejects.toThrow(error);

    expect(transactionSpy).toHaveBeenCalledTimes(1);
    expect(txMock.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
