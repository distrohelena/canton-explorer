import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { NodeCacheService } from '../cache/node-cache.service';
import { NodeConfigService } from '../config/node-config.service';
import { PqsSummaryService } from '../pqs/pqs-summary.service';

@Controller('/api')
export class NodesController {
  constructor(
    private readonly cacheService: NodeCacheService,
    private readonly configService: NodeConfigService,
    private readonly pqsSummaryService: PqsSummaryService,
  ) {}

  @Get('/nodes')
  listNodes() {
    return this.cacheService.list();
  }

  @Get('/nodes/activity-history')
  listActivityHistory(@Query('days') days?: string) {
    const parsedDays = days ? Number.parseInt(days, 10) : undefined;

    return this.cacheService.listActivityHistory(
      parsedDays && Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : undefined,
    );
  }

  @Get('/nodes/:id')
  getNode(@Param('id') id: string) {
    const node = this.cacheService.get(id);
    if (!node) {
      throw new NotFoundException(`Unknown node: ${id}`);
    }

    return node;
  }

  @Get('/nodes/:id/updates')
  async listNodeUpdates(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const node = this.configService.list().find((candidate) => candidate.id === id);
    if (!node) {
      throw new NotFoundException(`Unknown node: ${id}`);
    }

    const parsedLimit = limit ? Number.parseInt(limit, 10) : 25;

    return this.pqsSummaryService.fetchRecentUpdates(
      node,
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 25,
    );
  }

  @Get('/nodes/:id/updates/:updateId')
  async getNodeUpdateDetail(
    @Param('id') id: string,
    @Param('updateId') updateId: string,
  ) {
    const node = this.configService.list().find((candidate) => candidate.id === id);
    if (!node) {
      throw new NotFoundException(`Unknown node: ${id}`);
    }

    try {
      return await this.pqsSummaryService.fetchUpdateDetail(node, updateId);
    } catch (error) {
      if (error instanceof Error && error.message === 'Update not found') {
        throw new NotFoundException(`Unknown update: ${updateId}`);
      }

      throw error;
    }
  }

  @Get('/nodes/:id/contracts/:contractId')
  async getNodeContractDetail(
    @Param('id') id: string,
    @Param('contractId') contractId: string,
  ) {
    const node = this.configService.list().find((candidate) => candidate.id === id);
    if (!node) {
      throw new NotFoundException(`Unknown node: ${id}`);
    }

    try {
      return await this.pqsSummaryService.fetchContractDetail(node, contractId);
    } catch (error) {
      if (error instanceof Error && error.message === 'Contract not found') {
        throw new NotFoundException(`Unknown contract: ${contractId}`);
      }

      throw error;
    }
  }

  @Get('/ledgers')
  listLedgers() {
    return this.cacheService.list().map((node) => node.ledgerSummary);
  }
}
