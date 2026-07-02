import { describe, expect, it, jest } from '@jest/globals';
import { PqsSummaryService } from '../../src/pqs/pqs-summary.service';

describe('PqsSummaryService', () => {
  it('returns a normalized ledger summary from the active() query', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          pqs_database: 'participant1_pqs',
          active_contract_count: '12',
          latest_offset: '000000000000123456',
          latest_event_at: '2026-07-01T12:00:00.000Z',
        },
      ],
    });

    const service = new PqsSummaryService({
      getClient: () => ({ query }),
    } as never);

    const summary = await service.fetchSummary({
      id: 'participant-1',
      label: 'Participant 1',
      role: 'participant',
      ledgerLabel: 'Retail Ledger',
      pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
    });

    expect(query).toHaveBeenCalledWith(expect.stringContaining('from active()'));
    expect(summary.activeContractCount).toBe(12);
    expect(summary.ledgerLabel).toBe('Retail Ledger');
  });

  it('falls back to participant tables when active() is unavailable', async () => {
    const query = jest
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('function active() does not exist'), { code: '42883' }),
      )
      .mockResolvedValueOnce({
        rows: [
          {
            pqs_database: 'participant-app-user',
            active_contract_count: '11',
            latest_offset: '42',
            latest_event_at: '2026-07-01T22:51:02.433Z',
          },
        ],
      });

    const service = new PqsSummaryService({
      getClient: () => ({ query }),
    } as never);

    const summary = await service.fetchSummary({
      id: 'participant-2',
      label: 'Participant 2',
      role: 'participant',
      ledgerLabel: 'Quickstart App User',
      pqs: { connectionUriEnv: 'PARTICIPANT_2_PQS_URL' },
    });

    expect(query).toHaveBeenNthCalledWith(1, expect.stringContaining('from active()'));
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('participant.par_active_contracts'),
    );
    expect(summary).toEqual({
      ledgerLabel: 'Quickstart App User',
      pqsDatabase: 'participant-app-user',
      activeContractCount: 11,
      latestOffset: '42',
      latestEventAt: '2026-07-01T22:51:02.433Z',
    });
  });

  it('returns normalized recent updates with default limit and best-effort parties', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            update_id: '\\x00000000000000000000000000000001',
            record_time: '2026-07-01T12:00:00.000Z',
          },
          {
            update_id: '\\x00000000000000000000000000000000',
            record_time: '2026-07-01T11:59:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            update_id: '\\x00000000000000000000000000000001',
            parties: ['Alice', 'Bob'],
          },
        ],
      });

    const service = new PqsSummaryService({
      getClient: () => ({ query }),
    } as never);

    const updates = await service.fetchRecentUpdates({
      id: 'participant-1',
      label: 'Participant 1',
      role: 'participant',
      ledgerLabel: 'Retail Ledger',
      pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
    });

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('from participant.lapi_update_meta'),
    );
    expect(query).toHaveBeenNthCalledWith(1, expect.stringContaining('limit 25'));
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('participant.lapi_events_create'),
    );
    expect(updates).toEqual({
      nodeId: 'participant-1',
      label: 'Participant 1',
      limit: 25,
      updates: [
        {
          updateId: '00000000000000000000000000000001',
          recordTime: '2026-07-01T12:00:00.000Z',
          parties: ['Alice', 'Bob'],
        },
        {
          updateId: '00000000000000000000000000000000',
          recordTime: '2026-07-01T11:59:00.000Z',
          parties: [],
        },
      ],
    });
  });

  it('returns a single update detail for canonical, raw, and display-normalized ids', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            update_id:
              '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
            record_time: '2026-07-01T12:00:00.000Z',
            event_offset: '0000000000000001',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            update_id:
              '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
            parties: ['Alice', 'Bob'],
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            update_id:
              '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
            record_time: '2026-07-01T12:00:00.000Z',
            event_offset: '0000000000000001',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            update_id:
              '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
            parties: ['Alice', 'Bob'],
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            update_id:
              '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
            record_time: '2026-07-01T12:00:00.000Z',
            event_offset: '0000000000000001',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            update_id:
              '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
            parties: ['Alice', 'Bob'],
          },
        ],
      });

    const service = new PqsSummaryService({
      getClient: () => ({ query }),
    } as never);
    const fetchUpdateDetail = (
      service as unknown as {
        fetchUpdateDetail?: (node: object, updateId: string) => Promise<unknown>;
      }
    ).fetchUpdateDetail;

    expect(fetchUpdateDetail).toBeDefined();

    const node = {
      id: 'participant-1',
      label: 'Participant 1',
      role: 'participant' as const,
      ledgerLabel: 'Retail Ledger',
      pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
    };

    await expect(
      fetchUpdateDetail?.(
        node,
        '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      ),
    ).resolves.toEqual({
      nodeId: 'participant-1',
      label: 'Participant 1',
      updateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      recordTime: '2026-07-01T12:00:00.000Z',
      parties: ['Alice', 'Bob'],
      meta: {
        update_id: '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
        record_time: '2026-07-01T12:00:00.000Z',
        event_offset: '0000000000000001',
      },
    });

    await expect(
      fetchUpdateDetail?.(
        node,
        '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        updateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      }),
    );

    await expect(
      fetchUpdateDetail?.(
        node,
        '994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        updateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      }),
    );
  });

  it('rejects when a single update detail is missing', async () => {
    const service = new PqsSummaryService({
      getClient: () => ({ query: jest.fn() }),
    } as never);
    const fetchUpdateDetail = (
      service as unknown as {
        fetchUpdateDetail?: (node: object, updateId: string) => Promise<unknown>;
      }
    ).fetchUpdateDetail;

    expect(fetchUpdateDetail).toBeDefined();

    await expect(
      fetchUpdateDetail?.(
        {
          id: 'participant-1',
          label: 'Participant 1',
          role: 'participant',
          ledgerLabel: 'Retail Ledger',
          pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
        },
        'missing-update-id',
      ),
    ).rejects.toThrow('Update not found');
  });
});
