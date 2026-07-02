import { Injectable } from '@nestjs/common';
import type { NodeConfig } from '../config/node-config.schema';
import { PqsClientFactory } from '../pqs/pqs-client.factory';
import type { CachedPackageBlob, CachedPackageRef } from './package-cache.service';

interface PackageRefRow {
  package_id: string;
  main_package_id: string | null;
  name: string | null;
  version: string | null;
  uploaded_at: string | number | null;
  package_size: string | number | null;
}

interface PackageBlobRow {
  package_id: string;
  name: string | null;
  version: string | null;
  uploaded_at: string | number | null;
  package_size: string | number | null;
  data: Buffer;
}

const PACKAGE_REFS_QUERY = `
  select
    package_row.package_id::text as package_id,
    min(package_row.main_package_id)::text as main_package_id,
    package_row.name::text as name,
    package_row.version::text as version,
    package_row.uploaded_at::text as uploaded_at,
    package_row.package_size::bigint as package_size
  from (
    select
      package_table.package_id,
      coalesce(dar_table.main_package_id, package_table.package_id) as main_package_id,
      package_table.name,
      package_table.version,
      package_table.uploaded_at,
      package_table.package_size
    from participant.par_daml_packages package_table
    left join participant.par_dar_packages dar_table
      on dar_table.package_id = package_table.package_id
  ) package_row
  group by
    package_row.package_id,
    package_row.name,
    package_row.version,
    package_row.uploaded_at,
    package_row.package_size
  order by package_row.package_id asc
`;

@Injectable()
export class PqsPackageService {
  constructor(private readonly clientFactory: PqsClientFactory) {}

  async fetchPackageRefs(node: NodeConfig): Promise<CachedPackageRef[]> {
    const client = this.clientFactory.getClient(node);
    const result = await client.query(PACKAGE_REFS_QUERY);
    const rows = (result.rows as PackageRefRow[]) ?? [];

    return rows.map((row) => ({
      packageId: row.package_id,
      mainPackageId: row.main_package_id ?? row.package_id,
      name: row.name,
      version: row.version,
      uploadedAt: normalizeOptionalText(row.uploaded_at),
      packageSize: normalizeOptionalNumber(row.package_size),
    }));
  }

  async fetchPackagesById(
    node: NodeConfig,
    packageIds: string[],
  ): Promise<CachedPackageBlob[]> {
    if (packageIds.length === 0) {
      return [];
    }

    const client = this.clientFactory.getClient(node);
    const quotedIds = packageIds.map((packageId) => `'${escapeSqlLiteral(packageId)}'`).join(', ');
    const result = await client.query(`
      select
        package_id::text as package_id,
        name::text as name,
        version::text as version,
        uploaded_at::text as uploaded_at,
        package_size::bigint as package_size,
        data
      from participant.par_daml_packages
      where package_id in (${quotedIds})
      order by package_id asc
    `);
    const rows = (result.rows as PackageBlobRow[]) ?? [];

    return rows
      .filter((row): row is PackageBlobRow & { data: Buffer } => Buffer.isBuffer(row.data))
      .map((row) => ({
        packageId: row.package_id,
        name: row.name,
        version: row.version,
        uploadedAt: normalizeOptionalText(row.uploaded_at),
        packageSize: normalizeOptionalNumber(row.package_size),
        data: row.data,
      }));
  }
}

function normalizeOptionalText(value: string | number | null): string | null {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return null;
}

function normalizeOptionalNumber(value: string | number | null): number | null {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.length > 0) {
    return Number(value);
  }

  return null;
}

function escapeSqlLiteral(value: string): string {
  return value.replaceAll("'", "''");
}
