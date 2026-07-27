import { Injectable } from '@nestjs/common';
import {
  fetchMarketJson,
  finalizeProviderCandles,
  normalizeDailyCandle,
  providerError,
} from './canton-coin.provider';
import type { CantonCoinCandle } from './canton-coin.types';
import type { CantonCoinPriceProvider } from './canton-coin.provider';

const OKX_URL = 'https://www.okx.com/api/v5/market/history-candles';
const PAGE_LIMIT = 100;

type OkxResponse = {
  code?: unknown;
  data?: unknown;
};

@Injectable()
export class OkxCantonCoinProvider implements CantonCoinPriceProvider {
  readonly id = 'okx';
  readonly label = 'OKX';
  readonly pair = 'CC-USDT';
  readonly quote = 'USDT';

  async fetchHistory(now: Date) {
    const metadata = {
      id: this.id,
      label: this.label,
      pair: this.pair,
      quote: this.quote,
    } as const;
    const candles: CantonCoinCandle[] = [];
    let before: number | undefined;

    try {
      for (let page = 0; page < 1000; page += 1) {
        const params = new URLSearchParams({
          instId: this.pair,
          bar: '1Dutc',
          limit: String(PAGE_LIMIT),
        });
        if (before !== undefined) {
          params.set('before', String(before));
        }

        const response = (await fetchMarketJson(
          `${OKX_URL}?${params.toString()}`,
          this.label,
        )) as OkxResponse;
        if (response.code !== '0' || !Array.isArray(response.data)) {
          throw new Error(
            `${this.label} returned an invalid market-history response`,
          );
        }

        if (response.data.length === 0) {
          break;
        }

        let oldestTimestamp: number | undefined;
        for (const row of response.data) {
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
            [row[1], row[2], row[3], row[4], row[7]],
            now,
          );
          if (candle) {
            candles.push(candle);
          }
        }

        if (
          oldestTimestamp === undefined ||
          (before !== undefined && oldestTimestamp >= before)
        ) {
          break;
        }

        before = oldestTimestamp;
      }

      return finalizeProviderCandles(candles, metadata);
    } catch (error) {
      return providerError(metadata, error);
    }
  }
}
