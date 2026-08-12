import { describe, expect, it } from 'vitest';
import {
  aggregateActivityPoints,
  dashboardRangeDays,
  preferredCantonCoinDailyPoints,
} from './home-dashboard';
import type { ActivitySeries } from '../types/activity';
import type { CantonCoinVenue } from '../types/market';

function activitySeries(overrides: Partial<ActivitySeries> = {}): ActivitySeries {
  return {
    nodeId: 'participant-1',
    label: 'Participant 1',
    status: 'healthy',
    latestActiveContractCount: 0,
    samples: [],
    ...overrides,
  };
}

function venue(overrides: Partial<CantonCoinVenue> = {}): CantonCoinVenue {
  return {
    id: 'okx',
    label: 'OKX',
    pair: 'CC-USDT',
    quote: 'USDT',
    status: 'ok',
    coverageStart: null,
    coverageEnd: null,
    candles: [],
    message: null,
    ...overrides,
  };
}

describe('Home dashboard helpers', () => {
  it('maps dashboard ranges to backend activity windows', () => {
    expect(dashboardRangeDays('24h')).toBe(1);
    expect(dashboardRangeDays('7d')).toBe(7);
    expect(dashboardRangeDays('31d')).toBe(31);
  });

  it('sums transaction activity at matching timestamps across nodes', () => {
    expect(
      aggregateActivityPoints([
        activitySeries({
          samples: [
            {
              timestamp: '2026-08-12T10:00:00.000Z',
              activityValue: 2,
              activeContractCount: 0,
              latestOffset: '1',
            },
            {
              timestamp: '2026-08-12T11:00:00.000Z',
              activityValue: 3,
              activeContractCount: 0,
              latestOffset: '2',
            },
          ],
        }),
        activitySeries({
          nodeId: 'participant-2',
          samples: [
            {
              timestamp: '2026-08-12T10:00:00.000Z',
              activityValue: 4,
              activeContractCount: 0,
              latestOffset: '3',
            },
          ],
        }),
      ]),
    ).toEqual([
      { timestamp: '2026-08-12T10:00:00.000Z', value: 6 },
      { timestamp: '2026-08-12T11:00:00.000Z', value: 3 },
    ]);
  });

  it('keeps one-venue daily prices and prefers the USDT quote', () => {
    expect(
      preferredCantonCoinDailyPoints([
        venue({
          candles: [
            {
              timestamp: '2026-08-11T00:00:00.000Z',
              open: 1,
              high: 1,
              low: 1,
              close: 1,
              volumeQuote: 1,
            },
          ],
        }),
        venue({
          id: 'usd-venue',
          quote: 'USD',
          pair: 'CC-USD',
          candles: [
            {
              timestamp: '2026-08-11T00:00:00.000Z',
              open: 99,
              high: 99,
              low: 99,
              close: 99,
              volumeQuote: 1,
            },
          ],
        }),
      ]),
    ).toEqual([
      { timestamp: '2026-08-11T00:00:00.000Z', close: 1, quote: 'USDT' },
    ]);
  });
});
