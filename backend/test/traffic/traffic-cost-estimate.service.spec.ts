import { TrafficCostEstimateService } from '../../src/traffic/traffic-cost-estimate.service';
import type { CantonCoinHistoryResponse } from '../../src/market/canton-coin.types';
import { CantonCoinPriceService } from '../../src/market/canton-coin-price.service';
import { Test } from '@nestjs/testing';

const NOW = new Date('2026-07-27T12:00:00.000Z');
const PURCHASE_DAY = '2026-07-25T08:15:00.000Z';

function history(
  venues: CantonCoinHistoryResponse['venues'],
): CantonCoinHistoryResponse {
  return {
    asset: {
      name: 'Canton Coin',
      symbol: 'CC',
      canonicalId: 'canton-network',
      network: 'Canton Network',
      kind: 'native',
    },
    interval: '1D',
    dataStatus: 'ready',
    venues,
  };
}

function venue(
  id: string,
  quote: string,
  close: number,
  timestamp = '2026-07-25T00:00:00.000Z',
) {
  return {
    id,
    label: id.toUpperCase(),
    pair: `CC-${quote}`,
    quote,
    status: 'ok' as const,
    coverageStart: timestamp,
    coverageEnd: timestamp,
    candles: [
      {
        timestamp,
        open: close,
        high: close,
        low: close,
        close,
        volumeQuote: 100,
      },
    ],
    message: null,
  };
}

describe('TrafficCostEstimateService', () => {
  it('can be constructed by Nest without treating cache settings as a dependency', async () => {
    const module = await Test.createTestingModule({
      providers: [
        TrafficCostEstimateService,
        {
          provide: CantonCoinPriceService,
          useValue: { fetchHistory: jest.fn() },
        },
      ],
    }).compile();

    expect(module.get(TrafficCostEstimateService)).toBeInstanceOf(
      TrafficCostEstimateService,
    );
  });

  it('uses the same-quote daily median and rounds the exact USD result to cents', async () => {
    const priceService = {
      fetchHistory: jest
        .fn()
        .mockResolvedValue(
          history([
            venue('okx', 'USDT', 0.1),
            venue('bybit', 'USDT', 0.3),
            venue('kraken', 'USDT', 0.2),
            venue('other', 'USD', 9),
          ]),
        ),
    };
    const service = new TrafficCostEstimateService(priceService as never);

    await expect(
      service.estimate(
        '100',
        {
          updateId: 'purchase-1',
          eventOffset: '10',
          recordTime: PURCHASE_DAY,
          purchasedTraffic: '1000',
          amuletPaid: '5.0000000000',
        },
        NOW,
      ),
    ).resolves.toBe('0.10');

    expect(priceService.fetchHistory).toHaveBeenCalledTimes(1);
  });

  it('uses half-up cent rounding for a fractional cent', async () => {
    const priceService = {
      fetchHistory: jest
        .fn()
        .mockResolvedValue(
          history([venue('okx', 'USDT', 0.01), venue('bybit', 'USDT', 0.01)]),
        ),
    };
    const service = new TrafficCostEstimateService(priceService as never);

    await expect(
      service.estimate(
        '1',
        {
          updateId: 'purchase-1',
          eventOffset: '10',
          recordTime: PURCHASE_DAY,
          purchasedTraffic: '2',
          amuletPaid: '1',
        },
        NOW,
      ),
    ).resolves.toBe('0.01');
  });

  it('includes the current UTC purchase day when requesting market history', async () => {
    const priceService = {
      fetchHistory: jest
        .fn()
        .mockResolvedValue(
          history([
            venue('okx', 'USDT', 0.1, '2026-07-27T00:00:00.000Z'),
            venue('bybit', 'USDT', 0.1, '2026-07-27T00:00:00.000Z'),
          ]),
        ),
    };
    const service = new TrafficCostEstimateService(priceService as never);

    await expect(
      service.estimate(
        '100',
        {
          updateId: 'purchase-1',
          eventOffset: '10',
          recordTime: '2026-07-27T18:33:24.504Z',
          purchasedTraffic: '1000',
          amuletPaid: '5',
        },
        NOW,
      ),
    ).resolves.toBe('0.05');

    expect(priceService.fetchHistory).toHaveBeenCalledWith(
      new Date('2026-07-28T00:00:00.000Z'),
    );
  });

  it('returns null when the day lacks two eligible USDT closes', async () => {
    const priceService = {
      fetchHistory: jest
        .fn()
        .mockResolvedValue(
          history([venue('okx', 'USDT', 0.1), venue('other', 'USD', 0.2)]),
        ),
    };
    const service = new TrafficCostEstimateService(priceService as never);

    await expect(
      service.estimate(
        '100',
        {
          updateId: 'purchase-1',
          eventOffset: '10',
          recordTime: PURCHASE_DAY,
          purchasedTraffic: '1000',
          amuletPaid: '5',
        },
        NOW,
      ),
    ).resolves.toBeNull();
  });

  it('returns null for malformed or non-positive inputs', async () => {
    const priceService = {
      fetchHistory: jest
        .fn()
        .mockResolvedValue(
          history([venue('okx', 'USDT', 0.1), venue('bybit', 'USDT', 0.1)]),
        ),
    };
    const service = new TrafficCostEstimateService(priceService as never);
    const purchase = {
      updateId: 'purchase-1',
      eventOffset: '10',
      recordTime: PURCHASE_DAY,
      purchasedTraffic: '0',
      amuletPaid: 'not-a-number',
    };

    await expect(service.estimate('-1', purchase, NOW)).resolves.toBeNull();
    await expect(service.estimate('1', purchase, NOW)).resolves.toBeNull();
    await expect(service.estimate('1', null, NOW)).resolves.toBeNull();
  });

  it('reuses a valid cached history and returns null after the cache expires', async () => {
    jest.useFakeTimers();
    try {
      const priceService = {
        fetchHistory: jest
          .fn()
          .mockResolvedValue(
            history([venue('okx', 'USDT', 0.1), venue('bybit', 'USDT', 0.1)]),
          ),
      };
      const service = new TrafficCostEstimateService(priceService as never);
      const purchase = {
        updateId: 'purchase-1',
        eventOffset: '10',
        recordTime: PURCHASE_DAY,
        purchasedTraffic: '1000',
        amuletPaid: '5',
      };

      await expect(service.estimate('100', purchase, NOW)).resolves.toBe(
        '0.05',
      );
      await expect(service.estimate('100', purchase, NOW)).resolves.toBe(
        '0.05',
      );
      expect(priceService.fetchHistory).toHaveBeenCalledTimes(1);

      priceService.fetchHistory.mockRejectedValue(new Error('market down'));
      jest.advanceTimersByTime(5 * 60 * 1000 + 1);
      await expect(service.estimate('100', purchase, NOW)).resolves.toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});
