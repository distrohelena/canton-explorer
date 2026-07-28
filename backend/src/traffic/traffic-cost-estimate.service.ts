import { Injectable } from '@nestjs/common';
import type { NodeTrafficPurchase } from '../domain/node.types';
import { CantonCoinPriceService } from '../market/canton-coin-price.service';
import type { CantonCoinHistoryResponse } from '../market/canton-coin.types';

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PRICE_GAP_DAYS = 15;
const PRICE_SCALE = 8;
const USD_SCALE = 2;

export interface TrafficCostEstimate {
  usd: string;
  gapDays: number | null;
}

interface ScaledDecimal {
  value: bigint;
  scale: number;
}

function parseNonNegativeInteger(
  value: string | null | undefined,
): bigint | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) {
    return null;
  }

  try {
    return BigInt(value.trim());
  } catch {
    return null;
  }
}

function parsePositiveDecimal(
  value: string | null | undefined,
): ScaledDecimal | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match) {
    return null;
  }

  const fraction = match[2] ?? '';
  try {
    const parsed = {
      value: BigInt(`${match[1]}${fraction}`),
      scale: fraction.length,
    };
    return parsed.value > 0n ? parsed : null;
  } catch {
    return null;
  }
}

function parsePrice(value: number): ScaledDecimal | null {
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return parsePositiveDecimal(value.toFixed(PRICE_SCALE));
}

function utcDay(recordTime: string | null): string | null {
  if (!recordTime) {
    return null;
  }

  const parsed = new Date(recordTime);
  return Number.isNaN(parsed.getTime())
    ? null
    : parsed.toISOString().slice(0, 10);
}

function formatUsdCents(cents: bigint): string {
  const dollars = cents / 100n;
  const remainder = (cents % 100n).toString().padStart(2, '0');
  return `${dollars.toString()}.${remainder}`;
}

@Injectable()
export class TrafficCostEstimateService {
  private readonly cachedHistories = new Map<
    string,
    { expiresAt: number; value: CantonCoinHistoryResponse }
  >();

  constructor(
    private readonly cantonCoinPriceService: CantonCoinPriceService,
  ) {}

  private readonly cacheTtlMs = DEFAULT_CACHE_TTL_MS;

  async estimate(
    paidTrafficCost: string | null | undefined,
    purchase: NodeTrafficPurchase | null | undefined,
    now = new Date(),
  ): Promise<string | null> {
    const result = await this.estimateDetails(paidTrafficCost, purchase, now);
    return result?.usd ?? null;
  }

  async estimateDetails(
    paidTrafficCost: string | null | undefined,
    purchase: NodeTrafficPurchase | null | undefined,
    now = new Date(),
  ): Promise<TrafficCostEstimate | null> {
    const paid = parseNonNegativeInteger(paidTrafficCost);
    const purchasedTraffic = parseNonNegativeInteger(
      purchase?.purchasedTraffic,
    );
    const amuletPaid = parsePositiveDecimal(purchase?.amuletPaid);
    const purchaseDay = utcDay(purchase?.recordTime ?? null);

    if (
      paid === null ||
      purchasedTraffic === null ||
      purchasedTraffic <= 0n ||
      amuletPaid === null ||
      purchaseDay === null
    ) {
      return null;
    }

    const history = await this.getHistory(now, purchaseDay);
    const price = this.findDailyMedianPrice(history, purchaseDay);
    if (price === null) {
      return null;
    }

    const numerator = paid * amuletPaid.value * price.price.value * 100n;
    const denominator =
      purchasedTraffic * 10n ** BigInt(amuletPaid.scale + price.price.scale);
    const cents = (numerator + denominator / 2n) / denominator;

    return {
      usd: formatUsdCents(cents),
      gapDays: price.gapDays,
    };
  }

  private async getHistory(
    now: Date,
    purchaseDay: string,
  ): Promise<CantonCoinHistoryResponse | null> {
    const nowDay = utcDay(now.toISOString());
    const includesCurrentDay = nowDay !== null && purchaseDay >= nowDay;
    const historyNow = includesCurrentDay
      ? new Date(Date.parse(`${purchaseDay}T00:00:00.000Z`) + DAY_MS)
      : now;
    const cacheKey = historyNow.toISOString().slice(0, 10);
    const currentTime = Date.now();
    const cachedHistory = this.cachedHistories.get(cacheKey);
    if (cachedHistory && cachedHistory.expiresAt > currentTime) {
      return cachedHistory.value;
    }

    try {
      const value = await this.cantonCoinPriceService.fetchHistory(historyNow);
      this.cachedHistories.set(cacheKey, {
        value,
        expiresAt: currentTime + this.cacheTtlMs,
      });
      return value;
    } catch {
      return null;
    }
  }

  private findDailyMedianPrice(
    history: CantonCoinHistoryResponse | null,
    day: string,
  ): { price: ScaledDecimal; gapDays: number } | null {
    if (!history) {
      return null;
    }

    const closesByDay = new Map<string, number[]>();
    for (const venue of history.venues.filter(
      (candidate) =>
        candidate.status === 'ok' && candidate.quote.toUpperCase() === 'USDT',
    )) {
      const venueClosesByDay = new Map<string, number>();
      for (const candle of venue.candles) {
        const candleDay = utcDay(candle.timestamp);
        if (candleDay && Number.isFinite(candle.close)) {
          venueClosesByDay.set(candleDay, candle.close);
        }
      }

      for (const [candleDay, close] of venueClosesByDay) {
        const closes = closesByDay.get(candleDay) ?? [];
        closes.push(close);
        closesByDay.set(candleDay, closes);
      }
    }

    const candidates = Array.from(closesByDay.entries())
      .filter(([, closes]) => closes.length >= 2)
      .map(([candleDay, closes]) => ({
        day: candleDay,
        closes,
        gapDays: Math.round(
          Math.abs(
            Date.parse(`${candleDay}T00:00:00.000Z`) -
              Date.parse(`${day}T00:00:00.000Z`),
          ) / DAY_MS,
        ),
      }))
      .filter((candidate) => candidate.gapDays < MAX_PRICE_GAP_DAYS)
      .sort(
        (left, right) =>
          left.gapDays - right.gapDays || left.day.localeCompare(right.day),
      );
    const closest = candidates[0];

    if (!closest) {
      return null;
    }

    const closes = [...closest.closes].sort((left, right) => left - right);
    const middle = Math.floor(closes.length / 2);
    const median =
      closes.length % 2 === 1
        ? closes[middle]
        : ((closes[middle - 1] ?? 0) + (closes[middle] ?? 0)) / 2;

    const price = parsePrice(median);
    return price ? { price, gapDays: closest.gapDays } : null;
  }
}
