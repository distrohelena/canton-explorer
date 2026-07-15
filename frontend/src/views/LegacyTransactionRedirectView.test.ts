import { cleanup, render, screen, waitFor } from '@testing-library/vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { router as applicationRouter } from '../router';
import { fetchSearchResults } from '../lib/api';
import type { SearchResultsResponse, SearchUpdateResult } from '../types/search';
import LegacyTransactionRedirectView from './LegacyTransactionRedirectView.vue';

vi.mock('../lib/api', () => ({
  fetchSearchResults: vi.fn(),
}));

function searchResults(updates: SearchUpdateResult[] = []): SearchResultsResponse {
  const emptyGroup = {
    items: [],
    displayedCount: 0,
    truncated: false,
    status: 'ok' as const,
    warnings: [],
  };

  return {
    query: 'example',
    updates: {
      items: updates,
      displayedCount: updates.length,
      truncated: false,
      status: 'ok',
      warnings: [],
    },
    contracts: emptyGroup,
    parties: emptyGroup,
    packages: {
      packageIds: emptyGroup,
      packageNames: emptyGroup,
    },
  };
}

async function renderAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/tx/:updateId', component: LegacyTransactionRedirectView, props: true },
      {
        path: '/nodes/:id/updates/:eventOffset',
        component: { template: '<div>Update Detail</div>' },
      },
      { path: '/search', component: { template: '<div>Search Results</div>' } },
    ],
  });

  await router.push(path);
  await router.isReady();

  render(
    {
      template: '<RouterView />',
    },
    {
      global: {
        plugins: [router],
      },
    },
  );

  return router;
}

describe('LegacyTransactionRedirectView', () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it('registers /tx/:updateId in the exported application router', () => {
    const resolved = applicationRouter.resolve('/tx/example');

    expect(resolved.matched).toHaveLength(1);
    expect(resolved.matched[0]?.components?.default).toBe(LegacyTransactionRedirectView);
  });

  it('replaces a matching legacy URL with the first update destination', async () => {
    vi.mocked(fetchSearchResults).mockResolvedValue(
      searchResults([
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          eventOffset: '17',
          updateId: 'example',
          recordTime: null,
          parties: [],
        },
        {
          nodeId: 'participant-2',
          label: 'Participant 2',
          eventOffset: '29',
          updateId: 'example',
          recordTime: null,
          parties: [],
        },
      ]),
    );

    const router = await renderAt('/tx/example');

    await waitFor(() => expect(fetchSearchResults).toHaveBeenCalledWith('example'));
    await waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/nodes/participant-1/updates/17'));
  });

  it('replaces an empty result with the matching search page', async () => {
    vi.mocked(fetchSearchResults).mockResolvedValue(searchResults());

    const router = await renderAt('/tx/missing-update');

    await waitFor(() => expect(fetchSearchResults).toHaveBeenCalledWith('missing-update'));
    await waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/search?q=missing-update'));
  });

  it('replaces a rejected search with the matching search page', async () => {
    vi.mocked(fetchSearchResults).mockRejectedValue(new Error('search unavailable'));

    const router = await renderAt('/tx/unavailable-update');

    await waitFor(() => expect(fetchSearchResults).toHaveBeenCalledWith('unavailable-update'));
    await waitFor(() =>
      expect(router.currentRoute.value.fullPath).toBe('/search?q=unavailable-update'),
    );
  });

  it('renders a resolving state while the search is pending', async () => {
    let resolveSearch!: (results: SearchResultsResponse) => void;
    vi.mocked(fetchSearchResults).mockReturnValue(
      new Promise((resolve) => {
        resolveSearch = resolve;
      }),
    );

    const router = await renderAt('/tx/pending-update');

    expect(await screen.findByText(/resolving/i)).toBeInTheDocument();
    expect(fetchSearchResults).toHaveBeenCalledWith('pending-update');
    expect(router.currentRoute.value.fullPath).toBe('/tx/pending-update');

    resolveSearch(searchResults());
    await waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/search?q=pending-update'));
  });
});
