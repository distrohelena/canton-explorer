import { Injectable } from '@nestjs/common';
import type { NodeConfig } from '../config/node-config.schema';
import { PqsManagerFactory } from '../pqs/pqs-manager.factory';
import type { CachedPackageBlob, CachedPackageRef } from './package-cache.service';

@Injectable()
export class PqsPackageService {
  constructor(private readonly managerFactory: PqsManagerFactory) {}

  async fetchPackageRefs(node: NodeConfig): Promise<CachedPackageRef[]> {
    const rows = await (await this.managerFactory.getPqsQuery(node)).packages.findMany({
      select: { id: true, name: true, version: true },
      orderBy: [{ id: 'asc' }],
    });

    return rows.map((row) => ({
      packageId: row.id,
      mainPackageId: row.id,
      name: row.name,
      version: row.version,
      uploadedAt: null,
      packageSize: null,
    }));
  }

  async fetchPackagesById(
    node: NodeConfig,
    packageIds: string[],
  ): Promise<CachedPackageBlob[]> {
    void node;
    void packageIds;

    return [];
  }
}
