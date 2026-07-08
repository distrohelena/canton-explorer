import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TokenDetailView from './TokenDetailView.vue';
import { fetchTokenDetail, fetchTokenHolders, fetchTokenTransfers } from '../lib/api';

vi.mock('../lib/api', () => ({
  fetchTokenDetail: vi.fn(),
  fetchTokenHolders: vi.fn(),
  fetchTokenTransfers: vi.fn(),
}));

async function renderAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/tokens/:tokenId', component: TokenDetailView, props: true },
      { path: '/tokens', component: { template: '<div>Tokens</div>' } },
      { path: '/tokens/transfers/:updateId', component: { template: '<div>Transfer Detail</div>' } },
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

describe('TokenDetailView', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.resetAllMocks();
  });

  it('shows a loading state before the token detail resolves', () => {
    vi.mocked(fetchTokenDetail).mockReturnValue(new Promise(() => undefined));
    vi.mocked(fetchTokenHolders).mockReturnValue(new Promise(() => undefined));
    vi.mocked(fetchTokenTransfers).mockReturnValue(new Promise(() => undefined));

    return renderAt('/tokens/canton-coin').then(() => {
      expect(screen.getByText('Loading token detail...')).toBeInTheDocument();
    });
  });

  it('renders overview, top holders, and paged recent transfers for a token', async () => {
    vi.mocked(fetchTokenDetail).mockResolvedValue({
      token: {
        tokenId: 'canton-coin',
        name: 'Canton Coin',
        symbol: null,
        source: 'pqs',
      },
      transfers: [],
    });
    vi.mocked(fetchTokenHolders).mockResolvedValue({
      tokenId: 'canton-coin',
      limit: 10,
      nextBefore: null,
      nextAfter: null,
      holders: [
        {
          partyId: 'Alice',
          amount: '100.0',
          nodes: [
            {
              nodeId: 'participant-1',
              label: 'CNQS App Provider',
            },
          ],
        },
        {
          partyId: 'Bob',
          amount: '80.0',
          nodes: [
            {
              nodeId: 'participant-2',
              label: 'CNQS Super Validator',
            },
          ],
        },
      ],
    });
    vi.mocked(fetchTokenTransfers)
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValueOnce({
        limit: 10,
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
      });

    const formatMock = vi
      .fn()
      .mockReturnValueOnce('Jul 7, 2026')
      .mockReturnValueOnce('9:00:00 AM')
      .mockReturnValueOnce('Jul 7, 2026')
      .mockReturnValueOnce('8:00:00 AM');
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      function MockDateTimeFormat() {
        return {
          format: formatMock,
        } as unknown as Intl.DateTimeFormat;
      } as unknown as typeof Intl.DateTimeFormat,
    );

    const { container, router } = await renderAt('/tokens/canton-coin');

    expect(await screen.findByRole('heading', { name: 'Canton Coin' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByText('Token ID')).toBeInTheDocument();
    expect(screen.getAllByText('canton-coin').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Top Holders' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Latest Transfers' })).toBeInTheDocument();
    expect(screen.getAllByText('PQS').length).toBeGreaterThan(0);

    const holdersTable = screen.getByRole('table', { name: 'Top token holders' });
    expect(within(holdersTable).getByRole('link', { name: 'Alice' })).toHaveAttribute('href', '/parties/Alice');
    expect(within(holdersTable).getByText('100.0')).toBeInTheDocument();
    expect(within(holdersTable).getByText('CNQS App Provider')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

    await waitFor(() => expect(fetchTokenTransfers).toHaveBeenNthCalledWith(1, 'canton-coin', 10, {}));

    const transfersTable = await screen.findByRole('table', { name: 'Latest token transfers' });
    expect(within(transfersTable).getByText('42.0')).toBeInTheDocument();
    expect(within(transfersTable).getByRole('link', { name: 'Alice' })).toHaveAttribute(
      'href',
      '/parties/Alice',
    );
    expect(within(transfersTable).getByRole('link', { name: 'Bob' })).toHaveAttribute('href', '/parties/Bob');
    expect(within(transfersTable).getByText('CNQS App Provider')).toBeInTheDocument();
    expect(within(transfersTable).getByText('CNQS Super Validator')).toBeInTheDocument();
    expect(within(transfersTable).getByText('Jul 7, 2026')).toBeInTheDocument();
    expect(within(transfersTable).getByText('9:00:00 AM')).toBeInTheDocument();
    expect(container.querySelector('a[href="/tokens"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Older' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Newer' })).toBeDisabled();

    const transferRow = container.querySelector('.tokens-page__row.node-updates__row--link');
    expect(transferRow).not.toBeNull();

    await fireEvent.click(transferRow as Element);

    await waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/tokens/transfers/token-update-2'));
    expect(await screen.findByText('Transfer Detail')).toBeInTheDocument();
  });

  it('paginates top holders with holder-specific cursors', async () => {
    vi.mocked(fetchTokenDetail).mockResolvedValue({
      token: {
        tokenId: 'canton-coin',
        name: 'Canton Coin',
        symbol: null,
        source: 'pqs',
      },
      transfers: [],
    });
    vi.mocked(fetchTokenHolders)
      .mockResolvedValueOnce({
        tokenId: 'canton-coin',
        limit: 10,
        nextBefore: 'holders-cursor-before-1',
        nextAfter: null,
        holders: [
          {
            partyId: 'Alice',
            amount: '100.0',
            nodes: [{ nodeId: 'participant-1', label: 'Participant 1' }],
          },
        ],
      })
      .mockResolvedValueOnce({
        tokenId: 'canton-coin',
        limit: 10,
        nextBefore: null,
        nextAfter: 'holders-cursor-after-1',
        holders: [
          {
            partyId: 'Bob',
            amount: '80.0',
            nodes: [{ nodeId: 'participant-2', label: 'Participant 2' }],
          },
        ],
      })
      .mockResolvedValueOnce({
        tokenId: 'canton-coin',
        limit: 10,
        nextBefore: 'holders-cursor-before-1',
        nextAfter: null,
        holders: [
          {
            partyId: 'Alice',
            amount: '100.0',
            nodes: [{ nodeId: 'participant-1', label: 'Participant 1' }],
          },
        ],
      });
    vi.mocked(fetchTokenTransfers).mockResolvedValue({
      limit: 10,
      nextBefore: null,
      nextAfter: null,
      transfers: [],
    });

    const { router } = await renderAt('/tokens/canton-coin');

    await screen.findByText('Alice');

    await fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() =>
      expect(fetchTokenHolders).toHaveBeenNthCalledWith(2, 'canton-coin', 10, {
        before: 'holders-cursor-before-1',
      }),
    );
    await waitFor(() =>
      expect(router.currentRoute.value.fullPath).toBe('/tokens/canton-coin?holdersBefore=holders-cursor-before-1'),
    );
    expect(await screen.findByText('Bob')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).not.toBeDisabled();

    await fireEvent.click(screen.getByRole('button', { name: 'Previous' }));

    await waitFor(() =>
      expect(fetchTokenHolders).toHaveBeenNthCalledWith(3, 'canton-coin', 10, {
        after: 'holders-cursor-after-1',
      }),
    );
    await waitFor(() =>
      expect(router.currentRoute.value.fullPath).toBe('/tokens/canton-coin?holdersAfter=holders-cursor-after-1'),
    );
    expect(await screen.findByText('Alice')).toBeInTheDocument();
  });

  it('changes the holders page size independently from transfer pagination', async () => {
    vi.mocked(fetchTokenDetail).mockResolvedValue({
      token: {
        tokenId: 'canton-coin',
        name: 'Canton Coin',
        symbol: null,
        source: 'pqs',
      },
      transfers: [],
    });
    vi.mocked(fetchTokenHolders)
      .mockResolvedValueOnce({
        tokenId: 'canton-coin',
        limit: 10,
        nextBefore: 'holders-cursor-before-1',
        nextAfter: null,
        holders: [
          {
            partyId: 'Alice',
            amount: '100.0',
            nodes: [{ nodeId: 'participant-1', label: 'Participant 1' }],
          },
        ],
      })
      .mockResolvedValueOnce({
        tokenId: 'canton-coin',
        limit: 50,
        nextBefore: null,
        nextAfter: null,
        holders: [
          {
            partyId: 'Bob',
            amount: '80.0',
            nodes: [{ nodeId: 'participant-2', label: 'Participant 2' }],
          },
        ],
      });
    vi.mocked(fetchTokenTransfers).mockResolvedValue({
      limit: 10,
      nextBefore: null,
      nextAfter: null,
      transfers: [],
    });

    const { router } = await renderAt('/tokens/canton-coin?holdersBefore=holders-cursor-before-1');

    await screen.findByText('Alice');

    const holdersSection = screen.getByRole('heading', { name: 'Top Holders' }).closest('section');
    if (!holdersSection) {
      throw new Error('Expected top holders section');
    }

    await fireEvent.update(within(holdersSection).getByRole('combobox', { name: 'Items per page' }), '50');

    await waitFor(() =>
      expect(fetchTokenHolders).toHaveBeenNthCalledWith(2, 'canton-coin', 50, {}),
    );
    await waitFor(() =>
      expect(router.currentRoute.value.fullPath).toBe('/tokens/canton-coin?holdersLimit=50'),
    );
    expect(await screen.findByText('Bob')).toBeInTheDocument();
  });

});
