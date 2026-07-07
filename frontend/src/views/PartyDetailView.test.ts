import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PartyDetailView from './PartyDetailView.vue';
import * as api from '../lib/api';

vi.mock('../lib/api', () => ({
  fetchPartyDetail: vi.fn(),
  fetchPartyUpdates: vi.fn(),
  fetchPartyContracts: vi.fn(),
  fetchTemplates: vi.fn(),
}));

async function renderAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/parties/:partyId', component: PartyDetailView, props: true }],
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

describe('PartyDetailView', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows a loading state before the party detail resolves', async () => {
    vi.mocked(api.fetchPartyDetail).mockReturnValue(new Promise(() => undefined));

    await renderAt('/parties/Alice');

    expect(screen.getByText('Loading party detail...')).toBeInTheDocument();
  });

  it('renders a summary-first party detail page with inline paginated updates and contracts browsers', async () => {
    vi.mocked(api.fetchPartyDetail).mockResolvedValue({
      partyId: 'Alice',
      nodeCount: 2,
      recentUpdateCount: 2,
      recentContractCount: 2,
      nodes: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          recentUpdateCount: 1,
          recentContractCount: 1,
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
          nodeId: 'participant-1',
          label: 'Participant 1',
          eventOffset: '0000000000000001',
          updateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
          recordTime: '2026-07-01T12:00:00.000Z',
          parties: ['Alice', 'Bob'],
        },
      ],
      recentContracts: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          contractId: '00abc',
          templateId: 'Main:Asset',
          packageId: 'main-package',
          packageName: 'Main Package',
          packageVersion: '1.2.3',
          recordTime: '2026-07-01T12:00:00.000Z',
        },
      ],
      partyTopologyByNode: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          status: 'ok',
          errorMessage: null,
          partyToParticipants: [
            {
              participantId: 'participant-1',
              participantUid: 'participant-1::1220abc',
              permission: 'submission',
              synchronizerIds: [],
            },
          ],
          partyToKeyMappings: [
            {
              keyFingerprint: 'fingerprint-1',
              purpose: 'namespace',
              keyType: 'ed25519',
              synchronizerIds: [],
            },
          ],
        },
        {
          nodeId: 'participant-2',
          label: 'Participant 2',
          status: 'grpc_not_configured',
          errorMessage: null,
          partyToParticipants: [],
          partyToKeyMappings: [],
        },
      ],
    });
    vi.mocked(
      (api as { fetchPartyUpdates: (partyId: string, options?: unknown) => Promise<unknown> })
        .fetchPartyUpdates,
    ).mockResolvedValue({
      limit: 25,
      nextBefore: 'cursor-update-1',
      nextAfter: null,
      updates: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          eventOffset: '0000000000000001',
          updateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
          recordTime: '2026-07-01T12:00:00.000Z',
          parties: ['Alice', 'Bob'],
        },
      ],
    });
    vi.mocked(
      (api as { fetchPartyContracts: (partyId: string, options?: unknown) => Promise<unknown> })
        .fetchPartyContracts,
    ).mockImplementation(async (_partyId: string, options?: unknown) => {
      const typedOptions = options as
        | {
            before?: string;
            templates?: string[];
            hideSplice?: boolean;
            limit?: number;
          }
        | undefined;

      if (
        typedOptions?.before === 'cursor-contract-1' &&
        typedOptions?.templates?.[0] === 'Main:Asset' &&
        typedOptions?.hideSplice === true
      ) {
        return {
          limit: 25,
          nextBefore: null,
          nextAfter: 'cursor-contract-0',
          contracts: [
            {
              nodeId: 'participant-2',
              label: 'Participant 2',
              contractId: '00def',
              templateId: 'Main:Wallet',
              packageId: 'main-package-2',
              packageName: 'Main Package 2',
              packageVersion: '2.0.0',
              recordTime: '2026-07-01T11:59:00.000Z',
            },
          ],
        };
      }

      return {
        limit: 25,
        nextBefore: 'cursor-contract-1',
        nextAfter: null,
        contracts: [
          {
            nodeId: 'participant-1',
            label: 'Participant 1',
            contractId: '00abc',
            templateId: 'Main:Asset',
            packageId: 'main-package',
            packageName: 'Main Package',
            packageVersion: '1.2.3',
            recordTime: '2026-07-01T12:00:00.000Z',
          },
        ],
      };
    });
    vi.mocked(
      (api as { fetchTemplates: () => Promise<{ templates: Array<{ templateId: string }> }> }).fetchTemplates,
    ).mockResolvedValue({
      templates: [{ templateId: 'Main:Asset' }, { templateId: 'Splice.Amulet:Amulet' }],
    });

    const formatMock = vi
      .fn()
      .mockReturnValueOnce('Jul 1, 2026')
      .mockReturnValueOnce('12:00:00 PM')
      .mockReturnValueOnce('Jul 1, 2026')
      .mockReturnValueOnce('12:00:00 PM')
      .mockReturnValueOnce('Jul 1, 2026, 12:00:00 PM')
      .mockReturnValueOnce('Jul 1, 2026, 11:59:00 AM');
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      function MockDateTimeFormat() {
        return {
          format: formatMock,
        } as unknown as Intl.DateTimeFormat;
      } as unknown as typeof Intl.DateTimeFormat,
    );

    const { container } = await renderAt('/parties/Alice');

    expect(await screen.findByRole('heading', { name: 'Alice Party' })).toBeInTheDocument();
    expect(container.querySelector('.party-detail__sections')).not.toBeNull();
    expect(container.querySelector('.party-detail__summary-grid')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Back to overview' })).toHaveAttribute(
      'href',
      '/parties',
    );
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Observed Nodes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Party Topology' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recent Updates' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recent Contracts' })).toBeInTheDocument();
    expect(api.fetchPartyUpdates).toHaveBeenCalledWith('Alice');
    expect(api.fetchPartyContracts).toHaveBeenCalledWith('Alice', { limit: 25 });
    expect(screen.getAllByText('2')).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'Participant 1' })).toHaveAttribute(
      'href',
      '/nodes/participant-1',
    );
    expect(screen.getByRole('link', { name: 'Participant 2' })).toHaveAttribute(
      'href',
      '/nodes/participant-2',
    );
    expect(screen.getAllByText('gRPC')).toHaveLength(2);
    expect(screen.getByText('Party to Participant')).toBeInTheDocument();
    expect(screen.getByText('Party to Key')).toBeInTheDocument();
    expect(screen.getByText('participant-1::1220abc')).toBeInTheDocument();
    expect(screen.getByText('submission')).toBeInTheDocument();
    expect(screen.getByText('fingerprint-1')).toBeInTheDocument();
    expect(screen.getByText('namespace')).toBeInTheDocument();
    expect(screen.getByText('ed25519')).toBeInTheDocument();
    expect(screen.getByText('gRPC not configured for this node.')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: '0000000000000001' })).toHaveAttribute(
      'href',
      '/nodes/participant-1/updates/0000000000000001?from=party&partyId=Alice',
    );
    expect(screen.getByRole('link', { name: 'Alice' })).toHaveAttribute('href', '/parties/Alice');
    expect(screen.getByRole('link', { name: 'Bob' })).toHaveAttribute('href', '/parties/Bob');
    expect(screen.getByRole('link', { name: '00abc' })).toHaveAttribute(
      'href',
      '/nodes/participant-1/contracts/00abc',
    );
    expect(screen.getByText('Main')).toBeInTheDocument();
    expect(screen.getByText('Asset')).toBeInTheDocument();
    expect(screen.getAllByText('Jul 1, 2026').length).toBeGreaterThan(0);
    expect(screen.getAllByText('12:00:00 PM').length).toBeGreaterThan(0);
    expect(container.querySelector('a[href="/nodes/participant-1"]')).not.toBeNull();
    expect(
      container.querySelector('a[href="/nodes/participant-1/updates/0000000000000001?from=party&partyId=Alice"]'),
    ).not.toBeNull();
    expect(container.querySelector('a[href="/nodes/participant-1/contracts/00abc"]')).not.toBeNull();

    const updatesSection = screen.getByRole('heading', { name: 'Recent Updates' }).closest('section');
    const contractsSection = screen
      .getByRole('heading', { name: 'Recent Contracts' })
      .closest('section');

    expect(updatesSection).not.toBeNull();
    expect(contractsSection).not.toBeNull();

    const updatesScope = within(updatesSection!);
    const contractsScope = within(contractsSection!);

    expect(updatesScope.getByRole('button', { name: 'Advanced Filter' })).toBeInTheDocument();
    expect(contractsScope.getByRole('button', { name: 'Advanced Filter' })).toBeInTheDocument();
    expect(contractsScope.getByRole('button', { name: 'Older' })).not.toBeDisabled();

    await fireEvent.click(contractsScope.getByRole('button', { name: 'Advanced Filter' }));
    expect(await screen.findByText('Advanced Filter Parameters')).toBeInTheDocument();

    await fireEvent.update(contractsScope.getByRole('combobox', { name: 'Template ID' }), 'Main:Asset');
    await fireEvent.click(contractsScope.getByRole('button', { name: 'Add template filter' }));
    await fireEvent.click(contractsScope.getByRole('checkbox', { name: 'Hide Splice Templates' }));

    await waitFor(() =>
      expect(api.fetchPartyContracts).toHaveBeenLastCalledWith('Alice', {
        templates: ['Main:Asset'],
        hideSplice: true,
        limit: 25,
      }),
    );

    await fireEvent.click(contractsScope.getByRole('button', { name: 'Older' }));

    await waitFor(() =>
      expect(api.fetchPartyContracts).toHaveBeenLastCalledWith('Alice', {
        before: 'cursor-contract-1',
        templates: ['Main:Asset'],
        hideSplice: true,
        limit: 25,
      }),
    );
    expect(await screen.findByRole('link', { name: '00def' })).toHaveAttribute(
      'href',
      '/nodes/participant-2/contracts/00def',
    );
  });

  it('renders node-local topology empty and error states without breaking the party page', async () => {
    vi.mocked(api.fetchPartyDetail).mockResolvedValue({
      partyId: 'Alice',
      nodeCount: 1,
      recentUpdateCount: 1,
      recentContractCount: 1,
      nodes: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          recentUpdateCount: 1,
          recentContractCount: 1,
        },
      ],
      recentUpdates: [],
      recentContracts: [],
      partyTopologyByNode: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          status: 'ok',
          errorMessage: null,
          partyToParticipants: [],
          partyToKeyMappings: [],
        },
        {
          nodeId: 'participant-2',
          label: 'Participant 2',
          status: 'grpc_error',
          errorMessage: 'Topology read failed',
          partyToParticipants: [],
          partyToKeyMappings: [],
        },
      ],
    });
    vi.mocked(
      (api as { fetchPartyUpdates: (partyId: string, options?: unknown) => Promise<unknown> })
        .fetchPartyUpdates,
    ).mockResolvedValue({
      limit: 25,
      nextBefore: null,
      nextAfter: null,
      updates: [],
    });
    vi.mocked(
      (api as { fetchPartyContracts: (partyId: string, options?: unknown) => Promise<unknown> })
        .fetchPartyContracts,
    ).mockResolvedValue({
      limit: 25,
      nextBefore: null,
      nextAfter: null,
      contracts: [],
    });
    vi.mocked(
      (api as { fetchTemplates: () => Promise<{ templates: Array<{ templateId: string }> }> }).fetchTemplates,
    ).mockResolvedValue({
      templates: [],
    });

    await renderAt('/parties/Alice');

    expect(await screen.findByRole('heading', { name: 'Party Topology' })).toBeInTheDocument();
    expect(screen.getAllByText('Not Present').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Topology read failed')).toBeInTheDocument();
  });
});
