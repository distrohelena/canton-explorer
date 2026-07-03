import { NodeCacheService } from './node-cache.service';

describe('NodeCacheService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-03T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('slices activity history against the generation time instead of the last sample time', () => {
    const cache = new NodeCacheService();

    cache.seedActivityHistory({
      nodeId: 'node-1',
      label: 'Node 1',
      status: 'healthy',
      latestActiveContractCount: 12,
      lastObservedUpdateCount: 40,
      samples: [
        {
          timestamp: '2026-07-01T00:00:00.000Z',
          activityValue: 4,
          activeContractCount: 11,
          latestOffset: '10',
        },
        {
          timestamp: '2026-07-02T00:00:00.000Z',
          activityValue: 6,
          activeContractCount: 12,
          latestOffset: '11',
        },
      ],
    });

    const history = cache.listActivityHistory(1);

    expect(history.generatedAt).toBe('2026-07-03T12:00:00.000Z');
    expect(history.nodes).toHaveLength(1);
    expect(history.nodes[0]?.samples).toEqual([]);
  });
});
