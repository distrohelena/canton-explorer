import { Injectable } from '@nestjs/common';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export interface CachedPackageRef {
  packageId: string;
  mainPackageId: string;
  name: string | null;
  version: string | null;
  uploadedAt: string | null;
  packageSize: number | null;
}

export interface CachedPackageBlob {
  packageId: string;
  name: string | null;
  version: string | null;
  uploadedAt: string | null;
  packageSize: number | null;
  data: Buffer;
}

export interface CachedPackageMetadata {
  packageId: string;
  name: string | null;
  version: string | null;
  uploadedAt: string | null;
  packageSize: number | null;
}

export interface CachedPackageNodePresence {
  nodeId: string;
  packageId: string;
  mainPackageId: string;
  packageName: string | null;
  packageVersion: string | null;
  uploadedAt: string | null;
  packageSize: number | null;
  seenAt: string;
}

@Injectable()
export class PackageCacheService {
  private readonly database: DatabaseSync;

  constructor() {
    const databasePath =
      process.env.PACKAGE_CACHE_DB_PATH ??
      resolve(process.cwd(), 'data', 'package-cache.sqlite');
    mkdirSync(dirname(databasePath), { recursive: true });
    this.database = new DatabaseSync(databasePath);
    this.initializeSchema();
  }

  recordPackagePresence(
    nodeId: string,
    packageRefs: CachedPackageRef[],
    seenAt: string,
  ): string[] {
    const packageIds = packageRefs.map((packageRef) => packageRef.packageId);
    const cachedPackageIds = new Set(this.listExistingPackageIds(packageIds));
    const upsertPresence = this.database.prepare(`
      insert into node_packages (
        node_id,
        package_id,
        main_package_id,
        package_name,
        package_version,
        uploaded_at,
        package_size,
        seen_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(node_id, package_id) do update set
        main_package_id = excluded.main_package_id,
        package_name = excluded.package_name,
        package_version = excluded.package_version,
        uploaded_at = excluded.uploaded_at,
        package_size = excluded.package_size,
        seen_at = excluded.seen_at
    `);

    for (const packageRef of packageRefs) {
      upsertPresence.run(
        nodeId,
        packageRef.packageId,
        packageRef.mainPackageId,
        packageRef.name,
        packageRef.version,
        packageRef.uploadedAt,
        packageRef.packageSize,
        seenAt,
      );
    }

    return packageIds.filter((packageId) => !cachedPackageIds.has(packageId));
  }

  storePackages(packages: CachedPackageBlob[]): void {
    const upsertPackage = this.database.prepare(`
      insert into packages (
        package_id,
        package_name,
        package_version,
        uploaded_at,
        package_size,
        data,
        cached_at
      ) values (?, ?, ?, ?, ?, ?, ?)
      on conflict(package_id) do update set
        package_name = excluded.package_name,
        package_version = excluded.package_version,
        uploaded_at = excluded.uploaded_at,
        package_size = excluded.package_size,
        data = excluded.data,
        cached_at = excluded.cached_at
    `);
    const cachedAt = new Date().toISOString();

    for (const packageRow of packages) {
      upsertPackage.run(
        packageRow.packageId,
        packageRow.name,
        packageRow.version,
        packageRow.uploadedAt,
        packageRow.packageSize,
        packageRow.data,
        cachedAt,
      );
    }
  }

  listCachedPackageIds(): string[] {
    const rows = this.database
      .prepare('select package_id from packages order by package_id asc')
      .all() as Array<{ package_id: string }>;

    return rows.map((row) => row.package_id);
  }

  getPackage(packageId: string): CachedPackageBlob | null {
    const row = this.database
      .prepare(`
        select
          package_id,
          package_name,
          package_version,
          uploaded_at,
          package_size,
          data
        from packages
        where package_id = ?
      `)
      .get(packageId) as
      | {
          package_id: string;
          package_name: string | null;
          package_version: string | null;
          uploaded_at: string | null;
          package_size: number | null;
          data: Buffer;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      packageId: row.package_id,
      name: row.package_name,
      version: row.package_version,
      uploadedAt: row.uploaded_at,
      packageSize: row.package_size,
      data: row.data,
    };
  }

