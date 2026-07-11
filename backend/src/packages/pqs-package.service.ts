import { Injectable } from '@nestjs/common';
import type { NodeConfig } from '../config/node-config.schema';
import { PqsClientFactory } from '../pqs/pqs-client.factory';
import { qualifyPqsRelation } from '../pqs/pqs-schema';
import type { CachedPackageBlob, CachedPackageRef } from './package-cache.service';

interface PackageRefRow {
  package_id: string;
  name: string | null;
  version: string | null;
}

@Injectable()
export class PqsPackageService {
  constructor(private readonly clientFactory: PqsClientFactory) {}

  async fetchPackageRefs(node: NodeConfig): Promise<CachedPackageRef[]> {
    const client = this.clientFactory.getClient(node);
    const packagesRelation = qualifyPqsRelation(node, '__packages');
    const result = await client.query(`
      select
        id::text as package_id,
        name::text as name,
        version::text as version
      from ${packagesRelation}
      order by id asc
    `);
    const rows = (result.rows as PackageRefRow[]) ?? [];

    return rows.map((row) => ({
      packageId: row.package_id,
      mainPackageId: row.package_id,
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
