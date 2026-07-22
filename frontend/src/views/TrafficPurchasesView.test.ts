import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchNodes, fetchTrafficPurchases } from '../lib/api';
import type {
  GlobalTrafficPurchasesResponse,
  NodeSnapshot,
} from '../types/nodes';
import TrafficPurchasesView from './TrafficPurchasesView.vue';

vi.mock('../lib/api', () => ({
  fetchNodes: vi.fn(),
  fetchTrafficPurchases: vi.fn(),
}));

const node: NodeSnapshot = {
  id: 'participant-1',
  label: 'Participant 1',
  role: 'participant',
  mode: 'pqs_with_grpc',
  ledgerLabel: 'Retail Ledger',
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
    ledgerLabel: 'Retail Ledger',
    pqsDatabase: 'participant1_pqs',
    activeContractCount: 0,
    latestOffset: null,
    latestEventAt: null,
    totalUpdateCount: 0,
  },
  sourceStatus: {
    pqs: { ok: true, checkedAt: '', latencyMs: 1, message: null },
    grpc: { ok: true, checkedAt: '', latencyMs: 1, message: null },
  },
};

const secondNode: NodeSnapshot = {
  ...node,
  id: 'participant-2',
  label: 'Participant 2',
};

const traffic: GlobalTrafficPurchasesResponse = {
  limit: 10,
  nextBefore: null,
  nextAfter: null,
  purchases: [
    {
      nodeId: 'participant-2',
      label: 'Participant 2',
      updateId: 'traffic-update-2',
      eventOffset: '43',
      recordTime: '2026-07-21T12:01:00.000Z',
      purchasedTraffic: '2000000',
      amuletPaid: '20.0000000000',
    },
    {
      nodeId: 'participant-1',
      label: 'Participant 1',
      updateId: 'traffic-update-1',
      eventOffset: '42',
      recordTime: '2026-07-21T12:00:00.000Z',
      purchasedTraffic: '1000000',
      amuletPaid: '12.5000000000',
    },
  ],
  current: [
    {
      nodeId: 'participant-1',
      label: 'Participant 1',
      mode: 'pqs_with_grpc',
      status: 'ok',
      states: [{
        synchronizerId: 'global-sync',
        extraTrafficPurchased: '1000000',
        extraTrafficConsumed: '250000',
        baseTrafficRemainder: '50000',
        lastConsumedCost: '1200',
        timestamp: '1782648000000000',
        serial: 7,
      }],
      error: null,
    },
    {
      nodeId: 'participant-2',
      label: 'Participant 2',
      mode: 'pqs_only',
      status: 'grpc_not_configured',
      states: [],
      error: null,
    },
  ],
  historyStatus: [
    { nodeId: 'participant-1', label: 'Participant 1', status: 'ok', error: null },
    { nodeId: 'participant-2', label: 'Participant 2', status: 'ok', error: null },
  ],
};

describe('TrafficPurchasesView', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderView() {
    return render(TrafficPurchasesView, {
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

  it('renders all selected nodes in one combined table by default', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([node, secondNode]);
    vi.mocked(fetchTrafficPurchases).mockResolvedValue(traffic);

    renderView();

    expect(await screen.findByRole('heading', { name: 'Traffic Purchases' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Purchases' })).toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: 'Node selectors' })).not.toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'All node traffic purchases' });
    expect(within(table).getByText('Participant 1')).toBeInTheDocument();
    expect(within(table).getByText('Participant 2')).toBeInTheDocument();
    expect(screen.queryByText(/global-sync/)).not.toBeInTheDocument();
    expect(screen.getAllByText('1,000,000 bytes')).toHaveLength(1);
    expect(screen.getByText('2,000,000 bytes')).toBeInTheDocument();
    expect(screen.getByText(/12\.5000000000 CC/)).toBeInTheDocument();
    expect(screen.queryByText('healthy')).not.toBeInTheDocument();
    expect(fetchTrafficPurchases).toHaveBeenCalledWith({ limit: 10 });
  });

  it('shows all node checkboxes checked inside Advanced Search', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([node, secondNode]);
    vi.mocked(fetchTrafficPurchases).mockResolvedValue(traffic);

    renderView();
    await fireEvent.click(await screen.findByRole('button', { name: 'Advanced Search' }));

    expect(screen.getByRole('checkbox', { name: 'Participant 1' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Participant 2' })).toBeChecked();
  });

  it('sends selected nodes to the backend and renders no rows when all are unchecked', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([node, secondNode]);
    vi.mocked(fetchTrafficPurchases)
      .mockResolvedValueOnce(traffic)
      .mockResolvedValueOnce({ ...traffic, purchases: traffic.purchases.slice(1) })
      .mockResolvedValueOnce({ ...traffic, purchases: [] });

    renderView();
    await fireEvent.click(await screen.findByRole('button', { name: 'Advanced Search' }));

    await fireEvent.click(screen.getByRole('checkbox', { name: 'Participant 1' }));
    await waitFor(() => expect(fetchTrafficPurchases).toHaveBeenLastCalledWith({
      limit: 10,
      nodeIds: ['participant-2'],
    }));

    await fireEvent.click(screen.getByRole('checkbox', { name: 'Participant 2' }));
    await waitFor(() => expect(fetchTrafficPurchases).toHaveBeenLastCalledWith({
      limit: 10,
      nodeIds: [],
    }));
    expect(screen.getByText('No traffic purchases recorded.')).toBeInTheDocument();
  });

  it('preserves selected nodes while applying filters and pagination', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([node, secondNode]);
    vi.mocked(fetchTrafficPurchases)
      .mockResolvedValueOnce(traffic)
      .mockResolvedValue(traffic);

    renderView();
    await fireEvent.click(await screen.findByRole('button', { name: 'Advanced Search' }));
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Participant 1' }));
    await waitFor(() => expect(fetchTrafficPurchases).toHaveBeenLastCalledWith({
      limit: 10,
      nodeIds: ['participant-2'],
    }));

    await fireEvent.update(screen.getByLabelText('Minimum date'), '2026-07-01');
    await fireEvent.update(screen.getByLabelText('Maximum paid amount'), '20');
    await fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

    await waitFor(() => expect(fetchTrafficPurchases).toHaveBeenLastCalledWith({
      limit: 10,
      nodeIds: ['participant-2'],
      minDate: '2026-07-01',
      paidMax: '20',
    }));

    await fireEvent.change(screen.getByRole('combobox', { name: 'Traffic Purchases per page' }), {
      target: { value: '50' },
    });
    await waitFor(() => expect(fetchTrafficPurchases).toHaveBeenLastCalledWith({
      limit: 50,
      nodeIds: ['participant-2'],
      minDate: '2026-07-01',
      paidMax: '20',
    }));
  });

  it('keeps raw gRPC error details out of the page', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([node]);
    vi.mocked(fetchTrafficPurchases).mockResolvedValue({
      ...traffic,
      purchases: [],
      current: [{
        ...traffic.current[0]!,
        status: 'grpc_error',
        states: [],
        error: 'PROTO_DESERIALIZATION_FAILURE(8,0): Deserialization of protobuf message failed',
      }],
    });

    renderView();

    expect(await screen.findByText('No traffic purchases recorded.')).toBeInTheDocument();
    expect(screen.queryByText(/PROTO_DESERIALIZATION_FAILURE/)).not.toBeInTheDocument();
    expect(screen.queryByText('PQS: available')).not.toBeInTheDocument();
    expect(screen.queryByText('gRPC: unavailable')).not.toBeInTheDocument();
  });
});
