import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { NodeCacheService } from '../cache/node-cache.service';
import { NodeConfigService } from '../config/node-config.service';
import { describeGrpcError } from '../grpc/grpc-error.util';
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

  @Get('/updates')
  listGlobalRecentUpdates(
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Query('after') after?: string,
    @Query('party') party?: string | string[],
    @Query('template') template?: string | string[],
    @Query('partyMode') partyMode?: string,
    @Query('mode') mode?: string,
    @Query('hideSplice') hideSplice?: string,
  ) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 25;

    return this.pqsSummaryService.fetchGlobalRecentUpdates(
      this.configService.list(),
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 25,
      {
        before,
        after,
        parties: Array.isArray(party) ? party : party ? [party] : undefined,
        templates: Array.isArray(template) ? template : template ? [template] : undefined,
        partyMode: partyMode ?? mode,
        hideSplice: hideSplice === 'true' || hideSplice === '1' ? true : undefined,
      },
    );
  }

  @Get('/contracts')
  listGlobalContracts(
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Query('after') after?: string,
    @Query('party') party?: string | string[],
    @Query('template') template?: string | string[],
    @Query('partyMode') partyMode?: string,
    @Query('mode') mode?: string,
    @Query('hideSplice') hideSplice?: string,
  ) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 25;

    return this.pqsSummaryService.fetchGlobalContracts(
      this.configService.list(),
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 25,
      {
        before,
        after,
        parties: Array.isArray(party) ? party : party ? [party] : undefined,
        templates: Array.isArray(template) ? template : template ? [template] : undefined,
        partyMode: partyMode ?? mode,
        hideSplice: hideSplice === 'true' || hideSplice === '1' ? true : undefined,
      },
    );
  }

  @Get('/tokens')
  listTokens() {
    return (
      this.pqsSummaryService as PqsSummaryService & {
        fetchTokens: (nodes: ReturnType<NodeConfigService['list']>) => unknown;
      }
    ).fetchTokens(this.configService.list());
  }

  @Get('/tokens/transfers')
  listTokenTransfers(
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Query('after') after?: string,
    @Query('fromParty') fromParty?: string | string[],
    @Query('toParty') toParty?: string | string[],
    @Query('amountGt') amountGt?: string,
    @Query('amountLt') amountLt?: string,
  ) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 25;

    return (
      this.pqsSummaryService as PqsSummaryService & {
        fetchLatestTokenTransfers: (
          nodes: ReturnType<NodeConfigService['list']>,
          limit?: number,
          options?: {
            before?: string;
            after?: string;
            fromParties?: string[];
            toParties?: string[];
            amountGt?: string;
            amountLt?: string;
          },
        ) => unknown;
      }
    ).fetchLatestTokenTransfers(
      this.configService.list(),
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 25,
      {
        before,
        after,
        fromParties: Array.isArray(fromParty) ? fromParty : fromParty ? [fromParty] : undefined,
        toParties: Array.isArray(toParty) ? toParty : toParty ? [toParty] : undefined,
        amountGt,
        amountLt,
      },
    );
  }

  @Get('/tokens/transfers/:updateId')
  async getTokenTransferDetail(@Param('updateId') updateId: string) {
    try {
      return await (
        this.pqsSummaryService as PqsSummaryService & {
          fetchTokenTransferDetail: (
            nodes: ReturnType<NodeConfigService['list']>,
            updateId: string,
          ) => Promise<unknown>;
        }
      ).fetchTokenTransferDetail(this.configService.list(), updateId);
    } catch (error) {
      if (error instanceof Error && error.message === 'Token transfer not found') {
        throw new NotFoundException(`Unknown token transfer: ${updateId}`);
      }

      throw error;
    }
  }

  @Get('/tokens/:tokenId/transfers')
  async listTransfersByToken(
    @Param('tokenId') tokenId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Query('after') after?: string,
    @Query('fromParty') fromParty?: string | string[],
    @Query('toParty') toParty?: string | string[],
    @Query('amountGt') amountGt?: string,
    @Query('amountLt') amountLt?: string,
  ) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 25;

    try {
      return await (
        this.pqsSummaryService as PqsSummaryService & {
          fetchTokenTransfers: (
            nodes: ReturnType<NodeConfigService['list']>,
            tokenId: string,
            limit?: number,
            options?: {
              before?: string;
              after?: string;
              fromParties?: string[];
              toParties?: string[];
              amountGt?: string;
              amountLt?: string;
            },
          ) => Promise<unknown>;
        }
      ).fetchTokenTransfers(
        this.configService.list(),
        tokenId,
        Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 25,
        {
          before,
          after,
          fromParties: Array.isArray(fromParty) ? fromParty : fromParty ? [fromParty] : undefined,
          toParties: Array.isArray(toParty) ? toParty : toParty ? [toParty] : undefined,
          amountGt,
          amountLt,
        },
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'Token not found') {
        throw new NotFoundException(`Unknown token: ${tokenId}`);
      }

      throw error;
    }
  }

  @Get('/tokens/:tokenId')
  async getTokenDetail(@Param('tokenId') tokenId: string) {
    try {
      return await (
        this.pqsSummaryService as PqsSummaryService & {
          fetchTokenDetail: (
            nodes: ReturnType<NodeConfigService['list']>,
            tokenId: string,
          ) => Promise<unknown>;
        }
      ).fetchTokenDetail(this.configService.list(), tokenId);
    } catch (error) {
      if (error instanceof Error && error.message === 'Token not found') {
        throw new NotFoundException(`Unknown token: ${tokenId}`);
      }

      throw error;
    }
  }

  @Get('/tokens/:tokenId/holders')
  async listTokenHolders(@Param('tokenId') tokenId: string) {
    try {
      return await (
        this.pqsSummaryService as PqsSummaryService & {
          fetchTokenHolders: (
            nodes: ReturnType<NodeConfigService['list']>,
            tokenId: string,
          ) => Promise<unknown>;
        }
      ).fetchTokenHolders(this.configService.list(), tokenId);
    } catch (error) {
      if (error instanceof Error && error.message === 'Token not found') {
        throw new NotFoundException(`Unknown token: ${tokenId}`);
      }

      throw error;
    }
  }

  @Get('/search')
  search(@Query('q') query?: string) {
    return (
      this.pqsSummaryService as PqsSummaryService & {
        search: (searchQuery: string) => unknown;
      }
    ).search(query ?? '');
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
    const node = this.getNodeConfig(id);

    return this.pqsSummaryService.fetchNodePackages(node);
  }

  @Get('/nodes/:id/templates')
  async listNodeTemplates(@Param('id') id: string) {
    const node = this.getNodeConfig(id);

    return this.pqsSummaryService.fetchNodeTemplates(node);
  }

  @Get('/nodes/:id/participant-status')
  async getNodeParticipantStatus(@Param('id') id: string) {
    const node = this.getNodeConfig(id);
    return this.buildParticipantStatusEntry(node);
  }

  @Get('/nodes/:id/contracts')
  async listNodeContracts(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Query('after') after?: string,
    @Query('party') party?: string | string[],
    @Query('template') template?: string | string[],
    @Query('partyMode') partyMode?: string,
    @Query('mode') mode?: string,
    @Query('hideSplice') hideSplice?: string,
  ) {
    const node = this.getNodeConfig(id);
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 25;

    return this.pqsSummaryService.fetchNodeContracts(node, {
      limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 25,
      before,
      after,
      parties: Array.isArray(party) ? party : party ? [party] : undefined,
      templates: Array.isArray(template) ? template : template ? [template] : undefined,
      partyMode: partyMode ?? mode,
      hideSplice: hideSplice === 'true' || hideSplice === '1' ? true : undefined,
    });
  }

  @Get('/nodes/:id/parties')
  async listNodeActiveParties(@Param('id') id: string) {
    const node = this.getNodeConfig(id);
    const response = await this.pqsSummaryService.fetchActiveParties([node]);
    return response.nodes[0];
  }

  @Get('/nodes/:id/parties/local')
  async listNodeLocalParties(@Param('id') id: string) {
    const node = this.getNodeConfig(id);
    return this.buildLocalPartiesEntry(node);
  }

  @Get('/nodes/:id/updates')
  async listNodeUpdates(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Query('after') after?: string,
    @Query('party') party?: string | string[],
    @Query('template') template?: string | string[],
    @Query('partyMode') partyMode?: string,
    @Query('mode') mode?: string,
    @Query('hideSplice') hideSplice?: string,
  ) {
    const node = this.getNodeConfig(id);

    const parsedLimit = limit ? Number.parseInt(limit, 10) : 25;

    return this.pqsSummaryService.fetchRecentUpdates(
      node,
      {
        limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 25,
        before,
        after,
        parties: Array.isArray(party) ? party : party ? [party] : undefined,
        templates: Array.isArray(template) ? template : template ? [template] : undefined,
        partyMode: partyMode ?? mode,
        hideSplice: hideSplice === 'true' || hideSplice === '1' ? true : undefined,
      },
    );
  }

  @Get('/nodes/:id/updates/:updateId')
  async getNodeUpdateDetail(
    @Param('id') id: string,
    @Param('updateId') updateId: string,
  ) {
    const node = this.getNodeConfig(id);

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
    const node = this.getNodeConfig(id);

    try {
      return await this.pqsSummaryService.fetchContractDetail(node, contractId);
    } catch (error) {
      if (error instanceof Error && error.message === 'Contract not found') {
        throw new NotFoundException(`Unknown contract: ${contractId}`);
      }

      throw error;
    }
  }

  @Get('/parties')
  async listActiveParties() {
    return this.pqsSummaryService.fetchActiveParties(this.configService.list());
  }

  @Get('/templates')
  async listTemplates() {
    return this.pqsSummaryService.fetchTemplates();
  }

  @Get('/parties/local')
  async listLocalParties() {
    const nodes = await Promise.all(
      this.configService.list().map(async (node) => this.buildLocalPartiesEntry(node)),
    );

    return { nodes };
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

  @Get('/parties/:partyId/updates')
  async listPartyUpdates(
    @Param('partyId') partyId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Query('after') after?: string,
    @Query('template') template?: string | string[],
    @Query('partyMode') partyMode?: string,
    @Query('mode') mode?: string,
    @Query('hideSplice') hideSplice?: string,
  ) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 25;

    return this.pqsSummaryService.fetchPartyUpdates(this.configService.list(), partyId, {
      limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 25,
      before,
      after,
      templates: Array.isArray(template) ? template : template ? [template] : undefined,
      partyMode: partyMode ?? mode,
      hideSplice: hideSplice === 'true' || hideSplice === '1' ? true : undefined,
    });
  }

  @Get('/parties/:partyId/contracts')
  async listPartyContracts(
    @Param('partyId') partyId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Query('after') after?: string,
    @Query('template') template?: string | string[],
    @Query('hideSplice') hideSplice?: string,
  ) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 25;

    return this.pqsSummaryService.fetchPartyContracts(this.configService.list(), partyId, {
      limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 25,
      before,
      after,
      templates: Array.isArray(template) ? template : template ? [template] : undefined,
      hideSplice: hideSplice === 'true' || hideSplice === '1' ? true : undefined,
    });
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

  private getNodeConfig(id: string) {
    const node = this.configService.list().find((candidate) => candidate.id === id);
    if (!node) {
      throw new NotFoundException(`Unknown node: ${id}`);
    }

    return node;
  }

  private async buildLocalPartiesEntry(node: ReturnType<NodesController['getNodeConfig']>) {
    if (node.mode !== 'pqs_with_grpc') {
      return {
        nodeId: node.id,
        label: node.label,
        mode: node.mode,
        parties: [],
        localPartiesStatus: 'grpc_not_configured' as const,
        localPartiesError: null,
        localPartiesErrorCode: null,
        localPartiesErrorDetails: null,
        localPartiesErrorTid: null,
      };
    }

    try {
      return {
        nodeId: node.id,
        label: node.label,
        mode: node.mode,
        parties: await this.grpcOperationsService.listLocalParties(node),
        localPartiesStatus: 'ok' as const,
        localPartiesError: null,
        localPartiesErrorCode: null,
        localPartiesErrorDetails: null,
        localPartiesErrorTid: null,
      };
    } catch (error) {
      const grpcError = describeGrpcError(error);

      return {
        nodeId: node.id,
        label: node.label,
        mode: node.mode,
        parties: [],
        localPartiesStatus: 'grpc_error' as const,
        localPartiesError: grpcError.message,
        localPartiesErrorCode: grpcError.code,
        localPartiesErrorDetails: grpcError.details,
        localPartiesErrorTid: grpcError.tid,
      };
    }
  }

  private async buildParticipantStatusEntry(node: ReturnType<NodesController['getNodeConfig']>) {
    if (node.mode !== 'pqs_with_grpc') {
      return {
        nodeId: node.id,
        label: node.label,
        mode: node.mode,
        participantStatusStatus: 'grpc_not_configured' as const,
        participantStatus: null,
        notInitialized: null,
        participantStatusError: null,
        participantStatusErrorCode: null,
        participantStatusErrorDetails: null,
        participantStatusErrorTid: null,
      };
    }

    try {
      const result = await this.grpcOperationsService.fetchParticipantStatus(node);

      return {
        nodeId: node.id,
        label: node.label,
        mode: node.mode,
        participantStatusStatus: result.participantStatus ? ('ok' as const) : ('not_initialized' as const),
        participantStatus: result.participantStatus,
        notInitialized: result.notInitialized,
        participantStatusError: null,
        participantStatusErrorCode: null,
        participantStatusErrorDetails: null,
        participantStatusErrorTid: null,
      };
    } catch (error) {
      const grpcError = describeGrpcError(error);

      return {
        nodeId: node.id,
        label: node.label,
        mode: node.mode,
        participantStatusStatus: 'grpc_error' as const,
        participantStatus: null,
        notInitialized: null,
        participantStatusError: grpcError.message,
        participantStatusErrorCode: grpcError.code,
        participantStatusErrorDetails: grpcError.details,
        participantStatusErrorTid: grpcError.tid,
      };
    }
  }
}
