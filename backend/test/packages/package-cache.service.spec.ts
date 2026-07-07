import { afterEach, describe, expect, it } from '@jest/globals';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { PackageCacheService } from '../../src/packages/package-cache.service';

describe('PackageCacheService', () => {
  let tempDir: string | null = null;
  const originalDatabasePath = process.env.PACKAGE_CACHE_DB_PATH;

  afterEach(() => {
    if (originalDatabasePath === undefined) {
      delete process.env.PACKAGE_CACHE_DB_PATH;
    } else {
      process.env.PACKAGE_CACHE_DB_PATH = originalDatabasePath;
    }

    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it('configures sqlite for wal mode and a busy timeout on startup', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'package-cache-service-'));
    const databasePath = join(tempDir, 'packages.sqlite');
    process.env.PACKAGE_CACHE_DB_PATH = databasePath;
    const service = new PackageCacheService();
    const liveConnection = (service as PackageCacheService & {
      database: DatabaseSync;
    }).database;
    const liveBusyTimeout = liveConnection
      .prepare('pragma busy_timeout')
      .get() as { timeout: number; busy_timeout?: number };

    service.close();

    const persistedConnection = new DatabaseSync(databasePath);
    const journalMode = persistedConnection
      .prepare('pragma journal_mode')
      .get() as { journal_mode: string };

    expect(journalMode.journal_mode).toBe('wal');
    expect(liveBusyTimeout.busy_timeout ?? liveBusyTimeout.timeout).toBe(5000);

    persistedConnection.close();
  });

  it('records node package presence and returns only uncached package ids as missing', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'package-cache-service-'));
    process.env.PACKAGE_CACHE_DB_PATH = join(tempDir, 'packages.sqlite');
    const service = new PackageCacheService();

    const missingBeforeStore = service.recordPackagePresence(
      'cnqs-sv',
      [
        {
          packageId: 'package-a',
          mainPackageId: 'package-a',
          name: 'splice-amulet',
          version: '0.1.14',
          uploadedAt: '1782930510606316',
          packageSize: 1466372,
        },
        {
          packageId: 'package-b',
          mainPackageId: 'package-a',
          name: 'daml-prim',
          version: '0.0.0',
          uploadedAt: '1782930510606316',
          packageSize: 455515,
        },
      ],
      '2026-07-02T17:00:00.000Z',
    );

    expect(missingBeforeStore).toEqual(['package-a', 'package-b']);

    service.storePackages([
      {
        packageId: 'package-a',
        name: 'splice-amulet',
        version: '0.1.14',
        uploadedAt: '1782930510606316',
        packageSize: 1466372,
        data: Buffer.from('package-a-data'),
      },
    ]);

    const missingAfterStore = service.recordPackagePresence(
      'cnqs-sv',
      [
        {
          packageId: 'package-a',
          mainPackageId: 'package-a',
          name: 'splice-amulet',
          version: '0.1.14',
          uploadedAt: '1782930510606316',
          packageSize: 1466372,
        },
        {
          packageId: 'package-b',
          mainPackageId: 'package-a',
          name: 'daml-prim',
          version: '0.0.0',
          uploadedAt: '1782930510606316',
          packageSize: 455515,
        },
      ],
      '2026-07-02T17:15:00.000Z',
    );

    expect(missingAfterStore).toEqual(['package-b']);
    expect(service.listCachedPackageIds()).toEqual(['package-a']);
  });

  it('returns cached package blobs and metadata through the read APIs', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'package-cache-service-'));
    process.env.PACKAGE_CACHE_DB_PATH = join(tempDir, 'packages.sqlite');
    const service = new PackageCacheService();

    service.storePackages([
      {
        packageId: 'package-a',
        name: 'splice-amulet',
        version: '0.1.14',
        uploadedAt: '1782930510606316',
        packageSize: 1466372,
        data: Buffer.from('package-a-data'),
      },
      {
        packageId: 'package-b',
        name: 'daml-prim',
        version: '0.0.0',
        uploadedAt: '1782930510606317',
        packageSize: 455515,
        data: Buffer.from('package-b-data'),
      },
    ]);

    expect(service.getPackage('package-a')).toEqual({
      packageId: 'package-a',
      name: 'splice-amulet',
      version: '0.1.14',
      uploadedAt: '1782930510606316',
      packageSize: 1466372,
      data: Buffer.from('package-a-data'),
    });

    expect(service.getPackage('missing')).toBeNull();
    expect(service.listPackages()).toEqual([
      {
        packageId: 'package-a',
        name: 'splice-amulet',
        version: '0.1.14',
        uploadedAt: '1782930510606316',
        packageSize: 1466372,
      },
      {
        packageId: 'package-b',
        name: 'daml-prim',
        version: '0.0.0',
        uploadedAt: '1782930510606317',
        packageSize: 455515,
      },
    ]);
  });

  it('returns single-package metadata and node presence rows', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'package-cache-service-'));
    process.env.PACKAGE_CACHE_DB_PATH = join(tempDir, 'packages.sqlite');
    const service = new PackageCacheService();

    service.storePackages([
      {
        packageId: 'package-a',
        name: 'splice-amulet',
        version: '0.1.14',
        uploadedAt: '1782930510606316',
        packageSize: 1466372,
        data: Buffer.from('package-a-data'),
      },
    ]);
    service.recordPackagePresence(
      'cnqs-sv',
      [
        {
          packageId: 'package-a',
          mainPackageId: 'package-a',
          name: 'splice-amulet',
          version: '0.1.14',
          uploadedAt: '1782930510606316',
          packageSize: 1466372,
        },
      ],
      '2026-07-02T17:20:00.000Z',
    );

    expect(service.getPackageMetadata('package-a')).toEqual({
      packageId: 'package-a',
      name: 'splice-amulet',
      version: '0.1.14',
      uploadedAt: '1782930510606316',
      packageSize: 1466372,
    });
    expect(service.getPackageMetadata('missing')).toBeNull();
    expect(service.listNodesForPackage('package-a')).toEqual([
      {
        nodeId: 'cnqs-sv',
        packageId: 'package-a',
        mainPackageId: 'package-a',
        packageName: 'splice-amulet',
        packageVersion: '0.1.14',
        uploadedAt: '1782930510606316',
        packageSize: 1466372,
        seenAt: '2026-07-02T17:20:00.000Z',
      },
    ]);
    expect(service.listNodesForPackage('missing')).toEqual([]);
  });

  it('lists all cached packages for a package name across versions', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'package-cache-service-'));
    process.env.PACKAGE_CACHE_DB_PATH = join(tempDir, 'packages.sqlite');
    const service = new PackageCacheService();

    service.storePackages([
      {
        packageId: 'package-a',
        name: 'splice-amulet',
        version: '0.1.14',
        uploadedAt: '2026-07-01T12:00:00.000Z',
        packageSize: 1466372,
        data: Buffer.from('package-a-data'),
      },
      {
        packageId: 'package-b',
        name: 'splice-amulet',
        version: '0.1.24',
        uploadedAt: '2026-07-02T12:00:00.000Z',
        packageSize: 1467000,
        data: Buffer.from('package-b-data'),
      },
      {
        packageId: 'package-c',
        name: 'daml-prim',
        version: '0.0.0',
        uploadedAt: '2026-07-02T12:00:00.000Z',
        packageSize: 455515,
        data: Buffer.from('package-c-data'),
      },
    ]);

    expect(service.listPackagesByName('splice-amulet')).toEqual([
      {
        packageId: 'package-b',
        name: 'splice-amulet',
        version: '0.1.24',
        uploadedAt: '2026-07-02T12:00:00.000Z',
        packageSize: 1467000,
      },
      {
        packageId: 'package-a',
        name: 'splice-amulet',
        version: '0.1.14',
        uploadedAt: '2026-07-01T12:00:00.000Z',
        packageSize: 1466372,
      },
    ]);
    expect(service.listPackagesByName('missing-package')).toEqual([]);
  });

  it('lists all cached packages installed on a node', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'package-cache-service-'));
    process.env.PACKAGE_CACHE_DB_PATH = join(tempDir, 'packages.sqlite');
    const service = new PackageCacheService();

    service.recordPackagePresence(
      'cnqs-sv',
      [
        {
          packageId: 'package-a',
          mainPackageId: 'package-a',
          name: 'splice-amulet',
          version: '0.1.14',
          uploadedAt: '2026-07-01T12:00:00.000Z',
          packageSize: 1466372,
        },
        {
          packageId: 'package-b',
          mainPackageId: 'package-a',
          name: 'splice-amulet',
          version: '0.1.24',
          uploadedAt: '2026-07-02T12:00:00.000Z',
          packageSize: 1467000,
        },
        {
          packageId: 'package-c',
          mainPackageId: 'package-c',
          name: 'daml-prim',
          version: '0.0.0',
          uploadedAt: '2026-07-02T12:00:00.000Z',
          packageSize: 455515,
        },
      ],
      '2026-07-02T17:20:00.000Z',
    );

    expect(service.listPackagesForNode('cnqs-sv')).toEqual([
      {
        nodeId: 'cnqs-sv',
        packageId: 'package-c',
        mainPackageId: 'package-c',
        packageName: 'daml-prim',
        packageVersion: '0.0.0',
        uploadedAt: '2026-07-02T12:00:00.000Z',
        packageSize: 455515,
        seenAt: '2026-07-02T17:20:00.000Z',
      },
      {
        nodeId: 'cnqs-sv',
        packageId: 'package-b',
        mainPackageId: 'package-a',
        packageName: 'splice-amulet',
        packageVersion: '0.1.24',
        uploadedAt: '2026-07-02T12:00:00.000Z',
        packageSize: 1467000,
        seenAt: '2026-07-02T17:20:00.000Z',
      },
      {
        nodeId: 'cnqs-sv',
        packageId: 'package-a',
        mainPackageId: 'package-a',
        packageName: 'splice-amulet',
        packageVersion: '0.1.14',
        uploadedAt: '2026-07-01T12:00:00.000Z',
        packageSize: 1466372,
        seenAt: '2026-07-02T17:20:00.000Z',
      },
    ]);
    expect(service.listPackagesForNode('missing-node')).toEqual([]);
  });
});
