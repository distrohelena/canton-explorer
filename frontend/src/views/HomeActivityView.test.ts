import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/vue';
import { nextTick, reactive, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HomeActivityView from './HomeActivityView.vue';
import { fetchLatestUpdates, fetchTemplates } from '../lib/api';

const pushMock = vi.fn();
const routeState = reactive<{
  query: Record<string, unknown>;
  fullPath: string;
}>({
  query: {},
  fullPath: '/',
});

const history = ref({
  generatedAt: '2026-07-01T12:00:00.000Z',
  windowMinutes: 1440,
  nodes: [
    {
      nodeId: 'participant-1',
      label: 'Participant 1',
      status: 'healthy' as const,
      latestActiveContractCount: 15,
      samples: [
        {
          timestamp: '2026-07-01T11:55:00.000Z',
          activityValue: 1,
          activeContractCount: 13,
          latestOffset: '10',
        },
        {
          timestamp: '2026-07-01T12:00:00.000Z',
          activityValue: 3,
          activeContractCount: 15,
          latestOffset: '11',
        },
      ],
    },
  ],
});
const selectedDays = ref<1 | 7 | 30>(1);
const selectDays = vi.fn(async (days: 1 | 7 | 30) => {
  selectedDays.value = days;
  history.value = {
    ...history.value,
    windowMinutes: days * 1440,
  };
});

vi.mock('../lib/api', () => ({
  fetchTemplates: vi.fn().mockResolvedValue({
    templates: [
      { templateId: 'Main:Asset' },
      { templateId: 'Main:Wallet' },
      { templateId: 'Splice.Amulet:Amulet' },
    ],
  }),
  fetchLatestUpdates: vi.fn().mockResolvedValue({
    limit: 25,
    nextBefore: 'cursor-before-1',
    nextAfter: null,
    updates: [
      {
        nodeId: 'participant-2',
        label: 'Participant 2',
        eventOffset: '000000000000000002',
        updateId: '00000000000000000000000000000002',
        recordTime: '2026-07-01T12:01:00.000Z',
        parties: ['Bob'],
      },
      {
        nodeId: 'participant-1',
        label: 'Participant 1',
        eventOffset: '000000000000000001',
        updateId: '00000000000000000000000000000001',
        recordTime: '2026-07-01T12:00:00.000Z',
        parties: ['Alice'],
      },
    ],
  }),
}));

function resetMockState() {
  history.value = {
    generatedAt: '2026-07-01T12:00:00.000Z',
    windowMinutes: 1440,
    nodes: [
      {
        nodeId: 'participant-1',
        label: 'Participant 1',
        status: 'healthy',
        latestActiveContractCount: 15,
        samples: [
          {
            timestamp: '2026-07-01T11:55:00.000Z',
            activityValue: 1,
            activeContractCount: 13,
            latestOffset: '10',
          },
          {
            timestamp: '2026-07-01T12:00:00.000Z',
            activityValue: 3,
            activeContractCount: 15,
            latestOffset: '11',
          },
        ],
      },
    ],
  };
  selectedDays.value = 1;
  selectDays.mockClear();
  routeState.query = {};
  routeState.fullPath = '/';
}

function serializeQuery(query: Record<string, unknown>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === 'string') {
          params.append(key, entry);
        }
      }
      continue;
    }

    if (typeof value === 'string') {
      params.set(key, value);
    }
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : '';
  return `/${suffix}`;
}

vi.mock('../composables/useActivityHistory', () => ({
  useActivityHistory: () => ({
    history,
    loading: ref(false),
    error: ref(null),
    selectedDays,
    selectDays,
    refresh: vi.fn(),
  }),
}));

vi.mock('vue-router', () => ({
  useRoute: () => routeState,
  useRouter: () => ({
    push: pushMock,
  }),
}));

