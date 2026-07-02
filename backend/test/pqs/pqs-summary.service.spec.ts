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
    const serviceWithDetail = service as unknown as {
      fetchUpdateDetail?: (node: object, updateId: string) => Promise<unknown>;
    };

    expect(serviceWithDetail.fetchUpdateDetail).toBeDefined();

    const node = {
      id: 'participant-1',
      label: 'Participant 1',
      role: 'participant' as const,
      ledgerLabel: 'Retail Ledger',
      pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
    };

    await expect(
      serviceWithDetail.fetchUpdateDetail?.call(
        service,
        node,
        '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      ),
    ).resolves.toEqual({
      nodeId: 'participant-1',
      label: 'Participant 1',
      updateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      recordTime: '2026-07-01T12:00:00.000Z',
      parties: ['Alice', 'Bob'],
      events: [],
      meta: {
        update_id: '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
        record_time: '2026-07-01T12:00:00.000Z',
        event_offset: '0000000000000001',
      },
    });

    await expect(
      serviceWithDetail.fetchUpdateDetail?.call(
        service,
        node,
        '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        updateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      }),
    );

    await expect(
      serviceWithDetail.fetchUpdateDetail?.call(
        service,
        node,
        '994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        updateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      }),
    );

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('from participant.lapi_update_meta'),
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('participant.lapi_events_create'),
    );
  });

  it('rejects when a single update detail is missing', async () => {
    const service = new PqsSummaryService({
      getClient: () =>
        ({
          query: jest.fn().mockResolvedValue({
            rows: [],
          }),
        }) as never,
    } as never);
    const serviceWithDetail = service as unknown as {
      fetchUpdateDetail?: (node: object, updateId: string) => Promise<unknown>;
    };

    expect(serviceWithDetail.fetchUpdateDetail).toBeDefined();

    await expect(
      serviceWithDetail.fetchUpdateDetail?.call(
        service,
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

  it('returns a single update detail with empty parties when witness lookup fails', async () => {
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
      .mockRejectedValueOnce(new Error('events lookup failed'));

    const service = new PqsSummaryService({
      getClient: () => ({ query }),
    } as never);
    const serviceWithDetail = service as unknown as {
      fetchUpdateDetail?: (node: object, updateId: string) => Promise<unknown>;
    };

    expect(serviceWithDetail.fetchUpdateDetail).toBeDefined();

    await expect(
      serviceWithDetail.fetchUpdateDetail?.call(
        service,
        {
          id: 'participant-1',
          label: 'Participant 1',
          role: 'participant',
          ledgerLabel: 'Retail Ledger',
          pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
        },
        '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        parties: [],
        events: [],
      }),
    );
  });

  it('returns mixed normalized event rows on a single update detail', async () => {
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
            event_kind: 'create',
            event_id: '#0:0',
            contract_id: '00abc',
            template_id: 'Main:Asset',
            choice: null,
            witnesses: ['Alice', 'Bob'],
            raw: {
              update_id:
                '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
              event_id: '#0:0',
              contract_id: '00abc',
              template_id: 'Main:Asset',
              tree_event_witnesses: ['Alice', 'Bob'],
            },
          },
          {
            event_kind: 'consuming_exercise',
            event_id: '#0:1',
            contract_id: '00abc',
            template_id: 'Main:Asset',
            choice: 'Archive',
            witnesses: ['Alice'],
            raw: {
              update_id:
                '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
              event_id: '#0:1',
              contract_id: '00abc',
              template_id: 'Main:Asset',
              choice: 'Archive',
              tree_event_witnesses: ['Alice'],
            },
          },
        ],
      });

    const service = new PqsSummaryService({
      getClient: () => ({ query }),
    } as never);

    await expect(
      service.fetchUpdateDetail(
        {
          id: 'participant-1',
          label: 'Participant 1',
          role: 'participant',
          ledgerLabel: 'Retail Ledger',
          pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
        },
        '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        events: [
          {
            eventKind: 'create',
            eventId: '#0:0',
            contractId: '00abc',
            templateId: 'Main:Asset',
            choice: null,
            witnesses: ['Alice', 'Bob'],
            raw: {
              update_id:
                '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
              event_id: '#0:0',
              contract_id: '00abc',
              template_id: 'Main:Asset',
              tree_event_witnesses: ['Alice', 'Bob'],
            },
          },
          {
            eventKind: 'consuming_exercise',
            eventId: '#0:1',
            contractId: '00abc',
            templateId: 'Main:Asset',
            choice: 'Archive',
            witnesses: ['Alice'],
            raw: {
              update_id:
                '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
              event_id: '#0:1',
              contract_id: '00abc',
              template_id: 'Main:Asset',
              choice: 'Archive',
              tree_event_witnesses: ['Alice'],
            },
          },
        ],
      }),
    );
  });

  it('preserves raw event rows when a normalized field cannot be derived', async () => {
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
            parties: ['Alice'],
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            event_kind: 'create',
            event_id: '#0:0',
            contract_id: '00abc',
            template_id: null,
            choice: null,
            witnesses: ['Alice'],
            raw: {
              update_id:
                '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
              event_id: '#0:0',
              contract_id: '00abc',
              tree_event_witnesses: ['Alice'],
            },
          },
        ],
      });

    const service = new PqsSummaryService({
      getClient: () => ({ query }),
    } as never);

    await expect(
      service.fetchUpdateDetail(
        {
          id: 'participant-1',
          label: 'Participant 1',
          role: 'participant',
          ledgerLabel: 'Retail Ledger',
          pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
        },
        '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        events: [
          expect.objectContaining({
            eventKind: 'create',
            templateId: null,
            raw: {
              update_id:
                '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
              event_id: '#0:0',
              contract_id: '00abc',
              tree_event_witnesses: ['Alice'],
            },
          }),
        ],
      }),
    );
  });
});
