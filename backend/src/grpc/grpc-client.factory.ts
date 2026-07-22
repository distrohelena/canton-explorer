import { Injectable } from '@nestjs/common';
import type { NodeConfig } from '../config/node-config.schema';
import { createSharedSecretJwt } from './shared-secret-jwt';
import { createSelfSignedEs256Jwt } from './self-signed-es256-jwt';

type AuthProvider = { getHeadersAsync(): Promise<Record<string, string>> };

type LedgerHealthResponse = { status?: unknown };
type LedgerPartyDetail = { party: string; isLocal: boolean };
type ParticipantPackageDescription = {
  packageId: string;
  name?: string;
  version?: string;
  uploadedAt?: Date;
  size?: number;
};
type TopologyMappingContext = {
  signedByFingerprints?: string[];
};
type TopologyStoreSynchronizer = {
  id?: string;
  physicalId?: string;
};
type TopologyStoreId = {
  kind?: 'authorized' | 'synchronizer' | 'temporary';
  synchronizer?: TopologyStoreSynchronizer;
};
type TopologyParticipant = {
  participantUid?: string;
  permission?: unknown;
};
type TopologySigningPublicKey = {
  format?: string;
  publicKey?: Uint8Array;
  scheme?: string;
  usage?: string[];
  keySpec?: string;
};
type TopologySigningKeysWithThreshold = {
  threshold?: number;
  keys?: TopologySigningPublicKey[];
};
type TopologyPartyToParticipantItem = {
  party?: string;
  threshold?: number;
  participants?: TopologyParticipant[];
  partySigningKeys?: TopologySigningKeysWithThreshold;
};
type TopologySigningKey = {
  format?: string;
  usage?: string[];
  scheme?: string;
  keySpec?: string;
};
type TopologyPartyToKeyMappingItem = {
  party?: string;
  signingKeys?: TopologySigningKey[];
};
type AggregatedTopologyPartySynchronizer = {
  synchronizerId?: string;
  permission?: unknown;
  physicalSynchronizerId?: string;
};
type AggregatedTopologyPartyParticipant = {
  participantUid?: string;
  synchronizers?: AggregatedTopologyPartySynchronizer[];
};
type AggregatedTopologyPartyResult = {
  party?: string;
  participants?: AggregatedTopologyPartyParticipant[];
};
type AggregatedTopologySigningKey = {
  fingerprint?: string;
  format?: string;
  usage?: string[];
  scheme?: string;
  keySpec?: string;
  publicKey?: Uint8Array;
};
type AggregatedTopologyEncryptionKey = {
  fingerprint?: string;
  format?: string;
  scheme?: string;
  keySpec?: string;
  publicKey?: Uint8Array;
};
type AggregatedTopologyKeyOwnerResult = {
  keyOwner?: string;
  synchronizerId?: string;
  physicalSynchronizerId?: string;
  signingKeys?: AggregatedTopologySigningKey[];
  encryptionKeys?: AggregatedTopologyEncryptionKey[];
};
type LedgerPackageResponse = { archivePayload: Uint8Array };
type LedgerIdentifier = {
  packageId?: string;
  moduleName?: string;
  entityName?: string;
};
type LedgerValue = {
  sum?: {
    oneofKind?: string;
    unit?: unknown;
    bool?: boolean;
    int64?: string;
    numeric?: string;
    party?: string;
    text?: string;
    contractId?: string;
    optional?: { value?: LedgerValue };
    list?: { elements?: LedgerValue[] };
    textMap?: { entries?: Array<{ key?: string; value?: LedgerValue }> };
    genMap?: { entries?: Array<{ key?: LedgerValue; value?: LedgerValue }> };
    record?: LedgerRecord;
    variant?: { constructor?: string; value?: LedgerValue };
    enum?: { constructor?: string };
  };
};
type LedgerRecordField = {
  label?: string;
  value?: LedgerValue;
};
type LedgerRecord = {
  fields?: LedgerRecordField[];
};
type LedgerInterfaceView = {
  interfaceId?: LedgerIdentifier;
  viewStatus?: { code?: number; message?: string };
  viewValue?: LedgerRecord;
  implementationPackageId?: string;
};
type LedgerCreatedEvent = {
  contractId?: string;
  interfaceViews?: LedgerInterfaceView[];
};
type LedgerActiveContract = {
  createdEvent?: LedgerCreatedEvent;
  synchronizerId?: string;
};
type SdkCantonClient = {
  hashing: {
    computePublicKeyFingerprint(publicKey: Uint8Array, format?: string): string;
  };
  healthService: {
    checkAsync(input: { service?: string }): Promise<LedgerHealthResponse>;
  };
  partyManagementService: {
    listKnownPartiesAsync(input: {
      pageSize: number;
      pageToken?: string;
    }): Promise<{ partyDetails?: LedgerPartyDetail[]; nextPageToken?: string }>;
  };
  participantPackageService: {
    listPackagesAsync(
      input: Record<string, never>,
    ): Promise<{ packageDescriptions?: ParticipantPackageDescription[] }>;
  };
  participantStatusService: {
    getParticipantStatusAsync(input: Record<string, never>): Promise<{
      status?: {
        uid: string;
        uptime?: { seconds: string; nanos: number };
        ports: Record<string, number>;
        active: boolean;
        topologyQueues?: {
          manager: number;
          dispatcher: number;
          clients: number;
        };
        components: Array<{
          name: string;
          kind: 'unknown' | 'ok' | 'degraded' | 'failed' | 'fatal';
          description?: string;
        }>;
        version: string;
        connectedSynchronizers: Array<{
          physicalSynchronizerId: string;
          health: 'unspecified' | 'healthy' | 'unhealthy';
        }>;
        supportedProtocolVersions: number[];
      };
      notInitialized?: {
        active: boolean;
        waitingForExternalInput: 'unspecified' | 'id' | 'nodeTopology' | 'initialization';
        version: string;
      };
    }>;
  };
  trafficControlService: {
    trafficControlStateAsync(input: { synchronizerId: string }): Promise<{
      trafficState?: {
        extraTrafficPurchased: string;
        extraTrafficConsumed: string;
        baseTrafficRemainder: string;
        lastConsumedCost: string;
        timestamp: string;
        serial?: number;
      };
    }>;
  };
  packageService: {
    listPackagesAsync(input: Record<string, never>): Promise<{ packageIds?: string[] }>;
    getPackageAsync(input: { packageId: string }): Promise<LedgerPackageResponse>;
  };
  stateService: {
    getActiveContractsPageAsync(input: {
      party: string;
      templateId?: string;
      interfaceId?: string;
      includeInterfaceView?: boolean;
      includeCreatedEventBlob?: boolean;
      activeAtOffset?: string;
      maxPageSize?: number;
      pageToken?: Uint8Array;
    }): Promise<{
      contracts?: LedgerActiveContract[];
      activeAtOffset?: string;
      nextPageToken?: Uint8Array;
    }>;
  };
  topologyManagerReadService?: {
    listAvailableStoresAsync(input: Record<string, never>): Promise<{
      storeIds?: TopologyStoreId[];
    }>;
    listPartyToParticipantAsync(input: {
      baseQuery?: {
        storeId?: TopologyStoreId;
        headState?: boolean;
      };
      filterParty?: string;
      filterParticipant?: string;
    }): Promise<{
      results?: Array<{
        context?: TopologyMappingContext;
        item?: TopologyPartyToParticipantItem;
      }>;
    }>;
    listPartyToKeyMappingAsync(input: { filterParty?: string }): Promise<{
      results?: Array<{
        context?: TopologyMappingContext;
        item?: TopologyPartyToKeyMappingItem;
      }>;
    }>;
  };
  topologyAggregationService: {
    listPartiesAsync(input: {
      asOf?: Date;
      limit?: number;
      synchronizerIds: string[];
      filterParty?: string;
      filterParticipant?: string;
    }): Promise<{
      results?: AggregatedTopologyPartyResult[];
    }>;
    listKeyOwnersAsync(input: {
      asOf?: Date;
      limit?: number;
      synchronizerIds: string[];
      filterKeyOwnerType?: string;
      filterKeyOwnerUid?: string;
    }): Promise<{
      results?: AggregatedTopologyKeyOwnerResult[];
    }>;
  };
  disposeAsync?(): Promise<void>;
};

