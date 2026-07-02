import { fireEvent, render, screen } from '@testing-library/vue';
import { defineComponent } from 'vue';
import { afterEach } from 'vitest';
import { describe, expect, it, vi } from 'vitest';
import NodeUpdatesView from './NodeUpdatesView.vue';

vi.mock('../lib/api', () => ({
  fetchNodeUpdates: vi.fn().mockResolvedValue({
    nodeId: 'participant-1',
    label: 'Participant 1',
    limit: 25,
    updates: [
      {
        updateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
        recordTime: '2026-07-01T12:00:00.000Z',
        parties: ['Alice', 'Bob'],
      },
      {
        updateId: '00000000000000000000000000000000',
        recordTime: '2026-07-01T11:59:00.000Z',
        parties: [],
      },
    ],
  }),
}));

describe('NodeUpdatesView', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders recent updates for the selected node', async () => {
    const formatMock = vi
      .fn()
      .mockReturnValueOnce('Jul 1, 2026')
      .mockReturnValueOnce('12:00:00 PM')
      .mockReturnValueOnce('Jul 1, 2026')
      .mockReturnValueOnce('11:59:00 AM');
    const navigateMock = vi.fn();
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      function MockDateTimeFormat() {
        return {
          format: formatMock,
        } as unknown as Intl.DateTimeFormat;
      } as unknown as typeof Intl.DateTimeFormat,
    );

    const { container } = render(NodeUpdatesView, {
      props: { id: 'participant-1' },
      global: {
        stubs: {
          RouterLink: defineComponent({
            props: {
              to: {
                type: String,
                required: true,
              },
            },
            methods: {
              handleClick() {
                navigateMock(this.to);
              },
            },
            template: '<a :href="to" v-bind="$attrs" @click.prevent="handleClick"><slot /></a>',
          }),
        },
      },
    });

    expect(await screen.findByRole('heading', { name: 'Participant 1 Updates' })).toBeInTheDocument();
    expect(
      screen.getByText('994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1'),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText('Jul 1, 2026')).toHaveLength(2);
    expect(screen.getByText('12:00:00 PM')).toBeInTheDocument();
    expect(screen.getByText('11:59:00 AM')).toBeInTheDocument();
    expect(screen.getByText('Alice, Bob')).toBeInTheDocument();
    expect(screen.getByText('No parties')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to overview' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Back to overview' })).toHaveTextContent('←');
    expect(screen.queryByText('Back to overview')).not.toBeInTheDocument();

    const firstRowLink = container.querySelector(
      'a[href="/nodes/participant-1/updates/1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1"]',
    );
    const secondRowLink = container.querySelector(
      'a[href="/nodes/participant-1/updates/00000000000000000000000000000000"]',
    );

    expect(firstRowLink).not.toBeNull();
    expect(secondRowLink).not.toBeNull();
    expect(container.querySelector('.node-updates__row--head a')).toBeNull();

    await fireEvent.click(firstRowLink as HTMLAnchorElement);

    expect(navigateMock).toHaveBeenCalledWith(
      '/nodes/participant-1/updates/1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
    );
  });
});
