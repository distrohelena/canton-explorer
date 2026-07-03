import { render, screen } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PartyDetailView from './PartyDetailView.vue';
import { fetchPartyDetail } from '../lib/api';

vi.mock('../lib/api', () => ({
  fetchPartyDetail: vi.fn(),
}));

describe('PartyDetailView', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a loading state before the party detail resolves', () => {
    vi.mocked(fetchPartyDetail).mockReturnValue(new Promise(() => undefined));

    render(PartyDetailView, {
      props: {
        partyId: 'Alice',
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

    expect(screen.getByText('Loading party detail...')).toBeInTheDocument();
  });

  it('renders a summary-first party detail page', async () => {
    vi.mocked(fetchPartyDetail).mockResolvedValue({
      partyId: 'Alice',
      nodeCount: 2,
      recentUpdateCount: 2,
      recentContractCount: 2,
      nodes: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          recentUpdateCount: 1,
          recentContractCount: 1,
        },
        {
          nodeId: 'participant-2',
          label: 'Participant 2',
          recentUpdateCount: 1,
          recentContractCount: 1,
        },
      ],
      recentUpdates: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          eventOffset: '0000000000000001',
          updateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
          recordTime: '2026-07-01T12:00:00.000Z',
          parties: ['Alice', 'Bob'],
        },
      ],
      recentContracts: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          contractId: '00abc',
          templateId: 'Main:Asset',
          packageId: 'main-package',
          packageName: 'Main Package',
          packageVersion: '1.2.3',
          recordTime: '2026-07-01T12:00:00.000Z',
        },
      ],
    });

    const formatMock = vi
      .fn()
      .mockReturnValueOnce('Jul 1, 2026')
      .mockReturnValueOnce('12:00:00 PM')
      .mockReturnValueOnce('Jul 1, 2026')
      .mockReturnValueOnce('12:00:00 PM');
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      function MockDateTimeFormat() {
        return {
          format: formatMock,
        } as unknown as Intl.DateTimeFormat;
      } as unknown as typeof Intl.DateTimeFormat,
    );

    const { container } = render(PartyDetailView, {
      props: {
        partyId: 'Alice',
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

    expect(await screen.findByRole('heading', { name: 'Alice Party' })).toBeInTheDocument();
    expect(container.querySelector('.party-detail__sections')).not.toBeNull();
    expect(container.querySelector('.party-detail__summary-grid')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Observed Nodes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recent Updates' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recent Contracts' })).toBeInTheDocument();
    expect(screen.getAllByText('2')).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'Participant 1' })).toHaveAttribute(
      'href',
      '/nodes/participant-1',
    );
    expect(screen.getByRole('link', { name: 'Participant 2' })).toHaveAttribute(
      'href',
      '/nodes/participant-2',
    );
    expect(screen.getByText('0000000000000001')).toBeInTheDocument();
    expect(screen.getByText('Alice, Bob')).toBeInTheDocument();
    expect(screen.getByText('00abc')).toBeInTheDocument();
    expect(screen.getByText('Main:Asset')).toBeInTheDocument();
    expect(screen.getAllByText('Jul 1, 2026')).toHaveLength(2);
    expect(screen.getAllByText('12:00:00 PM')).toHaveLength(2);
    expect(container.querySelector('a[href="/nodes/participant-1"]')).not.toBeNull();
    expect(container.querySelector('a[href="/nodes/participant-1/updates/0000000000000001"]')).not.toBeNull();
    expect(container.querySelector('a[href="/nodes/participant-1/contracts/00abc"]')).not.toBeNull();
  });
});
