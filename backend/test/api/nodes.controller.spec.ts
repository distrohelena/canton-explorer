import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NodesController } from '../../src/api/nodes.controller';
import { NodeCacheService } from '../../src/cache/node-cache.service';
import { NodeConfigService } from '../../src/config/node-config.service';
import { GrpcOperationsService } from '../../src/grpc/grpc-operations.service';
import { PqsSummaryService } from '../../src/pqs/pqs-summary.service';
import type {
  PartyDetailResponse,
  NodeContractsResponse,
  NodeParticipantStatusResponse,
  NodePackagesResponse,
  PackageDetailResponse,
  PackageFamilyResponse,
  TemplateFilterResponse,
  TokensResponse,
  TokenTransfersResponse,
} from '../../src/domain/node.types';

const typedPackageDetailFixture = {
  packageId: 'main-package',
  name: 'Main Package',
  version: '1.2.3',
  uploadedAt: '2026-07-02T12:00:00.000Z',
  packageSize: 1024,
  status: 'decoded',
  seenOnNodes: [
    {
      nodeId: 'participant-1',
      packageName: 'Main Package',
      packageVersion: '1.2.3',
      seenAt: '2026-07-02T12:05:00.000Z',
    },
  ],
  moduleCount: 2,
  templateCount: 3,
  dataTypeCount: 5,
  modules: ['Main.Module', 'Main.Other'],
  templates: [
    {
      templateId: 'Main.Module:Asset',
      moduleName: 'Main.Module',
      entityName: 'Asset',
      createType: {
        kind: 'record',
        label: 'Main.Module:Asset',
        fields: [
          {
            name: 'owner',
            type: {
              kind: 'builtin',
              label: 'Party',
            },
          },
        ],
      },
    },
  ],
  dataTypes: [
    {
      typeId: 'Main.Module:AssetData',
      moduleName: 'Main.Module',
      entityName: 'AssetData',
      definition: {
        kind: 'record',
        label: 'Main.Module:AssetData',
        fields: [
          {
            name: 'description',
            type: {
              kind: 'builtin',
              label: 'Text',
            },
          },
        ],
      },
    },
  ],
} satisfies PackageDetailResponse;

const typedPackageFamilyFixture = {
  name: 'Main Package',
  packages: [
    {
      packageId: 'main-package-v2',
      name: 'Main Package',
      version: '1.2.4',
      uploadedAt: '2026-07-02T13:00:00.000Z',
      packageSize: 2048,
    },
    {
      packageId: 'main-package',
      name: 'Main Package',
      version: '1.2.3',
      uploadedAt: '2026-07-02T12:00:00.000Z',
      packageSize: 1024,
    },
  ],
} satisfies PackageFamilyResponse;

const typedNodePackagesFixture = {
  nodeId: 'participant-1',
  label: 'Participant 1',
  packagesByName: [
    {
      packageName: 'Main Package',
      packages: [
        {
          packageId: 'main-package-v2',
          version: '1.2.4',
          uploadedAt: '2026-07-02T13:00:00.000Z',
          seenAt: '2026-07-02T13:05:00.000Z',
        },
        {
          packageId: 'main-package',
          version: '1.2.3',
          uploadedAt: '2026-07-02T12:00:00.000Z',
          seenAt: '2026-07-02T12:05:00.000Z',
        },
      ],
    },
  ],
} satisfies NodePackagesResponse;

const typedNodeContractsFixture = {
  nodeId: 'participant-1',
  label: 'Participant 1',
  limit: 25,
  nextBefore: '000000000000000099',
  nextAfter: null,
  contracts: [
    {
      contractId: '00abc',
      templateId: 'Main:Asset',
      createdRecordTime: '2026-07-01T12:00:00.000Z',
    },
  ],
} satisfies NodeContractsResponse;

const typedTemplateFilterFixture = {
  templates: [
    { templateId: 'Main:Asset' },
    { templateId: 'Main:Wallet' },
  ],
} satisfies TemplateFilterResponse;

const typedNodeParticipantStatusFixture = {
  nodeId: 'participant-2',
  label: 'Participant 2',
  mode: 'pqs_with_grpc',
  participantStatusStatus: 'ok',
  participantStatus: {
    uid: 'participant2::1220abc',
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
    ],
  },
  notInitialized: null,
  participantStatusError: null,
  participantStatusErrorCode: null,
  participantStatusErrorDetails: null,
  participantStatusErrorTid: null,
} satisfies NodeParticipantStatusResponse;

