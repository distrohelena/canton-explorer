import { Injectable } from '@nestjs/common';
import {
  fetchMarketJson,
  finalizeProviderCandles,
  normalizeDailyCandle,
  providerError,
} from './canton-coin.provider';
import type { CantonCoinCandle } from './canton-coin.types';
import type { CantonCoinPriceProvider } from './canton-coin.provider';

const BYBIT_URL = 'https://api.bybit.com/v5/market/kline';
const PAGE_LIMIT = 1000;

type BybitResponse = {
  retCode?: unknown;
  result?: {
    list?: unknown;
  };
};

@Injectable()
export class BybitCantonCoinProvider implements CantonCoinPriceProvider {
  readonly id = 'bybit';
  readonly label = 'Bybit';
  readonly pair = 'CCUSDT';
  readonly quote = 'USDT';

  async fetchHistory(now: Date) {
    const metadata = {
      id: this.id,
      label: this.label,
      pair: this.pair,
      quote: this.quote,
    } as const;
    const candles: CantonCoinCandle[] = [];
    let end: number | undefined;

    try {
      for (let page = 0; page < 1000; page += 1) {
        const params = new URLSearchParams({
          category: 'spot',
          symbol: this.pair,
          interval: 'D',
          limit: String(PAGE_LIMIT),
        });
        if (end !== undefined) {
          params.set('end', String(end));
        }

        const response = (await fetchMarketJson(
          `${BYBIT_URL}?${params.toString()}`,
          this.label,
        )) as BybitResponse;
        if (response.retCode !== 0 || !Array.isArray(response.result?.list)) {
          throw new Error(
            `${this.label} returned an invalid market-history response`,
          );
        }

        if (response.result.list.length === 0) {
          break;
        }

        let oldestTimestamp: number | undefined;
        for (const row of response.result.list) {
          if (!Array.isArray(row)) {
            continue;
          }

          const timestamp = Number(row[0]);
          if (Number.isFinite(timestamp)) {
            oldestTimestamp =
              oldestTimestamp === undefined
                ? timestamp
                : Math.min(oldestTimestamp, timestamp);
          }

          const candle = normalizeDailyCandle(
            timestamp,
            [row[1], row[2], row[3], row[4], row[6]],
            now,
          );
          if (candle) {
            candles.push(candle);
          }
        }

        if (
          oldestTimestamp === undefined ||
          (end !== undefined && oldestTimestamp > end)
        ) {
          break;
        }

        const nextEnd = oldestTimestamp - 1;
        if (end !== undefined && nextEnd >= end) {
          break;
        }
        end = nextEnd;
      }

      return finalizeProviderCandles(candles, metadata);
    } catch (error) {
      return providerError(metadata, error);
    }
  }
}
