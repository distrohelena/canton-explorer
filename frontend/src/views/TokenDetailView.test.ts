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

    render(TokenDetailView, {
      props: {
        tokenId: 'canton-coin',
      },
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="typeof to === \'string\' ? to : to.path" v-bind="$attrs"><slot /></a>',
          },
        },
      },
    });

    expect(screen.getByText('Loading token detail...')).toBeInTheDocument();
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

    await waitFor(() => expect(fetchTokenTransfers).toHaveBeenNthCalledWith(1, 'canton-coin', 25, {}));

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

});
