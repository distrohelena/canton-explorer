import { render, screen, within } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ContractDetailView from './ContractDetailView.vue';
import { fetchNodeContractDetail } from '../lib/api';

vi.mock('../lib/api', () => ({
  fetchNodeContractDetail: vi.fn(),
}));

describe('ContractDetailView', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a contract summary and decoded contract data', async () => {
    vi.mocked(fetchNodeContractDetail).mockResolvedValue({
      nodeId: 'participant-1',
      label: 'Participant 1',
      contractId: '00abc',
      templateId: 'Main:Asset',
      packageId: 'main-package',
      packageName: 'Main Package',
      packageVersion: '1.2.3',
      createdUpdateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      createdEventOffset: '0000000000000001',
      createdRecordTime: '2026-07-01T12:00:00.000Z',
      archivedUpdateId: null,
      archivedEventOffset: '0000000000000002',
      archivedRecordTime: '2026-07-01T13:00:00.000Z',
      contractData: {
        status: 'decoded',
        value: {
          kind: 'record',
          fields: [
            { label: 'rewardRound', value: 258 },
            { label: 'rewardAmount', value: 20000 },
            {
              label: 'couponContractId',
              value: { kind: 'contract_id', value: '00coupon' },
            },
          ],
        },
      },
    });

    const formatMock = vi
      .fn()
      .mockReturnValueOnce('Jul 1, 2026')
      .mockReturnValueOnce('12:00:00 PM')
      .mockReturnValueOnce('Jul 1, 2026')
      .mockReturnValueOnce('1:00:00 PM');
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      function MockDateTimeFormat() {
        return {
          format: formatMock,
        } as unknown as Intl.DateTimeFormat;
      } as unknown as typeof Intl.DateTimeFormat,
    );

    const { container } = render(ContractDetailView, {
      props: {
        id: 'participant-1',
        contractId: '00abc',
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

    expect(await screen.findByRole('heading', { name: 'Participant 1 Contract' })).toBeInTheDocument();
    expect(screen.getByText('00abc')).toBeInTheDocument();
    expect(screen.getByText('Main:Asset')).toBeInTheDocument();
    expect(screen.getByText('main-package')).toBeInTheDocument();
    expect(screen.getByText('Package Name')).toBeInTheDocument();
    expect(screen.getByText('Main Package')).toBeInTheDocument();
    expect(screen.getByText('Version')).toBeInTheDocument();
    expect(screen.getByText('1.2.3')).toBeInTheDocument();
    const packageSummaryPair = container.querySelector('.contract-detail__summary-pair--package');
    expect(packageSummaryPair).not.toBeNull();
    expect(screen.getByText('Package Name').closest('.contract-detail__summary-pair--package')).toBe(
      packageSummaryPair,
    );
    expect(screen.getByText('Version').closest('.contract-detail__summary-pair--package')).toBe(
      packageSummaryPair,
    );
    expect(screen.getByText('Created Event')).toBeInTheDocument();
    expect(screen.getByText('Archived Event')).toBeInTheDocument();
    expect(screen.getByText('Created Record Time')).toBeInTheDocument();
    expect(screen.getByText('Archived Record Time')).toBeInTheDocument();
    const createdSummaryPair = container.querySelector('.contract-detail__summary-pair--created');
    expect(createdSummaryPair).not.toBeNull();
    expect(createdSummaryPair?.querySelectorAll('.contract-detail__summary-subitem')).toHaveLength(2);
    expect(screen.getByText('Created Event').closest('.contract-detail__summary-pair')).toBe(createdSummaryPair);
    expect(screen.getByText('Created Record Time').closest('.contract-detail__summary-pair')).toBe(
      createdSummaryPair,
    );
    const archivedSummaryPair = container.querySelector('.contract-detail__summary-pair--archived');
    expect(archivedSummaryPair).not.toBeNull();
    expect(screen.getByText('Archived Event').closest('.contract-detail__summary-pair')).toBe(
      archivedSummaryPair,
    );
    expect(screen.getByText('Archived Record Time').closest('.contract-detail__summary-pair')).toBe(
      archivedSummaryPair,
    );
    expect(screen.getAllByText('Jul 1, 2026')).toHaveLength(2);
    expect(screen.getByText('12:00:00 PM')).toBeInTheDocument();
    expect(screen.getByText('1:00:00 PM')).toBeInTheDocument();
    expect(screen.getByText('Create Event')).toBeInTheDocument();
    expect(screen.getByText('Reward Amount')).toBeInTheDocument();
    expect(screen.getByText('20,000')).toBeInTheDocument();
    expect(screen.getByText('Reward Round')).toBeInTheDocument();
    expect(screen.getByText('258')).toBeInTheDocument();
    expect(container.querySelector('a[href="/packages/main-package"]')).not.toBeNull();
    expect(container.querySelector('a[href="/nodes/participant-1/updates/0000000000000001"]')).not.toBeNull();
    expect(container.querySelector('a[href="/nodes/participant-1/updates/0000000000000002"]')).not.toBeNull();
    expect(container.querySelector('a[href="/nodes/participant-1/contracts/00coupon"]')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Back to overview' })).toHaveAttribute(
      'href',
      '/nodes/participant-1',
    );
  });

  it('renders archived record time as Not Present when the archive timestamp is missing', async () => {
    vi.mocked(fetchNodeContractDetail).mockResolvedValue({
      nodeId: 'participant-1',
      label: 'Participant 1',
      contractId: '00abc',
      templateId: 'Main:Asset',
      packageId: 'main-package',
      packageName: 'Main Package',
      packageVersion: '1.2.3',
      createdUpdateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      createdEventOffset: '0000000000000001',
      createdRecordTime: '2026-07-01T12:00:00.000Z',
      archivedUpdateId: null,
      archivedEventOffset: '0000000000000002',
      archivedRecordTime: null,
      contractData: {
        status: 'decoded',
        value: {
          kind: 'record',
          fields: [],
        },
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

    const { container } = render(ContractDetailView, {
      props: {
        id: 'participant-1',
        contractId: '00abc',
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

    const scoped = within(container as HTMLElement);
    expect(await scoped.findByText('Archived Event')).toBeInTheDocument();
    expect(scoped.getByText('Archived Record Time')).toBeInTheDocument();
    expect(scoped.getByText('Not Present')).toBeInTheDocument();
    const archivedSummaryPair = container.querySelector('.contract-detail__summary-pair--archived');
    expect(archivedSummaryPair).not.toBeNull();
    expect(scoped.getByText('Archived Event').closest('.contract-detail__summary-pair')).toBe(
      archivedSummaryPair,
    );
    expect(scoped.getByText('Archived Record Time').closest('.contract-detail__summary-pair')).toBe(
      archivedSummaryPair,
    );
  });
});
