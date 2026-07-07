import { cleanup, render, screen } from '@testing-library/vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SearchResultsView from './SearchResultsView.vue';
import { fetchSearchResults } from '../lib/api';

vi.mock('../lib/api', () => ({
  fetchSearchResults: vi.fn(),
}));

async function renderAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/search', component: SearchResultsView },
      { path: '/nodes/:id/updates/:eventOffset', component: { template: '<div>Update Detail</div>' } },
      { path: '/nodes/:id/contracts/:contractId', component: { template: '<div>Contract Detail</div>' } },
      { path: '/parties/:partyId', component: { template: '<div>Party Detail</div>' } },
      { path: '/packages/:packageId', component: { template: '<div>Package Detail</div>' } },
      { path: '/packages/by-name/:packageName', component: { template: '<div>Package Family</div>' } },
    ],
  });

  router.push(path);
  await router.isReady();

  return render(
    {
      template: '<RouterView />',
    },
    {
      global: {
        plugins: [router],
      },
    },
  );
}

describe('SearchResultsView', () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it('stays idle on /search with no query string', async () => {
    await renderAt('/search');

    expect(screen.getByText('Enter a search query to begin.')).toBeInTheDocument();
    expect(fetchSearchResults).not.toHaveBeenCalled();
  });

  it('loads grouped search results and renders the existing destination links', async () => {
    vi.mocked(fetchSearchResults).mockResolvedValue({
      query: 'Alice',
      updates: {
        items: [
          {
            nodeId: 'participant-1',
            label: 'Participant 1',
            eventOffset: '39',
            updateId: 'abc123',
            recordTime: '2026-07-02T12:00:00.000Z',
            parties: ['Alice', 'Bob'],
          },
        ],
        displayedCount: 1,
        truncated: false,
        status: 'ok',
        warnings: [],
      },
      contracts: {
        items: [
          {
            nodeId: 'participant-1',
            label: 'Participant 1',
            contractId: '00abc',
            templateId: 'Main:Asset',
            createdRecordTime: '2026-07-02T11:00:00.000Z',
          },
        ],
        displayedCount: 1,
        truncated: false,
        status: 'ok',
        warnings: [],
      },
      parties: {
        items: [{ partyId: 'Alice', nodeIds: ['participant-1'] }],
        displayedCount: 1,
        truncated: false,
        status: 'ok',
        warnings: [],
      },
      packages: {
        packageIds: {
          items: [{ packageId: 'splice-amulet-v2', name: 'splice-amulet', version: '0.1.24' }],
          displayedCount: 1,
          truncated: false,
          status: 'ok',
          warnings: [],
        },
        packageNames: {
          items: [
            {
              name: 'splice-amulet',
              packages: [{ packageId: 'splice-amulet-v2', version: '0.1.24' }],
            },
          ],
          displayedCount: 1,
          truncated: false,
          status: 'ok',
          warnings: [],
        },
      },
    });

    await renderAt('/search?q=Alice');

    expect(await screen.findByRole('heading', { name: 'Search Results' })).toBeInTheDocument();
    expect(fetchSearchResults).toHaveBeenCalledWith('Alice');
    expect(screen.getByRole('heading', { name: 'Updates' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Contracts' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Parties' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Packages' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /39/ })).toHaveAttribute(
      'href',
      '/nodes/participant-1/updates/39',
    );
    expect(screen.getByRole('link', { name: /00abc/ })).toHaveAttribute(
      'href',
      '/nodes/participant-1/contracts/00abc',
    );
    expect(screen.getByRole('link', { name: 'Alice' })).toHaveAttribute('href', '/parties/Alice');
    expect(screen.getByRole('link', { name: /splice-amulet-v2/ })).toHaveAttribute(
      'href',
      '/packages/splice-amulet-v2',
    );
    expect(screen.getByRole('link', { name: 'splice-amulet' })).toHaveAttribute(
      'href',
      '/packages/by-name/splice-amulet',
    );
  });

  it('renders partial warnings for degraded result groups', async () => {
    vi.mocked(fetchSearchResults).mockResolvedValue({
      query: '39',
      updates: {
        items: [],
        displayedCount: 0,
        truncated: false,
        status: 'partial',
        warnings: ['Failed to search updates on Participant 2'],
      },
      contracts: {
        items: [],
        displayedCount: 0,
        truncated: false,
        status: 'ok',
        warnings: [],
      },
      parties: {
        items: [],
        displayedCount: 0,
        truncated: false,
        status: 'ok',
        warnings: [],
      },
      packages: {
        packageIds: {
          items: [],
          displayedCount: 0,
          truncated: false,
          status: 'ok',
          warnings: [],
        },
        packageNames: {
          items: [],
          displayedCount: 0,
          truncated: false,
          status: 'ok',
          warnings: [],
        },
      },
    });

    await renderAt('/search?q=39');

    expect(await screen.findByText('Failed to search updates on Participant 2')).toBeInTheDocument();
  });

  it('renders a clean no-match state when the grouped response is empty', async () => {
    vi.mocked(fetchSearchResults).mockResolvedValue({
      query: 'Missing',
      updates: { items: [], displayedCount: 0, truncated: false, status: 'ok', warnings: [] },
      contracts: { items: [], displayedCount: 0, truncated: false, status: 'ok', warnings: [] },
      parties: { items: [], displayedCount: 0, truncated: false, status: 'ok', warnings: [] },
      packages: {
        packageIds: { items: [], displayedCount: 0, truncated: false, status: 'ok', warnings: [] },
        packageNames: { items: [], displayedCount: 0, truncated: false, status: 'ok', warnings: [] },
      },
    });

    await renderAt('/search?q=Missing');

    expect(await screen.findByText('No matches found for "Missing".')).toBeInTheDocument();
  });
});
