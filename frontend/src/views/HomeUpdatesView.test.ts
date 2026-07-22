import { cleanup, render, screen } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HomeUpdatesView from './HomeUpdatesView.vue';

vi.mock('../lib/api', () => ({
  fetchLatestUpdates: vi.fn().mockResolvedValue({
    limit: 10,
    nextBefore: null,
    nextAfter: null,
    updates: [
      {
        nodeId: 'participant-1',
        label: 'Participant 1',
        eventOffset: '1',
        updateId: 'update-1',
        recordTime: '2026-07-01T12:00:00.000Z',
        parties: ['Alice'],
      },
    ],
  }),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ fullPath: '/', query: {} }),
  useRouter: () => ({ push: vi.fn() }),
}));

describe('HomeUpdatesView', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the updates table with the Contracts-style header', async () => {
    render(HomeUpdatesView, {
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
    expect(screen.getByText('Updates', { selector: '.activity-home__eyebrow' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Latest Updates' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument();
    expect(await screen.findByRole('table', { name: 'Latest updates across all nodes' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Latest Contracts' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Nodes' })).not.toBeInTheDocument();
  });
});
