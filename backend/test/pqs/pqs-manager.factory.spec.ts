import { describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { NodeConfig } from '../../src/config/node-config.schema';

describe('PqsManagerFactory', () => {
  it('can be constructed by the Nest container without a loader provider', async () => {
    const { PqsManagerFactory } =
      await import('../../src/pqs/pqs-manager.factory');
    const moduleRef = await Test.createTestingModule({
      providers: [PqsManagerFactory],
    }).compile();

    expect(moduleRef.get(PqsManagerFactory)).toBeInstanceOf(PqsManagerFactory);
    await moduleRef.close();
  });

  it('caches the PQS manager and disposes it once on shutdown', async () => {
    const disposeAsync = jest
      .fn<() => Promise<void>>()
      .mockResolvedValue(undefined);
    const createManager = jest.fn().mockReturnValue({
      query: { $queryRaw: jest.fn() },
      disposeAsync,
    });
    const { PqsManagerFactory } =
      await import('../../src/pqs/pqs-manager.factory');
    const factory = new PqsManagerFactory(
      async () =>
        ({
          CantonManager: createManager,
          CantonClientOptions: class {},
          QuerySource: { pqs: 'pqs' },
          TransportKind: { grpc: 'grpc' },
        }) as never,
    );
    const node = {
      id: 'pqs-only',
      label: 'PQS only',
      role: 'participant',
      mode: 'pqs_only',
      pqs: { connectionUriEnv: 'PQS_TEST_URL', schema: 'public' },
    } as NodeConfig;
    const originalUrl = process.env.PQS_TEST_URL;
    process.env.PQS_TEST_URL = 'postgres://example';

    try {
      expect(await factory.getPqsQuery(node)).toBe(
        await factory.getPqsQuery(node),
      );
      expect(createManager).toHaveBeenCalledTimes(1);

      await factory.onModuleDestroy();

      expect(disposeAsync).toHaveBeenCalledTimes(1);
    } finally {
      if (originalUrl === undefined) {
        delete process.env.PQS_TEST_URL;
      } else {
        process.env.PQS_TEST_URL = originalUrl;
      }
    }
  });

  it('executes compatibility raw queries through the SDK query client', async () => {
    const queryRaw = jest
      .fn<
        (
          sql: string,
          values: readonly unknown[],
        ) => Promise<readonly { id: string }[]>
      >()
      .mockResolvedValue([{ id: 'row-1' }]);
    const { PqsManagerFactory } =
      await import('../../src/pqs/pqs-manager.factory');
    const factory = new PqsManagerFactory(
      async () =>
        ({
          CantonManager: jest.fn().mockReturnValue({
            query: { $queryRaw: queryRaw },
            disposeAsync: jest.fn(),
          }),
          CantonClientOptions: class {},
          QuerySource: { pqs: 'pqs' },
          TransportKind: { grpc: 'grpc' },
        }) as never,
    );
    const node = {
      id: 'pqs-only',
      label: 'PQS only',
      role: 'participant',
      mode: 'pqs_only',
      pqs: { connectionUriEnv: 'PQS_TEST_URL' },
    } as NodeConfig;
    const originalUrl = process.env.PQS_TEST_URL;
    process.env.PQS_TEST_URL = 'postgres://example';

    try {
      await expect(
        (await factory.getRawExecutor(node)).query(
          'select id from things where id = $1',
          ['row-1'],
        ),
      ).resolves.toEqual({ rows: [{ id: 'row-1' }] });
      expect(queryRaw).toHaveBeenCalledWith(
        'select id from things where id = $1',
        ['row-1'],
      );
    } finally {
      if (originalUrl === undefined) {
        delete process.env.PQS_TEST_URL;
      } else {
        process.env.PQS_TEST_URL = originalUrl;
      }
    }
  });

  it('resolves the direct PQS connection used by the index installer', async () => {
    const { PqsManagerFactory } =
      await import('../../src/pqs/pqs-manager.factory');
    const factory = new PqsManagerFactory();
    const node = {
      id: 'pqs-only',
      label: 'PQS only',
      role: 'participant',
      mode: 'pqs_only',
      pqs: { connectionUriEnv: 'PQS_INDEX_TEST_URL', schema: 'client_pqs' },
    } as NodeConfig;
    const originalUrl = process.env.PQS_INDEX_TEST_URL;
    process.env.PQS_INDEX_TEST_URL = 'postgres://index-owner@database/pqs';

    try {
      expect(factory.getPqsConnection(node)).toEqual({
        connectionString: 'postgres://index-owner@database/pqs',
        schema: 'client_pqs',
      });
    } finally {
      if (originalUrl === undefined) {
        delete process.env.PQS_INDEX_TEST_URL;
      } else {
        process.env.PQS_INDEX_TEST_URL = originalUrl;
      }
    }
  });
});
