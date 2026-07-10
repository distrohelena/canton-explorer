import { Injectable } from '@nestjs/common';
import type { NodeConfig } from '../config/node-config.schema';
import type {
  NodeParticipantNotInitializedSummary,
  NodeParticipantStatusComponent,
  NodeParticipantStatusSummary,
  NodeParticipantSynchronizerHealth,
  NodeParticipantWaitingForExternalInput,
  ServiceInfo,
} from '../domain/node.types';
import type { CachedPackageBlob, CachedPackageRef } from '../packages/package-cache.service';
import { GrpcClientFactory } from './grpc-client.factory';

export interface GrpcPartyTopologyParticipantMapping {
  participantId: string | null;
  participantUid: string | null;
  permission: string | null;
  threshold: number | null;
  synchronizerIds: string[];
}

export interface GrpcPartyTopologyKeyMapping {
  keyFingerprint: string | null;
  publicKey: string | null;
  purpose: string | null;
  keyType: string | null;
  keyFormat: string | null;
  keySpec: string | null;
  threshold: number | null;
  synchronizerIds: string[];
}

export type GrpcPartyTopologyStatus = 'ok' | 'grpc_not_configured' | 'grpc_error';

export interface GrpcPartyTopologyNodeEntry {
  nodeId: string;
  label: string;
  status: GrpcPartyTopologyStatus;
  errorMessage: string | null;
  isLocalParty?: boolean | null;
  partyToParticipants: GrpcPartyTopologyParticipantMapping[];
  partyToKeyMappings: GrpcPartyTopologyKeyMapping[];
}

type TopologyStoreShape = {
  kind?: 'authorized' | 'synchronizer' | 'temporary';
  authorized?: Record<string, never>;
  synchronizer?: {
    id?: string;
    physicalId?: string;
  };
  temporary?: {
    name: string;
  };
};

type TopologySdkModule = {
  ListPartyToParticipantRequest: new (init: {
    filterParty?: string;
    filterParticipant?: string;
    baseQuery?: {
      storeId?: TopologyStoreShape;
      headState?: boolean;
    };
  }) => {
    filterParty?: string;
    filterParticipant?: string;
    baseQuery?: {
      storeId?: TopologyStoreShape;
      headState?: boolean;
    };
  };
  TopologyBaseQuery: new (init: {
    storeId?: TopologyStoreShape;
    headState?: boolean;
  }) => {
    storeId?: TopologyStoreShape;
    headState?: boolean;
  };
  TopologyStoreId: new (init: {
    kind: unknown;
    authorized?: unknown;
    synchronizer?: unknown;
    temporary?: unknown;
  }) => TopologyStoreShape;
  TopologyStoreKind: {
    authorized: unknown;
    synchronizer: unknown;
    temporary: unknown;
  };
  TopologyStoreAuthorized: new (init?: Record<string, never>) => unknown;
  TopologyStoreSynchronizer: new (init: {
    id?: string;
    physicalId?: string;
  }) => TopologyStoreShape['synchronizer'];
  TopologyStoreTemporary: new (init: {
    name: string;
  }) => TopologyStoreShape['temporary'];
};

@Injectable()
export class GrpcOperationsService {
  private topologySdkPromise?: Promise<TopologySdkModule>;

  constructor(private readonly clientFactory: GrpcClientFactory) {}

  async fetchOperationalInfo(node: NodeConfig): Promise<ServiceInfo> {
    if (node.mode !== 'pqs_with_grpc') {
      return {
        target: null,
        reachable: false,
        healthCheckImplemented: false,
        servingStatus: null,
      };
    }

    return this.withClient(node, async (client) => {
      const response = await client.healthService.checkAsync({ service: '' });
      const servingStatus = this.mapHealthStatus(response?.status);

      return {
        target: node.grpc.ledgerTarget,
        reachable: true,
        healthCheckImplemented: servingStatus !== null,
        servingStatus,
      };
    });
  }

  async listLocalParties(node: NodeConfig): Promise<string[]> {
    if (node.mode !== 'pqs_with_grpc') {
      return [];
    }

    return this.withClient(node, async (client) => this.listLocalPartiesWithClient(client));
  }

