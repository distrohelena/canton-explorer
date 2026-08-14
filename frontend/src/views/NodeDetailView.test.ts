import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NodeDetailView from './NodeDetailView.vue';
import { fetchNode, fetchNodePackages, fetchNodeParticipantStatus } from '../lib/api';
import type { NodeSnapshot } from '../types/nodes';

const routeQuery = vi.hoisted(() => ({
  from: undefined as string | undefined,
}));

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
      ledgerApiVersion: '3.2.0',
    },
    ledgerSummary: {
      ledgerLabel: 'Retail Ledger',
      pqsDatabase: 'participant1_pqs',
      activeContractCount: 12,
      latestOffset: '1',
      latestEventAt: '2026-07-01T11:59:00.000Z',
      totalUpdateCount: 0,
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

vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRoute: () => ({ query: routeQuery }),
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

function nodeFixture(id: string, label: string): NodeSnapshot {
  return {
    id,
    label,
    role: 'participant',
    mode: 'pqs_only',
    ledgerLabel: `${label} Ledger`,
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
      ledgerApiVersion: '3.2.0',
    },
    ledgerSummary: {
      ledgerLabel: `${label} Ledger`,
      pqsDatabase: `${id.replace('-', '')}_pqs`,
      activeContractCount: 12,
      latestOffset: '1',
      latestEventAt: '2026-07-01T11:59:00.000Z',
      totalUpdateCount: 0,
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
  };
}

async function renderAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/nodes/:id', component: NodeDetailView, props: true }],
  });
  router.push(path);
  await router.isReady();
  const rendered = render({ template: '<RouterView />' }, {
    global: {
      plugins: [router],
      stubs: {
        RouterLink: {
          props: ['to'],
          template: '<a :href="typeof to === \'string\' ? to : String(to)" v-bind="$attrs"><slot /></a>',
        },
      },
    },
  });

  return { ...rendered, router };
}

function resolveDefaultResponses() {
  vi.mocked(fetchNode).mockResolvedValue(nodeFixture('participant-1', 'Participant 1'));
  vi.mocked(fetchNodePackages).mockResolvedValue({
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
  });
  vi.mocked(fetchNodeParticipantStatus).mockResolvedValue({
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
  });
}

