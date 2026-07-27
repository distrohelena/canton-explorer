import { BybitCantonCoinProvider } from '../../src/market/bybit-canton-coin.provider';
import { OkxCantonCoinProvider } from '../../src/market/okx-canton-coin.provider';

const NOW = new Date('2026-07-27T12:00:00.000Z');

function mockJsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

function requestUrl(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof URL) {
    return value.toString();
  }
  return '';
}

describe('Canton Coin market providers', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
  });

  it('parses and paginates OKX UTC daily candles, deduplicating timestamps', async () => {
    const fetchMock = jest.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(
        mockJsonResponse({
          code: '0',
          data: [
            [
              '1785110400000',
              '0.14',
              '0.15',
              '0.13',
              '0.145',
              '10',
              '1.45',
              '1.45',
              '1',
            ],
            [
              '1785024000000',
              '0.12',
              '0.13',
              '0.11',
              '0.125',
              '10',
              '1.25',
              '1.25',
              '1',
            ],
          ],
        }),
      )
      .mockResolvedValueOnce(
        mockJsonResponse({
          code: '0',
          data: [
            [
              '1785024000000',
              '0.12',
              '0.13',
              '0.11',
              '0.125',
              '10',
              '1.25',
              '1.25',
              '1',
            ],
            [
              '1784937600000',
              '0.1',
              '0.11',
              '0.09',
              '0.105',
              '10',
              '1.05',
              '1.05',
              '1',
            ],
          ],
        }),
      )
      .mockResolvedValueOnce(mockJsonResponse({ code: '0', data: [] }));

    const result = await new OkxCantonCoinProvider().fetchHistory(NOW);

    expect(result.status).toBe('ok');
    expect(result.pair).toBe('CC-USDT');
    expect(result.candles).toHaveLength(2);
    expect(result.candles.map((candle) => candle.timestamp)).toEqual([
      '2026-07-25T00:00:00.000Z',
      '2026-07-26T00:00:00.000Z',
    ]);
    expect(result.candles[1]?.volumeQuote).toBe(1.25);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const firstUrl = new URL(requestUrl(fetchMock.mock.calls[0]?.[0]));
    expect(firstUrl.searchParams.get('instId')).toBe('CC-USDT');
    expect(firstUrl.searchParams.get('bar')).toBe('1Dutc');
    expect(requestUrl(fetchMock.mock.calls[1]?.[0])).toContain(
      'before=1785024000000',
    );
  });

  it('parses and paginates Bybit spot klines and stops on a non-progressing cursor', async () => {
    const fetchMock = jest.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(
        mockJsonResponse({
          retCode: 0,
          result: {
            list: [
              ['1785110400000', '0.14', '0.15', '0.13', '0.145', '10', '1.45'],
              ['1785024000000', '0.12', '0.13', '0.11', '0.125', '10', '1.25'],
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        mockJsonResponse({
          retCode: 0,
          result: {
            list: [
              ['1785024000000', '0.12', '0.13', '0.11', '0.125', '10', '1.25'],
              ['1784937600000', '0.1', '0.11', '0.09', '0.105', '10', '1.05'],
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        mockJsonResponse({
          retCode: 0,
          result: {
            list: [
              ['1784937600000', '0.1', '0.11', '0.09', '0.105', '10', '1.05'],
            ],
          },
        }),
      );

    const result = await new BybitCantonCoinProvider().fetchHistory(NOW);

    expect(result.status).toBe('ok');
    expect(result.pair).toBe('CCUSDT');
    expect(result.candles).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.candles.map((candle) => candle.timestamp)).toEqual([
      '2026-07-25T00:00:00.000Z',
      '2026-07-26T00:00:00.000Z',
    ]);
    const firstUrl = new URL(requestUrl(fetchMock.mock.calls[0]?.[0]));
    expect(firstUrl.searchParams.get('category')).toBe('spot');
    expect(firstUrl.searchParams.get('symbol')).toBe('CCUSDT');
    expect(firstUrl.searchParams.get('interval')).toBe('D');
    expect(requestUrl(fetchMock.mock.calls[1]?.[0])).toContain(
      'end=1785023999999',
    );
  });

  it('drops the open UTC day and invalid rows while preserving valid rows', async () => {
    const fetchMock = jest.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(
        mockJsonResponse({
          code: '0',
          data: [
            [
              '1785110400000',
              'bad',
              '0.15',
              '0.13',
              '0.145',
              '10',
              '1.45',
              '1.45',
              '1',
            ],
            [
              '1785024000000',
              '0.12',
              '0.13',
              '0.11',
              '0.125',
              '10',
              '1.25',
              '1.25',
              '1',
            ],
          ],
        }),
      )
      .mockResolvedValueOnce(mockJsonResponse({ code: '0', data: [] }));

    const result = await new OkxCantonCoinProvider().fetchHistory(NOW);

    expect(result.status).toBe('ok');
    expect(result.candles).toHaveLength(1);
    expect(result.candles[0]?.timestamp).toBe('2026-07-26T00:00:00.000Z');
  });

  it('returns a safe error for malformed or unavailable provider responses', async () => {
    const fetchMock = jest.mocked(global.fetch);
    fetchMock.mockResolvedValue(
      mockJsonResponse({ code: '500', data: [] }, false, 500),
    );

    const result = await new OkxCantonCoinProvider().fetchHistory(NOW);

    expect(result.status).toBe('error');
    expect(result.candles).toEqual([]);
    expect(result.message).toMatch(/OKX/i);
  });
});