  async listKnownPartyFingerprints(node: NodeConfig): Promise<string[]> {
    if (node.mode !== 'pqs_with_grpc') {
      return [];
    }

    return this.withClient(node, async (client) => {
      const [partyTopologyResponse, localParties] = await Promise.all([
        client.topologyAggregationService.listPartiesAsync({
          synchronizerIds: [],
        }),
        this.listLocalPartiesWithClient(client),
      ]);

      const parties = this.uniqueNonEmptyStrings([
        ...(partyTopologyResponse.results ?? []).map((result) => result.party),
        ...localParties,
      ]);

      return parties
        .map((partyId) => this.extractPartyFingerprint(partyId))
        .filter((fingerprint): fingerprint is string => fingerprint !== null)
        .sort((left, right) => left.localeCompare(right));
    });
  }

  async fetchPartyTopology(
    node: NodeConfig,
    partyId: string,
  ): Promise<GrpcPartyTopologyNodeEntry> {
    if (node.mode !== 'pqs_with_grpc') {
      return {
        nodeId: node.id,
        label: node.label,
        status: 'grpc_not_configured',
        errorMessage: null,
        isLocalParty: null,
        partyToParticipants: [],
        partyToKeyMappings: [],
      };
    }

    try {
      return await this.withClient(node, async (client) => {
        const [partyTopologyResponse, keyOwnerResponse, rawPartyToParticipantResponse] = await Promise.all([
          client.topologyAggregationService.listPartiesAsync({
            filterParty: partyId,
            synchronizerIds: [],
          }),
          client.topologyAggregationService.listKeyOwnersAsync({
            filterKeyOwnerUid: partyId,
            synchronizerIds: [],
          }),
          this.tryListRawPartyToParticipant(client, partyId),
        ]);

        const aggregatedParticipantMappings = (partyTopologyResponse.results ?? [])
          .filter((result) => result.party === partyId)
          .flatMap((result) =>
            (result.participants ?? []).map((participant) => ({
              participantId: this.extractParticipantId(participant.participantUid),
              participantUid: this.nullIfEmptyString(participant.participantUid),
              permission: this.joinDistinctValues(
                (participant.synchronizers ?? []).map((synchronizer) => synchronizer.permission),
              ),
              threshold: null,
              synchronizerIds: this.uniqueNonEmptyStrings(
                (participant.synchronizers ?? []).map(
                  (synchronizer) =>
                    synchronizer.synchronizerId ?? synchronizer.physicalSynchronizerId,
                ),
              ),
            })),
          );
        const rawPartyMappings = (rawPartyToParticipantResponse?.results ?? [])
          .map((result) => result.item)
          .filter((item): item is NonNullable<typeof item> => item !== undefined && item !== null)
          .filter((item) => item.party === partyId);
        const rawTopologySynchronizerId = this.extractRawTopologySynchronizerId(
          rawPartyToParticipantResponse?.storeId,
        );
        const rawParticipantMappings = rawPartyMappings.flatMap((item) =>
          (item.participants ?? []).map((participant) => ({
            participantId: this.extractParticipantId(participant.participantUid),
            participantUid: this.nullIfEmptyString(participant.participantUid),
            permission: this.nullIfEmptyString(participant.permission),
            threshold:
              typeof item.threshold === 'number' && Number.isFinite(item.threshold)
                ? item.threshold
                : null,
            synchronizerIds: rawTopologySynchronizerId ? [rawTopologySynchronizerId] : [],
          })),
        );
        const aggregatedKeyMappings = (keyOwnerResponse.results ?? [])
          .filter((result) => result.keyOwner === partyId)
          .flatMap((result) => [
            ...(result.signingKeys ?? []).map((signingKey) => ({
              keyFingerprint:
                this.nullIfEmptyString(signingKey.fingerprint)
                ?? this.computePublicKeyFingerprint(client, signingKey.publicKey, signingKey.format),
              publicKey: this.bytesToHex(signingKey.publicKey),
              purpose: this.joinDistinctValues(signingKey.usage ?? []),
              keyType: this.nullIfEmptyString(signingKey.scheme),
              keyFormat: this.nullIfEmptyString(signingKey.format),
              keySpec: this.nullIfEmptyString(signingKey.keySpec),
              threshold: null,
              synchronizerIds: this.uniqueNonEmptyStrings([
                result.synchronizerId ?? result.physicalSynchronizerId,
              ]),
            })),
            ...(result.encryptionKeys ?? []).map((encryptionKey) => ({
              keyFingerprint:
                this.nullIfEmptyString(encryptionKey.fingerprint)
                ?? this.computePublicKeyFingerprint(
                  client,
                  encryptionKey.publicKey,
                  encryptionKey.format,
                ),
              publicKey: this.bytesToHex(encryptionKey.publicKey),
              purpose: 'encryption',
              keyType: this.nullIfEmptyString(encryptionKey.scheme),
              keyFormat: this.nullIfEmptyString(encryptionKey.format),
              keySpec: this.nullIfEmptyString(encryptionKey.keySpec),
              threshold: null,
              synchronizerIds: this.uniqueNonEmptyStrings([
                result.synchronizerId ?? result.physicalSynchronizerId,
              ]),
            })),
          ]);
        const rawSigningKeyMappings = rawPartyMappings.flatMap((item) =>
          (item.partySigningKeys?.keys ?? []).map((signingKey) => ({
            keyFingerprint: this.computePublicKeyFingerprint(
              client,
              signingKey.publicKey,
              signingKey.format,
            ),
            publicKey: this.bytesToHex(signingKey.publicKey),
            purpose: this.joinDistinctValues(signingKey.usage ?? []),
            keyType: this.nullIfEmptyString(signingKey.scheme),
            keyFormat: this.nullIfEmptyString(signingKey.format),
            keySpec: this.nullIfEmptyString(signingKey.keySpec),
            threshold:
              typeof item.partySigningKeys?.threshold === 'number'
              && Number.isFinite(item.partySigningKeys.threshold)
                ? item.partySigningKeys.threshold
                : null,
            synchronizerIds: rawTopologySynchronizerId ? [rawTopologySynchronizerId] : [],
          })),
        );

        return {
          nodeId: node.id,
          label: node.label,
          status: 'ok',
          errorMessage: null,
          isLocalParty: null,
          partyToParticipants: this.mergePartyTopologyParticipants([
            ...aggregatedParticipantMappings,
            ...rawParticipantMappings,
          ]),
          partyToKeyMappings: this.mergePartyTopologyKeyMappings([
            ...aggregatedKeyMappings,
            ...rawSigningKeyMappings,
          ]),
        };
      });
    } catch (error) {
      return {
        nodeId: node.id,
        label: node.label,
        status: 'grpc_error',
        errorMessage: error instanceof Error ? error.message : 'Unknown gRPC error',
        isLocalParty: null,
        partyToParticipants: [],
        partyToKeyMappings: [],
      };
    }
  }