describe('NodeDetailView', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resolveDefaultResponses();
  });

  afterEach(() => {
    cleanup();
    routeQuery.from = undefined;
  });

  it('renders a not-configured participant status state for pqs-only nodes', async () => {
    renderView();

    expect((await screen.findAllByText(/Not configured/i)).length).toBeGreaterThan(0);
    expect(screen.getByText('Node Participant 1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Participant Status' })).toBeInTheDocument();
    expect(screen.getAllByText(/Not configured/i).length).toBeGreaterThan(0);
  });

  it('renders the selected node in grouped operational sections', async () => {
    const { container } = renderView();

    expect(await screen.findByText('PQS Only')).toBeInTheDocument();
    expect(screen.getByText('Node Participant 1')).toBeInTheDocument();
    expect(container.querySelector('.node-detail')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Back to overview' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Service Health' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ledger Snapshot' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Service Health' }).closest('section')).toHaveClass(
      'node-detail__section--full',
    );
    expect(screen.getByRole('heading', { name: 'Ledger Snapshot' }).closest('section')).toHaveClass(
      'node-detail__section--full',
    );
    expect(screen.getByRole('heading', { name: 'Participant Status' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Installed Packages' })).toBeInTheDocument();
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

  it('does not render a back control when opened from the Updates page', async () => {
    routeQuery.from = 'updates';

    renderView();

    expect(await screen.findByText('Node Participant 1')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Back to overview' })).not.toBeInTheDocument();
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
        ledgerApiVersion: '3.2.0',
      },
      ledgerSummary: {
        ledgerLabel: 'Retail Ledger 2',
        pqsDatabase: 'participant2_pqs',
      activeContractCount: 20,
      latestOffset: '2',
      latestEventAt: '2026-07-01T11:59:30.000Z',
      totalUpdateCount: 0,
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

    expect(await screen.findByText('participant2::1220abc')).toBeInTheDocument();
    expect(screen.getByText('Node Participant 2')).toBeInTheDocument();
    expect(screen.getByText('participant2::1220abc')).toBeInTheDocument();
    expect(screen.getByText('3.4.0')).toBeInTheDocument();
    expect(screen.getByText('physical::1220def')).toBeInTheDocument();
    expect(screen.getByText('sync-service')).toBeInTheDocument();
    expect(screen.getByText('3.2.0')).toBeInTheDocument();
  });

  it('renders service health while packages and participant status are still pending', async () => {
    const node = deferred<NodeSnapshot>();
    const pending = new Promise<never>(() => undefined);
    vi.mocked(fetchNode).mockReturnValueOnce(node.promise);
    vi.mocked(fetchNodePackages).mockReturnValueOnce(pending);
    vi.mocked(fetchNodeParticipantStatus).mockReturnValueOnce(pending);

    renderView();

    expect(screen.getByRole('heading', { name: 'Node participant-1' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Service Health' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Participant Status' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Installed Packages' })).toBeInTheDocument();

    await waitFor(() => expect(fetchNode).toHaveBeenCalledWith('participant-1'));

    node.resolve(nodeFixture('participant-1', 'Participant 1'));

    expect(await screen.findByText('PQS Only')).toBeInTheDocument();
    expect(screen.getByText('Loading participant status...')).toBeInTheDocument();
    expect(screen.getByText('Loading installed packages...')).toBeInTheDocument();
  });

  it('retries only a failed installed packages section', async () => {
    vi.mocked(fetchNodePackages)
      .mockRejectedValueOnce(new Error('Packages unavailable'))
      .mockRejectedValueOnce(new Error('Packages unavailable'))
      .mockResolvedValueOnce({
        nodeId: 'participant-1',
        label: 'Participant 1',
        packagesByName: [{
          packageName: 'recovered-package',
          packages: [{
            packageId: 'recovered-package-id',
            version: '1.0.0',
            uploadedAt: null,
            seenAt: '2026-07-02T12:05:00.000Z',
          }],
        }],
      });

    renderView();

    const packagesSection = screen.getByRole('heading', { name: 'Installed Packages' }).closest('section');
    expect(packagesSection).not.toBeNull();
    const alert = await within(packagesSection as HTMLElement).findByRole('alert', {
      name: 'Installed Packages error',
    });
    expect(alert).toHaveTextContent('Packages unavailable');
    expect(screen.getByText('PQS Only')).toBeInTheDocument();
    expect(screen.getAllByText(/Not configured/i).length).toBeGreaterThan(0);

    await fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('recovered-package')).toBeInTheDocument();
    expect(fetchNodePackages).toHaveBeenCalledTimes(3);
    expect(fetchNode).toHaveBeenCalledTimes(1);
    expect(fetchNodeParticipantStatus).toHaveBeenCalledTimes(1);
  });

  it('keeps the new node visible when an old route request resolves late', async () => {
    const oldNode = deferred<NodeSnapshot>();
    vi.mocked(fetchNode).mockImplementation((id) =>
      id === 'participant-1'
        ? oldNode.promise
        : Promise.resolve(nodeFixture('participant-2', 'Participant 2')),
    );
    vi.mocked(fetchNodePackages).mockImplementation((id) => Promise.resolve({
      nodeId: id,
      label: id === 'participant-1' ? 'Participant 1' : 'Participant 2',
      packagesByName: [],
    }));
    vi.mocked(fetchNodeParticipantStatus).mockImplementation((id) => Promise.resolve({
      nodeId: id,
      label: id === 'participant-1' ? 'Participant 1' : 'Participant 2',
      mode: 'pqs_only',
      participantStatusStatus: 'grpc_not_configured',
      participantStatus: null,
      notInitialized: null,
      participantStatusError: null,
      participantStatusErrorCode: null,
      participantStatusErrorDetails: null,
      participantStatusErrorTid: null,
    }));

    const { router } = await renderAt('/nodes/participant-1');
    await waitFor(() => expect(fetchNode).toHaveBeenCalledWith('participant-1'));
    await router.push('/nodes/participant-2');

    expect(await screen.findByRole('heading', { name: 'Node Participant 2' })).toBeInTheDocument();

    oldNode.resolve(nodeFixture('participant-1', 'Participant 1'));
    await Promise.resolve();
    await Promise.resolve();

    expect(screen.getByRole('heading', { name: 'Node Participant 2' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Node Participant 1' })).not.toBeInTheDocument();
  });
});
