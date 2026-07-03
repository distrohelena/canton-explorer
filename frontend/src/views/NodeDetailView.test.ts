import { render, screen } from '@testing-library/vue';
import { describe, expect, it, vi } from 'vitest';
import NodeDetailView from './NodeDetailView.vue';

vi.mock('../lib/api', () => ({
  fetchNode: vi.fn().mockResolvedValue({
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
  fetchNodePackages: vi.fn().mockResolvedValue({
    nodeId: 'participant-1',
    label: 'Participant 1',
    packagesByName: [
      {
        packageName: 'main-package-name',
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
      {
        packageName: 'daml-prim',
        packages: [
          {
            packageId: 'daml-prim-package',
            version: '0.0.0',
            uploadedAt: '2026-07-02T12:00:00.000Z',
            seenAt: '2026-07-02T12:05:00.000Z',
          },
        ],
      },
    ],
  }),
}));

describe('NodeDetailView', () => {
  it('renders the selected node in grouped operational sections', async () => {
    render(NodeDetailView, {
      props: { id: 'participant-1' },
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to" v-bind="$attrs"><slot /></a>',
          },
        },
      },
    });

    expect(await screen.findByText('Participant 1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to overview' })).toHaveTextContent('←');
    expect(screen.queryByText('Back to overview')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Service Health' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ledger Snapshot' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Installed Packages' })).toBeInTheDocument();
    expect(screen.getByText('PQS Only')).toBeInTheDocument();
    expect(screen.getAllByText(/Not configured/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/participant1_pqs/)).toBeInTheDocument();
    expect(screen.getByText('main-package-name')).toBeInTheDocument();
    expect(screen.getByText('daml-prim')).toBeInTheDocument();
    expect(screen.getByText('main-package-v2')).toBeInTheDocument();
    expect(screen.getByText('1.2.4')).toBeInTheDocument();
    expect(screen.getByText('main-package')).toBeInTheDocument();
    expect(screen.getByText('1.2.3')).toBeInTheDocument();
    expect(screen.getByText('daml-prim-package')).toBeInTheDocument();
    expect(screen.getByText('0.0.0')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'main-package-v2' })).toHaveAttribute(
      'href',
      '/packages/main-package-v2',
    );
  });
});
