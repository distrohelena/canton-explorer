import { cleanup, render, screen, waitFor, within } from '@testing-library/vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HomeView from './HomeView.vue';

const fetchLatestUpdatesMock = vi.hoisted(() => vi.fn());
const fetchLatestTokenTransfersMock = vi.hoisted(() => vi.fn());
const fetchActivityHistoryMock = vi.hoisted(() => vi.fn());
const fetchCantonCoinHistoryMock = vi.hoisted(() => vi.fn());
const fetchRecentActivePartiesMock = vi.hoisted(() => vi.fn());

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

vi.mock('../lib/api', () => ({
  fetchLatestUpdates: fetchLatestUpdatesMock,
  fetchLatestTokenTransfers: fetchLatestTokenTransfersMock,
  fetchActivityHistory: fetchActivityHistoryMock,
  fetchCantonCoinHistory: fetchCantonCoinHistoryMock,
  fetchRecentActiveParties: fetchRecentActivePartiesMock,
  fetchNodeTemplates: vi.fn(),
  fetchNodeUpdates: vi.fn(),
  fetchPartyUpdates: vi.fn(),
  fetchTemplates: vi.fn(),
}));

const routerPushMock = vi.hoisted(() => vi.fn());

vi.mock('vue-router', () => ({
  useRoute: () => ({
    fullPath: '/',
    path: '/',
    query: {},
  }),
  useRouter: () => ({ push: routerPushMock }),
}));

const updateEntries = Array.from({ length: 6 }, (_, index) => ({
  nodeId: 'participant/1',
  label: 'Participant 1',
  eventOffset: String(6 - index),
  updateId: `update-${6 - index}`,
  recordTime: `2026-07-01T12:0${index}:00.000Z`,
  parties: [`Party ${index + 1}`],
}));

const transferEntries = Array.from({ length: 6 }, (_, index) => ({
  rowId: `transfer-${index + 1}`,
  tokenId: 'Amulet',
  tokenName: 'Amulet',
  amount: String(index + 1),
  sender: `Sender ${index + 1}`,
  receiver: `Receiver ${index + 1}`,
  updateId: `transfer-update-${index + 1}`,
  recordTime: `2026-07-01T13:0${index}:00.000Z`,
  nodes: [{ nodeId: 'participant/1', label: 'Participant 1', eventOffset: String(index + 1) }],
}));

describe('HomeView', () => {
  beforeEach(() => {
    fetchLatestUpdatesMock.mockResolvedValue({
      limit: 6,
      nextBefore: null,
      nextAfter: null,
      updates: updateEntries,
    });
    fetchLatestTokenTransfersMock.mockResolvedValue({
      limit: 6,
      nextBefore: null,
      nextAfter: null,
      transfers: transferEntries,
    });
    fetchActivityHistoryMock.mockResolvedValue({
      generatedAt: '2026-07-01T14:00:00.000Z',
      windowMinutes: 1440,
      nodes: [],
    });
    fetchCantonCoinHistoryMock.mockResolvedValue({
      asset: {
        name: 'Canton Coin',
        symbol: 'CC',
        canonicalId: 'canton-network',
        network: 'Canton Network',
        kind: 'native',
      },
      interval: '1D',
      dataStatus: 'empty',
      venues: [],
    });
    fetchRecentActivePartiesMock.mockResolvedValue({
      count: 0,
      windowStart: '2026-06-30T14:00:00.000Z',
      windowEnd: '2026-07-01T14:00:00.000Z',
      status: 'ok',
      error: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders six-row compact previews with seventh-row view-all links', async () => {
    render(HomeView, {
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    });

    const updatesTable = await screen.findByRole('table', { name: 'Latest updates' });
    const tradesTable = await screen.findByRole('table', { name: 'Latest trades' });

    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Transactions over time' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'CC price over time' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Latest Updates' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Latest Trades' })).toBeInTheDocument();
    await waitFor(() => {
      expect(within(updatesTable).getAllByRole('row')).toHaveLength(8);
      expect(within(tradesTable).getAllByRole('row')).toHaveLength(8);
    });
    expect(within(updatesTable).getAllByRole('columnheader').map((header) => header.textContent?.trim())).toEqual([
      'Node',
      'Offset',
      'Record Time',
      'Parties',
    ]);
    expect(within(tradesTable).getAllByRole('columnheader').map((header) => header.textContent?.trim())).toEqual([
      'Token',
      'Amount',
      'From → To',
      'Record Time',
    ]);
    const updatesViewAllRow = within(updatesTable).getByRole('row', { name: 'View all' });
    const tradesViewAllRow = within(tradesTable).getByRole('row', { name: 'View all' });
    expect(updatesViewAllRow).toHaveAttribute('href', '/updates');
    expect(updatesViewAllRow).toHaveClass('node-updates__row--link');
    expect(tradesViewAllRow).toHaveAttribute('href', '/tokens');
    expect(tradesViewAllRow).toHaveClass('tokens-page__known-row--link');
    expect(screen.queryByRole('group', { name: 'Bottom latest transfers pagination' })).not.toBeInTheDocument();
    expect(within(updatesTable).queryByText('Est. USD')).not.toBeInTheDocument();
    expect(within(tradesTable).queryByRole('columnheader', { name: 'Nodes' })).not.toBeInTheDocument();
    expect(fetchLatestUpdatesMock).toHaveBeenCalledWith(6, {});
    expect(fetchLatestTokenTransfersMock).toHaveBeenCalledWith(6, {});
    expect(fetchActivityHistoryMock).toHaveBeenCalledWith(1);
    expect(fetchCantonCoinHistoryMock).toHaveBeenCalledWith('1D');
    expect(fetchRecentActivePartiesMock).toHaveBeenCalledWith(24);
  });

  it('keeps the latest tables visible while dashboard activity is pending', async () => {
    const pendingActivity = deferred<Awaited<ReturnType<typeof fetchActivityHistoryMock>>>();
    fetchActivityHistoryMock.mockReturnValueOnce(pendingActivity.promise);

    render(HomeView, {
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    });

    expect(await screen.findByRole('table', { name: 'Latest updates' })).toBeInTheDocument();
    expect(await screen.findByRole('table', { name: 'Latest trades' })).toBeInTheDocument();
    expect(screen.getByText('Loading transaction activity…')).toBeInTheDocument();
  });
});
