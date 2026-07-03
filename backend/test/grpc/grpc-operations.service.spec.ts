import { describe, expect, it, jest } from '@jest/globals';
import { resolve } from 'node:path';
import { GrpcOperationsService } from '../../src/grpc/grpc-operations.service';
import { PackageCacheService } from '../../src/packages/package-cache.service';
import { SAMPLE_DAML_FIXTURE } from '../fixtures/daml/fixture-manifest';

describe('GrpcOperationsService', () => {
  it('returns reachability metadata from the SDK health client', async () => {
    const service = new GrpcOperationsService({
      create: () => ({
        healthService: {
          checkAsync: async (_request: { service?: string }) => ({
            status: 'serving',
          }),
        },
      }),
    } as never);

    const result = await service.fetchOperationalInfo({
      id: 'participant-1',
      label: 'Participant 1',
      role: 'participant',
      mode: 'pqs_with_grpc',
      pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
      grpc: { target: 'localhost:5012', useTls: false, connectTimeoutMs: 5000 },
    });

    expect(result.reachable).toBe(true);
    expect(result.healthCheckImplemented).toBe(true);
    expect(result.servingStatus).toBe('SERVING');
  });

  it('lists local parties through the SDK and filters out non-local entries', async () => {
    const disposeAsync = jest.fn().mockResolvedValue(undefined);
    const service = new GrpcOperationsService({
      create: () => ({
        partyManagementService: {
          listKnownPartiesAsync: jest
            .fn()
            .mockResolvedValueOnce({
              partyDetails: [
                { party: 'Alice', isLocal: true },
                { party: 'Bob', isLocal: false },
              ],
              nextPageToken: 'next-page',
            })
            .mockResolvedValueOnce({
              partyDetails: [
                { party: 'Carol', isLocal: true },
              ],
            }),
        },
        disposeAsync,
      }),
    } as never);

    const result = await service.listLocalParties({
      id: 'participant-1',
      label: 'Participant 1',
      role: 'participant',
      mode: 'pqs_with_grpc',
      pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
      grpc: { target: 'localhost:5012', useTls: false, connectTimeoutMs: 5000 },
    });

    expect(result).toEqual(['Alice', 'Carol']);
    expect(disposeAsync).toHaveBeenCalledTimes(1);
  });

  it('fetches package references and package archive payloads through the SDK', async () => {
    const disposeAsync = jest.fn().mockResolvedValue(undefined);
    const service = new GrpcOperationsService({
      create: () => ({
        participantPackageService: {
          listPackagesAsync: jest.fn().mockResolvedValue({
            packageDescriptions: [
              {
                packageId: 'package-a',
                name: 'Main Package',
                version: '1.2.3',
                uploadedAt: new Date('2026-07-03T10:00:00.000Z'),
                size: 2048,
              },
            ],
          }),
        },
        packageService: {
          getPackageAsync: jest.fn().mockResolvedValue({
            archivePayload: new Uint8Array([1, 2, 3]),
          }),
        },
        disposeAsync,
      }),
    } as never);

    const node = {
      id: 'participant-1',
      label: 'Participant 1',
      role: 'participant',
      mode: 'pqs_with_grpc',
      pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
      grpc: { target: 'localhost:5012', useTls: false, connectTimeoutMs: 5000 },
    };

    const refs = await service.fetchPackageRefs(node);
    const packages = await service.fetchPackagesByRefs(node, refs);

    expect(refs).toEqual([
      {
        packageId: 'package-a',
        mainPackageId: 'package-a',
        name: 'Main Package',
        version: '1.2.3',
        uploadedAt: '2026-07-03T10:00:00.000Z',
        packageSize: 2048,
      },
    ]);
    expect(packages).toEqual([
      expect.objectContaining({
        packageId: 'package-a',
        name: 'Main Package',
        version: '1.2.3',
        uploadedAt: '2026-07-03T10:00:00.000Z',
        packageSize: 2048,
        data: Buffer.from([1, 2, 3]),
      }),
    ]);
    expect(disposeAsync).toHaveBeenCalledTimes(2);
  });

  it('falls back to ledger package listing when participant package admin RPC is unavailable', async () => {
    process.env.PACKAGE_CACHE_DB_PATH = resolve(
      process.cwd(),
      'test/fixtures/daml/package-cache.sqlite',
    );
    const cachedPackage = new PackageCacheService().getPackage(SAMPLE_DAML_FIXTURE.packageId);
    if (!cachedPackage) {
      throw new Error('Missing DAML fixture package');
    }

    const disposeAsync = jest.fn().mockResolvedValue(undefined);
    const service = new GrpcOperationsService({
      create: () => ({
        participantPackageService: {
          listPackagesAsync: jest.fn().mockRejectedValue(
            new Error(
              'Method not found: com.digitalasset.canton.admin.participant.v30.PackageService/ListPackages',
            ),
          ),
        },
        packageService: {
          listPackagesAsync: jest.fn().mockResolvedValue({
            packageIds: [SAMPLE_DAML_FIXTURE.packageId],
          }),
          getPackageAsync: jest.fn().mockResolvedValue({
            archivePayload: new Uint8Array(cachedPackage.data),
          }),
        },
        disposeAsync,
      }),
    } as never);

    const result = await service.fetchPackageRefs({
      id: 'participant-1',
      label: 'Participant 1',
      role: 'participant',
      mode: 'pqs_with_grpc',
      pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
      grpc: { target: 'localhost:5012', useTls: false, connectTimeoutMs: 5000 },
    });

    expect(result).toEqual([
      {
        packageId: SAMPLE_DAML_FIXTURE.packageId,
        mainPackageId: SAMPLE_DAML_FIXTURE.packageId,
        name: 'splice-amulet',
        version: '0.1.18',
        uploadedAt: null,
        packageSize: cachedPackage.data.length,
      },
    ]);
  });
});
