import { cleanup, fireEvent, render, screen } from '@testing-library/vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HomeDashboardOverview from './HomeDashboardOverview.vue';

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
  fetchActivityHistory: fetchActivityHistoryMock,
  fetchCantonCoinHistory: fetchCantonCoinHistoryMock,
  fetchRecentActiveParties: fetchRecentActivePartiesMock,
}));

describe('HomeDashboardOverview', () => {
  beforeEach(() => {
    fetchActivityHistoryMock.mockResolvedValue({
      generatedAt: '2026-08-12T12:00:00.000Z',
      windowMinutes: 1440,
      nodes: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          status: 'healthy',
          totalUpdateCount: 128,
          latestActiveContractCount: 5,
          samples: [
            {
              timestamp: '2026-08-12T11:00:00.000Z',
              activityValue: 6,
              activeContractCount: 5,
              latestOffset: '10',
            },
          ],
        },
      ],
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
      dataStatus: 'ready',
      venues: [
        {
          id: 'okx',
          label: 'OKX',
          pair: 'CC-USDT',
          quote: 'USDT',
          status: 'ok',
          coverageStart: '2026-08-11T00:00:00.000Z',
          coverageEnd: '2026-08-12T00:00:00.000Z',
          candles: [
            {
              timestamp: '2026-08-12T00:00:00.000Z',
              open: 0.1,
              high: 0.1,
              low: 0.1,
              close: 0.1,
              volumeQuote: 100,
            },
          ],
          message: null,
        },
      ],
    });
    fetchRecentActivePartiesMock.mockResolvedValue({
      count: 42,
      windowStart: '2026-08-11T12:00:00.000Z',
      windowEnd: '2026-08-12T12:00:00.000Z',
      status: 'ok',
      error: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the two charts and the two full-width metrics panels', async () => {
    const { container } = render(HomeDashboardOverview);

    expect(container.querySelector('.home-dashboard-overview__metrics')).toBeNull();
    expect(screen.queryByText('Network overview')).not.toBeInTheDocument();
    expect(screen.queryByText('Network metrics')).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Transactions over time' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'CC price over time' })).toBeInTheDocument();
    const activityChart = await screen.findByRole('img', { name: 'Transactions over time chart' });
    const priceChart = await screen.findByRole('img', { name: 'Canton Coin price over time chart' });
    expect([...activityChart.querySelectorAll('.home-dashboard-overview__y-tick')].map((tick) => tick.textContent)).toEqual([
      '6', '5', '3', '2', '0',
    ]);
    expect([...priceChart.querySelectorAll('.home-dashboard-overview__y-tick')].map((tick) => tick.textContent)).toEqual([
      '0.12', '0.09', '0.06', '0.03', '0',
    ]);
    expect([...activityChart.querySelectorAll('.home-dashboard-overview__guide')].filter((guide) => guide.getAttribute('y1') === '150')).toHaveLength(1);
    expect([...priceChart.querySelectorAll('.home-dashboard-overview__guide')].filter((guide) => guide.getAttribute('y1') === '150')).toHaveLength(1);
    expect([...activityChart.querySelectorAll('.home-dashboard-overview__guide')].filter((guide) => guide.getAttribute('y1') === '14')).toHaveLength(1);
    expect([...priceChart.querySelectorAll('.home-dashboard-overview__guide')].filter((guide) => guide.getAttribute('y1') === '14')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Latest Canton Coin Price' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Active Parties (24h)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Transactions' })).toBeInTheDocument();
    expect(await screen.findByText('0.10 USDT')).toBeInTheDocument();
    expect(await screen.findByText('128')).toBeInTheDocument();
    expect(screen.getByText('0.0017 TPS in the last hour')).toBeInTheDocument();
    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '24h' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '30d' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('button', { name: '31d' })).not.toBeInTheDocument();
    expect(fetchActivityHistoryMock).toHaveBeenCalledWith(1);
    expect(fetchCantonCoinHistoryMock).toHaveBeenCalledWith('1D');
    expect(fetchRecentActivePartiesMock).toHaveBeenCalledWith(24);
  });

  it('reloads activity for the selected chart range while keeping daily market data', async () => {
    render(HomeDashboardOverview);

    await screen.findByRole('heading', { name: 'Transactions over time' });
    await fireEvent.click(screen.getByRole('button', { name: '7d' }));

    expect(fetchActivityHistoryMock).toHaveBeenLastCalledWith(7);
    expect(screen.getByRole('button', { name: '7d' })).toHaveAttribute('aria-pressed', 'true');
    expect(fetchRecentActivePartiesMock).toHaveBeenLastCalledWith(168);
    expect(screen.getByRole('heading', { name: 'Active Parties (7d)' })).toBeInTheDocument();
    expect(fetchCantonCoinHistoryMock).toHaveBeenCalledTimes(1);
    expect(fetchRecentActivePartiesMock).toHaveBeenCalledTimes(2);

    await fireEvent.click(screen.getByRole('button', { name: '30d' }));

    expect(fetchActivityHistoryMock).toHaveBeenLastCalledWith(30);
    expect(fetchRecentActivePartiesMock).toHaveBeenLastCalledWith(720);
    expect(screen.getByRole('heading', { name: 'Active Parties (30d)' })).toBeInTheDocument();
    expect(fetchCantonCoinHistoryMock).toHaveBeenCalledTimes(1);
    expect(fetchRecentActivePartiesMock).toHaveBeenCalledTimes(3);
  });

  it('renders market and recent parties while activity remains pending', async () => {
    const pendingActivity = deferred<Awaited<ReturnType<typeof fetchActivityHistoryMock>>>();
    fetchActivityHistoryMock.mockReturnValueOnce(pendingActivity.promise);

    render(HomeDashboardOverview);

    expect(await screen.findByText('0.10 USDT')).toBeInTheDocument();
    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(screen.getByText('Loading transaction activity…')).toBeInTheDocument();
    expect(fetchCantonCoinHistoryMock).toHaveBeenCalledTimes(1);
    expect(fetchRecentActivePartiesMock).toHaveBeenCalledTimes(1);
  });

  it('retries only the failed activity section', async () => {
    fetchActivityHistoryMock
      .mockRejectedValueOnce(new Error('Activity unavailable'))
      .mockRejectedValueOnce(new Error('Activity unavailable'));

    render(HomeDashboardOverview);

    expect(await screen.findByRole('button', { name: 'Retry activity' })).toBeInTheDocument();
    expect(fetchActivityHistoryMock).toHaveBeenCalledTimes(2);
    expect(fetchCantonCoinHistoryMock).toHaveBeenCalledTimes(1);
    expect(fetchRecentActivePartiesMock).toHaveBeenCalledTimes(1);

    await fireEvent.click(screen.getByRole('button', { name: 'Retry activity' }));

    expect(await screen.findByRole('img', { name: 'Transactions over time chart' })).toBeInTheDocument();
    expect(fetchActivityHistoryMock).toHaveBeenCalledTimes(3);
    expect(fetchCantonCoinHistoryMock).toHaveBeenCalledTimes(1);
    expect(fetchRecentActivePartiesMock).toHaveBeenCalledTimes(1);
  });
});
