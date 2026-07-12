import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TokensView from './TokensView.vue';
import { fetchLatestTokenTransfers, fetchTokens } from '../lib/api';
import type { TokensResponse } from '../types/tokens';

vi.mock('../lib/api', () => ({
  fetchTokens: vi.fn(),
  fetchLatestTokenTransfers: vi.fn(),
}));

function makeTokensResponse(
  tokens: TokensResponse['tokens'],
  overrides?: Partial<Omit<TokensResponse, 'tokens'>>,
): TokensResponse {
  return {
    limit: 10,
    nextBefore: null,
    nextAfter: null,
    tokens,
    ...overrides,
  };
}

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

function sectionForHeading(name: string): HTMLElement {
  const heading = screen.getByRole('heading', { name });
  const section = heading.closest('section');
  expect(section).not.toBeNull();
  return section as HTMLElement;
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
    vi.mocked(fetchTokens).mockResolvedValue(makeTokensResponse([
        {
          tokenId: 'Issuer::validator-license',
          name: 'Validator License',
          symbol: null,
          issuer: 'Issuer',
          source: 'pqs',
        },
      ]));
    vi.mocked(fetchLatestTokenTransfers).mockResolvedValue({
      limit: 10,
      nextBefore: 'cursor-token-0',
      nextAfter: null,
      transfers: [
        {
          rowId: 'token-update-2:#0:5:Create',
          movementType: 'Create',
          source: 'pqs_inferred_holding_v2',
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
    expect(screen.getAllByText('Validator License').length).toBeGreaterThan(0);
    expect(screen.getByText('Issuer')).toBeInTheDocument();
    expect(screen.getAllByText('PQS').length).toBeGreaterThan(0);
    expect(screen.queryByText('Issuer::validator-license')).not.toBeInTheDocument();

    const transfersTable = await screen.findByRole('table', { name: 'Latest token transfers' });
    expect(within(transfersTable).getByText('Nodes')).toBeInTheDocument();
    expect(within(transfersTable).queryByText('Update')).not.toBeInTheDocument();
    expect(within(transfersTable).getByText('Participant 2')).toBeInTheDocument();
    expect(within(transfersTable).getByText('Create')).toBeInTheDocument();
    expect(within(transfersTable).getByText('42.0')).toBeInTheDocument();
    expect(within(transfersTable).getByRole('link', { name: 'Alice' })).toHaveAttribute('href', '/parties/Alice');
    expect(within(transfersTable).getByRole('link', { name: 'Bob' })).toHaveAttribute('href', '/parties/Bob');
    const transfersBrowserSection = sectionForHeading('Latest Transfers');
    expect(within(transfersBrowserSection).getByRole('button', { name: 'Older' })).not.toBeDisabled();
    expect(within(transfersBrowserSection).getByRole('button', { name: 'Newer' })).toBeDisabled();
    expect(fetchLatestTokenTransfers).toHaveBeenCalledWith(10, {});
  });

  it('prefers token symbols over verbose names in known token cards', async () => {
    vi.mocked(fetchTokens).mockResolvedValue(makeTokensResponse([
      {
        tokenId: 'VaultAdmin::vUSDCx-SHARE',
        name: 'USDCx Test Vault deployment Share',
        symbol: 'vUSDCx-SHARE',
        issuer: 'VaultAdmin',
        source: 'pqs',
      },
    ]));
    vi.mocked(fetchLatestTokenTransfers).mockResolvedValue({
      limit: 10,
      nextBefore: null,
      nextAfter: null,
      transfers: [],
    });

    await renderAt('/tokens');

    expect(await screen.findByRole('heading', { name: 'Known Tokens' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /vUSDCx-SHARE/i })).toBeInTheDocument();
    expect(screen.getByText('VaultAdmin')).toBeInTheDocument();
    expect(screen.queryByText('USDCx Test Vault deployment Share')).not.toBeInTheDocument();
  });

  it('navigates to the party detail page from transfer parties', async () => {
    vi.mocked(fetchTokens).mockResolvedValue(makeTokensResponse([
        {
          tokenId: 'canton-coin',
          name: 'Canton Coin',
          symbol: null,
          issuer: null,
          source: 'pqs',
        },
      ]));
    vi.mocked(fetchLatestTokenTransfers).mockResolvedValue({
      limit: 25,
      nextBefore: null,
      nextAfter: null,
      transfers: [
        {
          rowId: 'token-update-2:#0:5:Create',
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
    vi.mocked(fetchTokens).mockResolvedValue(makeTokensResponse([
        {
          tokenId: 'canton-coin',
          name: 'Canton Coin',
          symbol: null,
          issuer: null,
          source: 'pqs',
        },
      ]));
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

  it('paginates known tokens independently from the transfer feed', async () => {
    vi.mocked(fetchTokens)
      .mockResolvedValueOnce(
        makeTokensResponse(
          [
            {
              tokenId: 'Issuer-A::Alpha',
              name: 'Alpha',
              symbol: null,
              issuer: 'Issuer-A',
              source: 'pqs',
            },
          ],
          {
            limit: 1,
            nextBefore: 'tokens-cursor-before-1',
          },
        ),
      )
      .mockResolvedValueOnce(
        makeTokensResponse(
          [
            {
              tokenId: 'Issuer-B::Beta',
              name: 'Beta',
              symbol: null,
              issuer: 'Issuer-B',
              source: 'pqs',
            },
          ],
          {
            limit: 1,
            nextAfter: 'tokens-cursor-after-1',
          },
        ),
      );
    vi.mocked(fetchLatestTokenTransfers).mockResolvedValue({
      limit: 10,
      nextBefore: null,
      nextAfter: null,
      transfers: [],
    });

    const { router } = await renderAt('/tokens');

    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    expect(fetchTokens).toHaveBeenNthCalledWith(1, {
      before: undefined,
      after: undefined,
      limit: 10,
      names: [],
      excludeNames: [],
      issuers: [],
    });

    const knownTokensSection = sectionForHeading('Known Tokens');

    await fireEvent.click(within(knownTokensSection).getByRole('button', { name: 'Older' }));

    await waitFor(() =>
      expect(fetchTokens).toHaveBeenNthCalledWith(2, {
        before: 'tokens-cursor-before-1',
        after: undefined,
        limit: 10,
        names: [],
        excludeNames: [],
        issuers: [],
      }),
    );
    await waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/tokens?tokensBefore=tokens-cursor-before-1'));
    expect(await screen.findByText('Beta')).toBeInTheDocument();

    await fireEvent.click(within(knownTokensSection).getByRole('button', { name: 'Newer' }));

    await waitFor(() =>
      expect(fetchTokens).toHaveBeenNthCalledWith(3, {
        before: undefined,
        after: 'tokens-cursor-after-1',
        limit: 10,
        names: [],
        excludeNames: [],
        issuers: [],
      }),
    );
    await waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/tokens?tokensAfter=tokens-cursor-after-1'));
  });

  it('navigates to the token detail page from a known token card', async () => {
    vi.mocked(fetchTokens).mockResolvedValue(makeTokensResponse([
        {
          tokenId: 'canton-coin',
          name: 'Canton Coin',
          symbol: null,
          issuer: null,
          source: 'pqs',
        },
      ]));
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
    vi.mocked(fetchTokens).mockResolvedValue(makeTokensResponse([
        {
          tokenId: 'canton-coin',
          name: 'Canton Coin',
          symbol: null,
          issuer: null,
          source: 'pqs',
        },
      ]));
    vi.mocked(fetchLatestTokenTransfers).mockResolvedValue({
      limit: 25,
      nextBefore: null,
      nextAfter: null,
      transfers: [
        {
          rowId: 'token-update-2:#0:5:Create',
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
    vi.mocked(fetchTokens).mockResolvedValue(makeTokensResponse([
        {
          tokenId: 'canton-coin',
          name: 'Canton Coin',
          symbol: null,
          issuer: null,
          source: 'pqs',
        },
      ]));
    vi.mocked(fetchLatestTokenTransfers).mockResolvedValue({
      limit: 25,
      nextBefore: null,
      nextAfter: null,
      transfers: [
        {
          rowId: 'token-update-2:#0:5:Create',
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

    await waitFor(() =>
      expect(router.currentRoute.value.fullPath).toBe(
        '/tokens/transfers/token-update-2%3A%230%3A5%3ACreate',
      ),
    );
    expect(await screen.findByText('Transfer Detail')).toBeInTheDocument();
  });

  it('paginates the token transfer feed with opaque cursors', async () => {
    vi.mocked(fetchTokens).mockResolvedValue(makeTokensResponse([
        {
          tokenId: 'canton-coin',
          name: 'Canton Coin',
          symbol: null,
          issuer: null,
          source: 'pqs',
        },
      ]));
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

    expect((await screen.findAllByText('Canton Coin')).length).toBeGreaterThan(0);

    await screen.findByRole('table', { name: 'Latest token transfers' });
    const transfersBrowserSection = sectionForHeading('Latest Transfers');

    await fireEvent.click(within(transfersBrowserSection).getByRole('button', { name: 'Older' }));

    await waitFor(() =>
      expect(fetchLatestTokenTransfers).toHaveBeenNthCalledWith(2, 10, { before: 'cursor-token-0' }),
    );
    await waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/tokens?before=cursor-token-0'));
    expect(await screen.findByText('Participant 1')).toBeInTheDocument();
    expect(within(transfersBrowserSection).getByRole('button', { name: 'Newer' })).not.toBeDisabled();

    await fireEvent.click(within(transfersBrowserSection).getByRole('button', { name: 'Newer' }));

    await waitFor(() =>
      expect(fetchLatestTokenTransfers).toHaveBeenNthCalledWith(3, 10, { after: 'cursor-token-1' }),
    );
    await waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/tokens?after=cursor-token-1'));
    expect(await screen.findByText('Participant 2')).toBeInTheDocument();
  });

  it('renders all observing nodes on separate lines for a deduped transfer', async () => {
    vi.mocked(fetchTokens).mockResolvedValue(makeTokensResponse([
        {
          tokenId: 'canton-coin',
          name: 'Canton Coin',
          symbol: null,
          issuer: null,
          source: 'pqs',
        },
      ]));
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
    vi.mocked(fetchTokens).mockResolvedValue(makeTokensResponse([
        {
          tokenId: 'canton-coin',
          name: 'Canton Coin',
          symbol: null,
          issuer: null,
          source: 'pqs',
        },
      ]));
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

    expect((await screen.findAllByText('Canton Coin')).length).toBeGreaterThan(0);

    const transfersBrowserSection = sectionForHeading('Latest Transfers');
    expect(fetchLatestTokenTransfers).toHaveBeenNthCalledWith(1, 10, {
      fromParties: ['Alice'],
      toParties: ['Bob'],
    });
    expect(
      within(transfersBrowserSection).getByRole('button', { name: 'Advanced Filter' }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('heading', { name: 'Advanced Filter Parameters' })).toBeInTheDocument();
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bob').length).toBeGreaterThan(0);
  });

  it('passes amount bounds from URL state through the latest transfer query', async () => {
    vi.mocked(fetchTokens).mockResolvedValue(makeTokensResponse([
        {
          tokenId: 'canton-coin',
          name: 'Canton Coin',
          symbol: null,
          issuer: null,
          source: 'pqs',
        },
      ]));
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

    expect((await screen.findAllByText('Canton Coin')).length).toBeGreaterThan(0);

    const transfersBrowserSection = sectionForHeading('Latest Transfers');
    expect(fetchLatestTokenTransfers).toHaveBeenNthCalledWith(1, 10, {
      amountGt: '10',
      amountLt: '100',
    });
    expect(
      within(transfersBrowserSection).getByRole('button', { name: 'Advanced Filter' }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(container.querySelector('input[value="10"]')).not.toBeNull();
    expect(container.querySelector('input[value="100"]')).not.toBeNull();
  });

  it('passes movement type from URL state through the latest transfer query', async () => {
    vi.mocked(fetchTokens).mockResolvedValue(makeTokensResponse([
      {
        tokenId: 'canton-coin',
        name: 'Canton Coin',
        symbol: null,
        issuer: null,
        source: 'pqs',
      },
    ]));
    vi.mocked(fetchLatestTokenTransfers).mockResolvedValue({
      limit: 25,
      nextBefore: null,
      nextAfter: null,
      transfers: [
        {
          rowId: 'token-update-2:#0:1:Main:Holding:Create',
          movementType: 'Create',
          tokenId: 'canton-coin',
          tokenName: 'Canton Coin',
          amount: '42.0',
          sender: null,
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

    await renderAt('/tokens?movementType=Create&movementType=Mint');

    expect((await screen.findAllByText('Canton Coin')).length).toBeGreaterThan(0);

    const transfersBrowserSection = sectionForHeading('Latest Transfers');
    expect(fetchLatestTokenTransfers).toHaveBeenNthCalledWith(1, 10, {
      movementTypes: ['Create', 'Mint'],
    });
    expect(
      within(transfersBrowserSection).getByRole('button', { name: 'Advanced Filter' }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('heading', { name: 'Advanced Filter Parameters' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove movement type filter Create' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove movement type filter Mint' })).toBeInTheDocument();
  });

  it('opens the known tokens advanced filter from URL state and passes token filters', async () => {
    vi.mocked(fetchTokens).mockResolvedValue(makeTokensResponse([
      {
        tokenId: 'Issuer-A::Alpha Vault',
        name: 'Alpha Vault',
        symbol: 'ALPHA',
        issuer: 'Issuer-A',
        source: 'pqs',
      },
    ]));
    vi.mocked(fetchLatestTokenTransfers).mockResolvedValue({
      limit: 25,
      nextBefore: null,
      nextAfter: null,
      transfers: [],
    });

    await renderAt('/tokens?tokensName=Vault&tokensExcludeName=Beta&tokensIssuer=Issuer-A');

    expect(await screen.findByText('ALPHA')).toBeInTheDocument();

    const knownTokensSection = sectionForHeading('Known Tokens');
    expect(fetchTokens).toHaveBeenNthCalledWith(1, {
      before: undefined,
      after: undefined,
      limit: 10,
      names: ['Vault'],
      excludeNames: ['Beta'],
      issuers: ['Issuer-A'],
    });
    expect(
      within(knownTokensSection).getByRole('button', { name: 'Advanced Filter' }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByText('Vault').length).toBeGreaterThan(0);
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getAllByText('Issuer-A').length).toBeGreaterThan(0);
  });
});
