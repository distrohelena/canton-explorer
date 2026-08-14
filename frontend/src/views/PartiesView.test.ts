import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import PartiesView from './PartiesView.vue';
import type { PartyFingerprintsResponse } from '../types/active-parties';
import type { NodeSnapshot } from '../types/nodes';
import {
  fetchNodeActiveParties,
  fetchPartyFingerprints,
  fetchNodeLocalParties,
  fetchNodes,
} from '../lib/api';

vi.mock('../lib/api', () => ({
  fetchNodes: vi.fn(),
  fetchNodeActiveParties: vi.fn(),
  fetchPartyFingerprints: vi.fn(),
  fetchNodeLocalParties: vi.fn(),
}));

async function renderAt(path = '/parties') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/parties', component: PartiesView }],
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
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to" v-bind="$attrs"><slot /></a>',
          },
        },
      },
    },
  );

  return { ...rendered, router };
}

function makeNode(
  id: string,
  mode: 'pqs_only' | 'pqs_with_grpc' = 'pqs_with_grpc',
) {
  return {
    id,
    label: id === 'participant-1' ? 'Participant 1' : 'Participant 2',
    role: 'participant' as const,
    mode,
    ledgerLabel: id,
    status: 'healthy' as const,
    latencyMs: 1,
    lastSuccessAt: null,
    lastErrorAt: null,
    errorSummary: null,
    serviceInfo: {
      target: mode === 'pqs_with_grpc' ? `localhost:${id === 'participant-1' ? '5011' : '5012'}` : null,
      reachable: mode === 'pqs_with_grpc',
      healthCheckImplemented: mode === 'pqs_with_grpc',
      servingStatus: mode === 'pqs_with_grpc' ? 'SERVING' : null,
      ledgerApiVersion: null,
    },
    ledgerSummary: {
      ledgerLabel: id,
      pqsDatabase: id,
      activeContractCount: 1,
      latestOffset: null,
      latestEventAt: null,
      totalUpdateCount: 0,
    },
    sourceStatus: {
      pqs: { ok: true, checkedAt: '', latencyMs: 1, message: null },
      grpc: {
        ok: mode === 'pqs_with_grpc',
        checkedAt: '',
        latencyMs: mode === 'pqs_with_grpc' ? 1 : null,
        message: null,
      },
    },
  };
}

