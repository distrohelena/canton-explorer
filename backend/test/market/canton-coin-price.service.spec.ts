import { CantonCoinPriceService } from '../../src/market/canton-coin-price.service';
import type { CantonCoinPriceProvider } from '../../src/market/canton-coin.provider';
import type { CantonCoinProviderResult } from '../../src/market/canton-coin.types';

const NOW = new Date('2026-07-27T12:00:00.000Z');

function result(
  overrides: Partial<CantonCoinProviderResult> = {},
): CantonCoinProviderResult {
  return {
    id: 'okx',
    label: 'OKX',
    pair: 'CC-USDT',
    quote: 'USDT',
    status: 'ok',
    coverageStart: '2026-07-25T00:00:00.000Z',
    coverageEnd: '2026-07-26T00:00:00.000Z',
    candles: [
      {
        timestamp: '2026-07-25T00:00:00.000Z',
        open: 0.1,
        high: 0.11,
        low: 0.09,
        close: 0.105,
        volumeQuote: 100,
      },
    ],
    message: null,
    ...overrides,
  };
}

function provider(
  id: string,
  response: CantonCoinProviderResult | Error,
): CantonCoinPriceProvider {
  return {
    id,
    label: id === 'bybit' ? 'Bybit' : id.toUpperCase(),
    pair: `${id}-CC`,
    quote: 'USDT',
    fetchHistory:
      response instanceof Error
        ? jest.fn().mockRejectedValue(response)
        : jest.fn().mockResolvedValue(response),
  };
}

describe('CantonCoinPriceService', () => {
  it('returns ready native CC history when every provider has candles', async () => {
    const service = new CantonCoinPriceService([
      provider('okx', result()),
      provider(
        'bybit',
        result({ id: 'bybit', label: 'Bybit', pair: 'CCUSDT' }),
      ),
    ]);

    const response = await service.fetchHistory(NOW);

    expect(response.asset).toEqual({
      name: 'Canton Coin',
      symbol: 'CC',
      canonicalId: 'canton-network',
      network: 'Canton Network',
      kind: 'native',
    });
    expect(response.dataStatus).toBe('ready');
    expect(response.venues).toHaveLength(2);
    expect(response.venues.every((venue) => venue.status === 'ok')).toBe(true);
    expect(JSON.stringify(response)).not.toMatch(/wrapped|contract/i);
  });

  it('returns partial when one provider has candles and another is empty', async () => {
    const response = await new CantonCoinPriceService([
      provider('okx', result()),
      provider(
        'bybit',
        result({
          id: 'bybit',
          label: 'Bybit',
          pair: 'CCUSDT',
          status: 'empty',
          coverageStart: null,
          coverageEnd: null,
          candles: [],
        }),
      ),
    ]).fetchHistory(NOW);

    expect(response.dataStatus).toBe('partial');
    expect(response.venues[1]?.status).toBe('empty');
  });

  it('returns empty when every provider succeeds without candles', async () => {
    const empty = result({
      status: 'empty',
      coverageStart: null,
      coverageEnd: null,
      candles: [],
    });

    const response = await new CantonCoinPriceService([
      provider('okx', empty),
      provider('bybit', {
        ...empty,
        id: 'bybit',
        label: 'Bybit',
        pair: 'CCUSDT',
      }),
    ]).fetchHistory(NOW);

    expect(response.dataStatus).toBe('empty');
    expect(response.venues.every((venue) => venue.status === 'empty')).toBe(
      true,
    );
  });

  it('returns error when no provider has candles and at least one provider fails', async () => {
    const response = await new CantonCoinPriceService([
      provider(
        'okx',
        result({
          status: 'empty',
          coverageStart: null,
          coverageEnd: null,
          candles: [],
        }),
      ),
      provider('bybit', new Error('network unavailable')),
    ]).fetchHistory(NOW);

    expect(response.dataStatus).toBe('error');
    expect(response.venues[1]?.status).toBe('error');
    expect(response.venues[1]?.message).toBe(
      'Bybit market history is unavailable.',
    );
  });
});
