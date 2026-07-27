import { BadRequestException } from '@nestjs/common';
import { MarketController } from '../../src/api/market.controller';
import type { CantonCoinHistoryResponse } from '../../src/market/canton-coin.types';
import type { CantonCoinPriceService } from '../../src/market/canton-coin-price.service';

const response = {
  asset: {
    name: 'Canton Coin',
    symbol: 'CC',
    canonicalId: 'canton-network',
    network: 'Canton Network',
    kind: 'native',
  },
  interval: '1D',
  dataStatus: 'empty',
  venues: [],
} satisfies CantonCoinHistoryResponse;

describe('MarketController', () => {
  it('returns native Canton Coin history without requiring node configuration', async () => {
    const fetchHistory = jest.fn().mockResolvedValue(response);
    const service = {
      fetchHistory,
    } as unknown as CantonCoinPriceService;
    const controller = new MarketController(service);

    await expect(controller.getCantonCoinHistory()).resolves.toEqual(response);
    expect(fetchHistory).toHaveBeenCalledTimes(1);
  });

  it('accepts the daily interval explicitly', async () => {
    const fetchHistory = jest.fn().mockResolvedValue(response);
    const service = {
      fetchHistory,
    } as unknown as CantonCoinPriceService;
    const controller = new MarketController(service);

    await controller.getCantonCoinHistory('1D');

    expect(fetchHistory).toHaveBeenCalledTimes(1);
  });

  it('rejects unsupported intervals', () => {
    const fetchHistory = jest.fn();
    const service = { fetchHistory } as unknown as CantonCoinPriceService;
    const controller = new MarketController(service);

    expect(() => controller.getCantonCoinHistory('1h')).toThrow(
      BadRequestException,
    );
    expect(fetchHistory).not.toHaveBeenCalled();
  });
});