const typedPartyDetailFixture = {
  partyId: 'Alice',
  nodeCount: 2,
  recentUpdateCount: 2,
  recentContractCount: 2,
  nodes: [
    {
      nodeId: 'participant-1',
      label: 'Participant 1',
      recentUpdateCount: 1,
      recentContractCount: 1,
    },
    {
      nodeId: 'participant-2',
      label: 'Participant 2',
      recentUpdateCount: 1,
      recentContractCount: 1,
    },
  ],
  recentUpdates: [
    {
      nodeId: 'participant-1',
      label: 'Participant 1',
      eventOffset: '0000000000000001',
      updateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      recordTime: '2026-07-01T12:00:00.000Z',
      parties: ['Alice', 'Bob'],
    },
    {
      nodeId: 'participant-2',
      label: 'Participant 2',
      eventOffset: '0000000000000002',
      updateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e2',
      recordTime: '2026-07-01T11:00:00.000Z',
      parties: ['Alice'],
    },
  ],
  recentContracts: [
    {
      nodeId: 'participant-1',
      label: 'Participant 1',
      contractId: '00abc',
      templateId: 'Main:Asset',
      packageId: 'main-package',
      packageName: 'Main Package',
      packageVersion: '1.2.3',
      recordTime: '2026-07-01T12:00:00.000Z',
    },
    {
      nodeId: 'participant-2',
      label: 'Participant 2',
      contractId: '00def',
      templateId: 'Main:Asset',
      packageId: 'main-package',
      packageName: 'Main Package',
      packageVersion: '1.2.3',
      recordTime: '2026-07-01T11:00:00.000Z',
    },
  ],
  partyTopologyByNode: [
    {
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
          keyFingerprint: 'fingerprint-1',
          purpose: 'namespace',
          keyType: 'ed25519',
          synchronizerIds: [],
        },
      ],
    },
    {
      nodeId: 'participant-2',
      label: 'Participant 2',
      status: 'ok',
      errorMessage: null,
      partyToParticipants: [],
      partyToKeyMappings: [],
    },
  ],
} satisfies PartyDetailResponse;

const typedActivePartiesFixture = {
  nodes: [
    {
      nodeId: 'participant-1',
      label: 'Participant 1',
      mode: 'pqs_only',
      parties: ['Alice', 'Bob'],
    },
  ],
};

const typedLocalPartiesFixture = {
  nodes: [
    {
      nodeId: 'participant-1',
      label: 'Participant 1',
      mode: 'pqs_only',
      parties: [],
      localPartiesStatus: 'grpc_not_configured',
      localPartiesError: null,
      localPartiesErrorCode: null,
      localPartiesErrorDetails: null,
      localPartiesErrorTid: null,
    },
    {
      nodeId: 'participant-2',
      label: 'Participant 2',
      mode: 'pqs_with_grpc',
      parties: ['LocalAlice', 'LocalBob'],
      localPartiesStatus: 'ok',
      localPartiesError: null,
      localPartiesErrorCode: null,
      localPartiesErrorDetails: null,
      localPartiesErrorTid: null,
    },
  ],
};

const typedTokensFixture = {
  tokens: [
    {
      tokenId: 'canton-coin',
      name: 'Canton Coin',
      symbol: null,
      source: 'pqs',
    },
  ],
} satisfies TokensResponse;

const typedTokenTransfersFixture = {
  limit: 25,
  nextBefore: 'token-cursor-before-1',
  nextAfter: null,
  transfers: [
    {
      tokenId: 'canton-coin',
      tokenName: 'Canton Coin',
      amount: '42.0',
      sender: 'Alice',
      receiver: 'Bob',
      updateId: '00000000000000000000000000000002',
      recordTime: '2026-07-01T12:01:00.000Z',
      nodes: [
        {
          nodeId: 'participant-2',
          label: 'Participant 2',
          eventOffset: '000000000000000002',
        },
      ],
    },
  ],
} satisfies TokenTransfersResponse;

