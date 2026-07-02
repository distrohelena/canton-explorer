import { describe, expect, it, jest } from '@jest/globals';
import { NodeCacheService } from '../../src/cache/node-cache.service';
import { NodePollerService } from '../../src/orchestrator/node-poller.service';

describe('NodePollerService', () => {
  it('keeps fresh PQS data when gRPC fails for a node', async () => {
    const cache = new NodeCacheService();
    const packageSyncService = {
      syncNodePackagesIfDue: jest.fn().mockResolvedValue(undefined),
    };
    const poller = new NodePollerService(
      { list: () => [] } as never,
      cache,
      {
        fetchSummary: jest.fn().mockResolvedValue({
          ledgerLabel: 'Quickstart App Provider',
          pqsDatabase: 'pqs-app-provider',
          activeContractCount: 9,
          latestOffset: '957',
          latestEventAt: '2026-07-01T22:51:02.433Z',
          totalUpdateCount: 120,
        }),
        fetchActivityBuckets: jest.fn().mockResolvedValue([]),
      } as never,
      {
        fetchOperationalInfo: jest
          .fn()
          .mockRejectedValue(new Error('Failed to connect before the deadline')),
      } as never,
      packageSyncService as never,
    );

    await poller['refreshNode']({
      id: 'cnqs-app-provider',
      label: 'CNQS App Provider',
      role: 'participant',
      ledgerLabel: 'Quickstart App Provider',
      pqs: { connectionUriEnv: 'CNQS_PQS_APP_PROVIDER_URL' },
      grpc: { target: 'localhost:3961', useTls: false, connectTimeoutMs: 5000 },
      polling: { intervalMs: 15000, staleAfterMs: 45000 },
    });

    expect(cache.get('cnqs-app-provider')).toEqual(
      expect.objectContaining({
        status: 'degraded',
        lastSuccessAt: expect.any(String),
        lastErrorAt: expect.any(String),
        errorSummary: expect.stringContaining('gRPC: Failed to connect before the deadline'),
        ledgerSummary: expect.objectContaining({
          pqsDatabase: 'pqs-app-provider',
          activeContractCount: 9,
        }),
        serviceInfo: {
          target: 'localhost:3961',
          reachable: false,
          healthCheckImplemented: false,
          servingStatus: null,
        },
        sourceStatus: {
          pqs: expect.objectContaining({
            ok: true,
            message: null,
          }),
          grpc: expect.objectContaining({
            ok: false,
            message: 'Failed to connect before the deadline',
          }),
        },
      }),
    );
    expect(packageSyncService.syncNodePackagesIfDue).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cnqs-app-provider' }),
    );
  });

  it('stores rolling activity samples based on cumulative PQS update counts', async () => {
    const cache = new NodeCacheService();
    const packageSyncService = {
      syncNodePackagesIfDue: jest.fn().mockResolvedValue(undefined),
    };
    const fetchSummary = jest
      .fn()
      .mockResolvedValueOnce({
        ledgerLabel: 'Retail Ledger',
        pqsDatabase: 'participant1_pqs',
        activeContractCount: 12,
        latestOffset: '10',
        latestEventAt: '2026-07-01T11:59:00.000Z',
        totalUpdateCount: 100,
      })
      .mockResolvedValueOnce({
        ledgerLabel: 'Retail Ledger',
        pqsDatabase: 'participant1_pqs',
        activeContractCount: 12,
        latestOffset: '11',
        latestEventAt: '2026-07-01T12:00:00.000Z',
        totalUpdateCount: 107,
      });
    const poller = new NodePollerService(
      { list: () => [] } as never,
      cache,
      {
        fetchSummary,
        fetchActivityBuckets: jest.fn().mockResolvedValue([]),
      } as never,
      {
        fetchOperationalInfo: jest.fn().mockResolvedValue({
          target: 'localhost:5012',
          reachable: true,
          healthCheckImplemented: true,
          servingStatus: 'SERVING',
        }),
      } as never,
      packageSyncService as never,
    );

    const node = {
      id: 'participant-1',
      label: 'Participant 1',
      role: 'participant',
      ledgerLabel: 'Retail Ledger',
      pqs: { connectionUriEnv: 'PQS_URL' },
      grpc: { target: 'localhost:5012', useTls: false, connectTimeoutMs: 5000 },
      polling: { intervalMs: 15000, staleAfterMs: 45000 },
    };

    jest.useFakeTimers();

    try {
      jest.setSystemTime(new Date('2026-07-01T11:59:00.000Z'));
      await poller['refreshNode'](node);

      jest.setSystemTime(new Date('2026-07-01T12:16:00.000Z'));
      await poller['refreshNode'](node);
    } finally {
      jest.useRealTimers();
    }

    expect(cache.listActivityHistory()).toEqual({
      generatedAt: expect.any(String),
      windowMinutes: expect.any(Number),
      nodes: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          status: 'healthy',
          latestActiveContractCount: 12,
          samples: [
            expect.objectContaining({
              activityValue: 0,
              activeContractCount: 12,
              latestOffset: '10',
            }),
            expect.objectContaining({
              activityValue: 7,
              activeContractCount: 12,
              latestOffset: '11',
            }),
          ],
        },
      ],
    });
  });

  it('seeds activity history from PQS buckets on the first successful refresh', async () => {
    const cache = new NodeCacheService();
    const packageSyncService = {
      syncNodePackagesIfDue: jest.fn().mockResolvedValue(undefined),
    };
    const poller = new NodePollerService(
      { list: () => [] } as never,
      cache,
      {
        fetchSummary: jest.fn().mockResolvedValue({
          ledgerLabel: 'Retail Ledger',
          pqsDatabase: 'participant1_pqs',
          activeContractCount: 12,
          latestOffset: '11',
          latestEventAt: '2026-07-01T12:00:00.000Z',
          totalUpdateCount: 107,
        }),
        fetchActivityBuckets: jest.fn().mockResolvedValue([
          {
            timestamp: '2026-07-01T11:45:00.000Z',
            activityValue: 3,
            latestOffset: '10',
          },
          {
            timestamp: '2026-07-01T12:00:00.000Z',
            activityValue: 4,
            latestOffset: '11',
          },
        ]),
      } as never,
      {
        fetchOperationalInfo: jest.fn().mockResolvedValue({
          target: 'localhost:5012',
          reachable: true,
          healthCheckImplemented: true,
          servingStatus: 'SERVING',
        }),
      } as never,
      packageSyncService as never,
    );

    await poller['refreshNode']({
      id: 'participant-1',
      label: 'Participant 1',
      role: 'participant',
      ledgerLabel: 'Retail Ledger',
      pqs: { connectionUriEnv: 'PQS_URL' },
      grpc: { target: 'localhost:5012', useTls: false, connectTimeoutMs: 5000 },
      polling: { intervalMs: 15000, staleAfterMs: 45000 },
    });

    expect(cache.listActivityHistory().nodes[0].samples).toEqual([
      {
        timestamp: '2026-07-01T11:45:00.000Z',
        activityValue: 3,
        activeContractCount: 12,
        latestOffset: '10',
      },
      {
        timestamp: '2026-07-01T12:00:00.000Z',
        activityValue: 4,
        activeContractCount: 12,
        latestOffset: '11',
      },
    ]);
  });
});
