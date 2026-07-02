import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NodesController } from '../../src/api/nodes.controller';
import { NodeCacheService } from '../../src/cache/node-cache.service';
import { NodeConfigService } from '../../src/config/node-config.service';
import { PqsSummaryService } from '../../src/pqs/pqs-summary.service';

describe('NodesController', () => {
  let controller: NodesController;
  let cache: NodeCacheService;
  let pqsSummaryService: {
    fetchRecentUpdates: jest.Mock;
    fetchUpdateDetail: jest.Mock;
    fetchContractDetail: jest.Mock;
  };

  beforeEach(async () => {
    pqsSummaryService = {
      fetchRecentUpdates: jest.fn().mockResolvedValue({
        nodeId: 'participant-1',
        label: 'Participant 1',
        limit: 25,
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
                ledgerLabel: 'Retail Ledger',
                pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
              },
            ],
          },
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
      25,
    );
    expect(response).toEqual({
      nodeId: 'participant-1',
      label: 'Participant 1',
      limit: 25,
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
