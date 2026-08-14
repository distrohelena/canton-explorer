import { cleanup, fireEvent, render, screen } from '@testing-library/vue';
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

vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('UpdatesBrowser', () => {
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
