import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ContractsView from './ContractsView.vue';
import { fetchNodeContracts, fetchNodeTemplates, fetchNodes } from '../lib/api';

vi.mock('../lib/api', () => ({
  fetchNodes: vi.fn(),
  fetchNodeContracts: vi.fn(),
  fetchNodeTemplates: vi.fn(),
}));

async function renderAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/contracts', component: ContractsView }],
  });

  router.push(path);
  await router.isReady();

  const rendered = render(
    {
      template: '<RouterView />',
    },
    {
      global: {
        plugins: [router],
      },
    },
  );

  return { ...rendered, router };
}

describe('ContractsView', () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  it('shows a loading state before contracts resolve', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([
      {
        id: 'participant-1',
        label: 'Participant 1',
        role: 'participant',
        mode: 'pqs_only',
        ledgerLabel: 'Retail Ledger',
        status: 'healthy',
        latencyMs: 1,
        lastSuccessAt: null,
        lastErrorAt: null,
        errorSummary: null,
        serviceInfo: {
          target: null,
          reachable: false,
          healthCheckImplemented: false,
          servingStatus: null,
        },
        ledgerSummary: {
          ledgerLabel: 'Retail Ledger',
          pqsDatabase: 'participant_1',
          activeContractCount: 1,
          latestOffset: null,
          latestEventAt: null,
        },
        sourceStatus: {
          pqs: { ok: true, checkedAt: '', latencyMs: 1, message: null },
          grpc: { ok: false, checkedAt: '', latencyMs: null, message: null },
        },
      },
    ]);
    vi.mocked(fetchNodeContracts).mockReturnValue(new Promise(() => undefined));

    await renderAt('/contracts');

    expect(screen.getByText('Loading contracts...')).toBeInTheDocument();
  });

  it('renders a reusable contracts browser with advanced filters and preserves filters across node changes', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([
      {
        id: 'participant-1',
        label: 'Participant 1',
        role: 'participant',
        mode: 'pqs_only',
        ledgerLabel: 'Retail Ledger',
        status: 'healthy',
        latencyMs: 1,
        lastSuccessAt: null,
        lastErrorAt: null,
        errorSummary: null,
        serviceInfo: {
          target: null,
          reachable: false,
          healthCheckImplemented: false,
          servingStatus: null,
        },
        ledgerSummary: {
          ledgerLabel: 'Retail Ledger',
          pqsDatabase: 'participant_1',
          activeContractCount: 1,
          latestOffset: null,
          latestEventAt: null,
        },
        sourceStatus: {
          pqs: { ok: true, checkedAt: '', latencyMs: 1, message: null },
          grpc: { ok: false, checkedAt: '', latencyMs: null, message: null },
        },
      },
      {
        id: 'participant-2',
        label: 'Participant 2',
        role: 'participant',
        mode: 'pqs_with_grpc',
        ledgerLabel: 'Retail Ledger 2',
        status: 'healthy',
        latencyMs: 1,
        lastSuccessAt: null,
        lastErrorAt: null,
        errorSummary: null,
        serviceInfo: {
          target: 'localhost:5012',
          reachable: true,
          healthCheckImplemented: true,
          servingStatus: 'SERVING',
        },
        ledgerSummary: {
          ledgerLabel: 'Retail Ledger 2',
          pqsDatabase: 'participant_2',
          activeContractCount: 1,
          latestOffset: null,
          latestEventAt: null,
        },
        sourceStatus: {
          pqs: { ok: true, checkedAt: '', latencyMs: 1, message: null },
          grpc: { ok: true, checkedAt: '', latencyMs: 1, message: null },
        },
      },
    ]);
    vi.mocked(fetchNodeTemplates).mockImplementation(async (id: string) => ({
      templates:
        id === 'participant-2'
          ? [{ templateId: 'Main:Wallet' }, { templateId: 'Splice.Amulet:Amulet' }]
          : [{ templateId: 'Main:Asset' }, { templateId: 'Splice.Amulet:Amulet' }],
    }));
    vi.mocked(fetchNodeContracts).mockImplementation(async (id: string, options) => {
      if (
        id === 'participant-2' &&
        options?.before === '199' &&
        options?.parties?.[0] === 'Alice' &&
        options?.templates?.[0] === 'Main:Asset' &&
        options?.partyMode === 'and' &&
        options?.hideSplice
      ) {
        return {
          nodeId: 'participant-2',
          label: 'Participant 2',
          limit: 25,
          nextBefore: null,
          nextAfter: '200',
          contracts: [
            {
              contractId: '00ghi',
              templateId: 'Main:Asset',
              createdRecordTime: '2026-07-01T12:04:00.000Z',
            },
          ],
        };
      }

      if (
        id === 'participant-2' &&
        options?.parties?.[0] === 'Alice' &&
        options?.templates?.[0] === 'Main:Asset' &&
        options?.partyMode === 'and' &&
        options?.hideSplice
      ) {
        return {
          nodeId: 'participant-2',
          label: 'Participant 2',
          limit: 25,
          nextBefore: '199',
          nextAfter: null,
          contracts: [
            {
              contractId: '00def',
              templateId: 'Main:Asset',
              createdRecordTime: '2026-07-01T12:05:00.000Z',
            },
          ],
        };
      }

      if (
        id === 'participant-1' &&
        options?.parties?.[0] === 'Alice' &&
        options?.templates?.[0] === 'Main:Asset' &&
        options?.partyMode === 'and' &&
        options?.hideSplice
      ) {
        return {
          nodeId: 'participant-1',
          label: 'Participant 1',
          limit: 25,
          nextBefore: null,
          nextAfter: null,
          contracts: [
            {
              contractId: '00abc',
              templateId: 'Main:Asset',
              createdRecordTime: '2026-07-01T12:00:00.000Z',
            },
          ],
        };
      }

      return {
        nodeId: id,
        label: id === 'participant-2' ? 'Participant 2' : 'Participant 1',
        limit: 25,
        nextBefore: null,
        nextAfter: null,
        contracts: [
          {
            contractId: id === 'participant-2' ? '00seed-2' : '00seed-1',
            templateId: id === 'participant-2' ? 'Main:Wallet' : 'Main:Asset',
            createdRecordTime: '2026-07-01T12:00:00.000Z',
          },
        ],
      };
    });

    const formatMock = vi
      .fn()
      .mockReturnValue('Jul 1, 2026, 12:00:00 PM');
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      function MockDateTimeFormat() {
        return {
          format: formatMock,
        } as unknown as Intl.DateTimeFormat;
      } as unknown as typeof Intl.DateTimeFormat,
    );

    const { container } = await renderAt('/contracts');

    expect(await screen.findByRole('heading', { name: 'Contracts' })).toBeInTheDocument();
    expect(fetchNodeContracts).toHaveBeenNthCalledWith(1, 'participant-1');
    expect(screen.getByText('PQS')).toHaveAttribute('title', 'Data sourced from PQS');

    await fireEvent.click(screen.getByRole('button', { name: 'Advanced Filter' }));

    expect(await screen.findByText('Advanced Filter Parameters')).toBeInTheDocument();
    expect(screen.getByText('Hide Splice Templates')).toBeInTheDocument();

    await fireEvent.update(screen.getByPlaceholderText('Party ID'), 'Alice');
    await fireEvent.click(screen.getByRole('button', { name: 'Add party filter' }));

    await fireEvent.update(screen.getByRole('combobox', { name: 'Template ID' }), 'Main:Asset');
    await fireEvent.click(screen.getByRole('button', { name: 'Add template filter' }));
    await fireEvent.click(screen.getByRole('button', { name: 'AND' }));
    await fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() =>
      expect(fetchNodeContracts).toHaveBeenLastCalledWith('participant-1', {
        parties: ['Alice'],
        templates: ['Main:Asset'],
        partyMode: 'and',
        hideSplice: true,
      }),
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getAllByText('Main:Asset').length).toBeGreaterThan(0);
    expect(container.querySelector('a[href="/nodes/participant-1/contracts/00abc"]')).not.toBeNull();

    await fireEvent.click(screen.getByRole('button', { name: 'Participant 2' }));

    await waitFor(() =>
      expect(fetchNodeContracts).toHaveBeenLastCalledWith('participant-2', {
        parties: ['Alice'],
        templates: ['Main:Asset'],
        partyMode: 'and',
        hideSplice: true,
      }),
    );

    expect(await screen.findByRole('link', { name: '00def' })).toHaveAttribute(
      'href',
      '/nodes/participant-2/contracts/00def',
    );
    expect(screen.getByRole('button', { name: 'Older' })).not.toBeDisabled();

    await fireEvent.click(screen.getByRole('button', { name: 'Older' }));

    await waitFor(() =>
      expect(fetchNodeContracts).toHaveBeenLastCalledWith('participant-2', {
        before: '199',
        parties: ['Alice'],
        templates: ['Main:Asset'],
        partyMode: 'and',
        hideSplice: true,
      }),
    );

    expect(await screen.findByRole('link', { name: '00ghi' })).toHaveAttribute(
      'href',
      '/nodes/participant-2/contracts/00ghi',
    );
  });

  it('auto-opens the advanced filter when contracts filters exist in the URL', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([
      {
        id: 'participant-1',
        label: 'Participant 1',
        role: 'participant',
        mode: 'pqs_only',
        ledgerLabel: 'Retail Ledger',
        status: 'healthy',
        latencyMs: 1,
        lastSuccessAt: null,
        lastErrorAt: null,
        errorSummary: null,
        serviceInfo: {
          target: null,
          reachable: false,
          healthCheckImplemented: false,
          servingStatus: null,
        },
        ledgerSummary: {
          ledgerLabel: 'Retail Ledger',
          pqsDatabase: 'participant_1',
          activeContractCount: 1,
          latestOffset: null,
          latestEventAt: null,
        },
        sourceStatus: {
          pqs: { ok: true, checkedAt: '', latencyMs: 1, message: null },
          grpc: { ok: false, checkedAt: '', latencyMs: null, message: null },
        },
      },
    ]);
    vi.mocked(fetchNodeTemplates).mockResolvedValue({
      templates: [{ templateId: 'Main:Asset' }],
    });
    vi.mocked(fetchNodeContracts).mockResolvedValue({
      nodeId: 'participant-1',
      label: 'Participant 1',
      limit: 25,
      nextBefore: null,
      nextAfter: null,
      contracts: [
        {
          contractId: '00abc',
          templateId: 'Main:Asset',
          createdRecordTime: '2026-07-01T12:00:00.000Z',
        },
      ],
    });

    await renderAt('/contracts?party=Alice&hideSplice=true');

    expect(await screen.findByText('Advanced Filter Parameters')).toBeInTheDocument();
    expect(fetchNodeContracts).toHaveBeenCalledWith('participant-1', {
      parties: ['Alice'],
      partyMode: 'or',
      hideSplice: true,
    });
  });
});
