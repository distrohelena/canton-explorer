import * as api from './api';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchActivityHistory, fetchNodeUpdates, fetchNodes } from './api';

describe('fetchNodes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
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
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
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
      }),
    );

    const history = await fetchActivityHistory();

    expect(history.nodes[0].nodeId).toBe('participant-1');
    expect(history.nodes[0].samples[0].activityValue).toBe(3);
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
          updateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
          recordTime: '2026-07-01T12:00:00.000Z',
          parties: ['Alice'],
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
      '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
    );

    expect(updateDetail).toEqual(
      expect.objectContaining({
        nodeId: 'participant-1',
        updateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      }),
    );
  });
});
