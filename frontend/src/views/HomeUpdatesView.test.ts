import { cleanup, fireEvent, render, screen, within } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HomeUpdatesView from './HomeUpdatesView.vue';

const routerPush = vi.hoisted(() => vi.fn());

vi.mock('../lib/api', () => ({
  fetchLatestUpdates: vi.fn().mockResolvedValue({
    limit: 15,
    nextBefore: null,
    nextAfter: null,
    updates: [
      {
        nodeId: 'participant/1',
        label: 'Participant 1',
        eventOffset: '2',
        updateId: 'update-2',
        recordTime: '2026-07-01T12:00:00.000Z',
        parties: ['Alice'],
        estimatedTrafficUsd: '12.34',
      },
      {
        nodeId: 'participant/1',
        label: 'Participant 1',
        eventOffset: '1',
        updateId: 'update-0',
        recordTime: '2026-07-01T11:59:00.000Z',
        parties: ['Alice'],
        estimatedTrafficUsd: '10.00',
      },
    ],
  }),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ fullPath: '/', query: {} }),
  useRouter: () => ({ push: routerPush }),
}));

describe('HomeUpdatesView', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the updates table with the Contracts-style header', async () => {
    const { container } = render(HomeUpdatesView, {
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    });

    expect(await screen.findByRole('heading', { name: 'Updates' })).toBeInTheDocument();
    expect(screen.getByText('From Jul 1, 2026 to Jul 1, 2026')).toBeInTheDocument();
    expect(screen.queryByText('Updates', { selector: '.activity-home__eyebrow' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Latest Updates' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument();
    expect(screen.queryByText('Show')).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Offset' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Event Offset' })).not.toBeInTheDocument();
    const filterButton = screen.getByRole('button', { name: 'Advanced Filter' });
    expect(filterButton).toHaveAttribute('title', 'Advanced Filter');
    expect(filterButton).toHaveClass('node-updates__filter-button');
    expect(filterButton.querySelector('svg.node-updates__filter-icon')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(filterButton.querySelector('.node-updates__filter-icon path')).toHaveAttribute(
      'd',
      'M2 4h20l-8 8v6l-4 2v-8L2 4Z',
    );
    expect(filterButton).not.toHaveTextContent('Advanced Filter');
    const updatesTable = await screen.findByRole('table', { name: 'Latest updates across all nodes' });
    expect(container.querySelector('.activity-home__updates-section--global-updates')).toBeInTheDocument();
    const nodeLinks = within(updatesTable).getAllByRole('link', { name: 'Participant 1' });
    expect(nodeLinks).toHaveLength(2);
    for (const nodeLink of nodeLinks) {
      expect(nodeLink).toHaveClass('activity-home__updates-node', 'contract-detail__link');
      expect(nodeLink).toHaveAttribute('href', '/nodes/participant%2F1?from=updates');
    }
    expect(within(updatesTable).getByRole('link', { name: '2' })).toHaveClass('contract-detail__link');
    const partyLinks = within(updatesTable).getAllByRole('link', { name: 'Alice' });
    expect(partyLinks).toHaveLength(2);
    for (const partyLink of partyLinks) {
      expect(partyLink).toHaveClass('contract-detail__link');
    }
    const partyCopyButtons = within(updatesTable).getAllByRole('button', {
      name: 'Copy party ID Alice',
    });
    expect(partyCopyButtons).toHaveLength(2);
    for (const partyCopyButton of partyCopyButtons) {
      expect(partyCopyButton).toHaveClass('copy-to-clipboard-button');
    }
    const firstUpdateRow = within(updatesTable).getAllByRole('row')[1];
    routerPush.mockClear();
    await fireEvent.click(nodeLinks[0]);
    expect(routerPush).not.toHaveBeenCalled();
    await fireEvent.keyDown(nodeLinks[0], { key: 'Enter', code: 'Enter' });
    expect(routerPush).not.toHaveBeenCalled();
    await fireEvent.keyDown(nodeLinks[0], { key: ' ', code: 'Space' });
    expect(routerPush).not.toHaveBeenCalled();
    await fireEvent.click(firstUpdateRow);
    expect(routerPush).toHaveBeenCalledTimes(1);
    routerPush.mockClear();
    await fireEvent.keyDown(firstUpdateRow, { key: 'Enter', code: 'Enter' });
    expect(routerPush).toHaveBeenCalledTimes(1);
    routerPush.mockClear();
    await fireEvent.keyDown(firstUpdateRow, { key: ' ', code: 'Space' });
    expect(routerPush).toHaveBeenCalledTimes(1);
    expect(screen.getByText('$12.34')).toBeInTheDocument();
    const estimateHeader = screen.getByText('Est. USD');
    const sourcePill = screen.getByText('PQS');
    expect(sourcePill).toHaveClass('contracts-table__source-pill');
    expect(sourcePill.closest('.contracts-table__record-time-header')).toBe(
      estimateHeader.closest('.contracts-table__record-time-header'),
    );
    const bottomPager = screen.getByRole('group', { name: 'Bottom updates pagination' });
    expect(within(bottomPager).getByRole('button', { name: 'Newer' })).toBeDisabled();
    expect(within(bottomPager).getByRole('button', { name: 'Older' })).toBeDisabled();
    const newerButtons = screen.getAllByRole('button', { name: 'Newer' });
    const olderButtons = screen.getAllByRole('button', { name: 'Older' });
    expect(newerButtons).toHaveLength(2);
    expect(olderButtons).toHaveLength(2);
    for (const button of newerButtons) {
      expect(button).toHaveAttribute('title', 'Newer');
      expect(button.querySelector('svg.node-updates__pagination-icon--newer')).toBeInTheDocument();
    }
    for (const button of olderButtons) {
      expect(button).toHaveAttribute('title', 'Older');
      expect(button.querySelector('svg.node-updates__pagination-icon--older')).toBeInTheDocument();
    }
    expect(screen.queryByRole('heading', { name: 'Latest Contracts' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Nodes' })).not.toBeInTheDocument();
  });
});
