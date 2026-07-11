import { cleanup, render, screen } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TokenTransferDetailView from './TokenTransferDetailView.vue';
import { fetchTokenTransferDetail } from '../lib/api';

vi.mock('../lib/api', () => ({
  fetchTokenTransferDetail: vi.fn(),
}));

describe('TokenTransferDetailView', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows a loading state before the transfer detail resolves', () => {
    vi.mocked(fetchTokenTransferDetail).mockReturnValue(new Promise(() => undefined));

    render(TokenTransferDetailView, {
      props: {
        updateId: 'token-update-2',
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

    expect(screen.getByText('Loading transfer detail...')).toBeInTheDocument();
  });

  it('renders a global token transfer detail and returns to the tokens page', async () => {
    vi.mocked(fetchTokenTransferDetail).mockResolvedValue({
      rowId: 'token-update-2:#0:1:Mint',
      movementType: 'Mint',
      source: 'pqs_inferred_holding_v2',
      tokenId: 'canton-coin',
      tokenName: 'Canton Coin',
      amount: '42.0',
      sender: 'Alice',
      receiver: 'Bob',
      updateId: 'token-update-2',
      recordTime: '2026-07-07T12:00:00.000Z',
      nodes: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          eventOffset: '101',
        },
        {
          nodeId: 'participant-2',
          label: 'Participant 2',
          eventOffset: '202',
        },
      ],
    });

    const formatMock = vi
      .fn()
      .mockReturnValueOnce('Jul 7, 2026')
      .mockReturnValueOnce('9:00:00 AM');
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      function MockDateTimeFormat() {
        return {
          format: formatMock,
        } as unknown as Intl.DateTimeFormat;
      } as unknown as typeof Intl.DateTimeFormat,
    );

    const { container } = render(TokenTransferDetailView, {
      props: {
        updateId: 'token-update-2',
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

    expect(await screen.findByRole('heading', { name: 'Canton Coin Transfer' })).toBeInTheDocument();
    expect(screen.getByText('Token ID')).toBeInTheDocument();
    expect(screen.getByText('canton-coin')).toBeInTheDocument();
    expect(screen.getByText('Movement Type')).toBeInTheDocument();
    expect(screen.getByText('Mint')).toBeInTheDocument();
    expect(screen.getByText('Source')).toBeInTheDocument();
    expect(screen.getByText('pqs_inferred_holding_v2')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Amount').closest('.contract-detail__summary-item')).toHaveClass(
      'contract-detail__summary-item--full-row',
    );
    expect(screen.getByText('42.0')).toHaveClass('token-transfer-detail__amount');
    expect(screen.getByText('Update ID')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'token-update-2' })).toHaveAttribute(
      'href',
      '/nodes/participant-1/updates/101?from=tokens',
    );
    expect(screen.getByText('Jul 7, 2026')).toBeInTheDocument();
    expect(screen.getByText('9:00:00 AM')).toBeInTheDocument();
    expect(screen.getByText('From').closest('.contract-detail__summary-item')).toHaveClass(
      'contract-detail__summary-item--full-row',
    );
    expect(screen.getByText('To').closest('.contract-detail__summary-item')).toHaveClass(
      'contract-detail__summary-item--full-row',
    );
    expect(screen.getByRole('link', { name: 'Alice' })).toHaveAttribute('href', '/parties/Alice');
    expect(screen.getByRole('link', { name: 'Bob' })).toHaveAttribute('href', '/parties/Bob');
    expect(screen.getByText('Participant 1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '101' })).toHaveAttribute(
      'href',
      '/nodes/participant-1/updates/101?from=tokens',
    );
    expect(screen.getByText('Participant 2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '202' })).toHaveAttribute(
      'href',
      '/nodes/participant-2/updates/202?from=tokens',
    );
    expect(container.querySelector('a[href="/tokens"]')).not.toBeNull();
  });
});
