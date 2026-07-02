import { afterEach, describe, expect, it } from '@jest/globals';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PackageCacheService } from '../../src/packages/package-cache.service';

describe('PackageCacheService', () => {
  let tempDir: string | null = null;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it('records node package presence and returns only uncached package ids as missing', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'package-cache-service-'));
    const service = new PackageCacheService(join(tempDir, 'packages.sqlite'));

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
});
