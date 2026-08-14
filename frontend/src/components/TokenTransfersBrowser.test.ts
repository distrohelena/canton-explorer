import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { nextTick, reactive } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TokenTransfersBrowser from './TokenTransfersBrowser.vue';

const fetchLatestTokenTransfersMock = vi.hoisted(() => vi.fn());
const fetchTokenTransfersMock = vi.hoisted(() => vi.fn());
const route = vi.hoisted(() => ({
  fullPath:
    '/tokens/transfers?before=before-1&fromParty=Alice&toParty=Bob&movementType=Transfer&amountGt=10&amountLt=20&limit=30',
  query: {
    before: 'before-1',
    fromParty: 'Alice',
    toParty: 'Bob',
    movementType: 'Transfer',
    amountGt: '10',
    amountLt: '20',
    limit: '30',
  },
}));

vi.mock('../lib/api', () => ({
  fetchLatestTokenTransfers: fetchLatestTokenTransfersMock,
  fetchTokenTransfers: fetchTokenTransfersMock,
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
    '/tokens/transfers?before=before-1&fromParty=Alice&toParty=Bob&movementType=Transfer&amountGt=10&amountLt=20&limit=30';
  route.query = {
    before: 'before-1',
    fromParty: 'Alice',
    toParty: 'Bob',
    movementType: 'Transfer',
    amountGt: '10',
    amountLt: '20',
    limit: '30',
  };
});

describe('TokenTransfersBrowser', () => {
  it('clears prior rows when its route query changes before the replacement request settles', async () => {
    let resolveReplacement!: (value: { limit: number; nextBefore: null; nextAfter: null; transfers: [] }) => void;
    const replacement = new Promise<{ limit: number; nextBefore: null; nextAfter: null; transfers: [] }>((resolve) => {
      resolveReplacement = resolve;
    });
    fetchLatestTokenTransfersMock
      .mockResolvedValueOnce({
        limit: 30,
        nextBefore: null,
        nextAfter: null,
        transfers: [{ rowId: 'old-transfer', updateId: 'old-update', tokenId: 'old-token', tokenName: 'Old token', nodes: [] }],
      })
      .mockReturnValueOnce(replacement);

    render(TokenTransfersBrowser, {
      props: {
        scope: 'global',
        path: '/tokens/transfers',
        title: 'Transfers',
      },
      global: {
        stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } },
      },
    });

    expect(await screen.findByText('Old token')).toBeInTheDocument();

    const reactiveRoute = reactive(route);
    reactiveRoute.query = { fromParty: 'Carol' };
    reactiveRoute.fullPath = '/tokens/transfers?fromParty=Carol';
    await nextTick();

    await waitFor(() => expect(fetchLatestTokenTransfersMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Old token')).not.toBeInTheDocument();
    expect(screen.getByText('Loading latest token transfers...')).toBeInTheDocument();

    resolveReplacement({ limit: 30, nextBefore: null, nextAfter: null, transfers: [] });
  });

  it('retries once automatically, exposes a local Retry, and preserves the current query', async () => {
    fetchLatestTokenTransfersMock
      .mockRejectedValueOnce(new Error('first transfers failure'))
      .mockRejectedValueOnce(new Error('second transfers failure'))
      .mockResolvedValueOnce({
        limit: 30,
        nextBefore: null,
        nextAfter: null,
        transfers: [],
      });

    render(TokenTransfersBrowser, {
      props: {
        scope: 'global',
        path: '/tokens/transfers',
        title: 'Transfers',
      },
      global: {
        stubs: {
          RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
        },
      },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('second transfers failure');
    expect(fetchLatestTokenTransfersMock).toHaveBeenCalledTimes(2);
    expect(fetchLatestTokenTransfersMock).toHaveBeenLastCalledWith(30, {
      before: 'before-1',
      fromParties: ['Alice'],
      toParties: ['Bob'],
      movementTypes: ['Transfer'],
      amountGt: '10',
      amountLt: '20',
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Retry transfers' }));

    expect(await screen.findByText('No token transfers available yet.')).toBeInTheDocument();
    expect(fetchLatestTokenTransfersMock).toHaveBeenCalledTimes(3);
    expect(fetchLatestTokenTransfersMock).toHaveBeenLastCalledWith(30, {
      before: 'before-1',
      fromParties: ['Alice'],
      toParties: ['Bob'],
      movementTypes: ['Transfer'],
      amountGt: '10',
      amountLt: '20',
    });
  });
});