  async fetchParticipantStatus(
    node: NodeConfig,
  ): Promise<
    | { participantStatus: NodeParticipantStatusSummary; notInitialized: null }
    | { participantStatus: null; notInitialized: NodeParticipantNotInitializedSummary }
  > {
    if (node.mode !== 'pqs_with_grpc') {
      throw new Error(`Node ${node.id} does not define grpc settings`);
    }

    return this.withClient(node, async (client) => {
      const response = await client.participantStatusService.getParticipantStatusAsync({});
      const status = response.status;

      if (status) {

        return {
          participantStatus: {
            uid: this.nullIfEmptyString(status.uid),
            uptime: this.formatDuration(status.uptime),
            ports: status.ports ?? {},
            active: status.active,
            commonStatusActive:
              typeof status.active === 'boolean' ? status.active : null,
            version: this.nullIfEmptyString(status.version),
            supportedProtocolVersions: status.supportedProtocolVersions ?? [],
            topologyQueues: status.topologyQueues
              ? {
                  manager: status.topologyQueues.manager,
                  dispatcher: status.topologyQueues.dispatcher,
                  clients: status.topologyQueues.clients,
                }
              : null,
            components: (status.components ?? []).map((component) =>
              this.mapComponentStatus(component),
            ),
            connectedSynchronizers: (status.connectedSynchronizers ?? []).map(
              (synchronizer) => ({
                physicalSynchronizerId: this.nullIfEmptyString(
                  synchronizer.physicalSynchronizerId,
                ),
                health: this.mapSynchronizerHealth(synchronizer.health),
              }),
            ),
          },
          notInitialized: null,
        };
      }

      if (response.notInitialized) {
        return {
          participantStatus: null,
          notInitialized: {
            active: response.notInitialized.active,
            waitingForExternalInput: this.mapWaitingForExternalInput(
              response.notInitialized.waitingForExternalInput,
            ),
            version: this.nullIfEmptyString(response.notInitialized.version),
          },
        };
      }

      return {
        participantStatus: null,
        notInitialized: {
          active: false,
          waitingForExternalInput: 'unspecified',
          version: null,
        },
      };
    });
  }

