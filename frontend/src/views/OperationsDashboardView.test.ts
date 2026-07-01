import { render, screen } from '@testing-library/vue';
import { ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import OperationsDashboardView from './OperationsDashboardView.vue';

vi.mock('../composables/useNodes', () => ({
  useNodes: () => ({
    nodes: ref([
      {
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

describe('OperationsDashboardView', () => {
  it('renders the node card and summary metrics', () => {
    render(OperationsDashboardView, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    expect(screen.getByText('Participant 1')).toBeInTheDocument();
    expect(screen.getByText('Retail Ledger')).toBeInTheDocument();
    expect(screen.getByText(/12 active contracts/i)).toBeInTheDocument();
  });
});
