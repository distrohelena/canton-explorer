import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PackageCacheService } from '../../src/packages/package-cache.service';
import { PqsPackageService } from '../../src/packages/pqs-package.service';
import { PackageSyncService } from '../../src/packages/package-sync.service';
import { GrpcOperationsService } from '../../src/grpc/grpc-operations.service';

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

  it('records metadata-only package presence for pqs_only nodes', async () => {
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
      {} as never,
      15 * 60 * 1000,
    );
    const node = {
      id: 'cnqs-sv',
      label: 'CNQS Super Validator',
      role: 'participant',
      mode: 'pqs_only',
      ledgerLabel: 'Quickstart Super Validator',
      pqs: { connectionUriEnv: 'CNQS_PQS_SV_URL' },
    };

    await expect(service.syncNodePackages(node as never)).resolves.toEqual({
      fetchedPackageCount: 0,
      missingPackageIds: ['package-a', 'package-b'],
      skippedBecauseNotDue: false,
    });

    expect(cacheService.listCachedPackageIds()).toEqual([]);
    expect(cacheService.listPackages()).toEqual([
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
        uploadedAt: '1782930510606316',
        packageSize: 455515,
      },
    ]);
    expect(pqsPackageService.fetchPackagesById).not.toHaveBeenCalled();

    await expect(service.syncNodePackages(node as never)).resolves.toEqual({
      fetchedPackageCount: 0,
      missingPackageIds: [],
      skippedBecauseNotDue: false,
    });

    expect(pqsPackageService.fetchPackagesById).not.toHaveBeenCalled();
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
        {
          provide: GrpcOperationsService,
          useValue: {
            fetchPackageRefs: jest.fn(),
            fetchPackagesByRefs: jest.fn(),
          },
        },
      ],
    }).compile();

    expect(moduleRef.get(PackageSyncService)).toBeInstanceOf(PackageSyncService);
  });

  it('uses gRPC package references but prefers PQS package blobs for gRPC-enabled nodes', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'package-sync-service-grpc-'));
    process.env.PACKAGE_CACHE_DB_PATH = join(tempDir, 'packages.sqlite');
    const cacheService = new PackageCacheService();
    const grpcOperationsService = {
      fetchPackageRefs: jest.fn().mockResolvedValue([
        {
          packageId: 'package-a',
          mainPackageId: 'package-a',
          name: 'Main Package',
          version: '1.2.3',
          uploadedAt: '2026-07-03T10:00:00.000Z',
          packageSize: 2048,
        },
      ]),
      fetchPackagesByRefs: jest.fn().mockResolvedValue([
        {
          packageId: 'package-a',
          name: 'Main Package',
          version: '1.2.3',
          uploadedAt: '2026-07-03T10:00:00.000Z',
          packageSize: 2048,
          data: Buffer.from([1, 2, 3]),
        },
      ]),
    };
    const pqsPackageService = {
      fetchPackageRefs: jest.fn(),
      fetchPackagesById: jest.fn().mockResolvedValue([
        {
          packageId: 'package-a',
          name: 'Main Package',
          version: '1.2.3',
          uploadedAt: '2026-07-03T10:00:00.000Z',
          packageSize: 2048,
          data: Buffer.from([9, 8, 7]),
        },
      ]),
    };
    const service = new PackageSyncService(
      cacheService,
      pqsPackageService as never,
      grpcOperationsService as never,
      15 * 60 * 1000,
    );
    const node = {
      id: 'participant-1',
      label: 'Participant 1',
      role: 'participant',
      mode: 'pqs_with_grpc',
      ledgerLabel: 'Retail Ledger',
      pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
      grpc: {
        ledgerTarget: 'localhost:5012',
        ledgerAdminTarget: 'localhost:5013',
        participantAdminTarget: 'localhost:5014',
        useTls: false,
        connectTimeoutMs: 5000,
      },
    };

    await expect(service.syncNodePackages(node as never)).resolves.toEqual({
      fetchedPackageCount: 1,
      missingPackageIds: ['package-a'],
      skippedBecauseNotDue: false,
    });

    expect(grpcOperationsService.fetchPackageRefs).toHaveBeenCalledWith(node);
    expect(pqsPackageService.fetchPackagesById).toHaveBeenCalledWith(node, ['package-a']);
    expect(grpcOperationsService.fetchPackagesByRefs).not.toHaveBeenCalled();
    expect(pqsPackageService.fetchPackageRefs).not.toHaveBeenCalled();
  });

  it('falls back to gRPC package blobs when the PQS package download fails after a gRPC reference listing', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'package-sync-service-grpc-blob-fallback-'));
    process.env.PACKAGE_CACHE_DB_PATH = join(tempDir, 'packages.sqlite');
    const cacheService = new PackageCacheService();
    const grpcOperationsService = {
      fetchPackageRefs: jest.fn().mockResolvedValue([
        {
          packageId: 'package-a',
          mainPackageId: 'package-a',
          name: 'Main Package',
          version: '1.2.3',
          uploadedAt: '2026-07-03T10:00:00.000Z',
          packageSize: 2048,
        },
      ]),
      fetchPackagesByRefs: jest.fn().mockResolvedValue([
        {
          packageId: 'package-a',
          name: 'Main Package',
          version: '1.2.3',
          uploadedAt: '2026-07-03T10:00:00.000Z',
          packageSize: 2048,
          data: Buffer.from([1, 2, 3]),
        },
      ]),
    };
    const pqsPackageService = {
      fetchPackageRefs: jest.fn(),
      fetchPackagesById: jest.fn().mockRejectedValue(new Error('pqs package download failed')),
    };
    const service = new PackageSyncService(
      cacheService,
      pqsPackageService as never,
      grpcOperationsService as never,
      15 * 60 * 1000,
    );
    const node = {
      id: 'participant-1',
      label: 'Participant 1',
      role: 'participant',
      mode: 'pqs_with_grpc',
      ledgerLabel: 'Retail Ledger',
      pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
      grpc: {
        ledgerTarget: 'localhost:5012',
        ledgerAdminTarget: 'localhost:5013',
        participantAdminTarget: 'localhost:5014',
        useTls: false,
        connectTimeoutMs: 5000,
      },
    };

    await expect(service.syncNodePackages(node as never)).resolves.toEqual({
      fetchedPackageCount: 1,
      missingPackageIds: ['package-a'],
      skippedBecauseNotDue: false,
    });

    expect(grpcOperationsService.fetchPackageRefs).toHaveBeenCalledWith(node);
    expect(pqsPackageService.fetchPackagesById).toHaveBeenCalledWith(node, ['package-a']);
    expect(grpcOperationsService.fetchPackagesByRefs).toHaveBeenCalledWith(node, [
      {
        packageId: 'package-a',
        mainPackageId: 'package-a',
        name: 'Main Package',
        version: '1.2.3',
        uploadedAt: '2026-07-03T10:00:00.000Z',
        packageSize: 2048,
      },
    ]);
  });

  it('falls back to gRPC package blobs when the PQS package lookup returns no blobs after a gRPC reference listing', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'package-sync-service-grpc-empty-pqs-'));
    process.env.PACKAGE_CACHE_DB_PATH = join(tempDir, 'packages.sqlite');
    const cacheService = new PackageCacheService();
    const grpcOperationsService = {
      fetchPackageRefs: jest.fn().mockResolvedValue([
        {
          packageId: 'package-a',
          mainPackageId: 'package-a',
          name: 'Main Package',
          version: '1.2.3',
          uploadedAt: '2026-07-03T10:00:00.000Z',
          packageSize: 2048,
        },
      ]),
      fetchPackagesByRefs: jest.fn().mockResolvedValue([
        {
          packageId: 'package-a',
          name: 'Main Package',
          version: '1.2.3',
          uploadedAt: '2026-07-03T10:00:00.000Z',
          packageSize: 2048,
          data: Buffer.from([1, 2, 3]),
        },
      ]),
    };
    const pqsPackageService = {
      fetchPackageRefs: jest.fn(),
      fetchPackagesById: jest.fn().mockResolvedValue([]),
    };
    const service = new PackageSyncService(
      cacheService,
      pqsPackageService as never,
      grpcOperationsService as never,
      15 * 60 * 1000,
    );
    const node = {
      id: 'participant-1',
      label: 'Participant 1',
      role: 'participant',
      mode: 'pqs_with_grpc',
      ledgerLabel: 'Retail Ledger',
      pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
      grpc: {
        ledgerTarget: 'localhost:5012',
        ledgerAdminTarget: 'localhost:5013',
        participantAdminTarget: 'localhost:5014',
        useTls: false,
        connectTimeoutMs: 5000,
      },
    };

    await expect(service.syncNodePackages(node as never)).resolves.toEqual({
      fetchedPackageCount: 1,
      missingPackageIds: ['package-a'],
      skippedBecauseNotDue: false,
    });

    expect(grpcOperationsService.fetchPackageRefs).toHaveBeenCalledWith(node);
    expect(pqsPackageService.fetchPackagesById).toHaveBeenCalledWith(node, ['package-a']);
    expect(grpcOperationsService.fetchPackagesByRefs).toHaveBeenCalledWith(node, [
      {
        packageId: 'package-a',
        mainPackageId: 'package-a',
        name: 'Main Package',
        version: '1.2.3',
        uploadedAt: '2026-07-03T10:00:00.000Z',
        packageSize: 2048,
      },
    ]);
  });

  it('falls back to PQS package references when the gRPC package listing fails', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'package-sync-service-grpc-refs-fallback-'));
    process.env.PACKAGE_CACHE_DB_PATH = join(tempDir, 'packages.sqlite');
    const cacheService = new PackageCacheService();
    const grpcOperationsService = {
      fetchPackageRefs: jest.fn().mockRejectedValue(new Error('grpc package listing failed')),
      fetchPackagesByRefs: jest.fn(),
    };
    const pqsPackageService = {
      fetchPackageRefs: jest.fn().mockResolvedValue([
        {
          packageId: 'package-a',
          mainPackageId: 'package-a',
          name: 'Main Package',
          version: '1.2.3',
          uploadedAt: '2026-07-03T10:00:00.000Z',
          packageSize: 2048,
        },
      ]),
      fetchPackagesById: jest.fn().mockResolvedValue([
        {
          packageId: 'package-a',
          name: 'Main Package',
          version: '1.2.3',
          uploadedAt: '2026-07-03T10:00:00.000Z',
          packageSize: 2048,
          data: Buffer.from([1, 2, 3]),
        },
      ]),
    };
    const service = new PackageSyncService(
      cacheService,
      pqsPackageService as never,
      grpcOperationsService as never,
      15 * 60 * 1000,
    );
    const node = {
      id: 'participant-1',
      label: 'Participant 1',
      role: 'participant',
      mode: 'pqs_with_grpc',
      ledgerLabel: 'Retail Ledger',
      pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
      grpc: {
        ledgerTarget: 'localhost:5012',
        ledgerAdminTarget: 'localhost:5013',
        participantAdminTarget: 'localhost:5014',
        useTls: false,
        connectTimeoutMs: 5000,
      },
    };

    await expect(service.syncNodePackages(node as never)).resolves.toEqual({
      fetchedPackageCount: 0,
      missingPackageIds: ['package-a'],
      skippedBecauseNotDue: false,
    });

    expect(pqsPackageService.fetchPackageRefs).toHaveBeenCalledWith(node);
    expect(pqsPackageService.fetchPackagesById).not.toHaveBeenCalled();
    expect(grpcOperationsService.fetchPackagesByRefs).not.toHaveBeenCalled();
  });

  it('force-refreshes a specific cached package by id even when it is already present', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'package-sync-service-refresh-by-id-'));
    process.env.PACKAGE_CACHE_DB_PATH = join(tempDir, 'packages.sqlite');
    const cacheService = new PackageCacheService();
    cacheService.storePackages([
      {
        packageId: 'package-a',
        name: 'Old Package',
        version: '1.0.0',
        uploadedAt: '2026-07-03T09:00:00.000Z',
        packageSize: 1024,
        data: Buffer.from('old-data'),
      },
    ]);

    const grpcOperationsService = {
      fetchPackageRefs: jest.fn().mockResolvedValue([
        {
          packageId: 'package-a',
          mainPackageId: 'package-a',
          name: 'New Package',
          version: '1.2.3',
          uploadedAt: '2026-07-03T10:00:00.000Z',
          packageSize: 2048,
        },
      ]),
      fetchPackagesByRefs: jest.fn(),
    };
    const pqsPackageService = {
      fetchPackageRefs: jest.fn(),
      fetchPackagesById: jest.fn().mockResolvedValue([
        {
          packageId: 'package-a',
          name: 'New Package',
          version: '1.2.3',
          uploadedAt: '2026-07-03T10:00:00.000Z',
          packageSize: 2048,
          data: Buffer.from('new-data'),
        },
      ]),
    };
    const service = new PackageSyncService(
      cacheService,
      pqsPackageService as never,
      grpcOperationsService as never,
      15 * 60 * 1000,
    );
    const node = {
      id: 'participant-1',
      label: 'Participant 1',
      role: 'participant',
      mode: 'pqs_with_grpc',
      ledgerLabel: 'Retail Ledger',
      pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
      grpc: {
        ledgerTarget: 'localhost:5012',
        ledgerAdminTarget: 'localhost:5013',
        participantAdminTarget: 'localhost:5014',
        useTls: false,
        connectTimeoutMs: 5000,
      },
    };

    await expect(service.syncPackagesById(node as never, ['package-a'])).resolves.toEqual({
      fetchedPackageCount: 1,
      missingPackageIds: [],
      skippedBecauseNotDue: false,
    });

    expect(grpcOperationsService.fetchPackageRefs).toHaveBeenCalledWith(node);
    expect(pqsPackageService.fetchPackagesById).toHaveBeenCalledWith(node, ['package-a']);
    expect(Buffer.from(cacheService.getPackage('package-a')?.data ?? []).toString()).toBe('new-data');
  });

});
