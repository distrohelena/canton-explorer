import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TokensView from './TokensView.vue';
import { fetchLatestTokenTransfers, fetchTokens } from '../lib/api';

vi.mock('../lib/api', () => ({
  fetchTokens: vi.fn(),
  fetchLatestTokenTransfers: vi.fn(),
}));

async function renderAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/tokens', component: TokensView },
      { path: '/tokens/transfers/:updateId', component: { template: '<div>Transfer Detail</div>' } },
      { path: '/tokens/:tokenId', component: { template: '<div>Token Detail</div>' } },
      { path: '/nodes/:id/updates/:eventOffset', component: { template: '<div>Update Detail</div>' } },
      { path: '/parties/:partyId', component: { template: '<div>Party Detail</div>' } },
    ],
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
      },
    },
  );

  return { ...rendered, router };
}

describe('TokensView', () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  it('shows loading states before token data resolves', async () => {
    vi.mocked(fetchTokens).mockReturnValue(new Promise(() => undefined));
    vi.mocked(fetchLatestTokenTransfers).mockReturnValue(new Promise(() => undefined));

    await renderAt('/tokens');

    expect(screen.getByText('Loading tokens...')).toBeInTheDocument();
    expect(screen.getByText('Loading latest token transfers...')).toBeInTheDocument();
  });

  it('renders known tokens and the latest transfer feed', async () => {
    vi.mocked(fetchTokens).mockResolvedValue({
      tokens: [
        {
          tokenId: 'canton-coin',
          name: 'Canton Coin',
          symbol: null,
          source: 'pqs',
        },
      ],
    });
    vi.mocked(fetchLatestTokenTransfers).mockResolvedValue({
      limit: 10,
      nextBefore: 'cursor-token-0',
      nextAfter: null,
      transfers: [
        {
          tokenId: 'canton-coin',
          tokenName: 'Canton Coin',
          amount: '42.0',
          sender: 'Alice',
          receiver: 'Bob',
          updateId: 'token-update-2',
          recordTime: '2026-07-07T12:00:00.000Z',
          nodes: [
            {
              nodeId: 'participant-2',
              label: 'Participant 2',
              eventOffset: '202',
            },
          ],
        },
      ],
    });
    await renderAt('/tokens');

    expect(await screen.findByRole('heading', { name: 'Known Tokens' })).toBeInTheDocument();
    expect(screen.getAllByText('Canton Coin').length).toBeGreaterThan(0);
    expect(screen.getAllByText('canton-coin').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PQS').length).toBeGreaterThan(0);

    const transfersTable = await screen.findByRole('table', { name: 'Latest token transfers' });
    expect(within(transfersTable).getByText('Nodes')).toBeInTheDocument();
    expect(within(transfersTable).queryByText('Update')).not.toBeInTheDocument();
    expect(within(transfersTable).getByText('Participant 2')).toBeInTheDocument();
    expect(within(transfersTable).getByText('42.0')).toBeInTheDocument();
    expect(within(transfersTable).getByRole('link', { name: 'Alice' })).toHaveAttribute('href', '/parties/Alice');
    expect(within(transfersTable).getByRole('link', { name: 'Bob' })).toHaveAttribute('href', '/parties/Bob');
    expect(screen.getByRole('button', { name: 'Older' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Newer' })).toBeDisabled();
    expect(fetchLatestTokenTransfers).toHaveBeenCalledWith(10, {});
  });

  it('navigates to the party detail page from transfer parties', async () => {
    vi.mocked(fetchTokens).mockResolvedValue({
      tokens: [
        {
          tokenId: 'canton-coin',
          name: 'Canton Coin',
          symbol: null,
          source: 'pqs',
        },
      ],
    });
    vi.mocked(fetchLatestTokenTransfers).mockResolvedValue({
      limit: 25,
      nextBefore: null,
      nextAfter: null,
      transfers: [
        {
          tokenId: 'canton-coin',
          tokenName: 'Canton Coin',
          amount: '42.0',
          sender: 'Alice',
          receiver: 'Bob',
          updateId: 'token-update-2',
          recordTime: '2026-07-07T12:00:00.000Z',
          nodes: [
            {
              nodeId: 'participant-2',
              label: 'Participant 2',
              eventOffset: '202',
            },
          ],
        },
      ],
    });

    const { router } = await renderAt('/tokens');

    await fireEvent.click(await screen.findByRole('link', { name: 'Alice' }));

    await waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/parties/Alice'));
    expect(await screen.findByText('Party Detail')).toBeInTheDocument();
  });

  it('changes the transfers page size and persists the selected limit in the URL', async () => {
    vi.mocked(fetchTokens).mockResolvedValue({
      tokens: [
        {
          tokenId: 'canton-coin',
          name: 'Canton Coin',
          symbol: null,
          source: 'pqs',
        },
      ],
    });
    vi.mocked(fetchLatestTokenTransfers)
      .mockResolvedValueOnce({
        limit: 10,
        nextBefore: null,
        nextAfter: null,
        transfers: [],
      })
      .mockResolvedValueOnce({
        limit: 50,
        nextBefore: null,
        nextAfter: null,
        transfers: [],
      });

    const { router } = await renderAt('/tokens');

    await screen.findByRole('heading', { name: 'Latest Transfers' });
    await fireEvent.update(screen.getByRole('combobox', { name: 'Items per page' }), '50');

    await waitFor(() => expect(fetchLatestTokenTransfers).toHaveBeenNthCalledWith(2, 50, {}));
    await waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/tokens?limit=50'));
  });

  it('navigates to the token detail page from a known token card', async () => {
    vi.mocked(fetchTokens).mockResolvedValue({
      tokens: [
        {
          tokenId: 'canton-coin',
          name: 'Canton Coin',
          symbol: null,
          source: 'pqs',
        },
      ],
    });
    vi.mocked(fetchLatestTokenTransfers).mockResolvedValue({
      limit: 25,
      nextBefore: null,
      nextAfter: null,
      transfers: [],
    });

    const { router } = await renderAt('/tokens');

    await fireEvent.click(await screen.findByRole('link', { name: /Canton Coin/i }));

    await waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/tokens/canton-coin'));
    expect(await screen.findByText('Token Detail')).toBeInTheDocument();
  });

  it('navigates to the token detail page from a transfer token link', async () => {
    vi.mocked(fetchTokens).mockResolvedValue({
      tokens: [
        {
          tokenId: 'canton-coin',
          name: 'Canton Coin',
          symbol: null,
          source: 'pqs',
        },
      ],
    });
    vi.mocked(fetchLatestTokenTransfers).mockResolvedValue({
      limit: 25,
      nextBefore: null,
      nextAfter: null,
      transfers: [
        {
          tokenId: 'canton-coin',
          tokenName: 'Canton Coin',
          amount: '42.0',
          sender: 'Alice',
          receiver: 'Bob',
          updateId: 'token-update-2',
          recordTime: '2026-07-07T12:00:00.000Z',
          nodes: [
            {
              nodeId: 'participant-2',
              label: 'Participant 2',
              eventOffset: '202',
            },
          ],
        },
      ],
    });

    const { router } = await renderAt('/tokens');
    const transfersTable = await screen.findByRole('table', { name: 'Latest token transfers' });

    await fireEvent.click(within(transfersTable).getByRole('link', { name: /Canton Coin/i }));

    await waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/tokens/canton-coin'));
    expect(await screen.findByText('Token Detail')).toBeInTheDocument();
  });

  it('navigates to the transfer detail page when clicking a transfer row', async () => {
    vi.mocked(fetchTokens).mockResolvedValue({
      tokens: [
        {
          tokenId: 'canton-coin',
          name: 'Canton Coin',
          symbol: null,
          source: 'pqs',
        },
      ],
    });
    vi.mocked(fetchLatestTokenTransfers).mockResolvedValue({
      limit: 25,
      nextBefore: null,
      nextAfter: null,
      transfers: [
        {
          tokenId: 'canton-coin',
          tokenName: 'Canton Coin',
          amount: '42.0',
          sender: 'Alice',
          receiver: 'Bob',
          updateId: 'token-update-2',
          recordTime: '2026-07-07T12:00:00.000Z',
          nodes: [
            {
              nodeId: 'participant-2',
              label: 'Participant 2',
              eventOffset: '202',
            },
          ],
        },
      ],
    });

    const { router, container } = await renderAt('/tokens');

    const row = container.querySelector('.tokens-page__row.node-updates__row--link');
    expect(row).not.toBeNull();

    await fireEvent.click(row as Element);

    await waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/tokens/transfers/token-update-2'));
    expect(await screen.findByText('Transfer Detail')).toBeInTheDocument();
  });

  it('paginates the token transfer feed with opaque cursors', async () => {
    vi.mocked(fetchTokens).mockResolvedValue({
      tokens: [
        {
          tokenId: 'canton-coin',
          name: 'Canton Coin',
          symbol: null,
          source: 'pqs',
        },
      ],
    });
    vi.mocked(fetchLatestTokenTransfers)
      .mockResolvedValueOnce({
        limit: 25,
        nextBefore: 'cursor-token-0',
        nextAfter: null,
        transfers: [
          {
            tokenId: 'canton-coin',
            tokenName: 'Canton Coin',
            amount: '42.0',
            sender: 'Alice',
            receiver: 'Bob',
            updateId: 'token-update-2',
            recordTime: '2026-07-07T12:00:00.000Z',
            nodes: [
              {
                nodeId: 'participant-2',
                label: 'Participant 2',
                eventOffset: '202',
              },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({
        limit: 25,
        nextBefore: null,
        nextAfter: 'cursor-token-1',
        transfers: [
          {
            tokenId: 'canton-coin',
            tokenName: 'Canton Coin',
            amount: '12.5',
            sender: 'Carol',
            receiver: 'Dave',
            updateId: 'token-update-1',
            recordTime: '2026-07-07T11:00:00.000Z',
            nodes: [
              {
                nodeId: 'participant-1',
                label: 'Participant 1',
                eventOffset: '101',
              },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({
        limit: 25,
        nextBefore: 'cursor-token-0',
        nextAfter: null,
        transfers: [
          {
            tokenId: 'canton-coin',
            tokenName: 'Canton Coin',
            amount: '42.0',
            sender: 'Alice',
            receiver: 'Bob',
            updateId: 'token-update-2',
            recordTime: '2026-07-07T12:00:00.000Z',
            nodes: [
              {
                nodeId: 'participant-2',
                label: 'Participant 2',
                eventOffset: '202',
              },
            ],
          },
        ],
      });

    const { router } = await renderAt('/tokens');

    await screen.findByText('Canton Coin');

    await fireEvent.click(screen.getByRole('button', { name: 'Older' }));

    await waitFor(() =>
      expect(fetchLatestTokenTransfers).toHaveBeenNthCalledWith(2, 10, { before: 'cursor-token-0' }),
    );
    await waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/tokens?before=cursor-token-0'));
    expect(await screen.findByText('Participant 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Newer' })).not.toBeDisabled();

    await fireEvent.click(screen.getByRole('button', { name: 'Newer' }));

    await waitFor(() =>
      expect(fetchLatestTokenTransfers).toHaveBeenNthCalledWith(3, 10, { after: 'cursor-token-1' }),
    );
    await waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/tokens?after=cursor-token-1'));
    expect(await screen.findByText('Participant 2')).toBeInTheDocument();
  });

  it('renders all observing nodes on separate lines for a deduped transfer', async () => {
    vi.mocked(fetchTokens).mockResolvedValue({
      tokens: [
        {
          tokenId: 'canton-coin',
          name: 'Canton Coin',
          symbol: null,
          source: 'pqs',
        },
      ],
    });
    vi.mocked(fetchLatestTokenTransfers).mockResolvedValue({
      limit: 25,
      nextBefore: null,
      nextAfter: null,
      transfers: [
        {
          tokenId: 'canton-coin',
          tokenName: 'Canton Coin',
          amount: '455660.1600000000',
          sender: 'Alice',
          receiver: 'Bob',
          updateId: 'shared-update-1',
          recordTime: '2026-07-07T12:54:23.000Z',
          nodes: [
            {
              nodeId: 'participant-1',
              label: 'CNQS App Provider',
              eventOffset: '29615',
            },
            {
              nodeId: 'participant-2',
              label: 'CNQS Super Validator',
              eventOffset: '58393',
            },
          ],
        },
      ],
    });

    const { container } = await renderAt('/tokens');
    const transfersTable = await screen.findByRole('table', { name: 'Latest token transfers' });
    expect(within(transfersTable).getAllByText(/CNQS /)).toHaveLength(2);
    expect(within(transfersTable).getByText('CNQS App Provider')).toBeInTheDocument();
    expect(within(transfersTable).getByText('CNQS Super Validator')).toBeInTheDocument();
    expect(container.querySelectorAll('.tokens-page__nodes-item')).toHaveLength(2);
  });

  it('opens the advanced filter from URL state and passes separate from/to party filters', async () => {
    vi.mocked(fetchTokens).mockResolvedValue({
      tokens: [
        {
          tokenId: 'canton-coin',
          name: 'Canton Coin',
          symbol: null,
          source: 'pqs',
        },
      ],
    });
    vi.mocked(fetchLatestTokenTransfers).mockResolvedValue({
      limit: 25,
      nextBefore: null,
      nextAfter: null,
      transfers: [
        {
          tokenId: 'canton-coin',
          tokenName: 'Canton Coin',
          amount: '42.0',
          sender: 'Alice',
          receiver: 'Bob',
          updateId: 'token-update-2',
          recordTime: '2026-07-07T12:00:00.000Z',
          nodes: [
            {
              nodeId: 'participant-2',
              label: 'Participant 2',
              eventOffset: '202',
            },
          ],
        },
      ],
    });

    await renderAt('/tokens?fromParty=Alice&toParty=Bob');

    await screen.findByText('Canton Coin');

    expect(fetchLatestTokenTransfers).toHaveBeenNthCalledWith(1, 10, {
      fromParties: ['Alice'],
      toParties: ['Bob'],
    });
    expect(screen.getByRole('button', { name: 'Advanced Filter' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('heading', { name: 'Advanced Filter Parameters' })).toBeInTheDocument();
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bob').length).toBeGreaterThan(0);
  });

  it('passes amount bounds from URL state through the latest transfer query', async () => {
    vi.mocked(fetchTokens).mockResolvedValue({
      tokens: [
        {
          tokenId: 'canton-coin',
          name: 'Canton Coin',
          symbol: null,
          source: 'pqs',
        },
      ],
    });
    vi.mocked(fetchLatestTokenTransfers).mockResolvedValue({
      limit: 25,
      nextBefore: null,
      nextAfter: null,
      transfers: [
        {
          tokenId: 'canton-coin',
          tokenName: 'Canton Coin',
          amount: '42.0',
          sender: 'Alice',
          receiver: 'Bob',
          updateId: 'token-update-2',
          recordTime: '2026-07-07T12:00:00.000Z',
          nodes: [
            {
              nodeId: 'participant-2',
              label: 'Participant 2',
              eventOffset: '202',
            },
          ],
        },
      ],
    });

    const { container } = await renderAt('/tokens?amountGt=10&amountLt=100');

    await screen.findByText('Canton Coin');

    expect(fetchLatestTokenTransfers).toHaveBeenNthCalledWith(1, 10, {
      amountGt: '10',
      amountLt: '100',
    });
    expect(screen.getByRole('button', { name: 'Advanced Filter' })).toHaveAttribute('aria-expanded', 'true');
    expect(container.querySelector('input[value="10"]')).not.toBeNull();
    expect(container.querySelector('input[value="100"]')).not.toBeNull();
  });
});