  async fetchPackageRefs(node: NodeConfig): Promise<CachedPackageRef[]> {
    if (node.mode !== 'pqs_with_grpc') {
      return [];
    }

    return this.withClient(node, async (client) => {
      try {
        const response = await client.participantPackageService.listPackagesAsync({});

        return (response.packageDescriptions ?? [])
          .map((description) => ({
            packageId: description.packageId,
            mainPackageId: description.packageId,
            name: description.name || null,
            version: description.version || null,
            uploadedAt: description.uploadedAt?.toISOString() ?? null,
            packageSize: description.size ?? null,
          }))
          .sort((left, right) => left.packageId.localeCompare(right.packageId));
      } catch (error) {
        if (!this.shouldFallbackToLedgerPackageListing(error)) {
          throw error;
        }
      }

      const fallbackResponse = await client.packageService.listPackagesAsync({});
      const packageRefs = await Promise.all(
        (fallbackResponse.packageIds ?? []).map(async (packageId) => {
          const packageResponse = await client.packageService.getPackageAsync({ packageId });
          const archivePayload = Buffer.from(packageResponse.archivePayload);
          const metadata = await this.decodePackageArchiveMetadata(archivePayload);

          return {
            packageId,
            mainPackageId: packageId,
            name: metadata.name,
            version: metadata.version,
            uploadedAt: null,
            packageSize: archivePayload.length,
          };
        }),
      );

      return packageRefs.sort((left, right) => left.packageId.localeCompare(right.packageId));
    });
  }

  async fetchPackagesByRefs(
    node: NodeConfig,
    packageRefs: CachedPackageRef[],
  ): Promise<CachedPackageBlob[]> {
    if (node.mode !== 'pqs_with_grpc' || packageRefs.length === 0) {
      return [];
    }

    return this.withClient(node, async (client) => {
      return Promise.all(
        packageRefs.map(async (packageRef) => {
          const response = await client.packageService.getPackageAsync({
            packageId: packageRef.packageId,
          });

          return {
            packageId: packageRef.packageId,
            name: packageRef.name,
            version: packageRef.version,
            uploadedAt: packageRef.uploadedAt,
            packageSize: packageRef.packageSize,
            data: Buffer.from(response.archivePayload),
          };
        }),
      );
    });
  }

  private mapHealthStatus(status: unknown): string | null {
    switch (status) {
      case 'serving':
        return 'SERVING';
      case 'notServing':
        return 'NOT_SERVING';
      case 'serviceUnknown':
        return 'SERVICE_UNKNOWN';
      case 'unknown':
        return 'UNKNOWN';
      default:
        return null;
    }
  }

  private shouldFallbackToLedgerPackageListing(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    return error.message.includes('Method not found:') && error.message.includes('PackageService/ListPackages');
  }

  private loadTopologySdk(): Promise<TopologySdkModule> {
    this.topologySdkPromise ??= (() => {
      const sdkModulePath = '@distrohelena/canton-typescript-sdk';
      return import(sdkModulePath) as Promise<TopologySdkModule>;
    })();

    return this.topologySdkPromise;
  }