describe('NodesController', () => {
  let controller: NodesController;
  let cache: NodeCacheService;
  let pqsSummaryService: {
    fetchTokens: jest.Mock;
    fetchLatestTokenTransfers: jest.Mock;
    fetchGlobalRecentUpdates: jest.Mock;
    fetchRecentUpdates: jest.Mock;
    fetchUpdateDetail: jest.Mock;
    fetchContractDetail: jest.Mock;
    search: jest.Mock;
    fetchPackageDetail: jest.Mock;
    fetchPackagesByName: jest.Mock;
    fetchTemplates: jest.Mock;
    fetchNodePackages: jest.Mock;
    fetchNodeTemplates: jest.Mock;
    fetchNodeContracts: jest.Mock;
    fetchActiveParties: jest.Mock;
    fetchPartyDetail: jest.Mock;
    fetchPartyUpdates: jest.Mock;
    fetchPartyContracts: jest.Mock;
  };
  let grpcOperationsService: {
    listLocalParties: jest.Mock;
    fetchParticipantStatus: jest.Mock;
  };

  beforeEach(async () => {
    pqsSummaryService = {
      fetchTokens: jest.fn().mockResolvedValue(typedTokensFixture),
      fetchLatestTokenTransfers: jest.fn().mockResolvedValue(typedTokenTransfersFixture),
      fetchGlobalRecentUpdates: jest.fn().mockResolvedValue({
        limit: 25,
        nextBefore: null,
        nextAfter: null,
        updates: [
          {
            nodeId: 'participant-2',
            label: 'Participant 2',
            eventOffset: '000000000000000002',
            updateId: '00000000000000000000000000000002',
            recordTime: '2026-07-01T12:01:00.000Z',
            parties: ['Bob'],
          },
          {
            nodeId: 'participant-1',
            label: 'Participant 1',
            eventOffset: '000000000000000001',
            updateId: '00000000000000000000000000000001',
            recordTime: '2026-07-01T12:00:00.000Z',
            parties: ['Alice'],
          },
        ],
      }),
      fetchRecentUpdates: jest.fn().mockResolvedValue({
        nodeId: 'participant-1',
        label: 'Participant 1',
        limit: 25,
        nextBefore: '000000000000000001',
        nextAfter: null,
        updates: [
          {
            eventOffset: '000000000000000001',
            updateId: '00000000000000000000000000000001',
            recordTime: '2026-07-01T12:00:00.000Z',
            parties: ['Alice'],
          },
        ],
      }),
      fetchUpdateDetail: jest.fn().mockResolvedValue({
        nodeId: 'participant-1',
        label: 'Participant 1',
        eventOffset: '0000000000000001',
        updateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
        recordTime: '2026-07-01T12:00:00.000Z',
        parties: ['Alice'],
        events: [
          {
            eventKind: 'create',
            eventId: '#0:0',
            contractId: '00abc',
            templateId: 'Main:Asset',
            choice: null,
            witnesses: ['Alice'],
            raw: {
              event_id: '#0:0',
              contract_id: '00abc',
              template_id: 'Main:Asset',
              tree_event_witnesses: ['Alice'],
            },
          },
        ],
        meta: {
          update_id:
            '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
          record_time: 1782907200000000,
          event_offset: '0000000000000001',
        },
      }),
      fetchContractDetail: jest.fn().mockResolvedValue({
        nodeId: 'participant-1',
        label: 'Participant 1',
        contractId: '00abc',
        templateId: 'Main:Asset',
        packageId: 'main-package',
        packageName: 'main-package-name',
        packageVersion: '1.2.3',
        createdUpdateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
        createdEventOffset: '0000000000000001',
        createdRecordTime: '2026-07-01T12:00:00.000Z',
        archivedUpdateId: null,
        archivedEventOffset: null,
        archivedRecordTime: null,
        contractData: null,
      }),
      search: jest.fn().mockResolvedValue({
        query: 'Alice',
        updates: {
          items: [],
          displayedCount: 0,
          truncated: false,
          status: 'ok',
          warnings: [],
        },
        contracts: {
          items: [],
          displayedCount: 0,
          truncated: false,
          status: 'ok',
          warnings: [],
        },
        parties: {
          items: [{ partyId: 'Alice', nodeIds: ['participant-1'] }],
          displayedCount: 1,
          truncated: false,
          status: 'ok',
          warnings: [],
        },
        packages: {
          packageIds: {
            items: [],
            displayedCount: 0,
            truncated: false,
            status: 'ok',
            warnings: [],
          },
          packageNames: {
            items: [],
            displayedCount: 0,
            truncated: false,
            status: 'ok',
            warnings: [],
          },
        },
      }),
      fetchPackageDetail: jest.fn().mockResolvedValue(typedPackageDetailFixture),
      fetchPackagesByName: jest.fn().mockResolvedValue(typedPackageFamilyFixture),
      fetchTemplates: jest.fn().mockResolvedValue(typedTemplateFilterFixture),
      fetchNodePackages: jest.fn().mockResolvedValue(typedNodePackagesFixture),
      fetchNodeTemplates: jest.fn().mockResolvedValue(typedTemplateFilterFixture),
      fetchNodeContracts: jest.fn().mockResolvedValue(typedNodeContractsFixture),
      fetchActiveParties: jest.fn().mockResolvedValue(typedActivePartiesFixture),
      fetchPartyDetail: jest.fn().mockResolvedValue(typedPartyDetailFixture),
      fetchPartyUpdates: jest.fn().mockResolvedValue({
        limit: 25,
        nextBefore: null,
        nextAfter: null,
        updates: typedPartyDetailFixture.recentUpdates,
      }),
      fetchPartyContracts: jest.fn().mockResolvedValue({
        limit: 25,
        nextBefore: null,
        nextAfter: null,
        contracts: typedPartyDetailFixture.recentContracts,
      }),
    };
    grpcOperationsService = {
      listLocalParties: jest.fn().mockResolvedValue(['LocalAlice', 'LocalBob']),
      fetchParticipantStatus: jest.fn().mockResolvedValue({
        participantStatus: typedNodeParticipantStatusFixture.participantStatus,
        notInitialized: null,
      }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [NodesController],
      providers: [
        NodeCacheService,
        {
          provide: NodeConfigService,
          useValue: {
            list: () => [
              {
                id: 'participant-1',
                label: 'Participant 1',
                role: 'participant',
                mode: 'pqs_only',
                ledgerLabel: 'Retail Ledger',
                pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
              },
              {
                id: 'participant-2',
                label: 'Participant 2',
                role: 'participant',
                mode: 'pqs_with_grpc',
                ledgerLabel: 'Retail Ledger 2',
                pqs: { connectionUriEnv: 'PARTICIPANT_2_PQS_URL' },
                grpc: {
                  ledgerTarget: 'localhost:5012',
                  ledgerAdminTarget: 'localhost:5013',
                  participantAdminTarget: 'localhost:5014',
                  useTls: false,
                  connectTimeoutMs: 5000,
                },
              },
            ],
          },
        },
        {
          provide: GrpcOperationsService,
          useValue: grpcOperationsService,
        },
        {
          provide: PqsSummaryService,
          useValue: pqsSummaryService,
        },
      ],
    }).compile();

    controller = moduleRef.get(NodesController);
    cache = moduleRef.get(NodeCacheService);

    cache.upsert({
      id: 'participant-1',
      label: 'Participant 1',
      role: 'participant',
      mode: 'pqs_only',
      ledgerLabel: 'Retail Ledger',
      status: 'healthy',
      latencyMs: 21,
      lastSuccessAt: '2026-07-01T12:00:00.000Z',
      lastErrorAt: null,
      errorSummary: null,
      serviceInfo: {
        target: 'localhost:5012',
        reachable: true,
        healthCheckImplemented: true,
        servingStatus: 'SERVING',
      },
      ledgerSummary: {
        ledgerLabel: 'Retail Ledger',
        pqsDatabase: 'participant1_pqs',
        activeContractCount: 12,
        latestOffset: '000000000000123456',
        latestEventAt: '2026-07-01T11:59:00.000Z',
        totalUpdateCount: 42,
      },
      sourceStatus: {
        pqs: {
          ok: true,
          checkedAt: '2026-07-01T12:00:00.000Z',
          latencyMs: 11,
          message: null,
        },
        grpc: {
          ok: true,
          checkedAt: '2026-07-01T12:00:00.000Z',
          latencyMs: 10,
          message: null,
        },
      },
    });
  });

  it('returns node summaries', () => {
    const response = controller.listNodes();

    expect(response).toHaveLength(1);
    expect(response[0].id).toBe('participant-1');
  });

  it('keeps the package detail fixture in sync with the response contract', () => {
    expect(typedPackageDetailFixture.packageId).toBe('main-package');
    expect(typedPackageDetailFixture.templates[0].templateId).toBe('Main.Module:Asset');
  });

  it('exposes a package detail controller entry point', () => {
    const maybeController = controller as {
      getPackageDetail?: (packageId: string) => Promise<PackageDetailResponse>;
    };

    expect(typeof maybeController.getPackageDetail).toBe('function');
  });

  it('returns package detail for a known package id', async () => {
    const response = await controller.getPackageDetail('main-package');

    expect(pqsSummaryService.fetchPackageDetail).toHaveBeenCalledWith('main-package');
    expect(response).toEqual(typedPackageDetailFixture);
  });

  it('returns 404 for an unknown package id', async () => {
    pqsSummaryService.fetchPackageDetail.mockRejectedValueOnce(new Error('Package not found'));

    await expect(controller.getPackageDetail('missing-package')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('exposes a package-family controller entry point', () => {
    const maybeController = controller as {
      listPackagesByName?: (packageName: string) => Promise<PackageFamilyResponse>;
    };

    expect(typeof maybeController.listPackagesByName).toBe('function');
  });

  it('returns all known versions for a package name', async () => {
    const response = await controller.listPackagesByName('Main Package');

    expect(pqsSummaryService.fetchPackagesByName).toHaveBeenCalledWith('Main Package');
    expect(response).toEqual(typedPackageFamilyFixture);
  });

  it('returns 404 for an unknown package name', async () => {
    pqsSummaryService.fetchPackagesByName.mockRejectedValueOnce(new Error('Package family not found'));

    await expect(controller.listPackagesByName('missing-package')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('exposes a node packages controller entry point', () => {
    const maybeController = controller as {
      listNodePackages?: (id: string) => Promise<NodePackagesResponse>;
    };

    expect(typeof maybeController.listNodePackages).toBe('function');
  });

  it('returns installed packages for a known node id', async () => {
    const response = await controller.listNodePackages('participant-1');

    expect(pqsSummaryService.fetchNodePackages).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'participant-1', label: 'Participant 1' }),
    );
    expect(response).toEqual(typedNodePackagesFixture);
  });

  it('returns known templates for a known node id', async () => {
    const response = await controller.listNodeTemplates('participant-1');

    expect(pqsSummaryService.fetchNodeTemplates).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'participant-1', label: 'Participant 1' }),
    );
    expect(response).toEqual(typedTemplateFilterFixture);
  });

  it('returns active contracts for a known node id', async () => {
    const response = await controller.listNodeContracts('participant-1');

    expect(pqsSummaryService.fetchNodeContracts).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'participant-1', label: 'Participant 1' }),
      {
        limit: 25,
        before: undefined,
        after: undefined,
      },
    );
    expect(response).toEqual(typedNodeContractsFixture);
  });

  it('returns filtered active contracts for a known node id', async () => {
    const maybeController = controller as {
      listNodeContracts?: (
        id: string,
        limit?: string,
        before?: string,
        after?: string,
        party?: string | string[],
        template?: string | string[],
        partyMode?: string,
        mode?: string,
        hideSplice?: string,
      ) => Promise<NodeContractsResponse>;
    };

    expect(typeof maybeController.listNodeContracts).toBe('function');

    const response = await maybeController.listNodeContracts!(
      'participant-1',
      '25',
      'cursor-1',
      undefined,
      ['Alice', 'Bob'],
      'Main:Asset',
      'and',
      undefined,
      'true',
    );

    expect(pqsSummaryService.fetchNodeContracts).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'participant-1', label: 'Participant 1' }),
      {
        limit: 25,
        before: 'cursor-1',
        after: undefined,
        parties: ['Alice', 'Bob'],
        templates: ['Main:Asset'],
        partyMode: 'and',
        hideSplice: true,
      },
    );
    expect(response).toEqual(typedNodeContractsFixture);
  });

  it('returns participant status for a known grpc-enabled node id', async () => {
    const response = await controller.getNodeParticipantStatus('participant-2');

    expect(grpcOperationsService.fetchParticipantStatus).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'participant-2', label: 'Participant 2' }),
    );
    expect(response).toEqual(typedNodeParticipantStatusFixture);
  });

  it('returns 404 when node package lookup uses an unknown node id', async () => {
    await expect(controller.listNodePackages('missing-node')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns all known templates', async () => {
    const response = await controller.listTemplates();

    expect(pqsSummaryService.fetchTemplates).toHaveBeenCalled();
    expect(response).toEqual(typedTemplateFilterFixture);
  });

  it('exposes a grouped search controller entry point', () => {
    const maybeController = controller as {
      search?: (query?: string) => Promise<unknown>;
    };

    expect(typeof maybeController.search).toBe('function');
  });

  it('returns grouped search results from the summary service', async () => {
    const maybeController = controller as {
      search?: (query?: string) => Promise<unknown>;
    };

    const response = await maybeController.search?.(' Alice ');

    expect(pqsSummaryService.search).toHaveBeenCalledWith(' Alice ');
    expect(response).toEqual({
      query: 'Alice',
      updates: {
        items: [],
        displayedCount: 0,
        truncated: false,
        status: 'ok',
        warnings: [],
      },
      contracts: {
        items: [],
        displayedCount: 0,
        truncated: false,
        status: 'ok',
        warnings: [],
      },
      parties: {
        items: [{ partyId: 'Alice', nodeIds: ['participant-1'] }],
        displayedCount: 1,
        truncated: false,
        status: 'ok',
        warnings: [],
      },
      packages: {
        packageIds: {
          items: [],
          displayedCount: 0,
          truncated: false,
          status: 'ok',
          warnings: [],
        },
        packageNames: {
          items: [],
          displayedCount: 0,
          truncated: false,
          status: 'ok',
          warnings: [],
        },
      },
    });
  });

  it('exposes a party detail controller entry point', () => {
    const maybeController = controller as {
      getPartyDetail?: (partyId: string) => Promise<PartyDetailResponse>;
    };

    expect(typeof maybeController.getPartyDetail).toBe('function');
  });

  it('exposes an active parties controller entry point', () => {
    const maybeController = controller as {
      listActiveParties?: () => Promise<typeof typedActivePartiesFixture>;
    };

    expect(typeof maybeController.listActiveParties).toBe('function');
  });

  it('returns active parties grouped by node', async () => {
    const maybeController = controller as {
      listActiveParties?: () => Promise<typeof typedActivePartiesFixture>;
    };

    const response = await maybeController.listActiveParties?.();

    expect(pqsSummaryService.fetchActiveParties).toHaveBeenCalledWith(expect.any(Array));
    expect(response?.nodes[0].nodeId).toBe('participant-1');
    expect(response).toEqual(typedActivePartiesFixture);
  });

  it('returns active parties for a single known node id', async () => {
    const response = await controller.listNodeActiveParties('participant-1');

    expect(pqsSummaryService.fetchActiveParties).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'participant-1' }),
    ]);
    expect(response).toEqual(typedActivePartiesFixture.nodes[0]);
  });

  it('returns 404 for active-party lookup on an unknown node id', async () => {
    await expect(controller.listNodeActiveParties('missing-node')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns local parties grouped by node using the SDK-backed gRPC service', async () => {
    const maybeController = controller as {
      listLocalParties?: () => Promise<typeof typedLocalPartiesFixture>;
    };

    const response = await maybeController.listLocalParties?.();

    expect(grpcOperationsService.listLocalParties).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'participant-2' }),
    );
    expect(response).toEqual(typedLocalPartiesFixture);
  });

  it('returns local parties for a single known node id', async () => {
    const response = await controller.listNodeLocalParties('participant-2');

    expect(grpcOperationsService.listLocalParties).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'participant-2' }),
    );
    expect(response).toEqual(typedLocalPartiesFixture.nodes[1]);
  });

  it('returns grpc_not_configured for local-party lookup on a pqs-only node', async () => {
    const response = await controller.listNodeLocalParties('participant-1');

    expect(response).toEqual(typedLocalPartiesFixture.nodes[0]);
  });

  it('marks grpc failures separately from empty local-party results', async () => {
    grpcOperationsService.listLocalParties.mockRejectedValueOnce(
      Object.assign(
        new Error(
          'An error occurred. Please contact the operator and inquire about the request 66f620d5014db408ba2d552b8d78b99f with tid 66f620d5014db408ba2d552b8d78b99f',
        ),
        {
          code: 13,
          details:
            'An error occurred. Please contact the operator and inquire about the request 66f620d5014db408ba2d552b8d78b99f with tid 66f620d5014db408ba2d552b8d78b99f',
        },
      ),
    );

    const maybeController = controller as {
      listLocalParties?: () => Promise<typeof typedLocalPartiesFixture>;
    };

    const response = await maybeController.listLocalParties?.();

    expect(response).toEqual({
      nodes: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          mode: 'pqs_only',
          parties: [],
          localPartiesStatus: 'grpc_not_configured',
          localPartiesError: null,
          localPartiesErrorCode: null,
          localPartiesErrorDetails: null,
          localPartiesErrorTid: null,
        },
        {
          nodeId: 'participant-2',
          label: 'Participant 2',
          mode: 'pqs_with_grpc',
          parties: [],
          localPartiesStatus: 'grpc_error',
          localPartiesError:
            'An error occurred. Please contact the operator and inquire about the request 66f620d5014db408ba2d552b8d78b99f with tid 66f620d5014db408ba2d552b8d78b99f',
          localPartiesErrorCode: '13',
          localPartiesErrorDetails:
            'An error occurred. Please contact the operator and inquire about the request 66f620d5014db408ba2d552b8d78b99f with tid 66f620d5014db408ba2d552b8d78b99f',
          localPartiesErrorTid: '66f620d5014db408ba2d552b8d78b99f',
        },
      ],
    });
  });

  it('returns party detail for a known party id', async () => {
    const response = await controller.getPartyDetail('Alice');

    expect(pqsSummaryService.fetchPartyDetail).toHaveBeenCalledWith(
      expect.any(Array),
      'Alice',
    );
    expect(response).toEqual(typedPartyDetailFixture);
  });

  it('returns party-scoped updates for a known party id', async () => {
    await (
      controller as unknown as {
        listPartyUpdates: (
          partyId: string,
          limit?: string,
          before?: string,
          after?: string,
          template?: string | string[],
          partyMode?: string,
          mode?: string,
          hideSplice?: string,
        ) => Promise<unknown>;
      }
    ).listPartyUpdates(
      'Alice',
      '25',
      'cursor-before-0',
      undefined,
      ['Main:Asset'],
      undefined,
      undefined,
      'true',
    );

    expect(pqsSummaryService.fetchPartyUpdates).toHaveBeenCalledWith(
      expect.any(Array),
      'Alice',
      {
        limit: 25,
        before: 'cursor-before-0',
        after: undefined,
        templates: ['Main:Asset'],
        partyMode: undefined,
        hideSplice: true,
      },
    );
  });

  it('returns party-scoped contracts for a known party id', async () => {
    await (
      controller as unknown as {
        listPartyContracts: (
          partyId: string,
          limit?: string,
          before?: string,
          after?: string,
          template?: string | string[],
          hideSplice?: string,
        ) => Promise<unknown>;
      }
    ).listPartyContracts('Alice', '25', 'cursor-contract-0', undefined, 'Main:Asset', 'true');

    expect(pqsSummaryService.fetchPartyContracts).toHaveBeenCalledWith(
      expect.any(Array),
      'Alice',
      {
        limit: 25,
        before: 'cursor-contract-0',
        after: undefined,
        templates: ['Main:Asset'],
        hideSplice: true,
      },
    );
  });

  it('returns 404 for an unknown party id', async () => {
    pqsSummaryService.fetchPartyDetail.mockRejectedValueOnce(new Error('Party not found'));

    await expect(controller.getPartyDetail('missing-party')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns aggregated ledgers', () => {
    const response = controller.listLedgers();

    expect(response[0].ledgerLabel).toBe('Retail Ledger');
  });

  it('returns cached activity history grouped by node', () => {
    cache.recordActivitySample({
      nodeId: 'participant-1',
      label: 'Participant 1',
      status: 'healthy',
      timestamp: '2026-06-23T12:00:00.000Z',
      activeContractCount: 11,
      latestOffset: '000000000000123400',
      totalUpdateCount: 10,
    });
    cache.recordActivitySample({
      nodeId: 'participant-1',
      label: 'Participant 1',
      status: 'healthy',
      timestamp: '2026-06-29T12:00:00.000Z',
      activeContractCount: 13,
      latestOffset: '000000000000123455',
      totalUpdateCount: 12,
    });
    cache.recordActivitySample({
      nodeId: 'participant-1',
      label: 'Participant 1',
      status: 'healthy',
      timestamp: '2026-07-01T11:55:00.000Z',
      activeContractCount: 12,
      latestOffset: '000000000000123456',
      totalUpdateCount: 12,
    });
    cache.recordActivitySample({
      nodeId: 'participant-1',
      label: 'Participant 1',
      status: 'healthy',
      timestamp: '2026-07-01T12:00:00.000Z',
      activeContractCount: 15,
      latestOffset: '000000000000123457',
      totalUpdateCount: 15,
    });

    const listActivityHistorySpy = jest.spyOn(cache, 'listActivityHistory');
    const response = controller.listActivityHistory('7');

    expect(listActivityHistorySpy).toHaveBeenCalledWith(7);
    expect(response).toEqual({
      generatedAt: expect.any(String),
      windowMinutes: 10080,
      nodes: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          status: 'healthy',
          latestActiveContractCount: 15,
          samples: [
            {
              timestamp: '2026-07-01T11:45:00.000Z',
              activityValue: 0,
              activeContractCount: 12,
              latestOffset: '000000000000123456',
            },
            {
              timestamp: '2026-07-01T12:00:00.000Z',
              activityValue: 3,
              activeContractCount: 15,
              latestOffset: '000000000000123457',
            },
          ],
        },
      ],
    });
  });

  it('returns recent updates for a known node', async () => {
    const response = await controller.listNodeUpdates('participant-1');

    expect(pqsSummaryService.fetchRecentUpdates).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'participant-1',
        label: 'Participant 1',
      }),
      {
        limit: 25,
        before: undefined,
        after: undefined,
        parties: undefined,
        partyMode: undefined,
      },
    );
    expect(response).toEqual({
      nodeId: 'participant-1',
      label: 'Participant 1',
      limit: 25,
      nextBefore: '000000000000000001',
      nextAfter: null,
      updates: [
        {
          eventOffset: '000000000000000001',
          updateId: '00000000000000000000000000000001',
          recordTime: '2026-07-01T12:00:00.000Z',
          parties: ['Alice'],
        },
      ],
    });
  });

  it('returns globally merged recent updates across all known nodes', async () => {
    const response = await (
      controller as unknown as {
        listGlobalRecentUpdates: (
          limit?: string,
          before?: string,
          after?: string,
        ) => Promise<unknown>;
      }
    ).listGlobalRecentUpdates();

    expect(pqsSummaryService.fetchGlobalRecentUpdates).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'participant-1' }),
        expect.objectContaining({ id: 'participant-2' }),
      ]),
      25,
      {
        before: undefined,
        after: undefined,
      },
    );
    expect(response).toEqual({
      limit: 25,
      nextBefore: null,
      nextAfter: null,
      updates: [
        {
          nodeId: 'participant-2',
          label: 'Participant 2',
          eventOffset: '000000000000000002',
          updateId: '00000000000000000000000000000002',
          recordTime: '2026-07-01T12:01:00.000Z',
          parties: ['Bob'],
        },
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          eventOffset: '000000000000000001',
          updateId: '00000000000000000000000000000001',
          recordTime: '2026-07-01T12:00:00.000Z',
          parties: ['Alice'],
        },
      ],
    });
  });

  it('passes global update cursors through to the PQS summary service', async () => {
    await (
      controller as unknown as {
        listGlobalRecentUpdates: (
          limit?: string,
          before?: string,
          after?: string,
        ) => Promise<unknown>;
      }
    ).listGlobalRecentUpdates('25', '000000000000000099', '000000000000000120');

    expect(pqsSummaryService.fetchGlobalRecentUpdates).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'participant-1' }),
        expect.objectContaining({ id: 'participant-2' }),
      ]),
      25,
      {
        before: '000000000000000099',
        after: '000000000000000120',
      },
    );
  });

  it('passes global update filters through to the PQS summary service', async () => {
    await controller.listGlobalRecentUpdates(
      '25',
      undefined,
      undefined,
      ['Alice', 'Bob'],
      ['Main:Asset', 'Main:Wallet'],
      'and',
      undefined,
      'true',
    );

    expect(pqsSummaryService.fetchGlobalRecentUpdates).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'participant-1' }),
        expect.objectContaining({ id: 'participant-2' }),
      ]),
      25,
      {
        before: undefined,
        after: undefined,
        parties: ['Alice', 'Bob'],
        templates: ['Main:Asset', 'Main:Wallet'],
        partyMode: 'and',
        hideSplice: true,
      },
    );
  });

  it('returns discovered tokens across all known nodes', async () => {
    const response = await (
      controller as unknown as {
        listTokens: () => Promise<unknown>;
      }
    ).listTokens();

    expect(pqsSummaryService.fetchTokens).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'participant-1' }),
        expect.objectContaining({ id: 'participant-2' }),
      ]),
    );
    expect(response).toEqual(typedTokensFixture);
  });

  it('passes token transfer pagination cursors through to the PQS summary service', async () => {
    await (
      controller as unknown as {
        listTokenTransfers: (
          limit?: string,
          before?: string,
          after?: string,
        ) => Promise<unknown>;
      }
    ).listTokenTransfers('25', 'token-cursor-before-1', 'token-cursor-after-1');

    expect(pqsSummaryService.fetchLatestTokenTransfers).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'participant-1' }),
        expect.objectContaining({ id: 'participant-2' }),
      ]),
      25,
      {
        before: 'token-cursor-before-1',
        after: 'token-cursor-after-1',
      },
    );
  });

  it('passes through offset cursors for updates pagination', async () => {
    await controller.listNodeUpdates(
      'participant-1',
      '25',
      '000000000000000100',
      undefined,
      undefined,
      undefined,
    );

    expect(pqsSummaryService.fetchRecentUpdates).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'participant-1',
      }),
      {
        limit: 25,
        before: '000000000000000100',
        after: undefined,
        parties: undefined,
        partyMode: undefined,
      },
    );
  });

  it('passes through repeated party filters and party mode for updates pagination', async () => {
    await controller.listNodeUpdates(
      'participant-1',
      '25',
      undefined,
      undefined,
      ['Alice', 'Bob'],
      ['Main:Asset'],
      'and',
    );

    expect(pqsSummaryService.fetchRecentUpdates).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'participant-1',
      }),
      {
        limit: 25,
        before: undefined,
        after: undefined,
        parties: ['Alice', 'Bob'],
        templates: ['Main:Asset'],
        partyMode: 'and',
      },
    );
  });

  it('passes through the hide Splice flag for updates pagination', async () => {
    await controller.listNodeUpdates(
      'participant-1',
      '25',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'true',
    );

    expect(pqsSummaryService.fetchRecentUpdates).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'participant-1',
      }),
      {
        limit: 25,
        before: undefined,
        after: undefined,
        parties: undefined,
        partyMode: undefined,
        hideSplice: true,
      },
    );
  });

  it('returns 404 for updates on an unknown node', async () => {
    await expect(controller.listNodeUpdates('missing-node')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns a single update detail for a known node', async () => {
    const response = await (
      controller as unknown as {
        getNodeUpdateDetail: (id: string, updateId: string) => Promise<unknown>;
      }
      ).getNodeUpdateDetail(
      'participant-1',
      '0000000000000001',
    );

    expect(pqsSummaryService.fetchUpdateDetail).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'participant-1',
        label: 'Participant 1',
      }),
      '0000000000000001',
    );
    expect(response).toEqual({
      nodeId: 'participant-1',
      label: 'Participant 1',
      eventOffset: '0000000000000001',
      updateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      recordTime: '2026-07-01T12:00:00.000Z',
      parties: ['Alice'],
      events: [
        {
          eventKind: 'create',
          eventId: '#0:0',
          contractId: '00abc',
          templateId: 'Main:Asset',
          choice: null,
          witnesses: ['Alice'],
          raw: {
            event_id: '#0:0',
            contract_id: '00abc',
            template_id: 'Main:Asset',
            tree_event_witnesses: ['Alice'],
          },
        },
      ],
      meta: {
        update_id: '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
        record_time: 1782907200000000,
        event_offset: '0000000000000001',
      },
    });
  });

  it('returns 404 for a single update detail on an unknown node', async () => {
    await expect(
      (
        controller as unknown as {
          getNodeUpdateDetail: (id: string, updateId: string) => Promise<unknown>;
        }
      ).getNodeUpdateDetail(
        'missing-node',
        '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 404 for an unknown update id on a known node', async () => {
    pqsSummaryService.fetchUpdateDetail.mockRejectedValueOnce(new Error('Update not found'));

    await expect(
      (
        controller as unknown as {
          getNodeUpdateDetail: (id: string, updateId: string) => Promise<unknown>;
        }
      ).getNodeUpdateDetail('participant-1', 'missing-update-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns a single contract detail for a known node', async () => {
    const response = await (
      controller as unknown as {
        getNodeContractDetail: (id: string, contractId: string) => Promise<unknown>;
      }
    ).getNodeContractDetail('participant-1', '00abc');

    expect(pqsSummaryService.fetchContractDetail).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'participant-1',
        label: 'Participant 1',
      }),
      '00abc',
    );
    expect(response).toEqual({
      nodeId: 'participant-1',
      label: 'Participant 1',
      contractId: '00abc',
      templateId: 'Main:Asset',
      packageId: 'main-package',
      packageName: 'main-package-name',
      packageVersion: '1.2.3',
      createdUpdateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      createdEventOffset: '0000000000000001',
      createdRecordTime: '2026-07-01T12:00:00.000Z',
      archivedUpdateId: null,
      archivedEventOffset: null,
      archivedRecordTime: null,
      contractData: null,
    });
  });

  it('returns 404 for a single contract detail on an unknown node', async () => {
    await expect(
      (
        controller as unknown as {
          getNodeContractDetail: (id: string, contractId: string) => Promise<unknown>;
        }
      ).getNodeContractDetail('missing-node', '00abc'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 404 for an unknown contract id on a known node', async () => {
    pqsSummaryService.fetchContractDetail.mockRejectedValueOnce(new Error('Contract not found'));

    await expect(
      (
        controller as unknown as {
          getNodeContractDetail: (id: string, contractId: string) => Promise<unknown>;
        }
      ).getNodeContractDetail('participant-1', 'missing-contract-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
