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
    const existingPackageIdsForNode = new Set(
      this.cacheService.listPackagesForNode(node.id).map((row) => row.packageId),
    );
    const { source, packageRefs } = await this.fetchPackageRefs(node);
    const missingPackageIds = this.cacheService.recordPackagePresence(
      node.id,
      packageRefs,
      new Date().toISOString(),
    );

    if (node.mode !== 'pqs_with_grpc') {
      return {
        missingPackageIds: packageRefs
          .map((packageRef) => packageRef.packageId)
          .filter((packageId) => !existingPackageIdsForNode.has(packageId)),
        fetchedPackageCount: 0,
        skippedBecauseNotDue: false,
      };
    }

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

  async syncPackagesById(
    node: NodeConfig,
    packageIds: string[],
  ): Promise<PackageSyncResult> {
    const normalizedPackageIds = Array.from(
      new Set(packageIds.map((packageId) => packageId.trim()).filter((packageId) => packageId.length > 0)),
    );

    if (normalizedPackageIds.length === 0) {
      return {
        missingPackageIds: [],
        fetchedPackageCount: 0,
        skippedBecauseNotDue: false,
      };
    }

    const existingPackageIdsForNode = new Set(
      this.cacheService.listPackagesForNode(node.id).map((row) => row.packageId),
    );
    const { source, packageRefs } = await this.fetchPackageRefs(node);
    const requestedRefs = packageRefs.filter((packageRef) =>
      normalizedPackageIds.includes(packageRef.packageId),
    );
    const requestedIds = requestedRefs.map((packageRef) => packageRef.packageId);
    const missingPackageIds = normalizedPackageIds.filter(
      (packageId) => !requestedIds.includes(packageId),
    );

    if (requestedRefs.length === 0) {
      return {
        missingPackageIds,
        fetchedPackageCount: 0,
        skippedBecauseNotDue: false,
      };
    }

    this.cacheService.recordPackagePresence(node.id, requestedRefs, new Date().toISOString());

    if (node.mode !== 'pqs_with_grpc') {
      return {
        missingPackageIds: requestedIds.filter((packageId) => !existingPackageIdsForNode.has(packageId)),
        fetchedPackageCount: 0,
        skippedBecauseNotDue: false,
      };
    }

    const packages = await this.fetchPackages(node, source, requestedIds, requestedRefs);
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
    if (node.mode !== 'pqs_with_grpc') {
      return [];
    }

    if (source === 'pqs') {
      return [];
    }

    try {
      const pqsPackages = await this.pqsPackageService.fetchPackagesById(node, missingPackageIds);
      const foundPackageIds = new Set(pqsPackages.map((pkg) => pkg.packageId));
      const missingRefs = missingPackageRefs.filter(
        (packageRef) => !foundPackageIds.has(packageRef.packageId),
      );

      if (missingRefs.length === 0) {
        return pqsPackages;
      }

      const grpcPackages = await this.grpcOperationsService.fetchPackagesByRefs(node, missingRefs);
      return [...pqsPackages, ...grpcPackages];
    } catch {
      return this.grpcOperationsService.fetchPackagesByRefs(node, missingPackageRefs);
    }
  }
}
