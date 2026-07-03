import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NodeCacheService } from '../../src/cache/node-cache.service';

describe('NodeCacheService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-02T12:45:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('initializes a 15 minute bucket baseline at zero activity', () => {
    const cache = new NodeCacheService();

    cache.recordActivitySample({
      nodeId: 'participant-1',
      label: 'Participant 1',
      status: 'healthy',
      timestamp: '2026-07-02T12:03:00.000Z',
      activityValue: 999,
      activeContractCount: 12,
      latestOffset: '10',
      totalUpdateCount: 100,
    } as never);

    expect(cache.listActivityHistory(1)).toEqual({
      generatedAt: expect.any(String),
      windowMinutes: 1440,
      nodes: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          status: 'healthy',
          latestActiveContractCount: 12,
          samples: [
            {
              timestamp: '2026-07-02T12:00:00.000Z',
              activityValue: 0,
              activeContractCount: 12,
              latestOffset: '10',
            },
          ],
        },
      ],
    });
  });

  it('merges multiple polls in the same 15 minute bucket and starts a new bucket on boundary crossing', () => {
    const cache = new NodeCacheService();

    cache.recordActivitySample({
      nodeId: 'participant-1',
      label: 'Participant 1',
      status: 'healthy',
      timestamp: '2026-07-02T12:03:00.000Z',
      activityValue: 999,
      activeContractCount: 12,
      latestOffset: '10',
      totalUpdateCount: 100,
    } as never);
    cache.recordActivitySample({
      nodeId: 'participant-1',
      label: 'Participant 1',
      status: 'healthy',
      timestamp: '2026-07-02T12:11:00.000Z',
      activityValue: 999,
      activeContractCount: 12,
      latestOffset: '11',
      totalUpdateCount: 103,
    } as never);
    cache.recordActivitySample({
      nodeId: 'participant-1',
      label: 'Participant 1',
      status: 'healthy',
      timestamp: '2026-07-02T12:16:00.000Z',
      activityValue: 999,
      activeContractCount: 13,
      latestOffset: '12',
      totalUpdateCount: 107,
    } as never);

    expect(cache.listActivityHistory(1).nodes[0].samples).toEqual([
      {
        timestamp: '2026-07-02T12:00:00.000Z',
        activityValue: 3,
        activeContractCount: 12,
        latestOffset: '11',
      },
      {
        timestamp: '2026-07-02T12:15:00.000Z',
        activityValue: 4,
        activeContractCount: 13,
        latestOffset: '12',
      },
    ]);
  });

  it('resets the baseline when cumulative update counts regress', () => {
    const cache = new NodeCacheService();

    cache.recordActivitySample({
      nodeId: 'participant-1',
      label: 'Participant 1',
      status: 'healthy',
      timestamp: '2026-07-02T12:03:00.000Z',
      activityValue: 999,
      activeContractCount: 12,
      latestOffset: '10',
      totalUpdateCount: 100,
    } as never);
    cache.recordActivitySample({
      nodeId: 'participant-1',
      label: 'Participant 1',
      status: 'healthy',
      timestamp: '2026-07-02T12:16:00.000Z',
      activityValue: 999,
      activeContractCount: 12,
      latestOffset: '11',
      totalUpdateCount: 106,
    } as never);
    cache.recordActivitySample({
      nodeId: 'participant-1',
      label: 'Participant 1',
      status: 'healthy',
      timestamp: '2026-07-02T12:32:00.000Z',
      activityValue: 999,
      activeContractCount: 10,
      latestOffset: '12',
      totalUpdateCount: 3,
    } as never);

    expect(cache.listActivityHistory(1).nodes[0].samples).toEqual([
      {
        timestamp: '2026-07-02T12:00:00.000Z',
        activityValue: 0,
        activeContractCount: 12,
        latestOffset: '10',
      },
      {
        timestamp: '2026-07-02T12:15:00.000Z',
        activityValue: 6,
        activeContractCount: 12,
        latestOffset: '11',
      },
      {
        timestamp: '2026-07-02T12:30:00.000Z',
        activityValue: 0,
        activeContractCount: 10,
        latestOffset: '12',
      },
    ]);
  });

  it('prunes buckets older than 30 days while keeping buckets inside the selected window', () => {
    const cache = new NodeCacheService();

    cache.recordActivitySample({
      nodeId: 'participant-1',
      label: 'Participant 1',
      status: 'healthy',
      timestamp: '2026-06-01T12:03:00.000Z',
      activityValue: 999,
      activeContractCount: 12,
      latestOffset: '10',
      totalUpdateCount: 100,
    } as never);
    cache.recordActivitySample({
      nodeId: 'participant-1',
      label: 'Participant 1',
      status: 'healthy',
      timestamp: '2026-06-29T12:11:00.000Z',
      activityValue: 999,
      activeContractCount: 13,
      latestOffset: '11',
      totalUpdateCount: 103,
    } as never);
    cache.recordActivitySample({
      nodeId: 'participant-1',
      label: 'Participant 1',
      status: 'healthy',
      timestamp: '2026-07-01T12:16:00.000Z',
      activityValue: 999,
      activeContractCount: 15,
      latestOffset: '12',
      totalUpdateCount: 110,
    } as never);

    const response = cache.listActivityHistory(30);

    expect(response.nodes).toHaveLength(1);
    expect(response.nodes[0].samples).toEqual([
      {
        timestamp: '2026-06-29T12:00:00.000Z',
        activityValue: 3,
        activeContractCount: 13,
        latestOffset: '11',
      },
      {
        timestamp: '2026-07-01T12:15:00.000Z',
        activityValue: 7,
        activeContractCount: 15,
        latestOffset: '12',
      },
    ]);
  });
});
