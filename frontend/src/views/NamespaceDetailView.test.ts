import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NamespaceDetailView from './NamespaceDetailView.vue';
import * as api from '../lib/api';
import type {
  NamespaceContractsResponse,
  NamespaceNodesResponse,
  NamespacePartiesResponse,
  NamespaceSummaryResponse,
  NamespaceTopologyResponse,
  NamespaceUpdatesResponse,
} from '../types/namespaces';

vi.mock('../lib/api', () => ({
  fetchNamespaceSummary: vi.fn(),
  fetchNamespaceNodes: vi.fn(),
  fetchNamespaceTopology: vi.fn(),
  fetchNamespaceParties: vi.fn(),
  fetchNamespaceUpdates: vi.fn(),
  fetchNamespaceContracts: vi.fn(),
}));

const summary = {
  namespaceId: '1220abcd',
  partyCount: 2,
  nodeCount: 1,
  recentUpdateCount: 1,
  recentContractCount: 1,
} satisfies NamespaceSummaryResponse;
const nodes = {
  nodes: [{ nodeId: 'participant-1', label: 'Participant 1', recentUpdateCount: 1, recentContractCount: 1 }],
} satisfies NamespaceNodesResponse;
const topology = {
  topologyByNode: [{
    nodeId: 'participant-1',
    label: 'Participant 1',
    status: 'grpc_error' as const,
    errorMessage: 'Topology payload error',
    partyToParticipants: [],
    partyToKeyMappings: [],
  }],
} satisfies NamespaceTopologyResponse;
const parties = {
  namespaceId: '1220abcd',
  partyCount: 2,
  limit: 15,
  nextBefore: null,
  nextAfter: null,
  parties: [{ partyId: 'Alice::1220abcd' }, { partyId: 'Bob::1220abcd' }],
} satisfies NamespacePartiesResponse;
const updates = {
  limit: 15,
  nextBefore: null,
  nextAfter: null,
  updates: [{
    nodeId: 'participant-1',
    label: 'Participant 1',
    eventOffset: '42',
    updateId: 'update-42',
    recordTime: '2026-07-09T12:00:00.000Z',
    parties: ['Alice::1220abcd'],
    estimatedTrafficUsd: '12.34',
  }],
} satisfies NamespaceUpdatesResponse;
const contracts = {
  limit: 15,
  nextBefore: null,
  nextAfter: null,
  contracts: [{
    nodeId: 'participant-1',
    label: 'Participant 1',
    contractId: '00abc',
    templateId: 'Main:Asset',
    packageId: null,
    packageName: null,
    packageVersion: null,
    recordTime: '2026-07-09T12:00:00.000Z',
  }],
} satisfies NamespaceContractsResponse;

function resolveAllSections() {
  vi.mocked(api.fetchNamespaceSummary).mockResolvedValue(summary);
  vi.mocked(api.fetchNamespaceNodes).mockResolvedValue(nodes);
  vi.mocked(api.fetchNamespaceTopology).mockResolvedValue(topology);
  vi.mocked(api.fetchNamespaceParties).mockResolvedValue(parties);
  vi.mocked(api.fetchNamespaceUpdates).mockResolvedValue(updates);
  vi.mocked(api.fetchNamespaceContracts).mockResolvedValue(contracts);
}

async function renderAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/namespaces/:namespaceId', component: NamespaceDetailView, props: true }],
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

