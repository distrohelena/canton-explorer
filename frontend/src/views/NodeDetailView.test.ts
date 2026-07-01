import { render, screen } from '@testing-library/vue';
import { describe, expect, it, vi } from 'vitest';
import NodeDetailView from './NodeDetailView.vue';

vi.mock('../lib/api', () => ({
  fetchNode: vi.fn().mockResolvedValue({
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
  }),
}));

describe('NodeDetailView', () => {
  it('renders source diagnostics for the selected node', async () => {
    render(NodeDetailView, {
      props: { id: 'participant-1' },
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    expect(await screen.findByText('Participant 1')).toBeInTheDocument();
    expect(screen.getByText(/SERVING/)).toBeInTheDocument();
    expect(screen.getByText(/participant1_pqs/)).toBeInTheDocument();
  });
});
