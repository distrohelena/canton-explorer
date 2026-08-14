import { cleanup, fireEvent, render, screen } from '@testing-library/vue';
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
  },
}));

vi.mock('../lib/api', () => ({
  fetchLatestContracts: fetchLatestContractsMock,
  fetchNodeContracts: fetchNodeContractsMock,
  fetchNodeTemplates: fetchNodeTemplatesMock,
  fetchPartyContracts: fetchPartyContractsMock,
  fetchTemplates: fetchTemplatesMock,
}));

vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ContractsBrowser', () => {
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
