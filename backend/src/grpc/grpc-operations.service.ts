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
  synchronizerIds: string[];
}

export interface GrpcPartyTopologyKeyMapping {
  keyFingerprint: string | null;
  purpose: string | null;
  keyType: string | null;
  synchronizerIds: string[];
}

export type GrpcPartyTopologyStatus = 'ok' | 'grpc_not_configured' | 'grpc_error';

export interface GrpcPartyTopologyNodeEntry {
  nodeId: string;
  label: string;
  status: GrpcPartyTopologyStatus;
  errorMessage: string | null;
  partyToParticipants: GrpcPartyTopologyParticipantMapping[];
  partyToKeyMappings: GrpcPartyTopologyKeyMapping[];
}

@Injectable()
export class GrpcOperationsService {
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

    return this.withClient(node, async (client) => {
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
        partyToParticipants: [],
        partyToKeyMappings: [],
      };
    }

    try {
      return await this.withClient(node, async (client) => {
        const [partyTopologyResponse, keyOwnerResponse] = await Promise.all([
          client.topologyAggregationService.listPartiesAsync({
            filterParty: partyId,
            synchronizerIds: [],
          }),
          client.topologyAggregationService.listKeyOwnersAsync({
            filterKeyOwnerUid: partyId,
            synchronizerIds: [],
          }),
        ]);

        return {
          nodeId: node.id,
          label: node.label,
          status: 'ok',
          errorMessage: null,
          partyToParticipants: (partyTopologyResponse.results ?? [])
            .filter((result) => result.party === partyId)
            .flatMap((result) =>
              (result.participants ?? []).map((participant) => ({
                participantId: this.extractParticipantId(participant.participantUid),
                participantUid: this.nullIfEmptyString(participant.participantUid),
                permission: this.joinDistinctValues(
                  (participant.synchronizers ?? []).map((synchronizer) => synchronizer.permission),
                ),
                synchronizerIds: this.uniqueNonEmptyStrings(
                  (participant.synchronizers ?? []).map(
                    (synchronizer) =>
                      synchronizer.synchronizerId ?? synchronizer.physicalSynchronizerId,
                  ),
                ),
              })),
            ),
          partyToKeyMappings: (keyOwnerResponse.results ?? [])
            .filter((result) => result.keyOwner === partyId)
            .flatMap((result) => [
              ...(result.signingKeys ?? []).map((signingKey) => ({
                keyFingerprint: this.bytesToHex(signingKey.publicKey),
                purpose: this.joinDistinctValues(signingKey.usage ?? []),
                keyType: this.nullIfEmptyString(signingKey.scheme),
                synchronizerIds: this.uniqueNonEmptyStrings([
                  result.synchronizerId ?? result.physicalSynchronizerId,
                ]),
              })),
              ...(result.encryptionKeys ?? []).map((encryptionKey) => ({
                keyFingerprint: this.bytesToHex(encryptionKey.publicKey),
                purpose: 'encryption',
                keyType: this.nullIfEmptyString(encryptionKey.scheme),
                synchronizerIds: this.uniqueNonEmptyStrings([
                  result.synchronizerId ?? result.physicalSynchronizerId,
                ]),
              })),
            ])
            .filter(
              (mapping) =>
                mapping.keyFingerprint !== null
                || mapping.purpose !== null
                || mapping.keyType !== null
                || mapping.synchronizerIds.length > 0,
            ),
        };
      });
    } catch (error) {
      return {
        nodeId: node.id,
        label: node.label,
        status: 'grpc_error',
        errorMessage: error instanceof Error ? error.message : 'Unknown gRPC error',
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

  private nullIfEmptyString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
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

  private bytesToHex(value: Uint8Array | null | undefined): string | null {
    if (!value || value.length === 0) {
      return null;
    }

    return Buffer.from(value).toString('hex');
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
    const sdk = await import('canton-typescript-sdk/daml-lf');
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
