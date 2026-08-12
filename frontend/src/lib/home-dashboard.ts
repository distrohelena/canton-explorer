import type { ActivitySeries } from '../types/activity';
import type { CantonCoinVenue } from '../types/market';

const DAY_MS = 24 * 60 * 60 * 1000;

export type HomeDashboardRange = '24h' | '7d' | '31d';

export interface HomeDashboardActivityPoint {
  timestamp: string;
  value: number;
}

export interface HomeDashboardPricePoint {
  timestamp: string;
  close: number;
  quote: string;
}

export function dashboardRangeDays(range: HomeDashboardRange): 1 | 7 | 31 {
  return range === '24h' ? 1 : range === '7d' ? 7 : 31;
}

export function aggregateActivityPoints(
  series: ActivitySeries[],
): HomeDashboardActivityPoint[] {
  const points = new Map<string, number>();

  for (const node of series) {
    for (const sample of node.samples) {
      const timestampMs = Date.parse(sample.timestamp);
      if (!Number.isFinite(timestampMs) || !Number.isFinite(sample.activityValue)) {
        continue;
      }

      const timestamp = new Date(timestampMs).toISOString();
      points.set(timestamp, (points.get(timestamp) ?? 0) + sample.activityValue);
    }
  }

  return [...points.entries()]
    .map(([timestamp, value]) => ({ timestamp, value }))
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

export function preferredCantonCoinDailyPoints(
  venues: CantonCoinVenue[],
): HomeDashboardPricePoint[] {
  const grouped = new Map<
    string,
    { timestamp: string; quote: string; closes: number[] }
  >();

  for (const venue of venues) {
    if (venue.status !== 'ok') {
      continue;
    }

    for (const candle of venue.candles) {
      const candleTimestamp = Date.parse(candle.timestamp);
      if (!Number.isFinite(candleTimestamp) || !Number.isFinite(candle.close) || candle.close < 0) {
        continue;
      }

      const timestamp = new Date(Math.floor(candleTimestamp / DAY_MS) * DAY_MS).toISOString();
      const key = `${venue.quote}:${timestamp}`;
      const existing = grouped.get(key) ?? {
        timestamp,
        quote: venue.quote,
        closes: [],
      };
      existing.closes.push(candle.close);
      grouped.set(key, existing);
    }
  }

  const preferredQuote = ['USDT', 'USD'].find((quote) =>
    [...grouped.values()].some((point) => point.quote === quote),
  ) ?? [...new Set([...grouped.values()].map((point) => point.quote))].sort()[0];

  if (!preferredQuote) {
    return [];
  }

  return [...grouped.values()]
    .filter((point) => point.quote === preferredQuote)
    .map((point) => ({
      timestamp: point.timestamp,
      close: median(point.closes),
      quote: point.quote,
    }))
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}