describe('NamespaceDetailView', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resolveAllSections();
  });

  afterEach(() => cleanup());

  it('mounts the shell and launches all six namespace sections independently', async () => {
    const pending = new Promise<never>(() => undefined);
    vi.mocked(api.fetchNamespaceSummary).mockReturnValue(pending);
    vi.mocked(api.fetchNamespaceNodes).mockReturnValue(pending);
    vi.mocked(api.fetchNamespaceTopology).mockReturnValue(pending);
    vi.mocked(api.fetchNamespaceParties).mockReturnValue(pending);
    vi.mocked(api.fetchNamespaceUpdates).mockReturnValue(pending);
    vi.mocked(api.fetchNamespaceContracts).mockReturnValue(pending);

    await renderAt('/namespaces/1220abcd');

    expect(screen.getByRole('heading', { name: '1220abcd Namespace' })).toBeInTheDocument();
    for (const heading of ['Overview', 'Observed Parties', 'Observed Nodes', 'Namespace Topology', 'Recent Updates', 'Recent Contracts']) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
    await waitFor(() => {
      expect(api.fetchNamespaceSummary).toHaveBeenCalledWith('1220abcd');
      expect(api.fetchNamespaceNodes).toHaveBeenCalledWith('1220abcd');
      expect(api.fetchNamespaceTopology).toHaveBeenCalledWith('1220abcd');
      expect(api.fetchNamespaceParties).toHaveBeenCalledWith('1220abcd', { limit: 15 });
      expect(api.fetchNamespaceUpdates).toHaveBeenCalledWith('1220abcd', { limit: 15 });
      expect(api.fetchNamespaceContracts).toHaveBeenCalledWith('1220abcd', { limit: 15 });
    });
  });

  it('renders every namespace-scoped payload, including gRPC topology state as data', async () => {
    await renderAt('/namespaces/1220abcd');

    expect(await screen.findByRole('link', { name: 'Alice::1220abcd' })).toHaveAttribute('href', '/parties/Alice%3A%3A1220abcd');
    const nodesSection = screen.getByRole('heading', { name: 'Observed Nodes' }).closest('section');
    expect(nodesSection).not.toBeNull();
    expect(within(nodesSection as HTMLElement).getByRole('link', { name: 'Participant 1' })).toHaveAttribute('href', '/nodes/participant-1');
    expect(screen.getByText('Topology payload error')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /update-42/ })).toHaveAttribute('href', '/nodes/participant-1/updates/42');
    expect(screen.getByRole('link', { name: /00abc/ })).toHaveAttribute('href', '/nodes/participant-1/contracts/00abc');
    expect(screen.getByText('$12.34')).toBeInTheDocument();
  });

  it('retries only the failed namespace updates section', async () => {
    vi.mocked(api.fetchNamespaceUpdates)
      .mockRejectedValueOnce(new Error('Namespace updates unavailable'))
      .mockRejectedValueOnce(new Error('Namespace updates unavailable'))
      .mockResolvedValueOnce(updates);

    await renderAt('/namespaces/1220abcd');

    const alert = await screen.findByRole('alert', { name: 'Recent Updates error' });
    expect(alert).toHaveTextContent('Namespace updates unavailable');
    expect(screen.getByText('Topology payload error')).toBeInTheDocument();
    await fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('link', { name: /update-42/ })).toBeInTheDocument();
    expect(api.fetchNamespaceUpdates).toHaveBeenCalledTimes(3);
    expect(api.fetchNamespaceSummary).toHaveBeenCalledTimes(1);
    expect(api.fetchNamespaceNodes).toHaveBeenCalledTimes(1);
    expect(api.fetchNamespaceTopology).toHaveBeenCalledTimes(1);
    expect(api.fetchNamespaceParties).toHaveBeenCalledTimes(1);
    expect(api.fetchNamespaceContracts).toHaveBeenCalledTimes(1);
  });

  it('reloads only observed parties when its pagination changes', async () => {
    vi.mocked(api.fetchNamespaceParties)
      .mockResolvedValueOnce({ ...parties, nextBefore: 'Alice::1220abcd' })
      .mockResolvedValueOnce({ ...parties, nextAfter: 'Bob::1220abcd', parties: [{ partyId: 'Carol::1220abcd' }] });

    await renderAt('/namespaces/1220abcd');
    const olderButton = await screen.findByRole('button', { name: 'Older' });
    await waitFor(() => expect(olderButton).toBeEnabled());
    await fireEvent.click(olderButton);

    expect(await screen.findByRole('link', { name: 'Carol::1220abcd' })).toBeInTheDocument();
    expect(api.fetchNamespaceParties).toHaveBeenLastCalledWith('1220abcd', { before: 'Alice::1220abcd', limit: 15 });
    expect(api.fetchNamespaceSummary).toHaveBeenCalledTimes(1);
    expect(api.fetchNamespaceUpdates).toHaveBeenCalledTimes(1);
    expect(api.fetchNamespaceContracts).toHaveBeenCalledTimes(1);
  });

  it('resets and launches all six sections for a new namespace', async () => {
    const { router } = await renderAt('/namespaces/1220abcd');
    await screen.findByText('update-42');
    await router.push('/namespaces/1220efgh');

    await waitFor(() => {
      expect(api.fetchNamespaceSummary).toHaveBeenLastCalledWith('1220efgh');
      expect(api.fetchNamespaceNodes).toHaveBeenLastCalledWith('1220efgh');
      expect(api.fetchNamespaceTopology).toHaveBeenLastCalledWith('1220efgh');
      expect(api.fetchNamespaceParties).toHaveBeenLastCalledWith('1220efgh', { limit: 15 });
      expect(api.fetchNamespaceUpdates).toHaveBeenLastCalledWith('1220efgh', { limit: 15 });
      expect(api.fetchNamespaceContracts).toHaveBeenLastCalledWith('1220efgh', { limit: 15 });
    });
  });

  it('keeps new namespace parties visible when the old namespace request resolves late', async () => {
    let resolveOldParties: (value: NamespacePartiesResponse) => void;
    const oldParties = new Promise<NamespacePartiesResponse>((resolve) => {
      resolveOldParties = resolve;
    });
    const newParties = {
      ...parties,
      namespaceId: '1220efgh',
      parties: [{ partyId: 'Carol::1220efgh' }],
    };
    vi.mocked(api.fetchNamespaceParties).mockImplementation((namespaceId) =>
      namespaceId === '1220abcd' ? oldParties : Promise.resolve(newParties),
    );

    const { router } = await renderAt('/namespaces/1220abcd');
    await waitFor(() => expect(api.fetchNamespaceParties).toHaveBeenCalledWith('1220abcd', { limit: 15 }));
    await router.push('/namespaces/1220efgh');
    expect(await screen.findByRole('link', { name: 'Carol::1220efgh' })).toBeInTheDocument();

    resolveOldParties!({ ...parties, parties: [{ partyId: 'Alice::1220abcd' }] });
    await Promise.resolve();
    await Promise.resolve();

    expect(screen.getByRole('link', { name: 'Carol::1220efgh' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Alice::1220abcd' })).not.toBeInTheDocument();
  });
});