type SdkModule = {
  BearerTokenAuthProvider: new (token: string) => AuthProvider;
  CantonClient: new (options: unknown) => SdkCantonClient;
  CantonClientOptions: new (options: {
    transportKind: unknown;
    ledgerEndpoint?: string;
    ledgerAdminEndpoint?: string;
    participantAdminEndpoint?: string;
    defaultRequestTimeoutMs: number;
    grpcConnectTimeoutMs: number;
    grpcChannelSecurity?: unknown;
    ledgerGrpcChannelSecurity?: unknown;
    ledgerAdminGrpcChannelSecurity?: unknown;
    participantAdminGrpcChannelSecurity?: unknown;
    ledgerAuthProvider?: AuthProvider;
    ledgerAdminAuthProvider?: AuthProvider;
    participantAdminAuthProvider?: AuthProvider;
  }) => unknown;
  TransportKind: { grpc: unknown };
  GrpcChannelSecurity: { tls: unknown; insecure: unknown };
};

@Injectable()
export class GrpcClientFactory {
  async create(node: NodeConfig) {
    if (node.mode !== 'pqs_with_grpc') {
      throw new Error(`Node ${node.id} does not define grpc settings`);
    }

    const sdk = await this.loadSdk();
    const authProvider = this.createAuthProvider(node, sdk);

    return new sdk.CantonClient(
      new sdk.CantonClientOptions({
        transportKind: sdk.TransportKind.grpc,
        ledgerEndpoint: node.grpc.ledgerTarget,
        ledgerAdminEndpoint: node.grpc.ledgerAdminTarget,
        participantAdminEndpoint: node.grpc.participantAdminTarget,
        defaultRequestTimeoutMs: node.grpc.connectTimeoutMs,
        grpcConnectTimeoutMs: node.grpc.connectTimeoutMs,
        grpcChannelSecurity: node.grpc.useTls
          ? sdk.GrpcChannelSecurity.tls
          : sdk.GrpcChannelSecurity.insecure,
        ledgerGrpcChannelSecurity: node.grpc.useTls
          ? sdk.GrpcChannelSecurity.tls
          : sdk.GrpcChannelSecurity.insecure,
        ledgerAdminGrpcChannelSecurity: node.grpc.useTls
          ? sdk.GrpcChannelSecurity.tls
          : sdk.GrpcChannelSecurity.insecure,
        participantAdminGrpcChannelSecurity: node.grpc.useTls
          ? sdk.GrpcChannelSecurity.tls
          : sdk.GrpcChannelSecurity.insecure,
        ledgerAuthProvider: authProvider,
        ledgerAdminAuthProvider: authProvider,
        participantAdminAuthProvider: authProvider,
      }),
    );
  }

