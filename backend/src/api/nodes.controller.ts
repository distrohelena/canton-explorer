import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { NodeCacheService } from '../cache/node-cache.service';
import { NodeConfigService } from '../config/node-config.service';
import { describeGrpcError } from '../grpc/grpc-error.util';
import { GrpcOperationsService } from '../grpc/grpc-operations.service';
import { NamespaceFingerprintService } from '../namespaces/namespace-fingerprint.service';
import { PqsSummaryService } from '../pqs/pqs-summary.service';

@Controller('/api')
export class NodesController {
  constructor(
    private readonly cacheService: NodeCacheService,
    private readonly configService: NodeConfigService,
    private readonly grpcOperationsService: GrpcOperationsService,
    private readonly namespaceFingerprintService: NamespaceFingerprintService,
    private readonly pqsSummaryService: PqsSummaryService,
  ) {}

  @Get('/nodes')
  listNodes() {
    return this.cacheService.list();
  }

  @Get('/nodes/activity-history')
  listActivityHistory(@Query('days') days?: string) {
    const parsedDays = days ? Number.parseInt(days, 10) : undefined;
    const configuredModes = new Map(
      this.configService.list().map((node) => [node.id, node.mode]),
    );

    const history = this.cacheService.listActivityHistory(
      parsedDays && Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : undefined,
    );

    return {
      ...history,
      nodes: history.nodes.map((node) => ({
        ...node,
        mode: configuredModes.get(node.nodeId),
      })),
    };
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
    @Query('node') node?: string | string[],
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
        nodeIds: node === undefined ? undefined : Array.isArray(node) ? node : [node],
        parties: Array.isArray(party) ? party : party ? [party] : undefined,
        templates: Array.isArray(template) ? template : template ? [template] : undefined,
        partyMode: partyMode ?? mode,
        hideSplice: hideSplice === 'true' || hideSplice === '1' ? true : undefined,
      },
    );
  }

  @Get('/traffic-purchases')
  listGlobalTrafficPurchases(
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Query('after') after?: string,
    @Query('node') node?: string | string[],
    @Query('minDate') minDate?: string,
    @Query('maxDate') maxDate?: string,
    @Query('purchasedMin') purchasedMin?: string,
    @Query('purchasedMax') purchasedMax?: string,
    @Query('paidMin') paidMin?: string,
    @Query('paidMax') paidMax?: string,
  ) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 25;

    return this.pqsSummaryService.fetchGlobalTrafficPurchases(
      this.configService.list(),
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 25,
      {
        before,
        after,
        nodeIds: node === undefined ? undefined : Array.isArray(node) ? node : [node],
        minDate,
        maxDate,
        purchasedMin,
        purchasedMax,
        paidMin,
        paidMax,
      },
    );
  }

  @Get('/tokens')
  listTokens(
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Query('after') after?: string,
    @Query('name') name?: string | string[],
    @Query('excludeName') excludeName?: string | string[],
    @Query('issuer') issuer?: string | string[],
  ) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 25;

    return (
      this.pqsSummaryService as PqsSummaryService & {
        fetchTokens: (
          nodes: ReturnType<NodeConfigService['list']>,
          limit?: number,
          options?: {
            before?: string;
            after?: string;
            names?: string[];
            excludeNames?: string[];
            issuers?: string[];
          },
        ) => unknown;
      }
    ).fetchTokens(
      this.configService.list(),
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 25,
      {
        before,
        after,
        names: Array.isArray(name) ? name : name ? [name] : undefined,
        excludeNames: Array.isArray(excludeName)
          ? excludeName
          : excludeName
            ? [excludeName]
            : undefined,
        issuers: Array.isArray(issuer) ? issuer : issuer ? [issuer] : undefined,
      },
    );
  }

  @Get('/tokens/transfers')
  listTokenTransfers(
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Query('after') after?: string,
    @Query('fromParty') fromParty?: string | string[],
    @Query('toParty') toParty?: string | string[],
    @Query('movementType') movementType?: string | string[],
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
            movementTypes?: string[];
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
        movementTypes: Array.isArray(movementType)
          ? movementType
          : movementType
            ? [movementType]
            : undefined,
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
    @Query('movementType') movementType?: string | string[],
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
              movementTypes?: string[];
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
          movementTypes: Array.isArray(movementType)
            ? movementType
            : movementType
              ? [movementType]
              : undefined,
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
  async listTokenHolders(
    @Param('tokenId') tokenId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Query('after') after?: string,
  ) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 25;

    try {
      return await (
        this.pqsSummaryService as PqsSummaryService & {
          fetchTokenHolders: (
            nodes: ReturnType<NodeConfigService['list']>,
            tokenId: string,
            limit?: number,
            options?: { before?: string; after?: string },
          ) => Promise<unknown>;
        }
      ).fetchTokenHolders(
        this.configService.list(),
        tokenId,
        Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 25,
        {
          before,
          after,
        },
      );
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

  @Get('/nodes/:id/traffic-purchases')
  async getNodeTrafficPurchases(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Query('after') after?: string,
    @Query('minDate') minDate?: string,
    @Query('maxDate') maxDate?: string,
    @Query('purchasedMin') purchasedMin?: string,
    @Query('purchasedMax') purchasedMax?: string,
    @Query('paidMin') paidMin?: string,
    @Query('paidMax') paidMax?: string,
  ) {
    const node = this.getNodeConfig(id);
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 25;
    const historyLimit =
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 25;

    const [currentResult, historyResult] = await Promise.allSettled([
      node.mode === 'pqs_with_grpc'
        ? this.grpcOperationsService.fetchTrafficStates(node)
        : Promise.resolve([]),
      this.pqsSummaryService.fetchTrafficPurchases(node, {
        limit: historyLimit,
        before,
        after,
        minDate,
        maxDate,
        purchasedMin,
        purchasedMax,
        paidMin,
        paidMax,
      }),
    ]);

    const current =
      node.mode !== 'pqs_with_grpc'
        ? {
            status: 'grpc_not_configured' as const,
            states: [],
            error: null,
          }
        : currentResult.status === 'fulfilled'
          ? {
              status: 'ok' as const,
              states: currentResult.value,
              error: null,
            }
          : {
              status: 'grpc_error' as const,
              states: [],
              error: describeGrpcError(currentResult.reason).message,
            };

    const history =
      historyResult.status === 'fulfilled'
        ? {
            status: 'ok' as const,
            limit: historyResult.value.limit,
            nextBefore: historyResult.value.nextBefore,
            nextAfter: historyResult.value.nextAfter,
            purchases: historyResult.value.purchases,
            error: null,
          }
        : {
            status: 'pqs_error' as const,
            limit: historyLimit,
            nextBefore: null,
            nextAfter: null,
            purchases: [],
            error:
              historyResult.reason instanceof Error
                ? historyResult.reason.message
                : 'Unknown PQS error',
          };

    return {
      nodeId: node.id,
      label: node.label,
      mode: node.mode,
      current,
      history,
    };
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

  @Get('/nodes/:id/parties/fingerprints')
  async listNodePartyFingerprints(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Query('after') after?: string,
    @Query('publicKey') publicKey?: string,
    @Query('encoding') encoding?: string,
    @Query('keyFormat') keyFormat?: string,
    @Query('keyType') keyType?: string,
  ) {
    const node = this.getNodeConfig(id);
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 10;
    return this.buildPartyFingerprintsEntry(node, {
      limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10,
      before,
      after,
      namespacePublicKey: publicKey,
      namespaceEncoding: encoding,
      namespaceKeyFormat: keyFormat,
      namespaceKeyType: keyType,
    });
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

    return this.pqsSummaryService.fetchRecentUpdates(node, {
      limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 25,
      before,
      after,
      parties: Array.isArray(party) ? party : party ? [party] : undefined,
      templates: Array.isArray(template) ? template : template ? [template] : undefined,
      partyMode: partyMode ?? mode,
      hideSplice: hideSplice === 'true' || hideSplice === '1' ? true : undefined,
    });
  }

  @Get('/nodes/:id/updates/:updateId')
  async getNodeUpdateDetail(@Param('id') id: string, @Param('updateId') updateId: string) {
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
  async getNodeContractDetail(@Param('id') id: string, @Param('contractId') contractId: string) {
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

  @Get('/parties/fingerprints')
  async listPartyFingerprints(
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Query('after') after?: string,
    @Query('publicKey') publicKey?: string,
    @Query('encoding') encoding?: string,
    @Query('keyFormat') keyFormat?: string,
    @Query('keyType') keyType?: string,
  ) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 10;
    return this.buildGlobalPartyFingerprintsEntry(this.configService.list(), {
      limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10,
      before,
      after,
      namespacePublicKey: publicKey,
      namespaceEncoding: encoding,
      namespaceKeyFormat: keyFormat,
      namespaceKeyType: keyType,
    });
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

  @Get('/namespaces/:namespaceId')
  async getNamespaceDetail(@Param('namespaceId') namespaceId: string) {
    try {
      return await this.pqsSummaryService.fetchNamespaceDetail(
        this.configService.list(),
        namespaceId,
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'Namespace not found') {
        throw new NotFoundException(`Unknown namespace: ${namespaceId}`);
      }

      throw error;
    }
  }

  @Get('/namespaces/:namespaceId/parties')
  async listNamespaceParties(
    @Param('namespaceId') namespaceId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Query('after') after?: string,
  ) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 25;

    try {
      return await this.pqsSummaryService.fetchNamespaceParties(
        this.configService.list(),
        namespaceId,
        {
          limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 25,
          before,
          after,
        },
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'Namespace not found') {
        throw new NotFoundException(`Unknown namespace: ${namespaceId}`);
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
        participantStatusStatus: result.participantStatus
          ? ('ok' as const)
          : ('not_initialized' as const),
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

  private async buildPartyFingerprintsEntry(
    node: ReturnType<NodesController['getNodeConfig']>,
    options: {
      limit: number;
      before?: string;
      after?: string;
      namespacePublicKey?: string;
      namespaceEncoding?: string;
      namespaceKeyFormat?: string;
      namespaceKeyType?: string;
    },
  ) {
    const exactFingerprint = await this.resolveNamespaceFilter(options);

    if (node.mode === 'pqs_with_grpc') {
      try {
        const fingerprints = await this.grpcOperationsService.listKnownPartyFingerprints(node);
        return {
          nodeId: node.id,
          label: node.label,
          mode: node.mode,
          source: 'grpc' as const,
          ...this.paginateFingerprints(
            this.filterFingerprints(fingerprints, exactFingerprint),
            options,
          ),
        };
      } catch {
        // Fall through to PQS-derived suffixes when gRPC is unavailable.
      }
    }

    const response = await this.pqsSummaryService.fetchActiveParties([node]);
    const parties = response.nodes[0]?.parties ?? [];

    return {
      nodeId: node.id,
      label: node.label,
      mode: node.mode,
      source: 'pqs' as const,
      ...this.paginateFingerprints(
        this.filterFingerprints(this.extractFingerprintsFromParties(parties), exactFingerprint),
        options,
      ),
    };
  }

  private async buildGlobalPartyFingerprintsEntry(
    nodes: ReturnType<NodeConfigService['list']>,
    options: {
      limit: number;
      before?: string;
      after?: string;
      namespacePublicKey?: string;
      namespaceEncoding?: string;
      namespaceKeyFormat?: string;
      namespaceKeyType?: string;
    },
  ) {
    const exactFingerprint = await this.resolveNamespaceFilter(options);

    const canUseGrpcForAll = nodes.every((node) => node.mode === 'pqs_with_grpc');

    if (canUseGrpcForAll) {
      try {
        const fingerprints = Array.from(
          new Set(
            (
              await Promise.all(
                nodes.map((node) => this.grpcOperationsService.listKnownPartyFingerprints(node)),
              )
            ).flat(),
          ),
        ).sort((left, right) => left.localeCompare(right));

        return {
          source: 'grpc' as const,
          ...this.paginateFingerprints(
            this.filterFingerprints(fingerprints, exactFingerprint),
            options,
          ),
        };
      } catch {
        // Fall through to PQS so the global result uses one consistent source.
      }
    }

    const response = await this.pqsSummaryService.fetchActiveParties(nodes);
    const fingerprints = Array.from(
      new Set(response.nodes.flatMap((node) => this.extractFingerprintsFromParties(node.parties))),
    ).sort((left, right) => left.localeCompare(right));

    return {
      source: 'pqs' as const,
      ...this.paginateFingerprints(
        this.filterFingerprints(fingerprints, exactFingerprint),
        options,
      ),
    };
  }

  private extractFingerprintsFromParties(parties: string[]): string[] {
    return Array.from(
      new Set(
        parties
          .map((partyId) => {
            const separatorIndex = partyId.indexOf('::');
            if (separatorIndex === -1) {
              return partyId.trim();
            }

            return partyId.slice(separatorIndex + 2).trim();
          })
          .filter((fingerprint) => fingerprint.length > 0),
      ),
    ).sort((left, right) => left.localeCompare(right));
  }

  private paginateFingerprints(
    fingerprints: string[],
    options: {
      limit: number;
      before?: string;
      after?: string;
    },
  ) {
    const sortedFingerprints = Array.from(new Set(fingerprints)).sort((left, right) =>
      left.localeCompare(right),
    );
    const limit = Math.max(1, options.limit);

    if (options.after) {
      const endIndex = sortedFingerprints.findIndex((value) => value === options.after);
      const normalizedEndIndex = endIndex >= 0 ? endIndex : sortedFingerprints.length;
      const startIndex = Math.max(0, normalizedEndIndex - limit);
      const page = sortedFingerprints.slice(startIndex, normalizedEndIndex);

      return {
        limit,
        nextBefore:
          normalizedEndIndex < sortedFingerprints.length && page.length > 0
            ? page[page.length - 1]
            : null,
        nextAfter: startIndex > 0 && page.length > 0 ? page[0] : null,
        fingerprints: page,
      };
    }

    const startIndex = options.before
      ? (() => {
          const index = sortedFingerprints.findIndex((value) => value === options.before);
          return index >= 0 ? index + 1 : 0;
        })()
      : 0;
    const page = sortedFingerprints.slice(startIndex, startIndex + limit);

    return {
      limit,
      nextBefore:
        startIndex + limit < sortedFingerprints.length && page.length > 0
          ? page[page.length - 1]
          : null,
      nextAfter: startIndex > 0 && page.length > 0 ? page[0] : null,
      fingerprints: page,
    };
  }

  private async resolveNamespaceFilter(options: {
    namespacePublicKey?: string;
    namespaceEncoding?: string;
    namespaceKeyFormat?: string;
    namespaceKeyType?: string;
  }): Promise<string | null> {
    if (!options.namespacePublicKey?.trim()) {
      return null;
    }

    return this.namespaceFingerprintService.computeFromInput({
      publicKey: options.namespacePublicKey,
      encoding: options.namespaceEncoding,
      keyFormat: options.namespaceKeyFormat,
      keyType: options.namespaceKeyType,
    });
  }

  private filterFingerprints(fingerprints: string[], exactFingerprint: string | null): string[] {
    if (!exactFingerprint) {
      return fingerprints;
    }

    return fingerprints.filter((fingerprint) => fingerprint === exactFingerprint);
  }
}
