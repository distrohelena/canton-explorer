import { describe, expect, it, jest } from '@jest/globals';
import { resolve } from 'node:path';
import { GrpcOperationsService } from '../../src/grpc/grpc-operations.service';
import { PackageCacheService } from '../../src/packages/package-cache.service';
import { SAMPLE_DAML_FIXTURE } from '../fixtures/daml/fixture-manifest';

const grpcNode = {
  id: 'participant-1',
  label: 'Participant 1',
  role: 'participant',
  mode: 'pqs_with_grpc',
  pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
  grpc: {
    ledgerTarget: 'localhost:5012',
    ledgerAdminTarget: 'localhost:5013',
    participantAdminTarget: 'localhost:5014',
    useTls: false,
    connectTimeoutMs: 5000,
  },
} as const;

const pqsOnlyNode = {
  id: 'participant-2',
  label: 'Participant 2',
  role: 'participant',
  mode: 'pqs_only',
  pqs: { connectionUriEnv: 'PARTICIPANT_2_PQS_URL' },
} as const;

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
      grpc: {
        ledgerTarget: 'localhost:5012',
        ledgerAdminTarget: 'localhost:5013',
        participantAdminTarget: 'localhost:5014',
        useTls: false,
        connectTimeoutMs: 5000,
      },
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
      grpc: {
        ledgerTarget: 'localhost:5012',
        ledgerAdminTarget: 'localhost:5013',
        participantAdminTarget: 'localhost:5014',
        useTls: false,
        connectTimeoutMs: 5000,
      },
    });

    expect(result).toEqual(['Alice', 'Carol']);
    expect(disposeAsync).toHaveBeenCalledTimes(1);
  });

  it('fetches party topology mappings through the SDK topology read services', async () => {
    const disposeAsync = jest.fn().mockResolvedValue(undefined);
    const listPartyToParticipantAsync = jest.fn().mockResolvedValue({
      results: [
        {
          context: {
            signedByFingerprints: ['participant-signing-key'],
          },
          item: {
            party: 'Alice',
            participants: [
              {
                participantUid: 'participant-1::1220abc',
                permission: 'submission',
              },
            ],
          },
        },
      ],
    });
    const listPartyToKeyMappingAsync = jest.fn().mockResolvedValue({
      results: [
        {
          context: {
            signedByFingerprints: ['party-signing-key'],
          },
          item: {
            party: 'Alice',
            signingKeys: [
              {
                format: 'raw',
                scheme: 'ed25519',
                usage: ['namespace'],
                keySpec: 'signing',
                publicKey: new Uint8Array([1, 2, 3]),
              },
            ],
          },
        },
      ],
    });
    const service = new GrpcOperationsService({
      create: () => ({
        topologyManagerReadService: {
          listPartyToParticipantAsync,
          listPartyToKeyMappingAsync,
        },
        disposeAsync,
      }),
    } as never);

    const result = await (
      service as GrpcOperationsService & {
        fetchPartyTopology: (
          node: typeof grpcNode,
          partyId: string,
        ) => Promise<unknown>;
      }
    ).fetchPartyTopology(grpcNode, 'Alice');

    expect(listPartyToParticipantAsync).toHaveBeenCalledWith(
      expect.objectContaining({ filterParty: 'Alice' }),
    );
    expect(listPartyToKeyMappingAsync).toHaveBeenCalledWith(
      expect.objectContaining({ filterParty: 'Alice' }),
    );
    expect(result).toEqual({
      nodeId: 'participant-1',
      label: 'Participant 1',
      status: 'ok',
      errorMessage: null,
      partyToParticipants: [
        {
          participantId: 'participant-1',
          participantUid: 'participant-1::1220abc',
          permission: 'submission',
          synchronizerIds: [],
        },
      ],
      partyToKeyMappings: [
        {
          keyFingerprint: 'party-signing-key',
          purpose: 'namespace',
          keyType: 'ed25519',
          synchronizerIds: [],
        },
      ],
    });
    expect(disposeAsync).toHaveBeenCalledTimes(1);
  });

  it('returns a not-configured topology state for pqs-only nodes', async () => {
    const service = new GrpcOperationsService({
      create: jest.fn(),
    } as never);

    const result = await (
      service as GrpcOperationsService & {
        fetchPartyTopology: (
          node: typeof pqsOnlyNode,
          partyId: string,
        ) => Promise<unknown>;
      }
    ).fetchPartyTopology(pqsOnlyNode, 'Alice');

    expect(result).toEqual({
      nodeId: 'participant-2',
      label: 'Participant 2',
      status: 'grpc_not_configured',
      errorMessage: null,
      partyToParticipants: [],
      partyToKeyMappings: [],
    });
  });

  it('normalizes topology read failures into a node-local grpc error state', async () => {
    const disposeAsync = jest.fn().mockResolvedValue(undefined);
    const service = new GrpcOperationsService({
      create: () => ({
        topologyManagerReadService: {
          listPartyToParticipantAsync: jest
            .fn()
            .mockRejectedValue(new Error('Topology read failed')),
          listPartyToKeyMappingAsync: jest.fn(),
        },
        disposeAsync,
      }),
    } as never);

    const result = await (
      service as GrpcOperationsService & {
        fetchPartyTopology: (
          node: typeof grpcNode,
          partyId: string,
        ) => Promise<unknown>;
      }
    ).fetchPartyTopology(grpcNode, 'Alice');

    expect(result).toEqual({
      nodeId: 'participant-1',
      label: 'Participant 1',
      status: 'grpc_error',
      errorMessage: 'Topology read failed',
      partyToParticipants: [],
      partyToKeyMappings: [],
    });
    expect(disposeAsync).toHaveBeenCalledTimes(1);
  });

  it('fetches participant status through the participant status service', async () => {
    const disposeAsync = jest.fn().mockResolvedValue(undefined);
    const service = new GrpcOperationsService({
      create: () => ({
        participantStatusService: {
          getParticipantStatusAsync: jest.fn().mockResolvedValue({
            status: {
                uid: 'participant-1::1220abc',
                uptime: { seconds: '3600', nanos: 0 },
                ports: {
                  admin: 5012,
                  ledger: 5011,
                },
                active: true,
                topologyQueues: {
                  manager: 1,
                  dispatcher: 2,
                  clients: 3,
                },
                components: [
                  {
                    name: 'sync-service',
                    kind: 'ok',
                    description: 'running',
                  },
                ],
                version: '3.4.0',
              connectedSynchronizers: [
                {
                  physicalSynchronizerId: 'physical::1220def',
                  health: 'healthy',
                },
                {
                  physicalSynchronizerId: '',
                  health: 'unhealthy',
                },
              ],
              supportedProtocolVersions: [30, 31],
            },
          }),
        },
        disposeAsync,
      }),
    } as never);

    const result = await service.fetchParticipantStatus(grpcNode);

    expect(result).toEqual(
      {
        participantStatus: {
          uid: 'participant-1::1220abc',
          uptime: '3600s',
          ports: {
            admin: 5012,
            ledger: 5011,
          },
          active: true,
          commonStatusActive: true,
          version: '3.4.0',
          supportedProtocolVersions: [30, 31],
          topologyQueues: {
            manager: 1,
            dispatcher: 2,
            clients: 3,
          },
          components: [
            {
              name: 'sync-service',
              severity: 'ok',
              description: 'running',
            },
          ],
          connectedSynchronizers: [
            {
              physicalSynchronizerId: 'physical::1220def',
              health: 'healthy',
            },
            {
              physicalSynchronizerId: null,
              health: 'unhealthy',
            },
          ],
        },
        notInitialized: null,
      },
    );
    expect(disposeAsync).toHaveBeenCalledTimes(1);
  });

  it('returns not-initialized participant status without any fallback path', async () => {
    const disposeAsync = jest.fn().mockResolvedValue(undefined);
    const service = new GrpcOperationsService({
      create: () => ({
        participantStatusService: {
          getParticipantStatusAsync: jest.fn().mockResolvedValue({
            notInitialized: {
              active: false,
              waitingForExternalInput: 'nodeTopology',
              version: '3.4.0',
            },
          }),
        },
        disposeAsync,
      }),
    } as never);

    const result = await service.fetchParticipantStatus({
      id: 'participant-1',
      label: 'Participant 1',
      role: 'participant',
      mode: 'pqs_with_grpc',
      pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
      grpc: {
        ledgerTarget: 'localhost:5012',
        ledgerAdminTarget: 'localhost:5013',
        participantAdminTarget: 'localhost:5014',
        useTls: false,
        connectTimeoutMs: 5000,
      },
    });

    expect(result).toEqual(
      {
        participantStatus: null,
        notInitialized: {
          active: false,
          waitingForExternalInput: 'node_topology',
          version: '3.4.0',
        },
      },
    );
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
      grpc: {
        ledgerTarget: 'localhost:5012',
        ledgerAdminTarget: 'localhost:5013',
        participantAdminTarget: 'localhost:5014',
        useTls: false,
        connectTimeoutMs: 5000,
      },
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

    const result = await service.fetchPackageRefs(grpcNode);

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
