import { cleanup, fireEvent, render, screen } from '@testing-library/vue';
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

vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TokenTransfersBrowser', () => {
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
