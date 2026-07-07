import { Injectable } from '@nestjs/common';
import type { NodeConfig } from '../config/node-config.schema';
import { createSharedSecretJwt } from './shared-secret-jwt';

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
type TopologyParticipant = {
  participantUid?: string;
  permission?: unknown;
};
type TopologyPartyToParticipantItem = {
  party?: string;
  participants?: TopologyParticipant[];
};
type TopologySigningKey = {
  usage?: string[];
  scheme?: string;
};
type TopologyPartyToKeyMappingItem = {
  party?: string;
  signingKeys?: TopologySigningKey[];
};
type LedgerPackageResponse = { archivePayload: Uint8Array };
type SdkCantonClient = {
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
  packageService: {
    listPackagesAsync(input: Record<string, never>): Promise<{ packageIds?: string[] }>;
    getPackageAsync(input: { packageId: string }): Promise<LedgerPackageResponse>;
  };
  topologyManagerReadService: {
    listPartyToParticipantAsync(input: {
      filterParty?: string;
      filterParticipant?: string;
    }): Promise<{
      results?: Array<{
        context?: TopologyMappingContext;
        item?: TopologyPartyToParticipantItem;
      }>;
    }>;
    listPartyToKeyMappingAsync(input: {
      filterParty?: string;
    }): Promise<{
      results?: Array<{
        context?: TopologyMappingContext;
        item?: TopologyPartyToKeyMappingItem;
      }>;
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
    return import('canton-typescript-sdk') as Promise<SdkModule>;
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
      default:
        return undefined;
    }
  }
}
