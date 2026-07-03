import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { NodeCacheService } from '../cache/node-cache.service';
import { NodeConfigService } from '../config/node-config.service';
import { GrpcOperationsService } from '../grpc/grpc-operations.service';
import { PqsSummaryService } from '../pqs/pqs-summary.service';

@Controller('/api')
export class NodesController {
  constructor(
    private readonly cacheService: NodeCacheService,
    private readonly configService: NodeConfigService,
    private readonly grpcOperationsService: GrpcOperationsService,
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

  @Get('/nodes/:id/packages')
  async listNodePackages(@Param('id') id: string) {
    const node = this.configService.list().find((candidate) => candidate.id === id);
    if (!node) {
      throw new NotFoundException(`Unknown node: ${id}`);
    }

    return this.pqsSummaryService.fetchNodePackages(node);
  }

  @Get('/nodes/:id/updates')
  async listNodeUpdates(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Query('after') after?: string,
    @Query('party') party?: string | string[],
    @Query('mode') mode?: string,
    @Query('hideSplice') hideSplice?: string,
  ) {
    const node = this.configService.list().find((candidate) => candidate.id === id);
    if (!node) {
      throw new NotFoundException(`Unknown node: ${id}`);
    }

    const parsedLimit = limit ? Number.parseInt(limit, 10) : 25;

    return this.pqsSummaryService.fetchRecentUpdates(
      node,
      {
        limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 25,
        before,
        after,
        parties: Array.isArray(party) ? party : party ? [party] : undefined,
        mode,
        hideSplice: hideSplice === 'true' || hideSplice === '1' ? true : undefined,
      },
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

  @Get('/parties/:partyId')
  async getPartyDetail(@Param('partyId') partyId: string) {
    try {
      return await this.pqsSummaryService.fetchPartyDetail(this.configService.list(), partyId);
    } catch (error) {
      if (error instanceof Error && error.message === 'Party not found') {
        throw new NotFoundException(`Unknown party: ${partyId}`);
      }

      throw error;
    }
  }

  @Get('/parties')
  async listActiveParties() {
    return this.pqsSummaryService.fetchActiveParties(this.configService.list());
  }

  @Get('/parties/local')
  async listLocalParties() {
    const nodes = await Promise.all(
      this.configService.list().map(async (node) => ({
        nodeId: node.id,
        label: node.label,
        mode: node.mode,
        parties:
          node.mode === 'pqs_with_grpc'
            ? await this.grpcOperationsService
                .listLocalParties(node)
                .catch(() => [])
            : [],
      })),
    );

    return { nodes };
  }

  @Get('/packages/by-name/:packageName')
  async listPackagesByName(@Param('packageName') packageName: string) {
    try {
      return await this.pqsSummaryService.fetchPackagesByName(packageName);
    } catch (error) {
      if (error instanceof Error && error.message === 'Package family not found') {
        throw new NotFoundException(`Unknown package name: ${packageName}`);
      }

      throw error;
    }
  }

  @Get('/packages/:packageId')
  async getPackageDetail(@Param('packageId') packageId: string) {
    try {
      return await this.pqsSummaryService.fetchPackageDetail(packageId);
    } catch (error) {
      if (error instanceof Error && error.message === 'Package not found') {
        throw new NotFoundException(`Unknown package: ${packageId}`);
      }

      throw error;
    }
  }

  @Get('/ledgers')
  listLedgers() {
    return this.cacheService.list().map((node) => node.ledgerSummary);
  }
}
