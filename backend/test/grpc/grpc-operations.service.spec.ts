import { describe, expect, it, jest } from '@jest/globals';
import { resolve } from 'node:path';
import { GrpcOperationsService } from '../../src/grpc/grpc-operations.service';
import { extractDamlLfArchivePayloadOrThrow } from '../../src/grpc/daml-lf-archive';
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

  it('reads traffic state for every connected synchronizer', async () => {
    const trafficControlStateAsync = jest.fn().mockResolvedValue({
      trafficState: {
        extraTrafficPurchased: '1000000',
        extraTrafficConsumed: '250000',
        baseTrafficRemainder: '50000',
        lastConsumedCost: '1200',
        timestamp: '2026-07-21T12:00:00.000Z',
        serial: 7,
      },
    });
    const service = new GrpcOperationsService({
      create: () => ({
        participantStatusService: {
          getParticipantStatusAsync: jest.fn().mockResolvedValue({
            status: {
              connectedSynchronizers: [
                { physicalSynchronizerId: 'global-sync', health: 'healthy' },
              ],
            },
          }),
        },
        trafficControlService: { trafficControlStateAsync },
      }),
    } as never);

    await expect(service.fetchTrafficStates(grpcNode)).resolves.toEqual([
      {
        synchronizerId: 'global-sync',
        extraTrafficPurchased: '1000000',
        extraTrafficConsumed: '250000',
        baseTrafficRemainder: '50000',
        lastConsumedCost: '1200',
        timestamp: '2026-07-21T12:00:00.000Z',
        serial: 7,
      },
    ]);
    expect(trafficControlStateAsync).toHaveBeenCalledWith({
      synchronizerId: 'global-sync',
    });
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
              partyDetails: [{ party: 'Carol', isLocal: true }],
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

  it('discovers HoldingV2 tokens and holders through ledger interface views', async () => {
    const disposeAsync = jest.fn().mockResolvedValue(undefined);
    const listKnownPartiesAsync = jest.fn().mockResolvedValue({
      partyDetails: [
        { party: 'Alice', isLocal: true },
        { party: 'Bob', isLocal: true },
      ],
    });
    const getActiveContractsPageAsync = jest.fn().mockImplementation(async (request) => ({
      contracts:
        request.party === 'Alice'
          ? [
              {
                createdEvent: {
                  contractId: 'share-contract-1',
                  interfaceViews: [
                    {
                      interfaceId: {
                        packageId: '#splice-api-token-holding-v2',
                        moduleName: 'Splice.Api.Token.HoldingV2',
                        entityName: 'Holding',
                      },
                      viewStatus: { code: 0 },
                      viewValue: {
                        fields: [
                          {
                            label: 'account',
                            value: {
                              sum: {
                                oneofKind: 'record',
                                record: {
                                  fields: [
                                    {
                                      label: 'owner',
                                      value: {
                                        sum: {
                                          oneofKind: 'optional',
                                          optional: {
                                            value: {
                                              sum: {
                                                oneofKind: 'party',
                                                party: 'Alice',
                                              },
                                            },
                                          },
                                        },
                                      },
                                    },
                                  ],
                                },
                              },
                            },
                          },
                          {
                            label: 'instrumentId',
                            value: {
                              sum: {
                                oneofKind: 'record',
                                record: {
                                  fields: [
                                    {
                                      label: 'admin',
                                      value: {
                                        sum: {
                                          oneofKind: 'party',
                                          party: 'RegistryAdmin',
                                        },
                                      },
                                    },
                                    {
                                      label: 'id',
                                      value: {
                                        sum: {
                                          oneofKind: 'text',
                                          text: 'USDCx-SHARE',
                                        },
                                      },
                                    },
                                  ],
                                },
                              },
                            },
                          },
                          {
                            label: 'amount',
                            value: {
                              sum: {
                                oneofKind: 'numeric',
                                numeric: '55.0000000000',
                              },
                            },
                          },
                          {
                            label: 'meta',
                            value: {
                              sum: {
                                oneofKind: 'record',
                                record: {
                                  fields: [
                                    {
                                      label: 'values',
                                      value: {
                                        sum: {
                                          oneofKind: 'textMap',
                                          textMap: {
                                            entries: [
                                              {
                                                key: 'name',
                                                value: {
                                                  sum: {
                                                    oneofKind: 'text',
                                                    text: 'USDCx Test Vault Share',
                                                  },
                                                },
                                              },
                                              {
                                                key: 'symbol',
                                                value: {
                                                  sum: {
                                                    oneofKind: 'text',
                                                    text: 'vUSDCx-SHARE',
                                                  },
                                                },
                                              },
                                            ],
                                          },
                                        },
                                      },
                                    },
                                  ],
                                },
                              },
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            ]
          : [],
    }));
    const service = new GrpcOperationsService({
      create: () => ({
        partyManagementService: {
          listKnownPartiesAsync,
        },
        stateService: {
          getActiveContractsPageAsync,
        },
        disposeAsync,
      }),
    } as never);

    const tokens = await service.fetchHoldingV2Tokens(grpcNode);
    const holders = await service.fetchHoldingV2TokenHolders(grpcNode);

    expect(getActiveContractsPageAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        party: 'Alice',
        interfaceId: '#splice-api-token-holding-v2:Splice.Api.Token.HoldingV2:Holding',
        includeInterfaceView: true,
      }),
    );
    expect(tokens).toEqual([
      {
        tokenId: 'RegistryAdmin::USDCx-SHARE',
        name: 'USDCx Test Vault Share',
        symbol: 'vUSDCx-SHARE',
        issuer: 'RegistryAdmin',
        source: 'grpc',
      },
    ]);
    expect(holders).toEqual([
      {
        contractId: 'share-contract-1',
        nodeId: 'participant-1',
        label: 'Participant 1',
        tokenId: 'RegistryAdmin::USDCx-SHARE',
        partyId: 'Alice',
        amount: '55.0000000000',
      },
    ]);
    expect(disposeAsync).toHaveBeenCalledTimes(2);
  });

  it('falls back cleanly when HoldingV2 packages are not available on the participant', async () => {
    const disposeAsync = jest.fn().mockResolvedValue(undefined);
    const listKnownPartiesAsync = jest.fn().mockResolvedValue({
      partyDetails: [{ party: 'Alice', isLocal: true }],
      nextPageToken: undefined,
    });
    const missingPackageError = new Error(
      'PACKAGE_NAMES_NOT_FOUND: The following package names do not match upgradable packages uploaded on this participant: [splice-api-token-holding-v2].',
    );
    const getActiveContractsPageAsync = jest.fn().mockRejectedValue(missingPackageError);
    const service = new GrpcOperationsService({
      create: () => ({
        partyManagementService: {
          listKnownPartiesAsync,
        },
        stateService: {
          getActiveContractsPageAsync,
        },
        disposeAsync,
      }),
    } as never);

    await expect(service.fetchHoldingV2Tokens(grpcNode)).resolves.toEqual([]);
    await expect(service.fetchHoldingV2TokenHolders(grpcNode)).resolves.toEqual([]);
    expect(disposeAsync).toHaveBeenCalledTimes(2);
  });

  it('canonicalizes native Amulet HoldingV2 data to Canton Coin', async () => {
    const disposeAsync = jest.fn().mockResolvedValue(undefined);
    const listKnownPartiesAsync = jest.fn().mockResolvedValue({
      partyDetails: [{ party: 'Alice', isLocal: true }],
      nextPageToken: undefined,
    });
    const getActiveContractsPageAsync = jest.fn().mockResolvedValue({
      contracts: [
        {
          createdEvent: {
            contractId: 'amulet-contract-1',
            interfaceViews: [
              {
                interfaceId: {
                  packageId: '#splice-api-token-holding-v2',
                  moduleName: 'Splice.Api.Token.HoldingV2',
                  entityName: 'Holding',
                },
                viewStatus: { code: 0 },
                viewValue: {
                  fields: [
                    {
                      label: 'account',
                      value: {
                        sum: {
                          oneofKind: 'record',
                          record: {
                            fields: [
                              {
                                label: 'owner',
                                value: {
                                  sum: { oneofKind: 'party', party: 'Alice' },
                                },
                              },
                            ],
                          },
                        },
                      },
                    },
                    {
                      label: 'instrumentId',
                      value: {
                        sum: {
                          oneofKind: 'record',
                          record: {
                            fields: [
                              {
                                label: 'admin',
                                value: {
                                  sum: { oneofKind: 'party', party: 'DSO' },
                                },
                              },
                              {
                                label: 'id',
                                value: {
                                  sum: { oneofKind: 'text', text: 'Amulet' },
                                },
                              },
                            ],
                          },
                        },
                      },
                    },
                    {
                      label: 'amount',
                      value: {
                        sum: { oneofKind: 'numeric', numeric: '42.0000000000' },
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    });
    const service = new GrpcOperationsService({
      create: () => ({
        partyManagementService: {
          listKnownPartiesAsync,
        },
        stateService: {
          getActiveContractsPageAsync,
        },
        disposeAsync,
      }),
    } as never);

    await expect(service.fetchHoldingV2Tokens(grpcNode)).resolves.toEqual([
      {
        tokenId: 'canton-coin',
        name: 'Canton Coin',
        symbol: null,
        issuer: null,
        source: 'grpc',
      },
    ]);
    await expect(service.fetchHoldingV2TokenHolders(grpcNode)).resolves.toEqual([
      {
        contractId: 'amulet-contract-1',
        nodeId: 'participant-1',
        label: 'Participant 1',
        tokenId: 'canton-coin',
        partyId: 'Alice',
        amount: '42.0000000000',
      },
    ]);
  });

  it('ignores OZ-specific holding metadata keys for CIP112 display metadata', async () => {
    const disposeAsync = jest.fn().mockResolvedValue(undefined);
    const listKnownPartiesAsync = jest.fn().mockResolvedValue({
      partyDetails: [{ party: 'Alice', isLocal: true }],
      nextPageToken: undefined,
    });
    const getActiveContractsPageAsync = jest.fn().mockResolvedValue({
      contracts: [
        {
          createdEvent: {
            contractId: 'share-contract-2',
            interfaceViews: [
              {
                interfaceId: {
                  packageId: '#splice-api-token-holding-v2',
                  moduleName: 'Splice.Api.Token.HoldingV2',
                  entityName: 'Holding',
                },
                viewStatus: { code: 0 },
                viewValue: {
                  fields: [
                    {
                      label: 'account',
                      value: {
                        sum: {
                          oneofKind: 'record',
                          record: {
                            fields: [
                              {
                                label: 'owner',
                                value: {
                                  sum: {
                                    oneofKind: 'optional',
                                    optional: {
                                      value: {
                                        sum: {
                                          oneofKind: 'party',
                                          party: 'Alice',
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            ],
                          },
                        },
                      },
                    },
                    {
                      label: 'instrumentId',
                      value: {
                        sum: {
                          oneofKind: 'record',
                          record: {
                            fields: [
                              {
                                label: 'admin',
                                value: {
                                  sum: {
                                    oneofKind: 'party',
                                    party: 'RegistryAdmin',
                                  },
                                },
                              },
                              {
                                label: 'id',
                                value: {
                                  sum: {
                                    oneofKind: 'text',
                                    text: 'USDCx-SHARE',
                                  },
                                },
                              },
                            ],
                          },
                        },
                      },
                    },
                    {
                      label: 'meta',
                      value: {
                        sum: {
                          oneofKind: 'record',
                          record: {
                            fields: [
                              {
                                label: 'values',
                                value: {
                                  sum: {
                                    oneofKind: 'textMap',
                                    textMap: {
                                      entries: [
                                        {
                                          key: 'oz.vault.share.name',
                                          value: {
                                            sum: {
                                              oneofKind: 'text',
                                              text: 'USDCx Test Vault Share',
                                            },
                                          },
                                        },
                                        {
                                          key: 'oz.vault.share.symbol',
                                          value: {
                                            sum: {
                                              oneofKind: 'text',
                                              text: 'vUSDCx-SHARE',
                                            },
                                          },
                                        },
                                      ],
                                    },
                                  },
                                },
                              },
                            ],
                          },
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
      nextPageToken: undefined,
    });
    const service = new GrpcOperationsService({
      create: () => ({
        partyManagementService: {
          listKnownPartiesAsync,
        },
        stateService: {
          getActiveContractsPageAsync,
        },
        disposeAsync,
      }),
    } as never);

    const tokens = await service.fetchHoldingV2Tokens(grpcNode);

    expect(tokens).toEqual([
      {
        tokenId: 'RegistryAdmin::USDCx-SHARE',
        name: 'USDCx-SHARE',
        symbol: null,
        issuer: 'RegistryAdmin',
        source: 'grpc',
      },
    ]);
  });

  it('uses configured token metadata keys for HoldingV2 display fields', async () => {
    const disposeAsync = jest.fn().mockResolvedValue(undefined);
    const listKnownPartiesAsync = jest.fn().mockResolvedValue({
      partyDetails: [{ party: 'Alice', isLocal: true }],
      nextPageToken: undefined,
    });
    const getActiveContractsPageAsync = jest.fn().mockResolvedValue({
      contracts: [
        {
          createdEvent: {
            contractId: 'share-contract-3',
            interfaceViews: [
              {
                interfaceId: {
                  packageId: '#splice-api-token-holding-v2',
                  moduleName: 'Splice.Api.Token.HoldingV2',
                  entityName: 'Holding',
                },
                viewStatus: { code: 0 },
                viewValue: {
                  fields: [
                    {
                      label: 'account',
                      value: {
                        sum: {
                          oneofKind: 'record',
                          record: {
                            fields: [
                              {
                                label: 'owner',
                                value: {
                                  sum: {
                                    oneofKind: 'optional',
                                    optional: {
                                      value: {
                                        sum: {
                                          oneofKind: 'party',
                                          party: 'Alice',
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            ],
                          },
                        },
                      },
                    },
                    {
                      label: 'instrumentId',
                      value: {
                        sum: {
                          oneofKind: 'record',
                          record: {
                            fields: [
                              {
                                label: 'admin',
                                value: {
                                  sum: {
                                    oneofKind: 'party',
                                    party: 'RegistryAdmin',
                                  },
                                },
                              },
                              {
                                label: 'id',
                                value: {
                                  sum: {
                                    oneofKind: 'text',
                                    text: 'USDCx-SHARE',
                                  },
                                },
                              },
                            ],
                          },
                        },
                      },
                    },
                    {
                      label: 'meta',
                      value: {
                        sum: {
                          oneofKind: 'record',
                          record: {
                            fields: [
                              {
                                label: 'values',
                                value: {
                                  sum: {
                                    oneofKind: 'textMap',
                                    textMap: {
                                      entries: [
                                        {
                                          key: 'display_name',
                                          value: {
                                            sum: {
                                              oneofKind: 'text',
                                              text: 'USDCx Test Vault Share',
                                            },
                                          },
                                        },
                                        {
                                          key: 'ticker',
                                          value: {
                                            sum: {
                                              oneofKind: 'text',
                                              text: 'vUSDCx-SHARE',
                                            },
                                          },
                                        },
                                      ],
                                    },
                                  },
                                },
                              },
                            ],
                          },
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
      nextPageToken: undefined,
    });
    const service = new GrpcOperationsService(
      {
        create: () => ({
          partyManagementService: {
            listKnownPartiesAsync,
          },
          stateService: {
            getActiveContractsPageAsync,
          },
          disposeAsync,
        }),
      } as never,
      {
        getTokenMetadataConfig: () => ({
          nameKeys: ['display_name'],
          symbolKeys: ['ticker'],
        }),
      } as never,
    );

    const tokens = await service.fetchHoldingV2Tokens(grpcNode);

    expect(tokens).toEqual([
      {
        tokenId: 'RegistryAdmin::USDCx-SHARE',
        name: 'USDCx Test Vault Share',
        symbol: 'vUSDCx-SHARE',
        issuer: 'RegistryAdmin',
        source: 'grpc',
      },
    ]);
  });

  it('fetches party topology mappings through the SDK topology aggregation services', async () => {
    const disposeAsync = jest.fn().mockResolvedValue(undefined);
    const computePublicKeyFingerprint = jest
      .fn()
      .mockReturnValueOnce('computed-signing-fingerprint')
      .mockReturnValueOnce('computed-encryption-fingerprint');
    const listPartiesAsync = jest.fn().mockResolvedValue({
      results: [
        {
          party: 'Alice',
          participants: [
            {
              participantUid: 'participant-1::1220abc',
              synchronizers: [
                {
                  synchronizerId: 'sync-a',
                  permission: 'submission',
                  physicalSynchronizerId: 'physical-sync-a',
                },
              ],
            },
          ],
        },
      ],
    });
    const listKeyOwnersAsync = jest.fn().mockResolvedValue({
      results: [
        {
          keyOwner: 'Alice',
          synchronizerId: 'sync-a',
          physicalSynchronizerId: 'physical-sync-a',
          signingKeys: [
            {
              format: 'raw',
              scheme: 'ed25519',
              usage: ['namespace'],
              keySpec: 'signing',
              publicKey: new Uint8Array([0xab, 0xcd, 0xef]),
            },
          ],
          encryptionKeys: [
            {
              format: 'raw',
              scheme: 'ecies',
              keySpec: 'encryption',
              publicKey: new Uint8Array([0x12, 0x34]),
            },
          ],
        },
      ],
    });
    const service = new GrpcOperationsService({
      create: () => ({
        topologyAggregationService: {
          listPartiesAsync,
          listKeyOwnersAsync,
        },
        hashing: {
          computePublicKeyFingerprint,
        },
        disposeAsync,
      }),
    } as never);
    const result = await (
      service as GrpcOperationsService & {
        fetchPartyTopology: (node: typeof grpcNode, partyId: string) => Promise<unknown>;
      }
    ).fetchPartyTopology(grpcNode, 'Alice');

    expect(listPartiesAsync).toHaveBeenCalledWith(
      expect.objectContaining({ filterParty: 'Alice', synchronizerIds: [] }),
    );
    expect(listKeyOwnersAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        filterKeyOwnerUid: 'Alice',
        synchronizerIds: [],
      }),
    );
    expect(result).toEqual({
      nodeId: 'participant-1',
      label: 'Participant 1',
      status: 'ok',
      errorMessage: null,
      isLocalParty: null,
      partyToParticipants: [
        {
          participantId: 'participant-1',
          participantUid: 'participant-1::1220abc',
          permission: 'submission',
          threshold: null,
          synchronizerIds: ['sync-a'],
        },
      ],
      partyToKeyMappings: [
        {
          keyFingerprint: 'computed-signing-fingerprint',
          publicKey: 'abcdef',
          purpose: 'namespace',
          keyType: 'ed25519',
          keyFormat: 'raw',
          keySpec: 'signing',
          threshold: null,
          synchronizerIds: ['sync-a'],
        },
        {
          keyFingerprint: 'computed-encryption-fingerprint',
          publicKey: '1234',
          purpose: 'encryption',
          keyType: 'ecies',
          keyFormat: 'raw',
          keySpec: 'encryption',
          threshold: null,
          synchronizerIds: ['sync-a'],
        },
      ],
    });
    expect(computePublicKeyFingerprint).toHaveBeenNthCalledWith(
      1,
      new Uint8Array([0xab, 0xcd, 0xef]),
      'raw',
    );
    expect(computePublicKeyFingerprint).toHaveBeenNthCalledWith(
      2,
      new Uint8Array([0x12, 0x34]),
      'raw',
    );
    expect(disposeAsync).toHaveBeenCalledTimes(1);
  });

  it('augments external-party topology with signing keys from raw PartyToParticipant mappings', async () => {
    class FakeTopologyStoreAuthorized {
      public constructor(_init: Record<string, never> = {}) {
        void _init;
      }
    }

    class FakeTopologyStoreSynchronizer {
      public readonly id?: string;
      public readonly physicalId?: string;

      public constructor(init: { id?: string; physicalId?: string } = {}) {
        this.id = init.id;
        this.physicalId = init.physicalId;
      }
    }

    class FakeTopologyStoreTemporary {
      public readonly name: string;

      public constructor(init: { name: string }) {
        this.name = init.name;
      }
    }

    class FakeTopologyStoreId {
      public readonly kind: string;
      public readonly authorized?: FakeTopologyStoreAuthorized;
      public readonly synchronizer?: FakeTopologyStoreSynchronizer;
      public readonly temporary?: FakeTopologyStoreTemporary;

      public constructor(init: {
        kind: string;
        authorized?: FakeTopologyStoreAuthorized;
        synchronizer?: FakeTopologyStoreSynchronizer;
        temporary?: FakeTopologyStoreTemporary;
      }) {
        this.kind = init.kind;
        this.authorized = init.authorized;
        this.synchronizer = init.synchronizer;
        this.temporary = init.temporary;
      }
    }

    class FakeTopologyBaseQuery {
      public readonly storeId?: FakeTopologyStoreId;
      public readonly headState?: boolean;

      public constructor(
        init: {
          storeId?: FakeTopologyStoreId;
          headState?: boolean;
        } = {},
      ) {
        this.storeId = init.storeId;
        this.headState = init.headState;
      }
    }

    class FakeListPartyToParticipantRequest {
      public readonly filterParty?: string;
      public readonly baseQuery?: FakeTopologyBaseQuery;

      public constructor(
        init: {
          filterParty?: string;
          baseQuery?: FakeTopologyBaseQuery;
        } = {},
      ) {
        this.filterParty = init.filterParty;
        this.baseQuery = init.baseQuery;
      }
    }

    const disposeAsync = jest.fn().mockResolvedValue(undefined);
    const computePublicKeyFingerprint = jest
      .fn()
      .mockReturnValue('computed-raw-signing-fingerprint');
    const listPartiesAsync = jest.fn().mockResolvedValue({
      results: [],
    });
    const listKeyOwnersAsync = jest.fn().mockResolvedValue({
      results: [],
    });
    const listAvailableStoresAsync = jest.fn().mockResolvedValue({
      storeIds: [
        { kind: 'authorized' },
        {
          kind: 'synchronizer',
          synchronizer: {
            id: 'sync-a',
          },
        },
      ],
    });
    const listPartyToParticipantAsync = jest.fn().mockImplementation(async (request) => {
      expect(request).toBeInstanceOf(FakeListPartyToParticipantRequest);
      expect(request.baseQuery).toBeInstanceOf(FakeTopologyBaseQuery);
      expect(request.baseQuery?.storeId).toBeInstanceOf(FakeTopologyStoreId);
      expect(request.baseQuery?.storeId?.synchronizer).toBeInstanceOf(
        FakeTopologyStoreSynchronizer,
      );

      return {
        results: [
          {
            item: {
              party: 'Alice',
              participants: [
                {
                  participantUid: 'participant-1::1220abc',
                  permission: 'confirmation',
                },
              ],
              partySigningKeys: {
                threshold: 1,
                keys: [
                  {
                    format: 'derX509SubjectPublicKeyInfo',
                    scheme: 'ed25519',
                    usage: ['namespace', 'proofOfOwnership', 'protocol'],
                    keySpec: 'ecCurve25519',
                    publicKey: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
                  },
                ],
              },
            },
          },
        ],
      };
    });
    const service = new GrpcOperationsService({
      create: () => ({
        topologyAggregationService: {
          listPartiesAsync,
          listKeyOwnersAsync,
        },
        topologyManagerReadService: {
          listAvailableStoresAsync,
          listPartyToParticipantAsync,
        },
        hashing: {
          computePublicKeyFingerprint,
        },
        disposeAsync,
      }),
    } as never);
    (
      service as GrpcOperationsService & {
        loadTopologySdk: () => Promise<unknown>;
      }
    ).loadTopologySdk = jest.fn().mockResolvedValue({
      ListPartyToParticipantRequest: FakeListPartyToParticipantRequest,
      TopologyBaseQuery: FakeTopologyBaseQuery,
      TopologyStoreId: FakeTopologyStoreId,
      TopologyStoreKind: {
        authorized: 'authorized',
        synchronizer: 'synchronizer',
        temporary: 'temporary',
      },
      TopologyStoreAuthorized: FakeTopologyStoreAuthorized,
      TopologyStoreSynchronizer: FakeTopologyStoreSynchronizer,
      TopologyStoreTemporary: FakeTopologyStoreTemporary,
    });

    const result = await (
      service as GrpcOperationsService & {
        fetchPartyTopology: (node: typeof grpcNode, partyId: string) => Promise<unknown>;
      }
    ).fetchPartyTopology(grpcNode, 'Alice');

    expect(listAvailableStoresAsync).toHaveBeenCalledWith({});
    const rawRequest = listPartyToParticipantAsync.mock.calls[0]?.[0];
    expect(rawRequest.filterParty).toBe('Alice');
    expect(rawRequest.baseQuery.headState).toBe(true);
    expect(rawRequest.baseQuery.storeId.kind).toBe('synchronizer');
    expect(rawRequest.baseQuery.storeId.synchronizer.id).toBe('sync-a');
    expect(result).toEqual({
      nodeId: 'participant-1',
      label: 'Participant 1',
      status: 'ok',
      errorMessage: null,
      isLocalParty: null,
      partyToParticipants: [
        {
          participantId: 'participant-1',
          participantUid: 'participant-1::1220abc',
          permission: 'confirmation',
          threshold: null,
          synchronizerIds: ['sync-a'],
        },
      ],
      partyToKeyMappings: [
        {
          keyFingerprint: 'computed-raw-signing-fingerprint',
          publicKey: 'deadbeef',
          purpose: 'namespace, proofOfOwnership, protocol',
          keyType: 'ed25519',
          keyFormat: 'derX509SubjectPublicKeyInfo',
          keySpec: 'ecCurve25519',
          threshold: 1,
          synchronizerIds: ['sync-a'],
        },
      ],
    });
    expect(computePublicKeyFingerprint).toHaveBeenCalledWith(
      new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
      'derX509SubjectPublicKeyInfo',
    );
    expect(disposeAsync).toHaveBeenCalledTimes(1);
  });

  it('returns a grpc error topology state when aggregation mapping reads fail', async () => {
    const disposeAsync = jest.fn().mockResolvedValue(undefined);
    const service = new GrpcOperationsService({
      create: () => ({
        topologyAggregationService: {
          listPartiesAsync: jest.fn().mockRejectedValue(new Error('Topology read failed')),
          listKeyOwnersAsync: jest.fn(),
        },
        disposeAsync,
      }),
    } as never);

    const result = await (
      service as GrpcOperationsService & {
        fetchPartyTopology: (node: typeof grpcNode, partyId: string) => Promise<unknown>;
      }
    ).fetchPartyTopology(grpcNode, 'Alice');

    expect(result).toEqual({
      nodeId: 'participant-1',
      label: 'Participant 1',
      status: 'grpc_error',
      errorMessage: 'Topology read failed',
      isLocalParty: null,
      partyToParticipants: [],
      partyToKeyMappings: [],
    });
    expect(disposeAsync).toHaveBeenCalledTimes(1);
  });

  it('returns a not-configured topology state for pqs-only nodes', async () => {
    const service = new GrpcOperationsService({
      create: jest.fn(),
    } as never);

    const result = await (
      service as GrpcOperationsService & {
        fetchPartyTopology: (node: typeof pqsOnlyNode, partyId: string) => Promise<unknown>;
      }
    ).fetchPartyTopology(pqsOnlyNode, 'Alice');

    expect(result).toEqual({
      nodeId: 'participant-2',
      label: 'Participant 2',
      status: 'grpc_not_configured',
      errorMessage: null,
      isLocalParty: null,
      partyToParticipants: [],
      partyToKeyMappings: [],
    });
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

    expect(result).toEqual({
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
    });
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

    expect(result).toEqual({
      participantStatus: null,
      notInitialized: {
        active: false,
        waitingForExternalInput: 'node_topology',
        version: '3.4.0',
      },
    });
    expect(disposeAsync).toHaveBeenCalledTimes(1);
  });

  it('fetches package references and package archive payloads through the SDK', async () => {
    process.env.PACKAGE_CACHE_DB_PATH = resolve(
      process.cwd(),
      'test/fixtures/daml/package-cache.sqlite',
    );
    const cachedPackage = new PackageCacheService().getPackage(SAMPLE_DAML_FIXTURE.packageId);
    if (!cachedPackage) {
      throw new Error('Missing DAML fixture package');
    }
    const archivePayload = extractDamlLfArchivePayloadOrThrow(new Uint8Array(cachedPackage.data));
    const disposeAsync = jest.fn().mockResolvedValue(undefined);
    const service = new GrpcOperationsService({
      create: () => ({
        participantPackageService: {
          listPackagesAsync: jest.fn().mockResolvedValue({
            packageDescriptions: [
              {
                packageId: SAMPLE_DAML_FIXTURE.packageId,
                name: 'splice-amulet',
                version: '0.1.18',
                uploadedAt: new Date('2026-07-03T10:00:00.000Z'),
                size: 2048,
              },
            ],
          }),
        },
        packageService: {
          getPackageAsync: jest.fn().mockResolvedValue({
            archivePayload,
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
        packageId: SAMPLE_DAML_FIXTURE.packageId,
        mainPackageId: SAMPLE_DAML_FIXTURE.packageId,
        name: 'splice-amulet',
        version: '0.1.18',
        uploadedAt: '2026-07-03T10:00:00.000Z',
        packageSize: 2048,
      },
    ]);
    expect(packages).toEqual([
      expect.objectContaining({
        packageId: SAMPLE_DAML_FIXTURE.packageId,
        name: 'splice-amulet',
        version: '0.1.18',
        uploadedAt: '2026-07-03T10:00:00.000Z',
        packageSize: 2048,
        data: Buffer.from(cachedPackage.data),
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
    const archivePayload = extractDamlLfArchivePayloadOrThrow(new Uint8Array(cachedPackage.data));

    const disposeAsync = jest.fn().mockResolvedValue(undefined);
    const service = new GrpcOperationsService({
      create: () => ({
        participantPackageService: {
          listPackagesAsync: jest
            .fn()
            .mockRejectedValue(
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
            archivePayload,
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
