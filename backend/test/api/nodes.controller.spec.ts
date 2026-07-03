import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NodesController } from '../../src/api/nodes.controller';
import { NodeCacheService } from '../../src/cache/node-cache.service';
import { NodeConfigService } from '../../src/config/node-config.service';
import { GrpcOperationsService } from '../../src/grpc/grpc-operations.service';
import { PqsSummaryService } from '../../src/pqs/pqs-summary.service';
import type {
  PartyDetailResponse,
  NodePackagesResponse,
  PackageDetailResponse,
  PackageFamilyResponse,
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
    { templateId: 'Main.Module:Asset', moduleName: 'Main.Module', entityName: 'Asset' },
  ],
  dataTypes: [
    { typeId: 'Main.Module:AssetData', moduleName: 'Main.Module', entityName: 'AssetData' },
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
    },
    {
      nodeId: 'participant-2',
      label: 'Participant 2',
      mode: 'pqs_with_grpc',
      parties: ['LocalAlice', 'LocalBob'],
    },
  ],
};

describe('NodesController', () => {
  let controller: NodesController;
  let cache: NodeCacheService;
  let pqsSummaryService: {
    fetchRecentUpdates: jest.Mock;
    fetchUpdateDetail: jest.Mock;
    fetchContractDetail: jest.Mock;
    fetchPackageDetail: jest.Mock;
    fetchPackagesByName: jest.Mock;
    fetchNodePackages: jest.Mock;
    fetchActiveParties: jest.Mock;
    fetchPartyDetail: jest.Mock;
  };
  let grpcOperationsService: {
    listLocalParties: jest.Mock;
  };

  beforeEach(async () => {
    pqsSummaryService = {
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
      fetchPackageDetail: jest.fn().mockResolvedValue(typedPackageDetailFixture),
      fetchPackagesByName: jest.fn().mockResolvedValue(typedPackageFamilyFixture),
      fetchNodePackages: jest.fn().mockResolvedValue(typedNodePackagesFixture),
      fetchActiveParties: jest.fn().mockResolvedValue(typedActivePartiesFixture),
      fetchPartyDetail: jest.fn().mockResolvedValue(typedPartyDetailFixture),
    };
    grpcOperationsService = {
      listLocalParties: jest.fn().mockResolvedValue(['LocalAlice', 'LocalBob']),
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
                grpc: { target: 'localhost:5012', useTls: false, connectTimeoutMs: 5000 },
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

  it('returns 404 when node package lookup uses an unknown node id', async () => {
    await expect(controller.listNodePackages('missing-node')).rejects.toBeInstanceOf(
      NotFoundException,
    );
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

  it('returns party detail for a known party id', async () => {
    const response = await controller.getPartyDetail('Alice');

    expect(pqsSummaryService.fetchPartyDetail).toHaveBeenCalledWith(
      expect.any(Array),
      'Alice',
    );
    expect(response).toEqual(typedPartyDetailFixture);
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
            expect.objectContaining({
              timestamp: '2026-06-29T12:00:00.000Z',
              activityValue: 2,
            }),
            expect.objectContaining({
              timestamp: '2026-07-01T11:45:00.000Z',
              activityValue: 0,
            }),
            expect.objectContaining({
              timestamp: '2026-07-01T12:00:00.000Z',
              activityValue: 3,
            }),
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
        mode: undefined,
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
        mode: undefined,
      },
    );
  });

  it('passes through repeated party filters and global mode for updates pagination', async () => {
    await controller.listNodeUpdates(
      'participant-1',
      '25',
      undefined,
      undefined,
      ['Alice', 'Bob'],
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
        mode: 'and',
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
        mode: undefined,
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
