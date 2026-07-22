import { cleanup, fireEvent, render, screen } from '@testing-library/vue';
import { nextTick, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HomeActivityView from './HomeActivityView.vue';
import type { ActivityHistoryResponse } from '../types/activity';

const history = ref<ActivityHistoryResponse>({
  generatedAt: '2026-07-01T12:00:00.000Z',
  windowMinutes: 1440,
  nodes: [
    {
      nodeId: 'participant-1',
      label: 'Participant 1',
      mode: 'pqs_with_grpc',
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

function resetMockState() {
  history.value = {
    generatedAt: '2026-07-01T12:00:00.000Z',
    windowMinutes: 1440,
    nodes: [
      {
        nodeId: 'participant-1',
        label: 'Participant 1',
        mode: 'pqs_with_grpc',
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

describe('HomeActivityView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    cleanup();
    resetMockState();
  });

  it('renders per-node activity history on the home page', async () => {
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

    expect(screen.getByRole('heading', { name: 'Nodes' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Latest Updates' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Latest Contracts' })).not.toBeInTheDocument();
    expect(screen.getByText('Participant 1')).toBeInTheDocument();
    expect(container.querySelector('.activity-home__grid')).toHaveClass(
      'activity-home__grid--single',
    );
    expect(screen.getByText('15 active contracts')).toBeInTheDocument();
    expect(screen.getByText('PQS + gRPC')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '30' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /participant 1 activity history/i })).toHaveAttribute(
      'href',
      '/nodes/participant-1',
    );
    expect(
      screen.queryByPlaceholderText('Search'),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Connected Nodes' })).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: '30' }));

    expect(selectDays).toHaveBeenCalledWith(30);
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
    const guides = Array.from(container.querySelectorAll<HTMLElement>('.activity-panel__guide'));
    expect(guides.every((guide) => guide.style.left.endsWith('%'))).toBe(true);
    expect(guides[0]?.style.left).toBe('0%');
    expect(guides.at(-1)?.style.left).toBe('100%');
    expect(container.querySelector('.activity-panel__axis-label--start')?.textContent).toBe(
      expectedStartLabel,
    );
    expect(container.querySelector('.activity-panel__axis-label--end')?.textContent).toBe(
      expectedEndLabel,
    );
  });

  it('keeps the date axis for degraded nodes without activity samples', () => {
    history.value = {
      generatedAt: '2026-07-01T12:00:00.000Z',
      windowMinutes: 10080,
      nodes: [
        {
          nodeId: 'participant-2',
          label: 'Participant 2',
          status: 'degraded' as const,
          latestActiveContractCount: 0,
          samples: [],
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

    expect(container.querySelector('.activity-panel__axis')).not.toBeNull();
    expect(container.querySelector('.activity-panel__axis-label--start')?.textContent).toBe(
      'Jun 24',
    );
    expect(container.querySelector('.activity-panel__axis-label--end')?.textContent).toBe(
      'Jul 1',
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
