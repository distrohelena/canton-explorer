import { render, screen } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import UpdateDetailView from './UpdateDetailView.vue';
import { fetchNodeUpdateDetail } from '../lib/api';

vi.mock('../lib/api', () => ({
  fetchNodeUpdateDetail: vi.fn(),
}));

describe('UpdateDetailView', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a loading state before the update detail resolves', () => {
    vi.mocked(fetchNodeUpdateDetail).mockReturnValue(new Promise(() => undefined));

    render(UpdateDetailView, {
      props: {
        id: 'participant-1',
        updateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      },
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to" v-bind="$attrs"><slot /></a>',
          },
        },
      },
    });

    expect(screen.getByText('Loading update detail...')).toBeInTheDocument();
  });

  it('renders a single update detail with summary fields and raw metadata', async () => {
    vi.mocked(fetchNodeUpdateDetail).mockResolvedValue({
      nodeId: 'participant-1',
      label: 'Participant 1',
      updateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      recordTime: '2026-07-01T12:00:00.000Z',
      parties: ['Alice', 'Bob'],
      events: [
        {
          eventKind: 'create',
          eventId: '#0:0',
          contractId: '00abc',
          templateId: 'Main:Asset',
          choice: null,
          witnesses: ['Alice', 'Bob'],
          raw: {
            event_id: '#0:0',
            contract_id: '00abc',
            template_id: 'Main:Asset',
          },
        },
      ],
      meta: {
        update_id: '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
        record_time: 1782907200000000,
        event_offset: '0000000000000001',
      },
    });

    const formatMock = vi
      .fn()
      .mockReturnValueOnce('Jul 1, 2026')
      .mockReturnValueOnce('12:00:00 PM');
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      function MockDateTimeFormat() {
        return {
          format: formatMock,
        } as unknown as Intl.DateTimeFormat;
      } as unknown as typeof Intl.DateTimeFormat,
    );

    render(UpdateDetailView, {
      props: {
        id: 'participant-1',
        updateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      },
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to" v-bind="$attrs"><slot /></a>',
          },
        },
      },
    });

    expect(await screen.findByRole('heading', { name: 'Participant 1 Update' })).toBeInTheDocument();
    expect(
      screen.getByText('994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1'),
    ).toBeInTheDocument();
    expect(screen.getByText('Jul 1, 2026')).toBeInTheDocument();
    expect(screen.getByText('12:00:00 PM')).toBeInTheDocument();
    expect(screen.getByText('Alice, Bob')).toBeInTheDocument();
    expect(screen.getByText(/"event_offset": "0000000000000001"/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to overview' })).toHaveAttribute(
      'href',
      '/nodes/participant-1/updates',
    );
    expect(screen.queryByText('Back to overview')).not.toBeInTheDocument();
  });

  it('shows a page-level error when the update detail request fails', async () => {
    vi.mocked(fetchNodeUpdateDetail).mockRejectedValue(new Error('Request failed: 404'));

    render(UpdateDetailView, {
      props: {
        id: 'participant-1',
        updateId: 'missing-update-id',
      },
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to" v-bind="$attrs"><slot /></a>',
          },
        },
      },
    });

    expect(await screen.findByText('Request failed: 404')).toBeInTheDocument();
  });
});
