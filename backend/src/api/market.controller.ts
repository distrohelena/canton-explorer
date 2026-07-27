import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { CantonCoinPriceService } from '../market/canton-coin-price.service';

@Controller('/api/market')
export class MarketController {
  constructor(
    private readonly cantonCoinPriceService: CantonCoinPriceService,
  ) {}

  @Get('/canton-coin/history')
  getCantonCoinHistory(@Query('interval') interval?: string) {
    if (interval && interval !== '1D') {
      throw new BadRequestException(
        'Only daily Canton Coin history is supported',
      );
    }

    return this.cantonCoinPriceService.fetchHistory();
  }
}
