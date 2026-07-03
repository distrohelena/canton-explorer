import { render, screen } from '@testing-library/vue';
import { ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import NodesView from './NodesView.vue';

vi.mock('../composables/useNodes', () => ({
  useNodes: () => ({
    nodes: ref([
      {
        id: 'participant-1',
        label: 'Participant 1',
        role: 'participant',
        mode: 'pqs_with_grpc',
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
          latestOffset: '1',
          latestEventAt: '2026-07-01T11:59:00.000Z',
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
      },
    ]),
    loading: ref(false),
    error: ref(null),
    refresh: vi.fn(),
  }),
}));

describe('NodesView', () => {
  it('renders the connected nodes overview on the nodes route', () => {
    render(NodesView, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    expect(screen.getByRole('heading', { name: 'Connected Nodes' })).toBeInTheDocument();
    expect(screen.getByText('Participant 1')).toBeInTheDocument();
    expect(screen.getByText(/PQS \+ gRPC/)).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText('Search'),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Network Activity' })).not.toBeInTheDocument();
  });
});
