import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NamespaceDetailView from './NamespaceDetailView.vue';
import * as api from '../lib/api';

vi.mock('../lib/api', () => ({
  fetchNamespaceDetail: vi.fn(),
  fetchNamespaceParties: vi.fn(),
  fetchLatestUpdates: vi.fn(),
  fetchLatestContracts: vi.fn(),
  fetchTemplates: vi.fn(),
}));

async function renderAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/namespaces/:namespaceId', component: NamespaceDetailView, props: true }],
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
            template: '<a :href="typeof to === \'string\' ? to : String(to)" v-bind="$attrs"><slot /></a>',
          },
        },
      },
    },
  );

  return { ...rendered, router };
}

describe('NamespaceDetailView', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows a loading state before the namespace detail resolves', async () => {
    vi.mocked(api.fetchNamespaceDetail).mockReturnValue(new Promise(() => undefined));

    await renderAt('/namespaces/1220abcd');

    expect(screen.getByText('Loading namespace detail...')).toBeInTheDocument();
  });

  it('renders a namespace-centric detail page with overview, observed parties, nodes, topology, updates, and contracts', async () => {
    vi.mocked(api.fetchNamespaceDetail).mockResolvedValue({
      namespaceId: '1220abcd',
      partyCount: 2,
      nodeCount: 2,
      recentUpdateCount: 2,
      recentContractCount: 1,
      nodes: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          recentUpdateCount: 1,
          recentContractCount: 0,
        },
        {
          nodeId: 'participant-2',
          label: 'Participant 2',
          recentUpdateCount: 1,
          recentContractCount: 1,
        },
      ],
      recentUpdates: [
        {
          nodeId: 'participant-2',
          label: 'Participant 2',
          eventOffset: '42',
          updateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
          recordTime: '2026-07-09T12:00:00.000Z',
          parties: ['Alice::1220abcd', 'Bob::1220abcd'],
        },
      ],
      recentContracts: [
        {
          nodeId: 'participant-2',
          label: 'Participant 2',
          contractId: '00abc',
          templateId: 'Main:Asset',
          packageId: null,
          packageName: null,
          packageVersion: null,
          recordTime: '2026-07-09T12:00:00.000Z',
        },
      ],
      topologyByNode: [
        {
          nodeId: 'participant-2',
          label: 'Participant 2',
          status: 'ok',
          errorMessage: null,
          partyToParticipants: [
            {
              participantId: null,
              participantUid: 'participant-2::1220ffff',
              permission: 'confirmation',
              threshold: 1,
              synchronizerIds: ['global-domain::1220aa'],
            },
          ],
          partyToKeyMappings: [
            {
              keyFingerprint: '1220abcd',
              publicKey: '302a300506032b6570032100abcdef',
              purpose: 'namespace',
              keyType: 'ed25519',
              keyFormat: 'derX509SubjectPublicKeyInfo',
              keySpec: 'ecCurve25519',
              threshold: 1,
              synchronizerIds: ['global-domain::1220aa'],
            },
          ],
        },
      ],
    });
    vi.mocked(api.fetchNamespaceParties).mockResolvedValue({
      namespaceId: '1220abcd',
      partyCount: 2,
      limit: 10,
      nextBefore: null,
      nextAfter: null,
      parties: [
        {
          partyId: 'Alice::1220abcd',
        },
        {
          partyId: 'Bob::1220abcd',
        },
      ],
    });
    vi.mocked(api.fetchLatestUpdates).mockResolvedValue({
      limit: 10,
      nextBefore: null,
      nextAfter: null,
      updates: [],
    });
    vi.mocked(api.fetchLatestContracts).mockResolvedValue({
      limit: 10,
      nextBefore: null,
      nextAfter: null,
      contracts: [],
    });
    vi.mocked(api.fetchTemplates).mockResolvedValue({ templates: [] });

    await renderAt('/namespaces/1220abcd');

    await waitFor(() => {
      expect(api.fetchNamespaceDetail).toHaveBeenCalledWith('1220abcd');
    });
    expect(api.fetchNamespaceParties).toHaveBeenCalledWith('1220abcd', { limit: 10 });

    expect(await screen.findByText('1220abcd Namespace')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to overview' })).toHaveAttribute('href', '/parties');
    expect(screen.getByRole('heading', { name: 'Observed Parties' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Observed Nodes' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alice::1220abcd' })).toHaveAttribute('href', '/parties/Alice%3A%3A1220abcd');
    expect(screen.queryByText('Participant 1 / Participant 2')).not.toBeInTheDocument();
    expect(screen.getByText('Namespace Topology')).toBeInTheDocument();
    expect(screen.getByText('participant-2::1220ffff')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recent Updates' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recent Contracts' })).toBeInTheDocument();
  });

  it('paginates observed parties through the dedicated backend endpoint', async () => {
    vi.mocked(api.fetchNamespaceDetail).mockResolvedValue({
      namespaceId: '1220abcd',
      partyCount: 12,
      nodeCount: 2,
      recentUpdateCount: 0,
      recentContractCount: 0,
      nodes: [],
      recentUpdates: [],
      recentContracts: [],
      topologyByNode: [],
    });
    vi.mocked(api.fetchNamespaceParties)
      .mockResolvedValueOnce({
        namespaceId: '1220abcd',
        partyCount: 12,
        limit: 10,
        nextBefore: 'Party 10::1220abcd',
        nextAfter: null,
        parties: Array.from({ length: 10 }, (_, index) => ({
          partyId: `Party ${String(index + 1).padStart(2, '0')}::1220abcd`,
        })),
      })
      .mockResolvedValueOnce({
        namespaceId: '1220abcd',
        partyCount: 12,
        limit: 10,
        nextBefore: null,
        nextAfter: 'Party 11::1220abcd',
        parties: [
          { partyId: 'Party 11::1220abcd' },
          { partyId: 'Party 12::1220abcd' },
        ],
      });
    vi.mocked(api.fetchLatestUpdates).mockResolvedValue({
      limit: 10,
      nextBefore: null,
      nextAfter: null,
      updates: [],
    });
    vi.mocked(api.fetchLatestContracts).mockResolvedValue({
      limit: 10,
      nextBefore: null,
      nextAfter: null,
      contracts: [],
    });
    vi.mocked(api.fetchTemplates).mockResolvedValue({ templates: [] });

    await renderAt('/namespaces/1220abcd');

    expect(await screen.findByRole('link', { name: 'Party 01::1220abcd' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Party 11::1220abcd' })).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Older' }));

    expect(await screen.findByRole('link', { name: 'Party 11::1220abcd' })).toBeInTheDocument();
    expect(vi.mocked(api.fetchNamespaceParties)).toHaveBeenLastCalledWith('1220abcd', {
      before: 'Party 10::1220abcd',
      limit: 10,
    });
  });
});
