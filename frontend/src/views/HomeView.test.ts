import { cleanup, render, screen, within } from '@testing-library/vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HomeView from './HomeView.vue';

const fetchLatestUpdatesMock = vi.hoisted(() => vi.fn());
const fetchLatestTokenTransfersMock = vi.hoisted(() => vi.fn());

vi.mock('../lib/api', () => ({
  fetchLatestUpdates: fetchLatestUpdatesMock,
  fetchLatestTokenTransfers: fetchLatestTokenTransfersMock,
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

    expect(screen.getByRole('heading', { name: 'Latest Updates' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Latest Trades' })).toBeInTheDocument();
    expect(within(updatesTable).getAllByRole('row')).toHaveLength(8);
    expect(within(tradesTable).getAllByRole('row')).toHaveLength(8);
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
    expect(within(updatesTable).getByRole('link', { name: 'View all' })).toHaveAttribute('href', '/updates');
    expect(within(tradesTable).getByRole('link', { name: 'View all' })).toHaveAttribute('href', '/tokens');
    expect(within(updatesTable).queryByText('Est. USD')).not.toBeInTheDocument();
    expect(within(tradesTable).queryByRole('columnheader', { name: 'Nodes' })).not.toBeInTheDocument();
    expect(fetchLatestUpdatesMock).toHaveBeenCalledWith(6, {});
    expect(fetchLatestTokenTransfersMock).toHaveBeenCalledWith(6, {});
  });
});
