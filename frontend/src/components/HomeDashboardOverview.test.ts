import { cleanup, fireEvent, render, screen } from '@testing-library/vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HomeDashboardOverview from './HomeDashboardOverview.vue';

const fetchActivityHistoryMock = vi.hoisted(() => vi.fn());
const fetchCantonCoinHistoryMock = vi.hoisted(() => vi.fn());
const fetchRecentActivePartiesMock = vi.hoisted(() => vi.fn());

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
              open: 1.25,
              high: 1.25,
              low: 1.25,
              close: 1.25,
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
    expect(await screen.findByRole('heading', { name: 'Transactions over time' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'CC price over time' })).toBeInTheDocument();
    const activityChart = await screen.findByRole('img', { name: 'Transactions over time chart' });
    const priceChart = await screen.findByRole('img', { name: 'Canton Coin price over time chart' });
    expect([...activityChart.querySelectorAll('.home-dashboard-overview__y-tick')].map((tick) => tick.textContent)).toEqual([
      '6', '5', '3', '2', '0',
    ]);
    expect([...priceChart.querySelectorAll('.home-dashboard-overview__y-tick')].map((tick) => tick.textContent)).toEqual([
      '1.25', '0.9375', '0.625', '0.3125', '0',
    ]);
    expect(screen.getByRole('heading', { name: 'Latest Canton Coin Price' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Active Parties (24h)' })).toBeInTheDocument();
    expect(await screen.findByText('1.25 USDT')).toBeInTheDocument();
    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '24h' })).toHaveAttribute('aria-pressed', 'true');
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
    expect(fetchCantonCoinHistoryMock).toHaveBeenCalledTimes(1);
    expect(fetchRecentActivePartiesMock).toHaveBeenCalledTimes(1);
  });
});
