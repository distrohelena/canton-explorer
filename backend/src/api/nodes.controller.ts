import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { NodeCacheService } from '../cache/node-cache.service';

@Controller('/api')
export class NodesController {
  constructor(private readonly cacheService: NodeCacheService) {}

  @Get('/nodes')
  listNodes() {
    return this.cacheService.list();
  }

  @Get('/nodes/:id')
  getNode(@Param('id') id: string) {
    const node = this.cacheService.get(id);
    if (!node) {
      throw new NotFoundException(`Unknown node: ${id}`);
    }

    return node;
  }

  @Get('/ledgers')
  listLedgers() {
    return this.cacheService.list().map((node) => node.ledgerSummary);
  }
}
