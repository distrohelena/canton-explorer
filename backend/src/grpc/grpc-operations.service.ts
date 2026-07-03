import { Injectable } from '@nestjs/common';
import type { NodeConfig } from '../config/node-config.schema';
import type { ServiceInfo } from '../domain/node.types';
import type { CachedPackageBlob, CachedPackageRef } from '../packages/package-cache.service';
import { GrpcClientFactory } from './grpc-client.factory';

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
        target: node.grpc.target,
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
