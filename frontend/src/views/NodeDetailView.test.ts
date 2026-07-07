import { render, screen } from '@testing-library/vue';
import { describe, expect, it, vi } from 'vitest';
import NodeDetailView from './NodeDetailView.vue';
import { fetchNode, fetchNodePackages, fetchNodeParticipantStatus } from '../lib/api';

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
            uploadedAt: null,
            seenAt: '2026-07-02T13:05:00.000Z',
          },
          {
            packageId: 'main-package',
            version: '1.2.3',
            uploadedAt: null,
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
            uploadedAt: null,
            seenAt: '2026-07-02T12:05:00.000Z',
          },
        ],
      },
    ],
  }),
  fetchNodeParticipantStatus: vi.fn().mockResolvedValue({
    nodeId: 'participant-1',
    label: 'Participant 1',
    mode: 'pqs_only',
    participantStatusStatus: 'grpc_not_configured',
    participantStatus: null,
    notInitialized: null,
    participantStatusError: null,
    participantStatusErrorCode: null,
    participantStatusErrorDetails: null,
    participantStatusErrorTid: null,
  }),
}));

function renderView() {
  return render(NodeDetailView, {
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
}

describe('NodeDetailView', () => {
  it('renders a not-configured participant status state for pqs-only nodes', async () => {
    renderView();

    expect(await screen.findByText('Node Participant 1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Participant Status' })).toBeInTheDocument();
    expect(screen.getAllByText(/Not configured/i).length).toBeGreaterThan(0);
  });

  it('renders the selected node in grouped operational sections', async () => {
    const { container } = renderView();

    expect(await screen.findByText('Node Participant 1')).toBeInTheDocument();
    expect(container.querySelector('.node-detail')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to overview' })).toHaveTextContent('←');
    expect(screen.getByRole('link', { name: 'Back to overview' })).toHaveAttribute(
      'href',
      '/nodes',
    );
    expect(screen.queryByText('Back to overview')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Service Health' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ledger Snapshot' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Service Health' }).closest('section')).toHaveClass(
      'node-detail__section--half',
    );
    expect(screen.getByRole('heading', { name: 'Ledger Snapshot' }).closest('section')).toHaveClass(
      'node-detail__section--half',
    );
    expect(screen.getByRole('heading', { name: 'Participant Status' })).toBeInTheDocument();
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
    expect(screen.queryByText('n/a')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'main-package-v2' })).toHaveAttribute(
      'href',
      '/packages/main-package-v2',
    );
  });

  it('renders participant status data for grpc-enabled nodes', async () => {
    vi.mocked(fetchNode).mockResolvedValueOnce({
      id: 'participant-2',
      label: 'Participant 2',
      role: 'participant',
      mode: 'pqs_with_grpc',
      ledgerLabel: 'Retail Ledger 2',
      status: 'healthy',
      latencyMs: 18,
      lastSuccessAt: '2026-07-01T12:00:00.000Z',
      lastErrorAt: null,
      errorSummary: null,
      serviceInfo: {
        target: 'localhost:5013',
        reachable: true,
        healthCheckImplemented: true,
        servingStatus: 'SERVING',
      },
      ledgerSummary: {
        ledgerLabel: 'Retail Ledger 2',
        pqsDatabase: 'participant2_pqs',
        activeContractCount: 20,
        latestOffset: '2',
        latestEventAt: '2026-07-01T11:59:30.000Z',
      },
      sourceStatus: {
        pqs: {
          ok: true,
          checkedAt: '2026-07-01T12:00:00.000Z',
          latencyMs: 9,
          message: null,
        },
        grpc: {
          ok: true,
          checkedAt: '2026-07-01T12:00:00.000Z',
          latencyMs: 8,
          message: null,
        },
      },
    });
    vi.mocked(fetchNodePackages).mockResolvedValueOnce({
      nodeId: 'participant-2',
      label: 'Participant 2',
      packagesByName: [],
    });
    vi.mocked(fetchNodeParticipantStatus).mockResolvedValueOnce({
      nodeId: 'participant-2',
      label: 'Participant 2',
      mode: 'pqs_with_grpc',
      participantStatusStatus: 'ok',
      participantStatus: {
        uid: 'participant2::1220abc',
        uptime: '3600s',
        ports: {
          admin: 5012,
          ledger: 5011,
        },
        active: true,
        commonStatusActive: true,
        version: '3.4.0',
        supportedProtocolVersions: [30, 31],
        topologyQueues: {
          manager: 1,
          dispatcher: 2,
          clients: 3,
        },
        components: [
          {
            name: 'sync-service',
            severity: 'ok',
            description: 'running',
          },
        ],
        connectedSynchronizers: [
          {
            physicalSynchronizerId: 'physical::1220def',
            health: 'healthy',
          },
        ],
      },
      notInitialized: null,
      participantStatusError: null,
      participantStatusErrorCode: null,
      participantStatusErrorDetails: null,
      participantStatusErrorTid: null,
    });

    render(NodeDetailView, {
      props: { id: 'participant-2' },
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to" v-bind="$attrs"><slot /></a>',
          },
        },
      },
    });

    expect(await screen.findByText('Node Participant 2')).toBeInTheDocument();
    expect(screen.getByText('participant2::1220abc')).toBeInTheDocument();
    expect(screen.getByText('3.4.0')).toBeInTheDocument();
    expect(screen.getByText('physical::1220def')).toBeInTheDocument();
    expect(screen.getByText('sync-service')).toBeInTheDocument();
  });
});
