import { describe, expect, it, jest } from '@jest/globals';
import type { NodeConfig } from '../../src/config/node-config.schema';
import { PqsPackageService } from '../../src/packages/pqs-package.service';

describe('PqsPackageService', () => {
  it('reads package references through the typed SDK packages delegate', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { id: 'package-b', name: 'Beta', version: '2.0.0' },
      { id: 'package-a', name: 'Alpha', version: '1.0.0' },
    ]);
    const service = new PqsPackageService({
      getPqsQuery: jest.fn().mockResolvedValue({ packages: { findMany } }),
    } as never);
    const node = {
      id: 'node-1',
      label: 'Node 1',
      role: 'participant',
      mode: 'pqs_only',
      pqs: { connectionUriEnv: 'PQS_URL' },
    } as NodeConfig;

    await expect(service.fetchPackageRefs(node)).resolves.toEqual([
      {
        packageId: 'package-b',
        mainPackageId: 'package-b',
        name: 'Beta',
        version: '2.0.0',
        uploadedAt: null,
        packageSize: null,
      },
      {
        packageId: 'package-a',
        mainPackageId: 'package-a',
        name: 'Alpha',
        version: '1.0.0',
        uploadedAt: null,
        packageSize: null,
      },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      select: { id: true, name: true, version: true },
      orderBy: [{ id: 'asc' }],
    });
  });
});
