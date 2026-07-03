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
        eventOffset: '0000000000000001',
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

  it('renders a single update detail without a raw metadata section', async () => {
    vi.mocked(fetchNodeUpdateDetail).mockResolvedValue({
      nodeId: 'participant-1',
      label: 'Participant 1',
      eventOffset: '0000000000000001',
      updateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      recordTime: '2026-07-01T12:00:00.000Z',
      parties: ['Alice', 'Bob'],
      events: [
        {
          eventKind: 'create',
          eventId: '#0:0',
          contractId: '00abc',
          packageId: 'main-package',
          templateId: 'Main:Asset',
          choice: null,
          witnesses: ['Alice', 'Bob'],
          createData: {
            status: 'decoded',
            value: {
              kind: 'record',
              fields: [
                { label: 'rewardRound', value: 258 },
                {
                  label: 'couponContractId',
                  value: { kind: 'contract_id', value: '00coupon' },
                },
              ],
            },
          },
          raw: {
            event_id: '#0:0',
            contract_id: '00abc',
            template_id: 'Main:Asset',
          },
        },
        {
          eventKind: 'non_consuming_exercise',
          eventId: '#0:1',
          contractId: '00reward',
          packageId: 'splice-dso-rules',
          templateId: 'Splice.DsoRules:DsoRules',
          choice: 'ReceiveSvRewardCoupon',
          witnesses: ['Alice'],
          exerciseData: {
            argument: { status: 'not_available' },
            result: {
              status: 'decoded',
              value: {
                kind: 'record',
                fields: [
                  { label: 'rewardAmount', value: 20000 },
                  { label: 'rewardRound', value: 258 },
                  {
                    label: 'couponContractId',
                    value: { kind: 'contract_id', value: '00coupon' },
                  },
                ],
              },
            },
          },
          raw: {
            event_id: '#0:1',
            contract_id: '00reward',
            template_id: 'Splice.DsoRules:DsoRules',
            choice: 'ReceiveSvRewardCoupon',
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

    const { container } = render(UpdateDetailView, {
      props: {
        id: 'participant-1',
        eventOffset: '0000000000000001',
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
    expect(screen.getByText('Event Offset')).toBeInTheDocument();
    expect(screen.getByText('0000000000000001')).toBeInTheDocument();
    expect(screen.getByText('Canonical Update ID')).toBeInTheDocument();
    expect(
      screen.getByText('1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1'),
    ).toBeInTheDocument();
    expect(screen.getByText('Jul 1, 2026')).toBeInTheDocument();
    expect(screen.getByText('12:00:00 PM')).toBeInTheDocument();
    expect(screen.getByText('Alice, Bob')).toBeInTheDocument();
    expect(screen.getAllByText('Alice')).toHaveLength(2);
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Summary' }).closest('section')).toHaveClass(
      'update-detail__section--summary',
    );
    expect(screen.queryByRole('heading', { name: 'Raw Metadata' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Events' })).toBeInTheDocument();
    expect(screen.getByText('Create')).toBeInTheDocument();
    expect(screen.getByText('Non-Consuming Exercise')).toBeInTheDocument();
    expect(screen.getByText('#0:0')).toBeInTheDocument();
    expect(screen.getAllByText('Package ID')).toHaveLength(2);
    expect(screen.getByText('main-package')).toBeInTheDocument();
    expect(screen.getByText('splice-dso-rules')).toBeInTheDocument();
    expect(screen.getByText('00abc')).toBeInTheDocument();
    expect(screen.getByText('Main:Asset')).toBeInTheDocument();
    expect(screen.queryByText(/"template_id": "Main:Asset"/)).not.toBeInTheDocument();
    expect(screen.getAllByText('Choice')[0].closest('div')).toHaveClass(
      'update-detail__event-item--choice',
    );
    expect(screen.getByText('Create Data')).toBeInTheDocument();
    expect(screen.getByText('Coupon Contract Id')).toBeInTheDocument();
    expect(screen.getByText('Result / Coupon Contract Id')).toBeInTheDocument();
    expect(screen.getAllByText('00coupon')).toHaveLength(2);
    expect(screen.getByText('Exercise Data')).toBeInTheDocument();
    expect(screen.getByText('Result / Reward Amount')).toBeInTheDocument();
    expect(screen.getByText('20,000')).toBeInTheDocument();
    expect(screen.getByText('Result / Reward Round')).toBeInTheDocument();
    expect(screen.getAllByText('258')).toHaveLength(2);
    expect(container.querySelector('a[href="/packages/main-package"]')).not.toBeNull();
    expect(container.querySelector('a[href="/packages/splice-dso-rules"]')).not.toBeNull();
    expect(container.querySelector('a[href="/nodes/participant-1/contracts/00abc"]')).not.toBeNull();
    expect(container.querySelector('a[href="/nodes/participant-1/contracts/00coupon"]')).not.toBeNull();
    expect(screen.queryByText('Update Detail')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to overview' })).toHaveAttribute(
      'href',
      '/nodes/participant-1/updates',
    );
    expect(screen.queryByText('Back to overview')).not.toBeInTheDocument();
  });

  it('renders nested decoded exercise data with flattened labels', async () => {
    vi.mocked(fetchNodeUpdateDetail).mockResolvedValue({
      nodeId: 'cnqs-sv',
      label: 'CNQS Super Validator',
      eventOffset: '11327',
      updateId: '1220c4d4cb71a7824ad32684cbb91ba37b285cec60a45c94c561531c2b1cfaf689b8',
      recordTime: '2026-07-02T17:20:00.000Z',
      parties: ['sv::party'],
      events: [
        {
          eventKind: 'non_consuming_exercise',
          eventId: '#0:0',
          contractId: '00report',
          templateId: 'Splice.DsoRules:DsoRules',
          choice: 'SubmitStatusReport',
          witnesses: ['sv::party'],
          exerciseData: {
            argument: {
              status: 'decoded',
              value: {
                kind: 'record',
                fields: [
                  { label: 'sv', value: 'sv::party' },
                  {
                    label: 'status',
                    value: {
                      kind: 'record',
                      fields: [
                        { label: 'reportTime', value: '2026-07-02T16:28:31.901Z' },
                        { label: 'migrationId', value: -1 },
                      ],
                    },
                  },
                ],
              },
            },
            result: {
              status: 'decoded',
              value: {
                kind: 'record',
                fields: [
                  {
                    label: 'newReport',
                    value: { kind: 'contract_id', value: '00newreport' },
                  },
                ],
              },
            },
          },
          raw: {},
        },
      ],
      meta: {
        update_id: '\\x1220c4d4cb71a7824ad32684cbb91ba37b285cec60a45c94c561531c2b1cfaf689b8',
        record_time: 1783051200000000,
        event_offset: '11327',
      },
    });

    const { container } = render(UpdateDetailView, {
      props: {
        id: 'cnqs-sv',
        eventOffset: '11327',
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

    expect(
      await screen.findByRole('heading', { name: 'CNQS Super Validator Update' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Argument / Status / Report Time')).toBeInTheDocument();
    expect(screen.getByText('2026-07-02T16:28:31.901Z')).toBeInTheDocument();
    expect(screen.getByText('Argument / Status / Migration Id')).toBeInTheDocument();
    expect(screen.getByText('-1')).toBeInTheDocument();
    expect(screen.getByText('Result / New Report')).toBeInTheDocument();
    expect(container.querySelector('a[href="/nodes/cnqs-sv/contracts/00newreport"]')).not.toBeNull();
  });

  it('shows an explicit empty state when no event rows are returned', async () => {
    vi.mocked(fetchNodeUpdateDetail).mockResolvedValue({
      nodeId: 'participant-1',
      label: 'Participant 1',
      eventOffset: '0000000000000001',
      updateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      recordTime: '2026-07-01T12:00:00.000Z',
      parties: ['Alice'],
      events: [],
      meta: {
        update_id: '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
        record_time: 1782907200000000,
        event_offset: '0000000000000001',
      },
    });

    render(UpdateDetailView, {
      props: {
        id: 'participant-1',
        eventOffset: '0000000000000001',
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

    expect(await screen.findByText('No event rows found for this update.')).toBeInTheDocument();
  });

  it('shows a page-level error when the update detail request fails', async () => {
    vi.mocked(fetchNodeUpdateDetail).mockRejectedValue(new Error('Request failed: 404'));

    render(UpdateDetailView, {
      props: {
        id: 'participant-1',
        eventOffset: 'missing-event-offset',
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
