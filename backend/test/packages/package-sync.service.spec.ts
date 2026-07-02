import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PackageCacheService } from '../../src/packages/package-cache.service';
import { PqsPackageService } from '../../src/packages/pqs-package.service';
import { PackageSyncService } from '../../src/packages/package-sync.service';

describe('PackageSyncService', () => {
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

  it('fetches and stores only packages that are not already cached', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'package-sync-service-'));
    process.env.PACKAGE_CACHE_DB_PATH = join(tempDir, 'packages.sqlite');
    const cacheService = new PackageCacheService();
    const pqsPackageService = {
      fetchPackageRefs: jest.fn().mockResolvedValue([
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
      ]),
      fetchPackagesById: jest.fn().mockResolvedValue([
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
          uploadedAt: '1782930510606316',
          packageSize: 455515,
          data: Buffer.from('package-b-data'),
        },
      ]),
    };
    const service = new PackageSyncService(
      cacheService,
      pqsPackageService as never,
      15 * 60 * 1000,
    );
    const node = {
      id: 'cnqs-sv',
      label: 'CNQS Super Validator',
      role: 'participant',
      ledgerLabel: 'Quickstart Super Validator',
      pqs: { connectionUriEnv: 'CNQS_PQS_SV_URL' },
    };

    await expect(service.syncNodePackages(node as never)).resolves.toEqual({
      fetchedPackageCount: 2,
      missingPackageIds: ['package-a', 'package-b'],
      skippedBecauseNotDue: false,
    });

    expect(cacheService.listCachedPackageIds()).toEqual(['package-a', 'package-b']);
    expect(pqsPackageService.fetchPackagesById).toHaveBeenCalledWith(node, ['package-a', 'package-b']);

    await expect(service.syncNodePackages(node as never)).resolves.toEqual({
      fetchedPackageCount: 0,
      missingPackageIds: [],
      skippedBecauseNotDue: false,
    });

    expect(pqsPackageService.fetchPackagesById).toHaveBeenCalledTimes(1);
  });

  it('is resolvable through Nest dependency injection', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'package-sync-service-di-'));
    process.env.PACKAGE_CACHE_DB_PATH = join(tempDir, 'packages.sqlite');

    const moduleRef = await Test.createTestingModule({
      providers: [
        PackageCacheService,
        PackageSyncService,
        {
          provide: PqsPackageService,
          useValue: {
            fetchPackageRefs: jest.fn(),
            fetchPackagesById: jest.fn(),
          },
        },
      ],
    }).compile();

    expect(moduleRef.get(PackageSyncService)).toBeInstanceOf(PackageSyncService);
  });
});