function makeActiveEntry(nodeId: string, parties: string[]) {
  return {
    nodeId,
    label: nodeId,
    mode: 'pqs_with_grpc' as const,
    parties,
    localPartiesStatus: 'ok' as const,
    localPartiesError: null,
    localPartiesErrorCode: null,
    localPartiesErrorDetails: null,
    localPartiesErrorTid: null,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

describe('PartiesView', () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  it('keeps successful node parties visible when another node fails and retries only that node', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([makeNode('participant-1'), makeNode('participant-2')]);
    vi.mocked(fetchNodeActiveParties).mockImplementation(async (nodeId: string) => {
      if (nodeId === 'participant-1') {
        return makeActiveEntry(nodeId, ['Alice']);
      }
      throw new Error('participant-2 unavailable');
    });

    await renderAt();

    expect(await screen.findByRole('link', { name: 'Alice' })).toBeInTheDocument();
    expect(await screen.findByText('participant-2 unavailable')).toBeInTheDocument();
    expect(fetchNodeActiveParties).toHaveBeenCalledTimes(3);

    await fireEvent.click(screen.getByRole('button', { name: 'Retry Participant 2' }));

    await waitFor(() => expect(fetchNodeActiveParties).toHaveBeenCalledTimes(5));
    expect(fetchNodeActiveParties).toHaveBeenCalledWith('participant-2');
    const fetchNodeActivePartiesMock = fetchNodeActiveParties as unknown as Mock;
    expect(fetchNodeActivePartiesMock.mock.calls.filter(([nodeId]) => nodeId === 'participant-1')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Alice' })).toBeInTheDocument();
  });

  it('shows a loading state before active parties resolve', async () => {
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
          ledgerApiVersion: null,
        },
        ledgerSummary: {
          ledgerLabel: 'Retail Ledger',
          pqsDatabase: 'participant_1',
          activeContractCount: 1,
          latestOffset: null,
          latestEventAt: null,
          totalUpdateCount: 0,
        },
        sourceStatus: {
          pqs: { ok: true, checkedAt: '', latencyMs: 1, message: null },
          grpc: { ok: false, checkedAt: '', latencyMs: null, message: null },
        },
      },
    ]);
    vi.mocked(fetchNodeActiveParties).mockReturnValue(new Promise(() => undefined));
    vi.mocked(fetchNodeLocalParties).mockResolvedValue({
      nodeId: 'participant-1',
      label: 'Participant 1',
      mode: 'pqs_only',
      parties: [],
      localPartiesStatus: 'grpc_not_configured',
      localPartiesError: null,
      localPartiesErrorCode: null,
      localPartiesErrorDetails: null,
      localPartiesErrorTid: null,
    });

    await renderAt();

    expect(screen.getByRole('tablist', { name: 'Party source modes' })).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Party source modes' }).querySelectorAll('button')).toHaveLength(3);
    expect(screen.queryByRole('tablist', { name: 'Node selectors' })).not.toBeInTheDocument();
    expect(screen.getByText('Loading nodes...')).toBeInTheDocument();
  });

  it('renders one unified advanced filter with all nodes checked by default', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([makeNode('participant-1'), makeNode('participant-2')]);
    vi.mocked(fetchNodeActiveParties).mockImplementation(async (nodeId: string) =>
      makeActiveEntry(nodeId, [nodeId === 'participant-1' ? 'Alice' : 'Bob']),
    );
    vi.mocked(fetchPartyFingerprints).mockResolvedValue({
      source: 'pqs',
      limit: 15,
      nextBefore: null,
      nextAfter: null,
      fingerprints: [],
    });

    await renderAt();
    await screen.findByRole('link', { name: 'Alice' });

    const filterShell = document.querySelector('.parties-page__filter-shell');
    expect(filterShell).toBeInTheDocument();
    expect(filterShell).toHaveAttribute('aria-hidden', 'true');
    expect(filterShell).toHaveAttribute('inert');

    const advancedFilterButton = screen.getByRole('button', { name: 'Advanced Filter' });
    expect(advancedFilterButton).toHaveClass('node-updates__filter-button');
    expect(advancedFilterButton).toHaveAttribute('title', 'Advanced Filter');
    expect(advancedFilterButton.querySelector('.node-updates__filter-icon')).not.toBeNull();
    expect(advancedFilterButton).toHaveTextContent('');
    await fireEvent.click(advancedFilterButton);

    expect(document.querySelectorAll('section[aria-label="Advanced Filter Parameters"]')).toHaveLength(1);
    expect(filterShell).toHaveClass('node-updates-filter-shell--open');
    expect(filterShell).toHaveAttribute('aria-hidden', 'false');
    expect(filterShell).not.toHaveAttribute('inert');
    expect(screen.getByRole('checkbox', { name: 'Participant 1' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Participant 2' })).toBeChecked();
    expect(screen.queryByLabelText('Public Key')).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Namespaces (gRPC)' }));

    expect(await screen.findByLabelText('Public Key')).toBeInTheDocument();
    expect(document.querySelectorAll('section[aria-label="Advanced Filter Parameters"]')).toHaveLength(1);
  });

  it.each([
    ['/parties', ['participant-1', 'participant-2']],
    ['/parties?node=participant-2&node=participant-2&node=participant-1', ['participant-1', 'participant-2']],
    ['/parties?node=', []],
    ['/parties?node=missing-node', []],
    ['/parties?node=&node=participant-2', ['participant-2']],
  ])('normalizes node query %s before loading active parties', async (path, expectedNodeIds) => {
    vi.mocked(fetchNodes).mockResolvedValue([makeNode('participant-1'), makeNode('participant-2')]);
    vi.mocked(fetchNodeActiveParties).mockImplementation(async (nodeId: string) =>
      makeActiveEntry(nodeId, [nodeId]),
    );

    await renderAt(path);

    await waitFor(() =>
      expect(vi.mocked(fetchNodeActiveParties).mock.calls.map(([nodeId]) => nodeId)).toEqual(expectedNodeIds),
    );
    if (path.includes('?node=')) {
      expect(await screen.findByText('Advanced Filter Parameters')).toBeInTheDocument();
    } else {
      await fireEvent.click(screen.getByRole('button', { name: 'Advanced Filter' }));
    }

    const participantOne = screen.getByRole('checkbox', { name: 'Participant 1' });
    const participantTwo = screen.getByRole('checkbox', { name: 'Participant 2' });
    if (expectedNodeIds.includes('participant-1')) {
      expect(participantOne).toBeChecked();
    } else {
      expect(participantOne).not.toBeChecked();
    }
    if (expectedNodeIds.includes('participant-2')) {
      expect(participantTwo).toBeChecked();
    } else {
      expect(participantTwo).not.toBeChecked();
    }
  });

  it('auto-opens explicit node filters, preserves unrelated query keys, and omits all-selected node query', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([makeNode('participant-1'), makeNode('participant-2')]);
    vi.mocked(fetchNodeActiveParties).mockImplementation(async (nodeId: string) =>
      makeActiveEntry(nodeId, [nodeId]),
    );

    const { router } = await renderAt('/parties?view=compact&node=participant-2');

    expect(await screen.findByText('Advanced Filter Parameters')).toBeInTheDocument();
    expect(router.currentRoute.value.query.view).toBe('compact');
    expect(router.currentRoute.value.query.node).toBe('participant-2');
    await waitFor(() => expect(fetchNodeActiveParties).toHaveBeenCalledWith('participant-2'));

    await fireEvent.click(screen.getByRole('checkbox', { name: 'Participant 1' }));
    await waitFor(() => expect(router.currentRoute.value.query.node).toBeUndefined());
    expect(router.currentRoute.value.query.view).toBe('compact');

    await fireEvent.click(screen.getByRole('checkbox', { name: 'Participant 2' }));
    await waitFor(() => expect(router.currentRoute.value.query.node).toEqual(['participant-1']));
  });

  it('resynchronizes selected nodes and data for query-only, back, and forward navigation', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([makeNode('participant-1'), makeNode('participant-2')]);
    vi.mocked(fetchNodeActiveParties).mockImplementation(async (nodeId: string) =>
      makeActiveEntry(nodeId, [nodeId]),
    );

    const { router } = await renderAt('/parties?view=compact');
    await waitFor(() => expect(fetchNodeActiveParties).toHaveBeenCalledTimes(2));
    vi.mocked(fetchNodeActiveParties).mockClear();

    await router.push('/parties?view=compact&node=participant-2');
    await waitFor(() =>
      expect(vi.mocked(fetchNodeActiveParties).mock.calls.map(([nodeId]) => nodeId)).toEqual([
        'participant-2',
      ]),
    );
    expect(screen.getByRole('checkbox', { name: 'Participant 2' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Participant 1' })).not.toBeChecked();

    router.back();
    await waitFor(() => expect(router.currentRoute.value.query).toEqual({ view: 'compact' }));
    await waitFor(() =>
      expect(vi.mocked(fetchNodeActiveParties).mock.calls.slice(-2).map(([nodeId]) => nodeId)).toEqual([
        'participant-1',
        'participant-2',
      ]),
    );
    expect(router.currentRoute.value.query).toEqual({ view: 'compact' });

    router.forward();
    await waitFor(() =>
      expect(router.currentRoute.value.query).toEqual({ view: 'compact', node: 'participant-2' }),
    );
    await waitFor(() =>
      expect(vi.mocked(fetchNodeActiveParties).mock.calls.at(-1)?.[0]).toBe('participant-2'),
    );
    expect(router.currentRoute.value.query).toEqual({ view: 'compact', node: 'participant-2' });
  });

  it('loads the selected mode after deferred node discovery', async () => {
    const nodesResponse = deferred<NodeSnapshot[]>();
    vi.mocked(fetchNodes).mockReturnValue(nodesResponse.promise);
    vi.mocked(fetchPartyFingerprints).mockResolvedValue({
      source: 'grpc',
      limit: 15,
      nextBefore: null,
      nextAfter: null,
      fingerprints: ['1220deferred'],
    });

    await renderAt();
    await fireEvent.click(screen.getByRole('button', { name: 'Namespaces (gRPC)' }));

    nodesResponse.resolve([makeNode('participant-1')]);

    expect(await screen.findByText('1220deferred')).toBeInTheDocument();
    expect(fetchPartyFingerprints).toHaveBeenCalledWith({ limit: 15 });
    expect(fetchNodeActiveParties).not.toHaveBeenCalled();
  });

  it('ends node discovery loading before the independent party sections settle', async () => {
    const parties = deferred<ReturnType<typeof makeActiveEntry>>();
    vi.mocked(fetchNodes).mockResolvedValue([makeNode('participant-1')]);
    vi.mocked(fetchNodeActiveParties).mockReturnValue(parties.promise);

    await renderAt();

    await waitFor(() => expect(fetchNodeActiveParties).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Loading nodes...')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading parties across selected nodes' })).toBeInTheDocument();

    parties.resolve(makeActiveEntry('participant-1', ['Alice']));
    expect(await screen.findByRole('link', { name: 'Alice' })).toBeInTheDocument();
  });

  it('retries failed namespace requests and renders a local retry instead of an empty result', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([makeNode('participant-1')]);
    vi.mocked(fetchNodeActiveParties).mockResolvedValue(makeActiveEntry('participant-1', ['Alice']));
    vi.mocked(fetchPartyFingerprints)
      .mockRejectedValueOnce(new Error('namespaces unavailable'))
      .mockRejectedValueOnce(new Error('namespaces unavailable'))
      .mockResolvedValueOnce({
        source: 'grpc',
        limit: 15,
        nextBefore: null,
        nextAfter: null,
        fingerprints: ['1220retry'],
      });

    await renderAt();
    await screen.findByRole('link', { name: 'Alice' });
    await fireEvent.click(screen.getByRole('button', { name: 'Namespaces (gRPC)' }));

    expect(await screen.findByText('Unable to load namespaces.')).toBeInTheDocument();
    expect(screen.getByText('namespaces unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No known namespaces found across selected nodes.')).not.toBeInTheDocument();
    expect(fetchPartyFingerprints).toHaveBeenCalledTimes(2);

    await fireEvent.click(screen.getByRole('button', { name: 'Retry namespaces' }));

    expect(await screen.findByRole('link', { name: '1220retry' })).toBeInTheDocument();
    expect(fetchPartyFingerprints).toHaveBeenCalledTimes(3);
  });

  it('reloads active parties immediately when a node is unchecked', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([makeNode('participant-1'), makeNode('participant-2')]);
    vi.mocked(fetchNodeActiveParties).mockImplementation(async (nodeId: string) =>
      makeActiveEntry(nodeId, [nodeId]),
    );

    await renderAt();
    await screen.findByRole('link', { name: 'participant-1' });
    await fireEvent.click(screen.getByRole('button', { name: 'Advanced Filter' }));
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Participant 1' }));

    await waitFor(() => {
      expect(fetchNodeActiveParties).toHaveBeenCalledTimes(3);
      expect(fetchNodeActiveParties).toHaveBeenLastCalledWith('participant-2');
    });
  });

  it('restricts All Parties to selected gRPC nodes and makes an empty selection call-free', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([
      makeNode('participant-1', 'pqs_only'),
      makeNode('participant-2', 'pqs_with_grpc'),
    ]);
    vi.mocked(fetchNodeActiveParties).mockImplementation(async (nodeId: string) =>
      makeActiveEntry(nodeId, [nodeId]),
    );
    vi.mocked(fetchNodeLocalParties).mockResolvedValue(makeActiveEntry('participant-2', ['Local 2']));

    await renderAt();
    await screen.findByRole('link', { name: 'participant-1' });
    await fireEvent.click(screen.getByRole('button', { name: 'All Parties (gRPC)' }));
    await screen.findByRole('link', { name: 'Local 2' });
    expect(fetchNodeLocalParties).toHaveBeenCalledTimes(1);
    expect(fetchNodeLocalParties).toHaveBeenCalledWith('participant-2');

    await fireEvent.click(screen.getByRole('button', { name: 'Advanced Filter' }));
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Participant 2' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'No gRPC nodes available' })).toBeInTheDocument());
    expect(fetchNodeLocalParties).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('checkbox', { name: 'Participant 1' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Participant 2' })).not.toBeChecked();

    await fireEvent.click(screen.getByRole('checkbox', { name: 'Participant 1' }));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'No gRPC nodes available' })).not.toBeInTheDocument(),
    );
    expect(screen.queryByTitle('Data sourced from gRPC')).not.toBeInTheDocument();
    expect(screen.getByText('No local parties found across selected nodes.')).toBeInTheDocument();
    expect(fetchNodeLocalParties).toHaveBeenCalledTimes(1);
  });

  it('renders the local-party empty state for an explicit empty All Parties selection', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([makeNode('participant-1')]);
    vi.mocked(fetchNodeActiveParties).mockResolvedValue(makeActiveEntry('participant-1', ['Alice']));

    await renderAt('/parties?node=');
    await fireEvent.click(screen.getByRole('button', { name: 'All Parties (gRPC)' }));

    expect(screen.getByText('No local parties found across selected nodes.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'No gRPC nodes available' })).not.toBeInTheDocument();
    expect(screen.queryByTitle('Data sourced from gRPC')).not.toBeInTheDocument();
    expect(fetchNodeLocalParties).not.toHaveBeenCalled();
  });

  it('passes namespace node IDs immediately and skips the namespace API for an empty selection', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([makeNode('participant-1'), makeNode('participant-2')]);
    vi.mocked(fetchNodeActiveParties).mockImplementation(async (nodeId: string) =>
      makeActiveEntry(nodeId, [nodeId]),
    );
    vi.mocked(fetchPartyFingerprints).mockResolvedValue({
      source: 'pqs',
      limit: 15,
      nextBefore: null,
      nextAfter: null,
      fingerprints: ['1220all'],
    });

    await renderAt();
    await screen.findByRole('link', { name: 'participant-1' });
    await fireEvent.click(screen.getByRole('button', { name: 'Namespaces (gRPC)' }));
    await screen.findByText('1220all');
    expect(fetchPartyFingerprints).toHaveBeenLastCalledWith({ limit: 15 });

    await fireEvent.click(screen.getByRole('button', { name: 'Advanced Filter' }));
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Participant 1' }));
    await waitFor(() =>
      expect(fetchPartyFingerprints).toHaveBeenLastCalledWith({ limit: 15, nodeIds: ['participant-2'] }),
    );

    await fireEvent.click(screen.getByRole('checkbox', { name: 'Participant 2' }));
    await waitFor(() => expect(screen.getByText('No known namespaces found across selected nodes.')).toBeInTheDocument());
    expect(fetchPartyFingerprints).toHaveBeenCalledTimes(2);
  });

  it('preserves route query keys through pagination, page-size, and mode changes and resets party cursors on selection changes', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([makeNode('participant-1'), makeNode('participant-2')]);
    vi.mocked(fetchNodeActiveParties).mockImplementation(async (nodeId: string) =>
      makeActiveEntry(
        nodeId,
        nodeId === 'participant-1'
          ? Array.from({ length: 18 }, (_, index) => `Active ${String(index + 1).padStart(2, '0')}`)
          : ['Other'],
      ),
    );
    vi.mocked(fetchNodeLocalParties).mockImplementation(async (nodeId: string) =>
      makeActiveEntry(nodeId, [`Local ${nodeId}`]),
    );

    const { router } = await renderAt('/parties?view=compact&node=participant-1');
    await screen.findByRole('link', { name: 'Active 01' });

    await fireEvent.click(screen.getByRole('button', { name: 'Older' }));
    await screen.findByRole('link', { name: 'Active 16' });
    expect(router.currentRoute.value.query).toEqual({ view: 'compact', node: 'participant-1' });

    await fireEvent.update(screen.getByRole('combobox', { name: 'Items per page' }), '30');
    expect(await screen.findByRole('link', { name: 'Active 01' })).toBeInTheDocument();
    expect(router.currentRoute.value.query).toEqual({ view: 'compact', node: 'participant-1' });

    await fireEvent.click(screen.getByRole('checkbox', { name: 'Participant 2' }));
    await waitFor(() => expect(router.currentRoute.value.query.node).toBeUndefined());
    expect(router.currentRoute.value.query.view).toBe('compact');
    expect(await screen.findByRole('link', { name: 'Active 01' })).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'All Parties (gRPC)' }));
    await screen.findByRole('link', { name: 'Local participant-1' });
    expect(router.currentRoute.value.query).toEqual({ view: 'compact' });
  });

  it('keeps concurrent loading active until every selected node settles', async () => {
    const participantOne = deferred<ReturnType<typeof makeActiveEntry>>();
    const participantTwo = deferred<ReturnType<typeof makeActiveEntry>>();
    vi.mocked(fetchNodes).mockResolvedValue([makeNode('participant-1'), makeNode('participant-2')]);
    vi.mocked(fetchNodeActiveParties)
      .mockReturnValueOnce(participantOne.promise)
      .mockReturnValueOnce(participantTwo.promise);

    await renderAt();
    await waitFor(() => expect(fetchNodeActiveParties).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('status', { name: 'Loading parties across selected nodes' })).toBeInTheDocument();

    participantOne.resolve(makeActiveEntry('participant-1', ['Alice']));
    await waitFor(() => expect(screen.getByRole('status', { name: 'Loading parties across selected nodes' })).toBeInTheDocument());

    participantTwo.resolve(makeActiveEntry('participant-2', ['Bob']));
    expect(await screen.findByRole('link', { name: 'Alice' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bob' })).toBeInTheDocument();
  });

  it('retains successful active party rows when another selected node fails', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([makeNode('participant-1'), makeNode('participant-2')]);
    vi.mocked(fetchNodeActiveParties)
      .mockResolvedValueOnce(makeActiveEntry('participant-1', ['Alice']))
      .mockRejectedValueOnce(new Error('participant-2 unavailable'))
      .mockRejectedValueOnce(new Error('participant-2 unavailable'));

    await renderAt();

    expect(await screen.findByRole('link', { name: 'Alice' })).toBeInTheDocument();
    expect(screen.getByText('participant-2 unavailable')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alice' })).toBeInTheDocument();
  });

  it('does not show a stale namespace source pill after leaving Namespaces', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([makeNode('participant-1')]);
    vi.mocked(fetchNodeActiveParties).mockResolvedValue(makeActiveEntry('participant-1', ['Alice']));
    vi.mocked(fetchPartyFingerprints).mockResolvedValue({
      source: 'grpc',
      limit: 15,
      nextBefore: null,
      nextAfter: null,
      fingerprints: ['1220namespace'],
    });

    await renderAt();
    await screen.findByRole('link', { name: 'Alice' });
    await fireEvent.click(screen.getByRole('button', { name: 'Namespaces (gRPC)' }));
    await screen.findByRole('link', { name: '1220namespace' });
    expect(screen.getByText('gRPC')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Active Parties (PQS)' }));
    await waitFor(() => expect(screen.queryByText('gRPC')).not.toBeInTheDocument());
    expect(await screen.findByRole('link', { name: 'Alice' })).toBeInTheDocument();
  });

  it('suppresses stale active party responses after a node selection changes', async () => {
    const staleParticipantOne = deferred<ReturnType<typeof makeActiveEntry>>();
    const staleParticipantTwo = deferred<ReturnType<typeof makeActiveEntry>>();
    const freshParticipantTwo = deferred<ReturnType<typeof makeActiveEntry>>();
    vi.mocked(fetchNodes).mockResolvedValue([makeNode('participant-1'), makeNode('participant-2')]);
    vi.mocked(fetchNodeActiveParties)
      .mockReturnValueOnce(staleParticipantOne.promise)
      .mockReturnValueOnce(staleParticipantTwo.promise)
      .mockReturnValueOnce(freshParticipantTwo.promise);

    await renderAt();
    await waitFor(() => expect(fetchNodeActiveParties).toHaveBeenCalledTimes(2));
    await fireEvent.click(screen.getByRole('button', { name: 'Advanced Filter' }));
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Participant 1' }));
    await waitFor(() => expect(fetchNodeActiveParties).toHaveBeenCalledTimes(3));

    staleParticipantOne.resolve(makeActiveEntry('participant-1', ['Stale Alice']));
    staleParticipantTwo.resolve(makeActiveEntry('participant-2', ['Stale Bob']));
    freshParticipantTwo.resolve(makeActiveEntry('participant-2', ['Fresh Bob']));

    expect(await screen.findByRole('link', { name: 'Fresh Bob' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Stale Alice' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Stale Bob' })).not.toBeInTheDocument();
  });

  it('suppresses stale local-party responses after a node selection changes', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([makeNode('participant-1'), makeNode('participant-2')]);
    vi.mocked(fetchNodeActiveParties).mockImplementation(async (nodeId: string) =>
      makeActiveEntry(nodeId, [nodeId]),
    );
    const staleParticipantOne = deferred<ReturnType<typeof makeActiveEntry>>();
    const staleParticipantTwo = deferred<ReturnType<typeof makeActiveEntry>>();
    const freshParticipantTwo = deferred<ReturnType<typeof makeActiveEntry>>();
    vi.mocked(fetchNodeLocalParties)
      .mockReturnValueOnce(staleParticipantOne.promise)
      .mockReturnValueOnce(staleParticipantTwo.promise)
      .mockReturnValueOnce(freshParticipantTwo.promise);

    await renderAt();
    await screen.findByRole('link', { name: 'participant-1' });
    await fireEvent.click(screen.getByRole('button', { name: 'All Parties (gRPC)' }));
    await waitFor(() => expect(fetchNodeLocalParties).toHaveBeenCalledTimes(2));
    await fireEvent.click(screen.getByRole('button', { name: 'Advanced Filter' }));
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Participant 1' }));
    await waitFor(() => expect(fetchNodeLocalParties).toHaveBeenCalledTimes(3));

    staleParticipantOne.resolve(makeActiveEntry('participant-1', ['Stale Local Alice']));
    staleParticipantTwo.resolve(makeActiveEntry('participant-2', ['Stale Local Bob']));
    freshParticipantTwo.resolve(makeActiveEntry('participant-2', ['Fresh Local Bob']));

    expect(await screen.findByRole('link', { name: 'Fresh Local Bob' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Stale Local Alice' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Stale Local Bob' })).not.toBeInTheDocument();
  });

  it('suppresses stale namespace responses after a node selection changes', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([makeNode('participant-1'), makeNode('participant-2')]);
    vi.mocked(fetchNodeActiveParties).mockImplementation(async (nodeId: string) =>
      makeActiveEntry(nodeId, [nodeId]),
    );
    const staleNamespaces = deferred<PartyFingerprintsResponse>();
    const freshNamespaces = deferred<PartyFingerprintsResponse>();
    vi.mocked(fetchPartyFingerprints)
      .mockReturnValueOnce(staleNamespaces.promise)
      .mockReturnValueOnce(freshNamespaces.promise);

    await renderAt();
    await screen.findByRole('link', { name: 'participant-1' });
    await fireEvent.click(screen.getByRole('button', { name: 'Namespaces (gRPC)' }));
    await waitFor(() => expect(fetchPartyFingerprints).toHaveBeenCalledTimes(1));
    await fireEvent.click(screen.getByRole('button', { name: 'Advanced Filter' }));
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Participant 1' }));
    await waitFor(() => expect(fetchPartyFingerprints).toHaveBeenCalledTimes(2));

    staleNamespaces.resolve({
      source: 'pqs',
      limit: 15,
      nextBefore: null,
      nextAfter: null,
      fingerprints: ['stale-namespace'],
    });
    freshNamespaces.resolve({
      source: 'pqs',
      limit: 15,
      nextBefore: null,
      nextAfter: null,
      fingerprints: ['fresh-namespace'],
    });

    expect(await screen.findByRole('link', { name: 'fresh-namespace' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'stale-namespace' })).not.toBeInTheDocument();
  });

  it('loads active parties across all nodes by default', async () => {
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
          ledgerApiVersion: null,
        },
        ledgerSummary: {
          ledgerLabel: 'Retail Ledger',
          pqsDatabase: 'participant_1',
          activeContractCount: 1,
          latestOffset: null,
          latestEventAt: null,
          totalUpdateCount: 0,
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
          ledgerApiVersion: null,
        },
        ledgerSummary: {
          ledgerLabel: 'Retail Ledger 2',
          pqsDatabase: 'participant_2',
          activeContractCount: 1,
          latestOffset: null,
          latestEventAt: null,
          totalUpdateCount: 0,
        },
        sourceStatus: {
          pqs: { ok: true, checkedAt: '', latencyMs: 1, message: null },
          grpc: { ok: true, checkedAt: '', latencyMs: 1, message: null },
        },
      },
    ]);
    vi.mocked(fetchNodeActiveParties)
      .mockResolvedValueOnce({
        nodeId: 'participant-1',
        label: 'Participant 1',
        mode: 'pqs_only',
        parties: ['Alice', 'Bob'],
      })
      .mockResolvedValueOnce({
        nodeId: 'participant-2',
        label: 'Participant 2',
        mode: 'pqs_with_grpc',
        parties: ['Carol'],
      });
    vi.mocked(fetchNodeLocalParties).mockResolvedValue({
      nodeId: 'participant-2',
      label: 'Participant 2',
      mode: 'pqs_with_grpc',
      parties: ['LocalCarol'],
      localPartiesStatus: 'ok',
      localPartiesError: null,
      localPartiesErrorCode: null,
      localPartiesErrorDetails: null,
      localPartiesErrorTid: null,
    });
    vi.mocked(fetchPartyFingerprints).mockResolvedValue({
      source: 'grpc',
      limit: 15,
      nextBefore: null,
      nextAfter: null,
      fingerprints: ['1220carol'],
    });

    await renderAt();

    await screen.findByRole('link', { name: 'Carol' });

    expect(screen.queryByText('PQS')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Active Parties (PQS)' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('tablist', { name: 'Party source modes' }).querySelectorAll('button')).toHaveLength(3);
    expect(screen.queryByRole('tablist', { name: 'Node selectors' })).not.toBeInTheDocument();
    expect(screen.queryByText('Show')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'No gRPC nodes available' }),
    ).not.toBeInTheDocument();
    expect(fetchNodeActiveParties).toHaveBeenCalledTimes(2);
    expect(fetchNodeActiveParties).toHaveBeenCalledWith('participant-1');
    expect(fetchNodeActiveParties).toHaveBeenCalledWith('participant-2');
    expect(screen.getByRole('heading', { name: 'All Nodes' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alice' })).toHaveAttribute('href', '/parties/Alice');
    expect(screen.getByRole('link', { name: 'Bob' })).toHaveAttribute('href', '/parties/Bob');
    expect(
      screen.getByRole('link', { name: 'Alice' }).closest('.node-detail__section'),
    ).toBeNull();
    expect(
      document.querySelector('.parties-page__results.parties-page__results--inline-actions'),
    ).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy party ID Alice' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy party ID Bob' })).toBeInTheDocument();

    expect(await screen.findByRole('link', { name: 'Carol' })).toHaveAttribute(
      'href',
      '/parties/Carol',
    );
    expect(fetchNodeActiveParties).toHaveBeenCalledTimes(2);

    await fireEvent.click(screen.getByRole('button', { name: 'All Parties (gRPC)' }));

    expect(await screen.findByRole('link', { name: 'LocalCarol' })).toHaveAttribute(
      'href',
      '/parties/LocalCarol',
    );
    expect(screen.getByText('gRPC')).toHaveAttribute('title', 'Data sourced from gRPC');
    expect(
      screen.getByText('gRPC').closest('.results-header__actions'),
    ).not.toBeNull();
    expect(screen.queryByText('Local party inventory via gRPC.')).not.toBeInTheDocument();
    expect(fetchNodeLocalParties).toHaveBeenCalledTimes(1);
    expect(fetchNodeLocalParties).toHaveBeenCalledWith('participant-2');
  });

  it('keeps all-node selection when switching between party sources', async () => {
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
          ledgerApiVersion: null,
        },
        ledgerSummary: {
          ledgerLabel: 'Retail Ledger',
          pqsDatabase: 'participant_1',
          activeContractCount: 1,
          latestOffset: null,
          latestEventAt: null,
          totalUpdateCount: 0,
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
          ledgerApiVersion: null,
        },
        ledgerSummary: {
          ledgerLabel: 'Retail Ledger 2',
          pqsDatabase: 'participant_2',
          activeContractCount: 1,
          latestOffset: null,
          latestEventAt: null,
          totalUpdateCount: 0,
        },
        sourceStatus: {
          pqs: { ok: true, checkedAt: '', latencyMs: 1, message: null },
          grpc: { ok: true, checkedAt: '', latencyMs: 1, message: null },
        },
      },
    ]);
    vi.mocked(fetchNodeActiveParties)
      .mockResolvedValueOnce({
        nodeId: 'participant-1',
        label: 'Participant 1',
        mode: 'pqs_only',
        parties: ['Bob', 'Alice'],
      })
      .mockResolvedValueOnce({
        nodeId: 'participant-2',
        label: 'Participant 2',
        mode: 'pqs_with_grpc',
        parties: ['Carol'],
      });
    vi.mocked(fetchNodeLocalParties).mockResolvedValue({
      nodeId: 'participant-2',
      label: 'Participant 2',
      mode: 'pqs_with_grpc',
      parties: ['LocalCarol'],
      localPartiesStatus: 'ok',
      localPartiesError: null,
      localPartiesErrorCode: null,
      localPartiesErrorDetails: null,
      localPartiesErrorTid: null,
    });
    vi.mocked(fetchPartyFingerprints).mockResolvedValue({
      source: 'pqs',
      limit: 15,
      nextBefore: '1220carol',
      nextAfter: null,
      fingerprints: ['1220alice', '1220carol'],
    });

    await renderAt();

    await screen.findByRole('link', { name: 'Carol' });

    expect(fetchNodeActiveParties).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('tablist', { name: 'Node selectors' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'All Nodes' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alice' })).toHaveAttribute('href', '/parties/Alice');
    expect(screen.getByRole('link', { name: 'Bob' })).toHaveAttribute('href', '/parties/Bob');
    expect(screen.getByRole('link', { name: 'Carol' })).toHaveAttribute('href', '/parties/Carol');

    await fireEvent.click(screen.getByRole('button', { name: 'Namespaces (gRPC)' }));

    await waitFor(() =>
      expect(fetchPartyFingerprints).toHaveBeenCalledTimes(1),
    );
    expect(await screen.findByText('1220alice')).toBeInTheDocument();
    expect(screen.getByText('1220carol')).toBeInTheDocument();
    expect(screen.queryByText('PQS')).not.toBeInTheDocument();
    expect(screen.queryAllByText('gRPC')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Older' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Newer' })).toBeDisabled();
  });

  it('paginates namespaces with newer and older controls', async () => {
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
          ledgerApiVersion: null,
        },
        ledgerSummary: {
          ledgerLabel: 'Retail Ledger',
          pqsDatabase: 'participant_1',
          activeContractCount: 1,
          latestOffset: null,
          latestEventAt: null,
          totalUpdateCount: 0,
        },
        sourceStatus: {
          pqs: { ok: true, checkedAt: '', latencyMs: 1, message: null },
          grpc: { ok: false, checkedAt: '', latencyMs: null, message: null },
        },
      },
    ]);
    vi.mocked(fetchNodeActiveParties).mockResolvedValue({
      nodeId: 'participant-1',
      label: 'Participant 1',
      mode: 'pqs_only',
      parties: ['Alice'],
    });
    vi.mocked(fetchPartyFingerprints)
      .mockResolvedValueOnce({
        source: 'pqs',
        limit: 15,
        nextBefore: '1220j',
        nextAfter: null,
        fingerprints: ['1220a', '1220b'],
      })
      .mockResolvedValueOnce({
        source: 'pqs',
        limit: 15,
        nextBefore: null,
        nextAfter: '1220k',
        fingerprints: ['1220k', '1220l'],
      })
      .mockResolvedValueOnce({
        source: 'pqs',
        limit: 15,
        nextBefore: '1220j',
        nextAfter: null,
        fingerprints: ['1220a', '1220b'],
      });

    await renderAt();

    await fireEvent.click(await screen.findByRole('button', { name: 'Namespaces (gRPC)' }));

    expect(await screen.findByText('1220a')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Older' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Newer' })).toBeDisabled();

    await fireEvent.click(screen.getByRole('button', { name: 'Older' }));

    expect(await screen.findByText('1220k')).toBeInTheDocument();
    expect(fetchPartyFingerprints).toHaveBeenLastCalledWith({
      before: '1220j',
      limit: 15,
    });
    expect(screen.getByRole('button', { name: 'Older' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Newer' })).not.toBeDisabled();

    await fireEvent.click(screen.getByRole('button', { name: 'Newer' }));

    expect(await screen.findByText('1220a')).toBeInTheDocument();
    expect(fetchPartyFingerprints).toHaveBeenLastCalledWith({
      after: '1220k',
      limit: 15,
    });
  });

  it('links namespace rows to the namespace detail page', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([
      {
        id: 'participant-1',
        label: 'Participant 1',
        role: 'participant',
        mode: 'pqs_with_grpc',
        ledgerLabel: 'Retail Ledger 1',
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
          ledgerApiVersion: null,
        },
        ledgerSummary: {
          ledgerLabel: 'Retail Ledger 1',
          pqsDatabase: 'participant_1',
          activeContractCount: 1,
          latestOffset: null,
          latestEventAt: null,
          totalUpdateCount: 0,
        },
        sourceStatus: {
          pqs: { ok: true, checkedAt: '', latencyMs: 1, message: null },
          grpc: { ok: true, checkedAt: '', latencyMs: 1, message: null },
        },
      },
    ]);
    vi.mocked(fetchNodeActiveParties).mockResolvedValue({
      nodeId: 'participant-1',
      label: 'Participant 1',
      mode: 'pqs_with_grpc',
      parties: ['Alice::1220abcd'],
    });
    vi.mocked(fetchPartyFingerprints).mockResolvedValue({
      source: 'grpc',
      limit: 15,
      nextBefore: null,
      nextAfter: null,
      fingerprints: ['1220abcd'],
    });

    await renderAt();

    await fireEvent.click(await screen.findByRole('button', { name: 'Namespaces (gRPC)' }));

    expect(await screen.findByRole('link', { name: '1220abcd' })).toHaveAttribute(
      'href',
      '/namespaces/1220abcd',
    );
    expect(screen.getByRole('link', { name: '1220abcd' })).toHaveClass(
      'contract-detail__link',
      'parties-page__party-link',
    );
  });

  it('filters namespaces through the advanced filter panel', async () => {
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
          ledgerApiVersion: null,
        },
        ledgerSummary: {
          ledgerLabel: 'Retail Ledger',
          pqsDatabase: 'participant_1',
          activeContractCount: 1,
          latestOffset: null,
          latestEventAt: null,
          totalUpdateCount: 0,
        },
        sourceStatus: {
          pqs: { ok: true, checkedAt: '', latencyMs: 1, message: null },
          grpc: { ok: false, checkedAt: '', latencyMs: null, message: null },
        },
      },
    ]);
    vi.mocked(fetchNodeActiveParties).mockResolvedValue({
      nodeId: 'participant-1',
      label: 'Participant 1',
      mode: 'pqs_only',
      parties: ['Alice'],
    });
    vi.mocked(fetchPartyFingerprints)
      .mockResolvedValueOnce({
        source: 'pqs',
        limit: 15,
        nextBefore: null,
        nextAfter: null,
        fingerprints: ['1220a', '1220b'],
      })
      .mockResolvedValueOnce({
        source: 'pqs',
        limit: 15,
        nextBefore: null,
        nextAfter: null,
        fingerprints: ['1220a'],
      });

    await renderAt();

    await fireEvent.click(await screen.findByRole('button', { name: 'Namespaces (gRPC)' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Advanced Filter' }));

    expect(await screen.findByText('Advanced Filter Parameters')).toBeInTheDocument();

    await fireEvent.update(screen.getByLabelText('Public Key'), '302a300506032b6570032100010203');
    await fireEvent.update(screen.getByLabelText('Encoding'), 'hex');
    await fireEvent.update(screen.getByLabelText('Key Format'), 'derX509SubjectPublicKeyInfo');
    await fireEvent.update(screen.getByLabelText('Key Type'), 'ed25519');
    await fireEvent.click(screen.getByRole('button', { name: 'Search Namespaces' }));

    expect(await screen.findByText('1220a')).toBeInTheDocument();
    expect(fetchPartyFingerprints).toHaveBeenLastCalledWith({
      limit: 15,
      publicKey: '302a300506032b6570032100010203',
      encoding: 'hex',
      keyFormat: 'derX509SubjectPublicKeyInfo',
      keyType: 'ed25519',
    });
  });

  it('paginates active parties and local parties with newer and older controls', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([
      {
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
          ledgerApiVersion: null,
        },
        ledgerSummary: {
          ledgerLabel: 'Retail Ledger',
          pqsDatabase: 'participant_1',
          activeContractCount: 1,
          latestOffset: null,
          latestEventAt: null,
          totalUpdateCount: 0,
        },
        sourceStatus: {
          pqs: { ok: true, checkedAt: '', latencyMs: 1, message: null },
          grpc: { ok: true, checkedAt: '', latencyMs: 1, message: null },
        },
      },
    ]);
    vi.mocked(fetchNodeActiveParties).mockResolvedValue({
      nodeId: 'participant-1',
      label: 'Participant 1',
      mode: 'pqs_with_grpc',
      parties: Array.from({ length: 18 }, (_, index) => `Active ${String(index + 1).padStart(2, '0')}`),
    });
    vi.mocked(fetchNodeLocalParties).mockResolvedValue({
      nodeId: 'participant-1',
      label: 'Participant 1',
      mode: 'pqs_with_grpc',
      parties: Array.from({ length: 18 }, (_, index) => `Local ${String(index + 1).padStart(2, '0')}`),
      localPartiesStatus: 'ok',
      localPartiesError: null,
      localPartiesErrorCode: null,
      localPartiesErrorDetails: null,
      localPartiesErrorTid: null,
    });

    await renderAt();

    expect(await screen.findByRole('link', { name: 'Active 01' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Active 16' })).not.toBeInTheDocument();
    const newerButton = screen.getByRole('button', { name: 'Newer' });
    const olderButton = screen.getByRole('button', { name: 'Older' });
    expect(newerButton).toHaveClass('dashboard__refresh');
    expect(newerButton.querySelector('.node-updates__pagination-icon--newer')).not.toBeNull();
    expect(olderButton.querySelector('.node-updates__pagination-icon--older')).not.toBeNull();
    expect(olderButton).not.toBeDisabled();
    expect(newerButton).toBeDisabled();

    await fireEvent.click(olderButton);

    expect(await screen.findByRole('link', { name: 'Active 16' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Older' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Newer' })).not.toBeDisabled();

    await fireEvent.click(screen.getByRole('button', { name: 'All Parties (gRPC)' }));

    expect(await screen.findByRole('link', { name: 'Local 01' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Local 16' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Older' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Newer' })).toBeDisabled();

    await fireEvent.click(screen.getByRole('button', { name: 'Older' }));

    expect(await screen.findByRole('link', { name: 'Local 16' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Older' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Newer' })).not.toBeDisabled();
  });

  it('shows a grpc error message instead of the empty-state copy when local party loading fails', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([
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
          ledgerApiVersion: null,
        },
        ledgerSummary: {
          ledgerLabel: 'Retail Ledger 2',
          pqsDatabase: 'participant_2',
          activeContractCount: 1,
          latestOffset: null,
          latestEventAt: null,
          totalUpdateCount: 0,
        },
        sourceStatus: {
          pqs: { ok: true, checkedAt: '', latencyMs: 1, message: null },
          grpc: { ok: true, checkedAt: '', latencyMs: 1, message: null },
        },
      },
    ]);
    vi.mocked(fetchNodeActiveParties).mockResolvedValue({
      nodeId: 'participant-2',
      label: 'Participant 2',
      mode: 'pqs_with_grpc',
      parties: [],
    });
    vi.mocked(fetchNodeLocalParties).mockResolvedValue({
      nodeId: 'participant-2',
      label: 'Participant 2',
      mode: 'pqs_with_grpc',
      parties: [],
      localPartiesStatus: 'grpc_error',
      localPartiesError:
        'An error occurred. Please contact the operator and inquire about the request 66f620d5014db408ba2d552b8d78b99f with tid 66f620d5014db408ba2d552b8d78b99f',
      localPartiesErrorCode: '13',
      localPartiesErrorDetails:
        'An error occurred. Please contact the operator and inquire about the request 66f620d5014db408ba2d552b8d78b99f with tid 66f620d5014db408ba2d552b8d78b99f',
      localPartiesErrorTid: '66f620d5014db408ba2d552b8d78b99f',
    });

    await renderAt();

    await fireEvent.click(await screen.findByRole('button', { name: 'All Parties (gRPC)' }));

    expect(
      await screen.findByText('gRPC error while listing local parties for this node.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Status code: 13/)).toBeInTheDocument();
    expect(screen.getByText(/Request ID: 66f620d5014db408ba2d552b8d78b99f/)).toBeInTheDocument();
    expect(screen.getByText(/Please contact the operator/)).toBeInTheDocument();
    expect(screen.queryByText('No local parties found for this node.')).not.toBeInTheDocument();
  });

  it('shows a pqs error message instead of the empty-state copy when active party loading fails', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([
      {
        id: 'participant-2',
        label: 'Participant 2',
        role: 'participant',
        mode: 'pqs_with_grpc',
        ledgerLabel: 'Retail Ledger 2',
        status: 'degraded',
        latencyMs: 1,
        lastSuccessAt: null,
        lastErrorAt: null,
        errorSummary: 'PQS unavailable',
        serviceInfo: {
          target: 'localhost:5012',
          reachable: true,
          healthCheckImplemented: true,
          servingStatus: 'SERVING',
          ledgerApiVersion: null,
        },
        ledgerSummary: {
          ledgerLabel: 'Retail Ledger 2',
          pqsDatabase: 'participant_2',
          activeContractCount: 1,
          latestOffset: null,
          latestEventAt: null,
          totalUpdateCount: 0,
        },
        sourceStatus: {
          pqs: { ok: false, checkedAt: '', latencyMs: 1, message: 'connect ECONNREFUSED' },
          grpc: { ok: true, checkedAt: '', latencyMs: 1, message: null },
        },
      },
    ]);
    vi.mocked(fetchNodeActiveParties).mockResolvedValue({
      nodeId: 'participant-2',
      label: 'Participant 2',
      mode: 'pqs_with_grpc',
      parties: [],
      activePartiesStatus: 'pqs_error',
      activePartiesError: 'connect ECONNREFUSED 127.0.0.1:5542',
    });
    vi.mocked(fetchNodeLocalParties).mockResolvedValue({
      nodeId: 'participant-2',
      label: 'Participant 2',
      mode: 'pqs_with_grpc',
      parties: [],
      localPartiesStatus: 'ok',
      localPartiesError: null,
      localPartiesErrorCode: null,
      localPartiesErrorDetails: null,
      localPartiesErrorTid: null,
    });

    await renderAt();

    expect(
      await screen.findByText('PQS error while listing active parties for this node.'),
    ).toBeInTheDocument();
    expect(screen.getByText('connect ECONNREFUSED 127.0.0.1:5542')).toBeInTheDocument();
    expect(screen.queryByText('No active parties found for this node.')).not.toBeInTheDocument();
  });
});
