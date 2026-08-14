import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { nextTick, reactive } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import UpdatesBrowser from './UpdatesBrowser.vue';

const fetchLatestUpdatesMock = vi.hoisted(() => vi.fn());
const fetchNodeTemplatesMock = vi.hoisted(() => vi.fn().mockResolvedValue({ templates: [] }));
const fetchNodeUpdatesMock = vi.hoisted(() => vi.fn());
const fetchPartyUpdatesMock = vi.hoisted(() => vi.fn());
const fetchTemplatesMock = vi.hoisted(() => vi.fn().mockResolvedValue({ templates: [] }));
const route = vi.hoisted(() => ({
  fullPath: '/updates?before=before-1&party=Alice&party=Bob&partyMode=and&template=Pkg%3AT&hideSplice=true&limit=30',
  query: {
    before: 'before-1',
    party: ['Alice', 'Bob'],
    partyMode: 'and',
    template: 'Pkg:T',
    hideSplice: 'true',
    limit: '30',
  },
}));

vi.mock('../lib/api', () => ({
  fetchLatestUpdates: fetchLatestUpdatesMock,
  fetchNodeTemplates: fetchNodeTemplatesMock,
  fetchNodeUpdates: fetchNodeUpdatesMock,
  fetchPartyUpdates: fetchPartyUpdatesMock,
  fetchTemplates: fetchTemplatesMock,
}));

vi.mock('vue-router', async () => {
  const { reactive } = await import('vue');
  const routeState = reactive(route);
  return {
    useRoute: () => routeState,
    useRouter: () => ({ push: vi.fn() }),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  route.fullPath = '/updates?before=before-1&party=Alice&party=Bob&partyMode=and&template=Pkg%3AT&hideSplice=true&limit=30';
  route.query = {
    before: 'before-1',
    party: ['Alice', 'Bob'],
    partyMode: 'and',
    template: 'Pkg:T',
    hideSplice: 'true',
    limit: '30',
  };
});

describe('UpdatesBrowser', () => {
  it('clears prior rows when its route query changes before the replacement request settles', async () => {
    let resolveReplacement!: (value: { limit: number; nextBefore: null; nextAfter: null; updates: [] }) => void;
    const replacement = new Promise<{ limit: number; nextBefore: null; nextAfter: null; updates: [] }>((resolve) => {
      resolveReplacement = resolve;
    });
    fetchLatestUpdatesMock
      .mockResolvedValueOnce({
        limit: 30,
        nextBefore: null,
        nextAfter: null,
        updates: [{ eventOffset: 'old-update', parties: [] }],
      })
      .mockReturnValueOnce(replacement);

    render(UpdatesBrowser, {
      props: {
        scope: 'global',
        path: '/updates',
        title: 'Updates',
        sourceTag: 'updates',
        advancedFilterId: 'updates-filter',
      },
      global: {
        stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } },
      },
    });

    expect(await screen.findByText('old-update')).toBeInTheDocument();

    const reactiveRoute = reactive(route);
    reactiveRoute.query = { party: 'Carol' };
    reactiveRoute.fullPath = '/updates?party=Carol';
    await nextTick();

    await waitFor(() => expect(fetchLatestUpdatesMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('old-update')).not.toBeInTheDocument();
    expect(screen.getByText('Loading updates...')).toBeInTheDocument();

    resolveReplacement({ limit: 30, nextBefore: null, nextAfter: null, updates: [] });
  });

  it('retries a failed request once, keeps its error local, and retries with the current query', async () => {
    fetchLatestUpdatesMock
      .mockRejectedValueOnce(new Error('first failure'))
      .mockRejectedValueOnce(new Error('second failure'))
      .mockResolvedValueOnce({
        limit: 30,
        nextBefore: null,
        nextAfter: null,
        updates: [],
      });

    render(UpdatesBrowser, {
      props: {
        scope: 'global',
        path: '/updates',
        title: 'Updates',
        sourceTag: 'updates',
        advancedFilterId: 'updates-filter',
      },
      global: {
        stubs: {
          RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
        },
      },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('second failure');
    expect(fetchLatestUpdatesMock).toHaveBeenCalledTimes(2);
    expect(fetchLatestUpdatesMock).toHaveBeenLastCalledWith(30, {
      before: 'before-1',
      parties: ['Alice', 'Bob'],
      partyMode: 'and',
      templates: ['Pkg:T'],
      hideSplice: true,
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Retry updates' }));

    expect(await screen.findByText('No updates available yet.')).toBeInTheDocument();
    expect(fetchLatestUpdatesMock).toHaveBeenCalledTimes(3);
    expect(fetchLatestUpdatesMock).toHaveBeenLastCalledWith(30, {
      before: 'before-1',
      parties: ['Alice', 'Bob'],
      partyMode: 'and',
      templates: ['Pkg:T'],
      hideSplice: true,
    });
  });
});
