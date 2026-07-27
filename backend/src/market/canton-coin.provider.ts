import type {
  CantonCoinCandle,
  CantonCoinProviderResult,
} from './canton-coin.types';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 2;
const REQUEST_TIMEOUT_MS = 10_000;

export async function fetchMarketJson(
  url: string,
  providerLabel: string,
): Promise<unknown> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (response.ok) {
        try {
          return await response.json();
        } catch {
          throw new Error(`${providerLabel} returned invalid JSON`);
        }
      }

      if (
        attempt + 1 < MAX_ATTEMPTS &&
        (response.status === 429 || response.status >= 500)
      ) {
        await Promise.resolve();
        continue;
      }

      throw new Error(
        `${providerLabel} request failed with status ${response.status}`,
      );
    } catch (error) {
      if (
        attempt + 1 < MAX_ATTEMPTS &&
        !(error instanceof Error && /invalid JSON/.test(error.message))
      ) {
        await Promise.resolve();
        continue;
      }

      throw error instanceof Error
        ? error
        : new Error(`${providerLabel} request failed`);
    }
  }

  throw new Error(`${providerLabel} request failed`);
}

export function normalizeDailyCandle(
  timestampValue: unknown,
  values: unknown[],
  now: Date,
): CantonCoinCandle | null {
  const timestamp =
    typeof timestampValue === 'number'
      ? timestampValue
      : Number(timestampValue);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return null;
  }

  const [open, high, low, close, volumeQuote] = values.map((value) =>
    Number(value),
  );
  if (![open, high, low, close, volumeQuote].every(Number.isFinite)) {
    return null;
  }

  const dayTimestamp = Math.floor(timestamp / DAY_MS) * DAY_MS;
  const currentDayTimestamp = Math.floor(now.getTime() / DAY_MS) * DAY_MS;
  if (dayTimestamp >= currentDayTimestamp) {
    return null;
  }

  return {
    timestamp: new Date(dayTimestamp).toISOString(),
    open,
    high,
    low,
    close,
    volumeQuote,
  };
}

export function finalizeProviderCandles(
  candles: CantonCoinCandle[],
  metadata: Pick<CantonCoinProviderResult, 'id' | 'label' | 'pair' | 'quote'>,
): CantonCoinProviderResult {
  const uniqueCandles = [
    ...new Map(candles.map((candle) => [candle.timestamp, candle])).values(),
  ].sort((left, right) => left.timestamp.localeCompare(right.timestamp));

  return {
    ...metadata,
    status: uniqueCandles.length > 0 ? 'ok' : 'empty',
    coverageStart: uniqueCandles[0]?.timestamp ?? null,
    coverageEnd: uniqueCandles.at(-1)?.timestamp ?? null,
    candles: uniqueCandles,
    message: null,
  };
}

export function providerError(
  metadata: Pick<CantonCoinProviderResult, 'id' | 'label' | 'pair' | 'quote'>,
  error: unknown,
): CantonCoinProviderResult {
  return {
    ...metadata,
    status: 'error',
    coverageStart: null,
    coverageEnd: null,
    candles: [],
    message:
      error instanceof Error
        ? error.message
        : `${metadata.label} request failed`,
  };
}

export interface CantonCoinPriceProvider {
  readonly id: string;
  readonly label: string;
  readonly pair: string;
  readonly quote: string;
  fetchHistory(now: Date): Promise<CantonCoinProviderResult>;
}
