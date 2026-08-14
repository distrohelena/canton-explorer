import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { nextTick, reactive } from 'vue';
import type { LocationQueryRaw } from 'vue-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ContractsBrowser from './ContractsBrowser.vue';

const fetchLatestContractsMock = vi.hoisted(() => vi.fn());
const fetchNodeContractsMock = vi.hoisted(() => vi.fn());
const fetchNodeTemplatesMock = vi.hoisted(() => vi.fn().mockResolvedValue({ templates: [] }));
const fetchPartyContractsMock = vi.hoisted(() => vi.fn());
const fetchTemplatesMock = vi.hoisted(() => vi.fn().mockResolvedValue({ templates: [] }));
const route = vi.hoisted(() => ({
  fullPath:
    '/contracts?before=before-1&node=node-1&party=Alice&party=Bob&partyMode=and&template=Pkg%3AT&hideSplice=true&limit=30',
  query: {
    before: 'before-1',
    node: 'node-1',
    party: ['Alice', 'Bob'],
    partyMode: 'and',
    template: 'Pkg:T',
    hideSplice: 'true',
    limit: '30',
  } as LocationQueryRaw,
}));

vi.mock('../lib/api', () => ({
  fetchLatestContracts: fetchLatestContractsMock,
  fetchNodeContracts: fetchNodeContractsMock,
  fetchNodeTemplates: fetchNodeTemplatesMock,
  fetchPartyContracts: fetchPartyContractsMock,
  fetchTemplates: fetchTemplatesMock,
}));

vi.mock('vue-router', async () => {
  const { reactive } = await import('vue');
  const routeState = reactive(route);
  return {
    useRoute: () => routeState,
    useRouter: () => ({ push: vi.fn() }),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  route.fullPath =
    '/contracts?before=before-1&node=node-1&party=Alice&party=Bob&partyMode=and&template=Pkg%3AT&hideSplice=true&limit=30';
  route.query = {
    before: 'before-1',
    node: 'node-1',
    party: ['Alice', 'Bob'],
    partyMode: 'and',
    template: 'Pkg:T',
    hideSplice: 'true',
    limit: '30',
  };
});

describe('ContractsBrowser', () => {
  it('clears prior rows when its route query changes before the replacement request settles', async () => {
    let resolveReplacement!: (value: { limit: number; nextBefore: null; nextAfter: null; contracts: [] }) => void;
    const replacement = new Promise<{ limit: number; nextBefore: null; nextAfter: null; contracts: [] }>((resolve) => {
      resolveReplacement = resolve;
    });
    fetchLatestContractsMock
      .mockResolvedValueOnce({
        limit: 30,
        nextBefore: null,
        nextAfter: null,
        contracts: [{ contractId: 'old-contract', templateId: null }],
      })
      .mockReturnValueOnce(replacement);

    render(ContractsBrowser, {
      props: {
        scope: 'global',
        path: '/contracts',
        title: 'Contracts',
        advancedFilterId: 'contracts-filter',
        nodeOptions: [],
      },
      global: {
        stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } },
      },
    });

    expect(await screen.findByText('old-contract')).toBeInTheDocument();

    const reactiveRoute = reactive(route);
    reactiveRoute.query = {
      before: '', node: '', party: ['Carol'], partyMode: '', template: '', hideSplice: '', limit: '30',
    };
    reactiveRoute.fullPath = '/contracts?party=Carol';
    await nextTick();

    await waitFor(() => expect(fetchLatestContractsMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('old-contract')).not.toBeInTheDocument();
    expect(screen.getByText('Loading contracts...')).toBeInTheDocument();

    resolveReplacement({ limit: 30, nextBefore: null, nextAfter: null, contracts: [] });
  });

  it('retries once automatically, exposes a local Retry, and preserves the current query', async () => {
    fetchLatestContractsMock
      .mockRejectedValueOnce(new Error('first contracts failure'))
      .mockRejectedValueOnce(new Error('second contracts failure'))
      .mockResolvedValueOnce({
        limit: 30,
        nextBefore: null,
        nextAfter: null,
        contracts: [],
      });

    render(ContractsBrowser, {
      props: {
        scope: 'global',
        path: '/contracts',
        title: 'Contracts',
        advancedFilterId: 'contracts-filter',
        nodeOptions: [
          { id: 'node-1', label: 'Node 1' },
          { id: 'node-2', label: 'Node 2' },
        ],
      },
      global: {
        stubs: {
          RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
        },
      },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('second contracts failure');
    expect(fetchLatestContractsMock).toHaveBeenCalledTimes(2);
    expect(fetchLatestContractsMock).toHaveBeenLastCalledWith(30, {
      nodeIds: ['node-1'],
      before: 'before-1',
      parties: ['Alice', 'Bob'],
      partyMode: 'and',
      templates: ['Pkg:T'],
      hideSplice: true,
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Retry contracts' }));

    expect(await screen.findByText('No active contracts found for this node.')).toBeInTheDocument();
    expect(fetchLatestContractsMock).toHaveBeenCalledTimes(3);
    expect(fetchLatestContractsMock).toHaveBeenLastCalledWith(30, {
      nodeIds: ['node-1'],
      before: 'before-1',
      parties: ['Alice', 'Bob'],
      partyMode: 'and',
      templates: ['Pkg:T'],
      hideSplice: true,
    });
  });
});
