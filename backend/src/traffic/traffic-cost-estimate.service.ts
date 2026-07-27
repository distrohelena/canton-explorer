import { Injectable } from '@nestjs/common';
import type { NodeTrafficPurchase } from '../domain/node.types';
import { CantonCoinPriceService } from '../market/canton-coin-price.service';
import type { CantonCoinHistoryResponse } from '../market/canton-coin.types';

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const PRICE_SCALE = 8;
const USD_SCALE = 2;

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

    const numerator = paid * amuletPaid.value * price.value * 100n;
    const denominator =
      purchasedTraffic * 10n ** BigInt(amuletPaid.scale + price.scale);
    const cents = (numerator + denominator / 2n) / denominator;

    return formatUsdCents(cents);
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
  ): ScaledDecimal | null {
    if (!history) {
      return null;
    }

    const closes = history.venues
      .filter(
        (venue) =>
          venue.status === 'ok' && venue.quote.toUpperCase() === 'USDT',
      )
      .flatMap((venue) => {
        const candle = venue.candles.find(
          (candidate) => utcDay(candidate.timestamp) === day,
        );
        return candle ? [candle.close] : [];
      })
      .filter(Number.isFinite)
      .sort((left, right) => left - right);

    if (closes.length < 2) {
      return null;
    }

    const middle = Math.floor(closes.length / 2);
    const median =
      closes.length % 2 === 1
        ? closes[middle]
        : ((closes[middle - 1] ?? 0) + (closes[middle] ?? 0)) / 2;

    return parsePrice(median);
  }
}
