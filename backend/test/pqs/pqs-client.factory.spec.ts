import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { NodeConfig } from '../../src/config/node-config.schema';

const poolInstances: Array<{ on: jest.Mock }> = [];

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => {
    const instance = {
      on: jest.fn(),
    };
    poolInstances.push(instance);
    return instance;
  }),
}));

describe('PqsClientFactory', () => {
  const originalEnv = process.env.CNQS_PQS_TEST_URL;

  beforeEach(() => {
    poolInstances.length = 0;
    process.env.CNQS_PQS_TEST_URL = 'postgres://cnadmin@localhost:5432/participant-sv';
  });

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    if (originalEnv === undefined) {
      delete process.env.CNQS_PQS_TEST_URL;
    } else {
      process.env.CNQS_PQS_TEST_URL = originalEnv;
    }
  });

  it('registers a pool error handler and reuses the cached pool', async () => {
    const { PqsClientFactory } = await import('../../src/pqs/pqs-client.factory');
    const factory = new PqsClientFactory();
    const node = {
      id: 'cnqs-sv',
      label: 'CNQS Super Validator',
      role: 'participant',
      mode: 'pqs_only',
      ledgerLabel: 'Quickstart Super Validator',
      pqs: {
        connectionUriEnv: 'CNQS_PQS_TEST_URL',
      },
    } as NodeConfig;

    const first = factory.getClient(node);
    const second = factory.getClient(node);

    expect(first).toBe(second);
    expect(poolInstances).toHaveLength(1);
    expect(poolInstances[0].on).toHaveBeenCalledWith('error', expect.any(Function));
  });
});