  private buildTopologyStoreId(
    sdk: TopologySdkModule,
    store: TopologyStoreShape,
  ): TopologyStoreShape | undefined {
    switch (store.kind) {
      case 'authorized':
        return new sdk.TopologyStoreId({
          kind: sdk.TopologyStoreKind.authorized,
          authorized: new sdk.TopologyStoreAuthorized(),
        });
      case 'synchronizer':
        return new sdk.TopologyStoreId({
          kind: sdk.TopologyStoreKind.synchronizer,
          synchronizer: new sdk.TopologyStoreSynchronizer({
            id: store.synchronizer?.id,
            physicalId: store.synchronizer?.physicalId,
          }),
        });
      case 'temporary':
        if (!store.temporary?.name) {
          return undefined;
        }

        return new sdk.TopologyStoreId({
          kind: sdk.TopologyStoreKind.temporary,
          temporary: new sdk.TopologyStoreTemporary({
            name: store.temporary.name,
          }),
        });
      default:
        return undefined;
    }
  }

  private nullIfEmptyString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
  }

  private async tryListRawPartyToParticipant(
    client: Awaited<ReturnType<GrpcClientFactory['create']>>,
    partyId: string,
  ): Promise<
    | {
        storeId?: {
          kind?: 'authorized' | 'synchronizer' | 'temporary';
          synchronizer?: {
            id?: string;
            physicalId?: string;
          };
        };
        results?: Array<{
          item?: {
            party?: string;
            threshold?: number;
            participants?: Array<{
              participantUid?: string;
              permission?: unknown;
            }>;
            partySigningKeys?: {
              threshold?: number;
              keys?: Array<{
                format?: string;
                publicKey?: Uint8Array;
                usage?: string[];
                scheme?: string;
                keySpec?: string;
              }>;
            };
          };
        }>;
      }
    | null
  > {
    if (
      !client.topologyManagerReadService?.listPartyToParticipantAsync
      || !client.topologyManagerReadService.listAvailableStoresAsync
    ) {
      return null;
    }

    try {
      const sdk = await this.loadTopologySdk();
      const availableStores = await client.topologyManagerReadService.listAvailableStoresAsync({});
      const synchronizerStores = (availableStores.storeIds ?? []).filter(
        (store) => store.kind === 'synchronizer' && store.synchronizer !== undefined,
      );

      for (const storeId of synchronizerStores) {
        try {
          const response = await client.topologyManagerReadService.listPartyToParticipantAsync(
            new sdk.ListPartyToParticipantRequest({
              filterParty: partyId,
              baseQuery: new sdk.TopologyBaseQuery({
                storeId: this.buildTopologyStoreId(sdk, storeId),
                headState: true,
              }),
            }),
          );

          if ((response.results ?? []).length > 0) {
            return {
              storeId,
              results: response.results,
            };
          }
        } catch {
          continue;
        }
      }
    } catch {
      return null;
    }

    return null;
  }

  private uniqueNonEmptyStrings(values: unknown[]): string[] {
    return Array.from(
      new Set(
        values
          .map((value) => this.nullIfEmptyString(value))
          .filter((value): value is string => value !== null),
      ),
    );
  }

  private joinDistinctValues(values: unknown[]): string | null {
    const normalizedValues = this.uniqueNonEmptyStrings(values);
    return normalizedValues.length > 0 ? normalizedValues.join(', ') : null;
  }

  private mergePartyTopologyParticipants(
    mappings: GrpcPartyTopologyParticipantMapping[],
  ): GrpcPartyTopologyParticipantMapping[] {
    const merged = new Map<string, GrpcPartyTopologyParticipantMapping>();

    for (const mapping of mappings) {
      const key = mapping.participantUid ?? mapping.participantId ?? JSON.stringify(mapping);
      const existing = merged.get(key);

      if (!existing) {
        merged.set(key, {
          participantId: mapping.participantId,
          participantUid: mapping.participantUid,
          permission: mapping.permission,
          threshold: mapping.threshold,
          synchronizerIds: [...mapping.synchronizerIds],
        });
        continue;
      }

      existing.participantId ??= mapping.participantId;
      existing.participantUid ??= mapping.participantUid;
      existing.permission ??= mapping.permission;
      existing.threshold ??= mapping.threshold;
      existing.synchronizerIds = this.uniqueNonEmptyStrings([
        ...existing.synchronizerIds,
        ...mapping.synchronizerIds,
      ]);
    }

    return Array.from(merged.values()).filter(
      (mapping) =>
        mapping.participantId !== null
        || mapping.participantUid !== null
        || mapping.permission !== null
        || mapping.threshold !== null
        || mapping.synchronizerIds.length > 0,
    );
  }

  private mergePartyTopologyKeyMappings(
    mappings: GrpcPartyTopologyKeyMapping[],
  ): GrpcPartyTopologyKeyMapping[] {
    const merged = new Map<string, GrpcPartyTopologyKeyMapping>();

    for (const mapping of mappings) {
      const key = mapping.keyFingerprint ?? JSON.stringify(mapping);
      const existing = merged.get(key);

      if (!existing) {
        merged.set(key, {
          keyFingerprint: mapping.keyFingerprint,
          publicKey: mapping.publicKey,
          purpose: mapping.purpose,
          keyType: mapping.keyType,
          keyFormat: mapping.keyFormat,
          keySpec: mapping.keySpec,
          threshold: mapping.threshold,
          synchronizerIds: [...mapping.synchronizerIds],
        });
        continue;
      }

      existing.keyFingerprint ??= mapping.keyFingerprint;
      existing.publicKey ??= mapping.publicKey;
      existing.purpose ??= mapping.purpose;
      existing.keyType ??= mapping.keyType;
      existing.keyFormat ??= mapping.keyFormat;
      existing.keySpec ??= mapping.keySpec;
      existing.threshold ??= mapping.threshold;
      existing.synchronizerIds = this.uniqueNonEmptyStrings([
        ...existing.synchronizerIds,
        ...mapping.synchronizerIds,
      ]);
    }

    return Array.from(merged.values()).filter(
      (mapping) =>
        mapping.keyFingerprint !== null
        || mapping.publicKey !== null
        || mapping.purpose !== null
        || mapping.keyType !== null
        || mapping.keyFormat !== null
        || mapping.keySpec !== null
        || mapping.threshold !== null
        || mapping.synchronizerIds.length > 0,
    );
  }

  private bytesToHex(value: Uint8Array | null | undefined): string | null {
    if (!value || value.length === 0) {
      return null;
    }

    return Buffer.from(value).toString('hex');
  }

  private computePublicKeyFingerprint(
    client: { hashing?: { computePublicKeyFingerprint(publicKey: Uint8Array, format?: string): string } },
    publicKey: Uint8Array | null | undefined,
    format?: string | null,
  ): string | null {
    if (!publicKey || publicKey.length === 0) {
      return null;
    }

    return this.nullIfEmptyString(
      client.hashing?.computePublicKeyFingerprint(
        publicKey,
        this.nullIfEmptyString(format) ?? undefined,
      ),
    );
  }

  private extractParticipantId(participantUid: unknown): string | null {
    const normalizedParticipantUid = this.nullIfEmptyString(participantUid);

    if (!normalizedParticipantUid) {
      return null;
    }

    const separatorIndex = normalizedParticipantUid.indexOf('::');
    if (separatorIndex === -1) {
      return normalizedParticipantUid;
    }

    return normalizedParticipantUid.slice(0, separatorIndex) || null;
  }

  private async listLocalPartiesWithClient(client: {
    partyManagementService: {
      listKnownPartiesAsync(input: {
        pageSize: number;
        pageToken?: string;
      }): Promise<{ partyDetails?: Array<{ party: string; isLocal: boolean }>; nextPageToken?: string }>;
    };
  }): Promise<string[]> {
    const parties: string[] = [];
    let nextPageToken: string | undefined;

    do {
      const response = await client.partyManagementService.listKnownPartiesAsync({
        pageSize: 1000,
        pageToken: nextPageToken,
      });

      for (const partyDetail of response.partyDetails ?? []) {
        if (partyDetail.isLocal) {
          parties.push(partyDetail.party);
        }
      }

      nextPageToken = response.nextPageToken;
    } while (nextPageToken);

    return parties.sort((left, right) => left.localeCompare(right));
  }

  private extractPartyFingerprint(partyId: unknown): string | null {
    const normalizedPartyId = this.nullIfEmptyString(partyId);
    if (!normalizedPartyId) {
      return null;
    }

    const separatorIndex = normalizedPartyId.indexOf('::');
    if (separatorIndex === -1) {
      return normalizedPartyId;
    }

    const fingerprint = normalizedPartyId.slice(separatorIndex + 2).trim();
    return fingerprint.length > 0 ? fingerprint : null;
  }

  private extractRawTopologySynchronizerId(
    storeId:
      | {
          kind?: 'authorized' | 'synchronizer' | 'temporary';
          synchronizer?: {
            id?: string;
            physicalId?: string;
          };
        }
      | undefined,
  ): string | null {
    if (storeId?.kind !== 'synchronizer') {
      return null;
    }

    return this.nullIfEmptyString(storeId.synchronizer?.id ?? storeId.synchronizer?.physicalId);
  }

  private formatDuration(
    duration: { seconds?: string | number | bigint; nanos?: number } | null | undefined,
  ): string | null {
    if (!duration) {
      return null;
    }

    const seconds =
      duration.seconds === undefined || duration.seconds === null
        ? null
        : typeof duration.seconds === 'bigint'
          ? duration.seconds.toString()
          : String(duration.seconds);
    const nanos = typeof duration.nanos === 'number' ? duration.nanos : 0;

    if (seconds === null) {
      return nanos > 0 ? `${nanos}ns` : null;
    }

    return nanos > 0 ? `${seconds}s ${nanos}ns` : `${seconds}s`;
  }

  private mapComponentStatus(component: {
    name: string;
    kind: 'unknown' | 'ok' | 'degraded' | 'failed' | 'fatal';
    description?: string;
  }): NodeParticipantStatusComponent {
    switch (component.kind) {
      case 'ok':
        return {
          name: component.name,
          severity: 'ok',
          description: component.description ?? null,
        };
      case 'degraded':
        return {
          name: component.name,
          severity: 'degraded',
          description: component.description ?? null,
        };
      case 'failed':
        return {
          name: component.name,
          severity: 'failed',
          description: component.description ?? null,
        };
      case 'fatal':
        return {
          name: component.name,
          severity: 'fatal',
          description: component.description ?? null,
        };
      default:
        return {
          name: component.name,
          severity: 'failed',
          description: null,
        };
    }
  }

  private mapSynchronizerHealth(
    health: number | string | null | undefined,
  ): NodeParticipantSynchronizerHealth {
    switch (health) {
      case 'healthy':
      case 1:
        return 'healthy';
      case 'unhealthy':
      case 2:
        return 'unhealthy';
      case 'unspecified':
      case 0:
        return 'unspecified';
      default:
        return 'unspecified';
    }
  }

  private mapWaitingForExternalInput(
    value: string,
  ): NodeParticipantWaitingForExternalInput {
    switch (value) {
      case 'id':
        return 'id';
      case 'nodeTopology':
        return 'node_topology';
      case 'initialization':
        return 'initialization';
      default:
        return 'unspecified';
    }
  }

  private async decodePackageArchiveMetadata(
    archivePayload: Buffer,
  ): Promise<{ name: string | null; version: string | null }> {
    const sdk = await import('@distrohelena/canton-typescript-sdk/daml-lf');
    const packageLoader = new sdk.DamlLfPackageLoader();
    const decodedPackage = packageLoader.loadPackageOrThrow(archivePayload);

    return {
      name: decodedPackage.packageName || null,
      version: decodedPackage.packageVersion || null,
    };
  }

  private async withClient<T>(
    node: NodeConfig,
    run: (client: Awaited<ReturnType<GrpcClientFactory['create']>>) => Promise<T>,
  ): Promise<T> {
    const client = await this.clientFactory.create(node);

    try {
      return await run(client);
    } finally {
      await client.disposeAsync?.();
    }
  }
}
