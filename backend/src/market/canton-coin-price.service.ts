import { Inject, Injectable } from '@nestjs/common';
import type { CantonCoinPriceProvider } from './canton-coin.provider';
import type {
  CantonCoinHistoryResponse,
  CantonCoinProviderResult,
} from './canton-coin.types';

export const CANTON_COIN_PRICE_PROVIDERS = Symbol(
  'CANTON_COIN_PRICE_PROVIDERS',
);
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class CantonCoinPriceService {
  constructor(
    @Inject(CANTON_COIN_PRICE_PROVIDERS)
    private readonly providers: CantonCoinPriceProvider[],
  ) {}

  async fetchHistory(now = new Date()): Promise<CantonCoinHistoryResponse> {
    const settled = await Promise.allSettled(
      this.providers.map((provider) => provider.fetchHistory(now)),
    );
    const venues = settled.map((outcome, index) => {
      const provider = this.providers[index];
      if (outcome.status === 'fulfilled') {
        return this.normalizeProviderResult(outcome.value, now);
      }

      return {
        id: provider.id,
        label: provider.label,
        pair: provider.pair,
        quote: provider.quote,
        status: 'error' as const,
        coverageStart: null,
        coverageEnd: null,
        candles: [],
        message: `${provider.label} market history is unavailable.`,
      };
    });

    const hasCandles = venues.some((venue) => venue.candles.length > 0);
    const hasError = venues.some((venue) => venue.status === 'error');
    const allOk =
      venues.length > 0 && venues.every((venue) => venue.status === 'ok');

    return {
      asset: {
        name: 'Canton Coin',
        symbol: 'CC',
        canonicalId: 'canton-network',
        network: 'Canton Network',
        kind: 'native',
      },
      interval: '1D',
      dataStatus: hasCandles
        ? allOk
          ? 'ready'
          : 'partial'
        : hasError
          ? 'error'
          : 'empty',
      venues,
    };
  }

  private normalizeProviderResult(
    result: CantonCoinProviderResult,
    now: Date,
  ): CantonCoinProviderResult {
    if (result.status === 'error') {
      return {
        ...result,
        candles: [],
        coverageStart: null,
        coverageEnd: null,
        message:
          result.message ?? `${result.label} market history is unavailable.`,
      };
    }

    const currentDayTimestamp = Math.floor(now.getTime() / DAY_MS) * DAY_MS;
    const validCandles = result.candles.filter((candle) => {
      const timestamp = Date.parse(candle.timestamp);
      return (
        Number.isFinite(timestamp) &&
        Math.floor(timestamp / DAY_MS) * DAY_MS < currentDayTimestamp &&
        [
          candle.open,
          candle.high,
          candle.low,
          candle.close,
          candle.volumeQuote,
        ].every(Number.isFinite)
      );
    });
    const candles = [
      ...new Map(
        validCandles.map((candle) => [candle.timestamp, candle]),
      ).values(),
    ].sort((left, right) => left.timestamp.localeCompare(right.timestamp));

    return {
      ...result,
      status: candles.length > 0 ? 'ok' : 'empty',
      coverageStart: candles[0]?.timestamp ?? null,
      coverageEnd: candles.at(-1)?.timestamp ?? null,
      candles,
      message: null,
    };
  }
}