  getPackageMetadata(packageId: string): CachedPackageMetadata | null {
    const row = this.database
      .prepare(`
        select
          package_id,
          package_name,
          package_version,
          uploaded_at,
          package_size
        from packages
        where package_id = ?
      `)
      .get(packageId) as
      | {
          package_id: string;
          package_name: string | null;
          package_version: string | null;
          uploaded_at: string | null;
          package_size: number | null;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      packageId: row.package_id,
      name: row.package_name,
      version: row.package_version,
      uploadedAt: row.uploaded_at,
      packageSize: row.package_size,
    };
  }

  listPackages(): CachedPackageMetadata[] {
    const rows = this.database
      .prepare(`
        select
          package_id,
          package_name,
          package_version,
          uploaded_at,
          package_size
        from packages
        order by package_id asc
      `)
      .all() as Array<{
      package_id: string;
      package_name: string | null;
      package_version: string | null;
      uploaded_at: string | null;
      package_size: number | null;
    }>;

    return rows.map((row) => ({
      packageId: row.package_id,
      name: row.package_name,
      version: row.package_version,
      uploadedAt: row.uploaded_at,
      packageSize: row.package_size,
    }));
  }

  listPackagesByName(packageName: string): CachedPackageMetadata[] {
    const rows = this.database
      .prepare(`
        select
          package_id,
          package_name,
          package_version,
          uploaded_at,
          package_size
        from packages
        where package_name = ?
        order by uploaded_at desc, package_version desc, package_id asc
      `)
      .all(packageName) as Array<{
      package_id: string;
      package_name: string | null;
      package_version: string | null;
      uploaded_at: string | null;
      package_size: number | null;
    }>;

    return rows.map((row) => ({
      packageId: row.package_id,
      name: row.package_name,
      version: row.package_version,
      uploadedAt: row.uploaded_at,
      packageSize: row.package_size,
    }));
  }

  listNodesForPackage(packageId: string): CachedPackageNodePresence[] {
    const rows = this.database
      .prepare(`
        select
          node_id,
          package_id,
          main_package_id,
          package_name,
          package_version,
          uploaded_at,
          package_size,
          seen_at
        from node_packages
        where package_id = ?
        order by node_id asc
      `)
      .all(packageId) as Array<{
      node_id: string;
      package_id: string;
      main_package_id: string;
      package_name: string | null;
      package_version: string | null;
      uploaded_at: string | null;
      package_size: number | null;
      seen_at: string;
    }>;

    return rows.map((row) => ({
      nodeId: row.node_id,
      packageId: row.package_id,
      mainPackageId: row.main_package_id,
      packageName: row.package_name,
      packageVersion: row.package_version,
      uploadedAt: row.uploaded_at,
      packageSize: row.package_size,
      seenAt: row.seen_at,
    }));
  }

  listPackagesForNode(nodeId: string): CachedPackageNodePresence[] {
    const rows = this.database
      .prepare(`
        select
          node_id,
          package_id,
          main_package_id,
          package_name,
          package_version,
          uploaded_at,
          package_size,
          seen_at
        from node_packages
        where node_id = ?
        order by package_name asc, uploaded_at desc, package_version desc, package_id asc
      `)
      .all(nodeId) as Array<{
      node_id: string;
      package_id: string;
      main_package_id: string;
      package_name: string | null;
      package_version: string | null;
      uploaded_at: string | null;
      package_size: number | null;
      seen_at: string;
    }>;

    return rows.map((row) => ({
      nodeId: row.node_id,
      packageId: row.package_id,
      mainPackageId: row.main_package_id,
      packageName: row.package_name,
      packageVersion: row.package_version,
      uploadedAt: row.uploaded_at,
      packageSize: row.package_size,
      seenAt: row.seen_at,
    }));
  }

  close(): void {
    this.database.close();
  }

  private initializeSchema(): void {
    this.database.exec(`
      create table if not exists packages (
        package_id text primary key,
        package_name text,
        package_version text,
        uploaded_at text,
        package_size integer,
        data blob not null,
        cached_at text not null
      );

      create table if not exists node_packages (
        node_id text not null,
        package_id text not null,
        main_package_id text not null,
        package_name text,
        package_version text,
        uploaded_at text,
        package_size integer,
        seen_at text not null,
        primary key (node_id, package_id)
      );
    `);
  }

  private listExistingPackageIds(packageIds: string[]): string[] {
    if (packageIds.length === 0) {
      return [];
    }

    const placeholders = packageIds.map(() => '?').join(', ');
    const statement = this.database.prepare(
      `select package_id from packages where package_id in (${placeholders})`,
    );

    return (statement.all(...packageIds) as Array<{ package_id: string }>).map(
      (row) => row.package_id,
    );
  }
}
