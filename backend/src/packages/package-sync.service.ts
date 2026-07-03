import { Injectable } from '@nestjs/common';
import type { NodeConfig } from '../config/node-config.schema';
import { GrpcOperationsService } from '../grpc/grpc-operations.service';
import { PackageCacheService } from './package-cache.service';
import { PqsPackageService } from './pqs-package.service';

export interface PackageSyncResult {
  missingPackageIds: string[];
  fetchedPackageCount: number;
  skippedBecauseNotDue: boolean;
}

interface PackageRefFetchResult {
  source: 'grpc' | 'pqs';
  packageRefs: Awaited<ReturnType<PqsPackageService['fetchPackageRefs']>>;
}

@Injectable()
export class PackageSyncService {
  private readonly lastSyncStartedAtByNode = new Map<string, number>();
  private readonly syncIntervalMs = 15 * 60 * 1000;

  constructor(
    private readonly cacheService: PackageCacheService,
    private readonly pqsPackageService: PqsPackageService,
    private readonly grpcOperationsService: GrpcOperationsService,
  ) {}

  async syncNodePackagesIfDue(node: NodeConfig): Promise<PackageSyncResult> {
    const now = Date.now();
    const lastSyncStartedAt = this.lastSyncStartedAtByNode.get(node.id);

    if (
      typeof lastSyncStartedAt === 'number' &&
      now - lastSyncStartedAt < this.syncIntervalMs
    ) {
      return {
        missingPackageIds: [],
        fetchedPackageCount: 0,
        skippedBecauseNotDue: true,
      };
    }

    this.lastSyncStartedAtByNode.set(node.id, now);
    return this.syncNodePackages(node);
  }

  async syncNodePackages(node: NodeConfig): Promise<PackageSyncResult> {
    const { source, packageRefs } = await this.fetchPackageRefs(node);
    const missingPackageIds = this.cacheService.recordPackagePresence(
      node.id,
      packageRefs,
      new Date().toISOString(),
    );

    if (missingPackageIds.length === 0) {
      return {
        missingPackageIds: [],
        fetchedPackageCount: 0,
        skippedBecauseNotDue: false,
      };
    }

    const missingPackageRefs = packageRefs.filter((packageRef) =>
      missingPackageIds.includes(packageRef.packageId),
    );
    const packages = await this.fetchPackages(
      node,
      source,
      missingPackageIds,
      missingPackageRefs,
    );
    this.cacheService.storePackages(packages);

    return {
      missingPackageIds,
      fetchedPackageCount: packages.length,
      skippedBecauseNotDue: false,
    };
  }

  private async fetchPackageRefs(node: NodeConfig): Promise<PackageRefFetchResult> {
    if (node.mode !== 'pqs_with_grpc') {
      return {
        source: 'pqs',
        packageRefs: await this.pqsPackageService.fetchPackageRefs(node),
      };
    }

    try {
      return {
        source: 'grpc',
        packageRefs: await this.grpcOperationsService.fetchPackageRefs(node),
      };
    } catch {
      return {
        source: 'pqs',
        packageRefs: await this.pqsPackageService.fetchPackageRefs(node),
      };
    }
  }

  private async fetchPackages(
    node: NodeConfig,
    source: PackageRefFetchResult['source'],
    missingPackageIds: string[],
    missingPackageRefs: PackageRefFetchResult['packageRefs'],
  ) {
    if (node.mode !== 'pqs_with_grpc' || source === 'pqs') {
      return this.pqsPackageService.fetchPackagesById(node, missingPackageIds);
    }

    try {
      return await this.grpcOperationsService.fetchPackagesByRefs(node, missingPackageRefs);
    } catch {
      return this.pqsPackageService.fetchPackagesById(node, missingPackageIds);
    }
  }
}