  private async loadSdk(): Promise<SdkModule> {
    const sdkModulePath = '@distrohelena/canton-typescript-sdk';
    return import(sdkModulePath) as Promise<SdkModule>;
  }

  private createAuthProvider(
    node: Extract<NodeConfig, { mode: 'pqs_with_grpc' }>,
    sdk: Pick<SdkModule, 'BearerTokenAuthProvider'>,
  ): AuthProvider | undefined {
    if (!node.grpc.auth) {
      return undefined;
    }

    switch (node.grpc.auth.kind) {
      case 'shared_secret_jwt':
        return new sdk.BearerTokenAuthProvider(
          createSharedSecretJwt({
            user: node.grpc.auth.user,
            audience: node.grpc.auth.audience,
            secret: node.grpc.auth.secret,
          }),
        );
      case 'self_signed_es256': {
        const privateKeyJwkBase64Url = process.env[node.grpc.auth.privateKeyEnv];
        if (!privateKeyJwkBase64Url) {
          throw new Error(
            `Missing ES256 private JWK environment variable: ${node.grpc.auth.privateKeyEnv}`,
          );
        }

        return new sdk.BearerTokenAuthProvider(
          createSelfSignedEs256Jwt({
            sub: node.grpc.auth.sub,
            aud: node.grpc.auth.aud,
            privateKeyJwkBase64Url,
          }),
        );
      }
      case 'static_token': {
        const token = process.env[node.grpc.auth.tokenEnv];
        if (!token) {
          throw new Error(`Missing static token environment variable: ${node.grpc.auth.tokenEnv}`);
        }

        return new sdk.BearerTokenAuthProvider(token);
      }
      default:
        return undefined;
    }
  }
}
