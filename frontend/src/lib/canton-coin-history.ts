import type { CantonCoinCandle, CantonCoinVenue } from "../types/market";

const DAY_MS = 24 * 60 * 60 * 1000;

export type CantonCoinRange = "all" | "1y" | "90d" | "30d";

export interface CantonCoinMedianPoint {
  timestamp: string;
  close: number;
  quote: string;
}

export interface CantonCoinChartDomain {
  min: number;
  max: number;
}

export interface CantonCoinChartPlot {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function chartTicks(maximum: number): number[] {
  const safeMaximum = Number.isFinite(maximum) && maximum > 0 ? maximum : 0;
  if (safeMaximum === 0) {
    return [0];
  }

  return [1, 0.75, 0.5, 0.25, 0].map((ratio) => safeMaximum * ratio);
}

export function chartYForValue(
  value: number,
  domain: CantonCoinChartDomain,
  plot: CantonCoinChartPlot,
): number {
  if (domain.min === domain.max) {
    return domain.min === 0
      ? plot.top + plot.height
      : plot.top + plot.height / 2;
  }

  return (
    plot.top +
    plot.height -
    ((value - domain.min) / (domain.max - domain.min)) * plot.height
  );
}

export function filterCantonCoinRange(
  candles: CantonCoinCandle[],
  range: CantonCoinRange,
  now = new Date(),
): CantonCoinCandle[] {
  const days =
    range === "1y" ? 365 : range === "90d" ? 90 : range === "30d" ? 30 : null;
  if (days === null) {
    return candles;
  }

  const start = now.getTime() - days * DAY_MS;
  return candles.filter((candle) => {
    const timestamp = Date.parse(candle.timestamp);
    return Number.isFinite(timestamp) && timestamp >= start;
  });
}

export function medianCloseByUtcDay(
  venues: CantonCoinVenue[],
): CantonCoinMedianPoint[] {
  const grouped = new Map<
    string,
    { timestamp: string; quote: string; closes: number[] }
  >();

  for (const venue of venues) {
    if (venue.status !== "ok") {
      continue;
    }

    for (const candle of venue.candles) {
      if (!Number.isFinite(candle.close) || candle.close < 0) {
        continue;
      }

      const timestamp = new Date(
        Math.floor(Date.parse(candle.timestamp) / DAY_MS) * DAY_MS,
      ).toISOString();
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

  return [...grouped.values()]
    .filter((entry) => entry.closes.length >= 2)
    .map((entry) => {
      const closes = [...entry.closes].sort((left, right) => left - right);
      const middle = Math.floor(closes.length / 2);
      const close =
        closes.length % 2 === 0
          ? (closes[middle - 1] + closes[middle]) / 2
          : closes[middle];
      return {
        timestamp: entry.timestamp,
        close,
        quote: entry.quote,
      };
    })
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

export function linePoints(
  candles: CantonCoinCandle[],
  width: number,
  height: number,
  domain?: CantonCoinChartDomain,
  plot: CantonCoinChartPlot = { left: 0, top: 0, width, height },
): string {
  const points = candles.filter(
    (candle) => Number.isFinite(candle.close) && candle.close >= 0,
  );
  if (points.length === 0) {
    return "";
  }

  const values = points.map((candle) => candle.close);
  const min = domain?.min ?? Math.min(...values);
  const max = domain?.max ?? Math.max(...values);
  const xStep = points.length === 1 ? 0 : plot.width / (points.length - 1);

  return points
    .map((candle, index) => {
      const x = plot.left + index * xStep;
      const y = chartYForValue(candle.close, { min, max }, plot);
      return `${round(x)},${round(y)}`;
    })
    .join(" ");
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
