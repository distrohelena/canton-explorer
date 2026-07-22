import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchNodeTrafficPurchases, fetchNodes } from '../lib/api';
import type { NodeSnapshot, NodeTrafficPurchasesResponse } from '../types/nodes';
import SettingsView from './SettingsView.vue';

vi.mock('../lib/api', () => ({
  fetchNodeTrafficPurchases: vi.fn(),
  fetchNodes: vi.fn(),
}));

const healthyNode: NodeSnapshot = {
  id: 'participant-1',
  label: 'Participant 1',
  role: 'participant',
  mode: 'pqs_with_grpc',
  ledgerLabel: 'Retail Ledger',
  status: 'healthy',
  latencyMs: 21,
  lastSuccessAt: '2026-07-21T12:00:00.000Z',
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
    latestOffset: '42',
    latestEventAt: '2026-07-21T11:59:00.000Z',
    totalUpdateCount: 128,
  },
  sourceStatus: {
    pqs: {
      ok: true,
      checkedAt: '2026-07-21T12:00:00.000Z',
      latencyMs: 11,
      message: null,
    },
    grpc: {
      ok: true,
      checkedAt: '2026-07-21T12:00:00.000Z',
      latencyMs: 10,
      message: null,
    },
  },
};

const healthyTraffic: NodeTrafficPurchasesResponse = {
  nodeId: 'participant-1',
  label: 'Participant 1',
  mode: 'pqs_with_grpc',
  current: {
    status: 'ok',
    states: [
      {
        synchronizerId: 'global-sync',
        extraTrafficPurchased: '1000000',
        extraTrafficConsumed: '250000',
        baseTrafficRemainder: '50000',
        lastConsumedCost: '1200',
        timestamp: '1782648000000000',
        serial: 7,
      },
    ],
    error: null,
  },
  history: {
    status: 'ok',
    limit: 25,
    nextBefore: null,
    nextAfter: null,
    purchases: [
      {
        updateId: 'update-traffic-1',
        eventOffset: '42',
        recordTime: '2026-07-21T12:00:00.000Z',
        purchasedTraffic: '1000000',
        amuletPaid: '12.5000000000',
      },
    ],
    error: null,
  },
};

function renderSettings() {
  return render(SettingsView, {
    global: {
      stubs: {
        RouterLink: {
          props: ['to'],
          template: '<a :href="to"><slot /></a>',
        },
      },
    },
  });
}

describe('SettingsView', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('renders read-only indexing details for a healthy node', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([healthyNode]);
    vi.mocked(fetchNodeTrafficPurchases).mockResolvedValue(healthyTraffic);

    renderSettings();

    expect(screen.getByText('Loading indexing status…')).toBeInTheDocument();
    await screen.findByText('Participant 1');
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(
      screen.queryByText('Read-only view. Explorer configuration is managed by the server.'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Indexing status' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Participant 1' })).toHaveAttribute('href', '/nodes/participant-1');
    expect(screen.getByText('Healthy')).toBeInTheDocument();
    expect(screen.getByText('PQS available')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('128')).toBeInTheDocument();
    expect(screen.getByText('gRPC available')).toBeInTheDocument();
    expect(screen.getByText('Traffic balance')).toBeInTheDocument();
    expect(screen.getByText('1,000,000 bytes')).toBeInTheDocument();
    expect(screen.getByText(/12\.5000000000 CC for 1,000,000 bytes/)).toBeInTheDocument();
  });

  it('shows the latest indexed event time and source check time', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([healthyNode]);

    renderSettings();

    await screen.findByText('Participant 1');

    expect(screen.getByText('July 21, 2026 at 11:59 AM')).toBeInTheDocument();
    expect(screen.getAllByText('July 21, 2026 at 12:00 PM')).toHaveLength(2);
  });

  it('does not show a gRPC failure for a PQS-only node', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([{
      ...healthyNode,
      id: 'participant-2',
      label: 'Participant 2',
      mode: 'pqs_only',
      serviceInfo: {
        target: null,
        reachable: false,
        healthCheckImplemented: false,
        servingStatus: null,
      },
      sourceStatus: {
        ...healthyNode.sourceStatus,
        grpc: {
          ok: true,
          checkedAt: '2026-07-21T12:00:00.000Z',
          latencyMs: null,
          message: 'Not configured',
        },
      },
    }]);

    renderSettings();

    await screen.findByText('Participant 2');

    expect(screen.queryByText(/gRPC unavailable/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/gRPC error/i)).not.toBeInTheDocument();
  });

  it('preserves indexing details and shows source errors for a degraded node', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([{
      ...healthyNode,
      status: 'degraded',
      sourceStatus: {
        pqs: {
          ok: false,
          checkedAt: '2026-07-21T12:01:00.000Z',
          latencyMs: 1000,
          message: 'PQS connection refused',
        },
        grpc: {
          ok: false,
          checkedAt: '2026-07-21T12:01:00.000Z',
          latencyMs: 1000,
          message: 'gRPC unavailable',
        },
      },
    }]);

    renderSettings();

    await screen.findByText('Participant 1');

    expect(screen.getByText('Degraded')).toBeInTheDocument();
    expect(screen.getByText('PQS connection refused')).toBeInTheDocument();
    expect(screen.getAllByText('gRPC unavailable')).toHaveLength(2);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders empty and error states with retry', async () => {
    vi.mocked(fetchNodes)
      .mockRejectedValueOnce(new Error('nodes unavailable'))
      .mockResolvedValueOnce([]);

    renderSettings();

    expect(await screen.findByText('Unable to load indexing status.')).toBeInTheDocument();
    expect(screen.getByText('nodes unavailable')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.getByText('No nodes are configured.')).toBeInTheDocument());
    expect(screen.getByText('Explorer configuration is managed by the server.')).toBeInTheDocument();
  });

  it('refreshes periodically and clears the refresh timer on unmount', async () => {
    vi.useFakeTimers();
    vi.mocked(fetchNodes).mockResolvedValue([healthyNode]);

    const view = renderSettings();
    expect(fetchNodes).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(15000);
    expect(fetchNodes).toHaveBeenCalledTimes(2);

    view.unmount();
    await vi.advanceTimersByTimeAsync(15000);
    expect(fetchNodes).toHaveBeenCalledTimes(2);
  });
});
