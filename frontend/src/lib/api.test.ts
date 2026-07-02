import * as api from './api';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchActivityHistory, fetchNodeUpdates, fetchNodes } from './api';
import type { NodeContractDetailResponse } from '../types/contracts';
import type { NodeUpdateDetailResponse } from '../types/updates';

const typedUpdateDetailFixture = {
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
      createData: {
        status: 'decoded',
        value: {
          kind: 'record',
          fields: [{ label: 'owner', value: 'Alice' }],
        },
      },
      exerciseData: {
        argument: { status: 'not_available' },
        result: { status: 'not_available' },
      },
      raw: {},
    },
  ],
  meta: {
    update_id: '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
    record_time: 1782907200000000,
    event_offset: '0000000000000001',
  },
} satisfies NodeUpdateDetailResponse;

const typedContractDetailFixture = {
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
  contractData: {
    status: 'decoded',
    value: {
      kind: 'record',
      fields: [{ label: 'owner', value: 'Alice' }],
    },
  },
} satisfies NodeContractDetailResponse;

describe('fetchNodes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps typed update and contract detail fixtures in sync with API response contracts', () => {
    expect(typedUpdateDetailFixture.events[0].createData).toBeDefined();
    expect(typedContractDetailFixture.contractData).toBeDefined();
  });

  it('loads node summaries from the backend API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { id: 'participant-1', label: 'Participant 1', status: 'healthy' },
        ],
      }),
    );

    const nodes = await fetchNodes();

    expect(nodes[0].id).toBe('participant-1');
  });

  it('loads activity history from the backend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          generatedAt: '2026-07-01T12:00:00.000Z',
          windowMinutes: 180,
          nodes: [
            {
              nodeId: 'participant-1',
              label: 'Participant 1',
              status: 'healthy',
              latestActiveContractCount: 15,
              samples: [
                {
                  timestamp: '2026-07-01T12:00:00.000Z',
                  activityValue: 3,
                  activeContractCount: 15,
                  latestOffset: '11',
                },
              ],
            },
          ],
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const history = await fetchActivityHistory(7);

    expect(history.nodes[0].nodeId).toBe('participant-1');
    expect(history.nodes[0].samples[0].activityValue).toBe(3);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3100/api/nodes/activity-history?days=7');
  });

  it('loads recent updates for a node from the backend API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
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
      }),
    );

    const updates = await fetchNodeUpdates('participant-1');

    expect(updates.nodeId).toBe('participant-1');
    expect(updates.limit).toBe(25);
    expect(updates.updates[0].eventOffset).toBe('000000000000000001');
    expect(updates.updates[0].updateId).toBe('00000000000000000000000000000001');
  });

  it('loads a single update detail for a node from the backend API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
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
              },
            },
          ],
          meta: {
            update_id: '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
            record_time: 1782907200000000,
            event_offset: '0000000000000001',
          },
        }),
      }),
    );

    const fetchNodeUpdateDetail = (
      api as {
        fetchNodeUpdateDetail?: (id: string, updateId: string) => Promise<unknown>;
      }
    ).fetchNodeUpdateDetail;

    expect(fetchNodeUpdateDetail).toBeTypeOf('function');

    const updateDetail = await fetchNodeUpdateDetail?.(
      'participant-1',
      '0000000000000001',
    );

    expect(updateDetail).toEqual(
      expect.objectContaining({
        nodeId: 'participant-1',
        eventOffset: '0000000000000001',
        updateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
        events: [
          expect.objectContaining({
            eventKind: 'create',
            raw: expect.objectContaining({
              event_id: '#0:0',
            }),
          }),
        ],
      }),
    );
  });

  it('loads a single contract detail for a node from the backend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
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
    });
    vi.stubGlobal('fetch', fetchMock);

    const fetchNodeContractDetail = (
      api as {
        fetchNodeContractDetail?: (id: string, contractId: string) => Promise<unknown>;
      }
    ).fetchNodeContractDetail;

    expect(fetchNodeContractDetail).toBeTypeOf('function');

    const contractDetail = await fetchNodeContractDetail?.('participant-1', '00abc');

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3100/api/nodes/participant-1/contracts/00abc');
    expect(contractDetail).toEqual(
      expect.objectContaining({
        nodeId: 'participant-1',
        contractId: '00abc',
        templateId: 'Main:Asset',
      }),
    );
  });
});