describe('HomeActivityView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    cleanup();
    resetMockState();
    pushMock.mockReset();
    pushMock.mockImplementation(async (location: string | { path?: string; query?: Record<string, unknown> }) => {
      if (typeof location === 'string') {
        routeState.fullPath = location;
        return;
      }

      routeState.query = { ...(location.query ?? {}) };
      routeState.fullPath = serializeQuery(routeState.query);
    });
    vi.mocked(fetchLatestUpdates).mockResolvedValue({
      limit: 25,
      nextBefore: 'cursor-before-1',
      nextAfter: null,
      updates: [
        {
          nodeId: 'participant-2',
          label: 'Participant 2',
          eventOffset: '000000000000000002',
          updateId: '00000000000000000000000000000002',
          recordTime: '2026-07-01T12:01:00.000Z',
          parties: ['Bob'],
        },
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          eventOffset: '000000000000000001',
          updateId: '00000000000000000000000000000001',
          recordTime: '2026-07-01T12:00:00.000Z',
          parties: ['Alice'],
        },
      ],
    });
  });

  it('renders per-node activity history on the home page', async () => {
    render(HomeActivityView, {
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    });

    expect(screen.getByRole('heading', { name: 'Network Activity' })).toBeInTheDocument();
    expect(screen.getByText('Participant 1')).toBeInTheDocument();
    expect(screen.getByText('15 active contracts')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '30' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /participant 1 activity history/i })).toHaveAttribute(
      'href',
      '/nodes/participant-1/updates',
    );
    expect(
      screen.queryByPlaceholderText('Search'),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Connected Nodes' })).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: '30' }));

    expect(selectDays).toHaveBeenCalledWith(30);
  });

  it('renders a merged latest-updates list across all nodes on the home page', async () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      function MockDateTimeFormat(
        _locale?: string | string[],
        options?: Intl.DateTimeFormatOptions,
      ) {
        return {
          format: (value: string | number | Date) => {
            const resolvedOptions = options ?? {};
            const isoValue = new Date(value).toISOString();

            if ('dateStyle' in resolvedOptions && resolvedOptions.dateStyle === 'medium') {
              return 'Jul 1, 2026';
            }

            if ('timeStyle' in resolvedOptions && resolvedOptions.timeStyle === 'medium') {
              return isoValue.includes('12:01:00.000Z') ? '12:01:00 PM' : '12:00:00 PM';
            }

            return 'Axis';
          },
        } as unknown as Intl.DateTimeFormat;
      } as unknown as typeof Intl.DateTimeFormat,
    );

    const { container } = render(HomeActivityView, {
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    });

    expect(await screen.findByRole('heading', { name: 'Latest Updates' })).toBeInTheDocument();
    expect(await screen.findByText('Participant 2')).toBeInTheDocument();
    expect(fetchLatestUpdates).toHaveBeenCalledWith(25);
    const updatesTable = screen.getByRole('table', { name: 'Latest updates across all nodes' });
    const updatesScope = within(updatesTable);

    expect(updatesScope.getByText('000000000000000002')).toBeInTheDocument();
    expect(updatesScope.getByText('Bob')).toBeInTheDocument();
    expect(updatesScope.getByText('Participant 1')).toBeInTheDocument();
    expect(updatesScope.getByText('000000000000000001')).toBeInTheDocument();
    expect(updatesScope.getByText('Alice')).toBeInTheDocument();
    expect(updatesScope.getAllByText('Jul 1, 2026')).toHaveLength(2);
    expect(updatesScope.getByText('12:01:00 PM')).toBeInTheDocument();
    expect(updatesScope.getByText('12:00:00 PM')).toBeInTheDocument();
    const firstRow = updatesTable.querySelector('.activity-home__updates-row.node-updates__row--link');
    expect(firstRow).not.toBeNull();
    expect(firstRow?.children).toHaveLength(4);
    expect(container.querySelector('a[href="/parties/Bob"]')).not.toBeNull();
    expect(container.querySelector('a[href="/parties/Alice"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Advanced Filter' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Newer' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Older' })).not.toBeDisabled();

    await fireEvent.click(firstRow as Element);

    expect(pushMock).toHaveBeenCalledWith(
      '/nodes/participant-2/updates/000000000000000002?from=updates',
    );
  });

  it('pages the merged latest-updates feed with opaque global cursors', async () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      function MockDateTimeFormat(
        _locale?: string | string[],
        options?: Intl.DateTimeFormatOptions,
      ) {
        return {
          format: (value: string | number | Date) => {
            const resolvedOptions = options ?? {};
            const isoValue = new Date(value).toISOString();

            if ('dateStyle' in resolvedOptions && resolvedOptions.dateStyle === 'medium') {
              return 'Jul 1, 2026';
            }

            if ('timeStyle' in resolvedOptions && resolvedOptions.timeStyle === 'medium') {
              if (isoValue.includes('12:01:00.000Z')) {
                return '12:01:00 PM';
              }

              if (isoValue.includes('11:59:00.000Z')) {
                return '11:59:00 AM';
              }

              return '12:00:00 PM';
            }

            return 'Axis';
          },
        } as unknown as Intl.DateTimeFormat;
      } as unknown as typeof Intl.DateTimeFormat,
    );

    vi.mocked(fetchLatestUpdates)
      .mockResolvedValueOnce({
        limit: 25,
        nextBefore: 'cursor-before-1',
        nextAfter: null,
        updates: [
          {
            nodeId: 'participant-2',
            label: 'Participant 2',
            eventOffset: '000000000000000002',
            updateId: '00000000000000000000000000000002',
            recordTime: '2026-07-01T12:01:00.000Z',
            parties: ['Bob'],
          },
          {
            nodeId: 'participant-1',
            label: 'Participant 1',
            eventOffset: '000000000000000001',
            updateId: '00000000000000000000000000000001',
            recordTime: '2026-07-01T12:00:00.000Z',
            parties: ['Alice'],
          },
        ],
      })
      .mockResolvedValueOnce({
        limit: 25,
        nextBefore: null,
        nextAfter: 'cursor-after-1',
        updates: [
          {
            nodeId: 'participant-1',
            label: 'Participant 1',
            eventOffset: '000000000000000000',
            updateId: '00000000000000000000000000000000',
            recordTime: '2026-07-01T11:59:00.000Z',
            parties: ['Carol'],
          },
        ],
      });

    render(HomeActivityView, {
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    });

    expect(await screen.findByText('Participant 2')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Older' }));

    await waitFor(() =>
      expect(fetchLatestUpdates).toHaveBeenLastCalledWith(25, {
        before: 'cursor-before-1',
      }),
    );
    expect(await screen.findByText('Carol')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Older' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Newer' })).not.toBeDisabled();
    expect(routeState.query.before).toBe('cursor-before-1');
  });

  it('applies advanced filter controls to the merged latest-updates feed', async () => {
    vi.mocked(fetchLatestUpdates).mockResolvedValue({
      limit: 25,
      nextBefore: null,
      nextAfter: null,
      updates: [],
    });

    render(HomeActivityView, {
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    });

    expect(await screen.findByRole('heading', { name: 'Latest Updates' })).toBeInTheDocument();
    expect(screen.queryByText('Advanced Filter Parameters')).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Advanced Filter' }));

    expect(await screen.findByText('Advanced Filter Parameters')).toBeInTheDocument();
    await fireEvent.update(screen.getByPlaceholderText('Party ID'), 'Alice');
    await fireEvent.click(screen.getByRole('button', { name: 'Add party filter' }));

    await waitFor(() =>
      expect(fetchLatestUpdates).toHaveBeenLastCalledWith(25, {
        parties: ['Alice'],
        partyMode: 'or',
      }),
    );
    expect(routeState.query.party).toEqual(['Alice']);
    expect(routeState.query.partyMode).toBe('or');

    await fireEvent.click(screen.getByRole('button', { name: 'AND' }));

    await waitFor(() =>
      expect(fetchLatestUpdates).toHaveBeenLastCalledWith(25, {
        parties: ['Alice'],
        partyMode: 'and',
      }),
    );
    expect(routeState.query.partyMode).toBe('and');

    await fireEvent.click(screen.getByRole('checkbox', { name: 'Hide Splice Offsets' }));

    expect(screen.getByRole('checkbox', { name: 'Hide Splice Offsets' })).toHaveClass(
      'node-updates__advanced-filter-checkbox',
    );

    await waitFor(() =>
      expect(fetchLatestUpdates).toHaveBeenLastCalledWith(25, {
        parties: ['Alice'],
        partyMode: 'and',
        hideSplice: true,
      }),
    );
    expect(routeState.query.hideSplice).toBe('true');
  });

  it('opens the advanced filter panel from URL-backed global query params', async () => {
    routeState.query = {
      party: ['Alice'],
      partyMode: 'and',
      hideSplice: 'true',
    };
    routeState.fullPath = serializeQuery(routeState.query);

    vi.mocked(fetchLatestUpdates).mockResolvedValue({
      limit: 25,
      nextBefore: null,
      nextAfter: null,
      updates: [],
    });

    render(HomeActivityView, {
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    });

    expect(await screen.findByRole('heading', { name: 'Latest Updates' })).toBeInTheDocument();
    expect(await screen.findByText('Advanced Filter Parameters')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'AND' })).toHaveClass(
      'node-updates__advanced-filter-mode--active',
    );
    expect(screen.getByRole('checkbox', { name: 'Hide Splice Offsets' })).toBeChecked();
    expect(fetchLatestUpdates).toHaveBeenCalledWith(25, {
      parties: ['Alice'],
      partyMode: 'and',
      hideSplice: true,
    });
  });

  it('adds a template filter from the advanced filter and persists it in the URL-backed query state', async () => {
    vi.mocked(fetchLatestUpdates).mockResolvedValue({
      limit: 25,
      nextBefore: null,
      nextAfter: null,
      updates: [],
    });

    render(HomeActivityView, {
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    });

    expect(await screen.findByRole('heading', { name: 'Latest Updates' })).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Advanced Filter' }));
    await waitFor(() => expect(fetchTemplates).toHaveBeenCalled());

    const input = screen.getByRole('combobox', { name: 'Template ID' });
    await fireEvent.focus(input);
    await fireEvent.update(input, 'wallet');
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await fireEvent.keyDown(input, { key: 'Enter' });

    await fireEvent.click(screen.getByRole('button', { name: 'Add template filter' }));

    await waitFor(() =>
      expect(fetchLatestUpdates).toHaveBeenLastCalledWith(25, {
        templates: ['Main:Wallet'],
      }),
    );

    expect(routeState.query.template).toEqual(['Main:Wallet']);
    expect(routeState.query.partyMode).toBeUndefined();
    expect(screen.getAllByText('Main:Wallet').length).toBeGreaterThan(0);
  });

  it('shows a left-side vertical scale for each activity chart', () => {
    const { container } = render(HomeActivityView, {
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    });

    const scaleLabels = Array.from(
      container.querySelectorAll('.activity-panel__scale-label'),
      (label) => label.textContent,
    );

    expect(scaleLabels).toEqual(['3', '1.5', '0']);
  });

  it('repositions chart points when the selected window changes', async () => {
    history.value = {
      generatedAt: '2026-07-01T12:00:00.000Z',
      windowMinutes: 1440,
      nodes: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          status: 'healthy',
          latestActiveContractCount: 15,
          samples: [
            {
              timestamp: '2026-05-20T12:00:00.000Z',
              activityValue: 1,
              activeContractCount: 11,
              latestOffset: '09',
            },
            {
              timestamp: '2026-06-21T12:00:00.000Z',
              activityValue: 2,
              activeContractCount: 13,
              latestOffset: '10',
            },
            {
              timestamp: '2026-07-01T12:00:00.000Z',
              activityValue: 3,
              activeContractCount: 15,
              latestOffset: '11',
            },
          ],
        },
      ],
    };

    const { container } = render(HomeActivityView, {
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    });

    const line = container.querySelector('.activity-panel__line');
    expect(line).not.toBeNull();
    const pointsBefore = line?.getAttribute('points');

    await fireEvent.click(screen.getByRole('button', { name: '30' }));
    await nextTick();

    expect(container.querySelector('.activity-panel__line')?.getAttribute('points')).not.toBe(
      pointsBefore,
    );
  });

  it('renders a visible chart segment when a node has only one activity bucket', () => {
    history.value = {
      generatedAt: '2026-07-01T12:00:00.000Z',
      windowMinutes: 1440,
      nodes: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          status: 'healthy',
          latestActiveContractCount: 15,
          samples: [
            {
              timestamp: '2026-07-01T12:00:00.000Z',
              activityValue: 0,
              activeContractCount: 15,
              latestOffset: '11',
            },
          ],
        },
      ],
    };

    const { container } = render(HomeActivityView, {
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    });

    expect(container.querySelector('.activity-panel__line')?.getAttribute('points')).toContain(' ');
  });

  it('keeps empty leading time visible when cached history is shorter than the selected window', () => {
    history.value = {
      generatedAt: '2026-07-01T12:00:00.000Z',
      windowMinutes: 43200,
      nodes: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          status: 'healthy',
          latestActiveContractCount: 15,
          samples: [
            {
              timestamp: '2026-07-01T11:55:00.000Z',
              activityValue: 1,
              activeContractCount: 13,
              latestOffset: '10',
            },
            {
              timestamp: '2026-07-01T12:00:00.000Z',
              activityValue: 3,
              activeContractCount: 15,
              latestOffset: '11',
            },
          ],
        },
      ],
    };
    selectedDays.value = 30;

    const { container } = render(HomeActivityView, {
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    });

    expect(container.querySelector('.activity-panel__line')?.getAttribute('points')).not.toMatch(
      /^0,/,
    );
  });

  it('shows chart start/end labels and hourly guides for the 1 day view', () => {
    history.value = {
      generatedAt: '2026-07-01T12:00:00.000Z',
      windowMinutes: 1440,
      nodes: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          status: 'healthy',
          latestActiveContractCount: 15,
          samples: [
            {
              timestamp: '2026-07-01T00:00:00.000Z',
              activityValue: 1,
              activeContractCount: 13,
              latestOffset: '10',
            },
            {
              timestamp: '2026-07-01T12:00:00.000Z',
              activityValue: 3,
              activeContractCount: 15,
              latestOffset: '11',
            },
          ],
        },
      ],
    };

    const { container } = render(HomeActivityView, {
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    });

    const expectedStartLabel = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(new Date('2026-06-30T12:00:00.000Z'));
    const expectedEndLabel = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date('2026-07-01T12:00:00.000Z'));

    expect(container.querySelectorAll('.activity-panel__guide')).toHaveLength(24);
    expect(container.querySelector('.activity-panel__axis-label--start')?.textContent).toBe(
      expectedStartLabel,
    );
    expect(container.querySelector('.activity-panel__axis-label--end')?.textContent).toBe(
      expectedEndLabel,
    );
  });

  it('drops to zero at the next trailing gap and then stays flat to the range end', () => {
    history.value = {
      generatedAt: '2026-07-03T12:00:00.000Z',
      windowMinutes: 10080,
      nodes: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          status: 'healthy',
          latestActiveContractCount: 15,
          samples: [
            {
              timestamp: '2026-07-01T00:00:00.000Z',
              activityValue: 8,
              activeContractCount: 13,
              latestOffset: '10',
            },
          ],
        },
      ],
    };
    selectedDays.value = 7;

    const { container } = render(HomeActivityView, {
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    });

    expect(container.querySelector('.activity-panel__line')?.getAttribute('points')).toBe(
      '205.71428571428572,5 251.42857142857142,91 320,91',
    );
    expect(container.querySelector('.activity-panel__axis-label--end')?.textContent).toBe('Jul 3');
  });

  it('keeps the final segment flat when the last sample is inside the closing bucket', () => {
    history.value = {
      generatedAt: '2026-07-03T12:00:00.000Z',
      windowMinutes: 1440,
      nodes: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          status: 'healthy',
          latestActiveContractCount: 15,
          samples: [
            {
              timestamp: '2026-07-03T11:45:00.000Z',
              activityValue: 4,
              activeContractCount: 15,
              latestOffset: '11',
            },
          ],
        },
      ],
    };
    selectedDays.value = 1;

    const { container } = render(HomeActivityView, {
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    });

    expect(container.querySelector('.activity-panel__line')?.getAttribute('points')).toBe(
      '316.6666666666667,5 320,5',
    );
  });

  it('fills missing interior hourly buckets with zero activity in the 1 day view', () => {
    history.value = {
      generatedAt: '2026-07-03T12:00:00.000Z',
      windowMinutes: 1440,
      nodes: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          status: 'healthy',
          latestActiveContractCount: 15,
          samples: [
            {
              timestamp: '2026-07-03T08:00:00.000Z',
              activityValue: 8,
              activeContractCount: 13,
              latestOffset: '10',
            },
            {
              timestamp: '2026-07-03T12:00:00.000Z',
              activityValue: 4,
              activeContractCount: 15,
              latestOffset: '11',
            },
          ],
        },
      ],
    };
    selectedDays.value = 1;

    const { container } = render(HomeActivityView, {
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    });

    expect(container.querySelector('.activity-panel__line')?.getAttribute('points')).toBe(
      '266.6666666666667,5 280,91 293.3333333333333,91 306.6666666666667,91 320,48',
    );
  });
});
