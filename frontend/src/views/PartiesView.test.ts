import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PartiesView from './PartiesView.vue';
import { fetchActiveParties, fetchLocalParties } from '../lib/api';

vi.mock('../lib/api', () => ({
  fetchActiveParties: vi.fn(),
  fetchLocalParties: vi.fn(),
}));

describe('PartiesView', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows a loading state before active parties resolve', () => {
    vi.mocked(fetchActiveParties).mockReturnValue(new Promise(() => undefined));
    vi.mocked(fetchLocalParties).mockResolvedValue({ nodes: [] });

    render(PartiesView, {
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to" v-bind="$attrs"><slot /></a>',
          },
        },
      },
    });

    expect(screen.getByText('Loading active parties...')).toBeInTheDocument();
  });

  it('renders active parties per node and disables pqs-only nodes in all-parties mode', async () => {
    vi.mocked(fetchActiveParties).mockResolvedValue({
      nodes: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          mode: 'pqs_only',
          parties: ['Alice', 'Bob'],
        },
        {
          nodeId: 'participant-2',
          label: 'Participant 2',
          mode: 'pqs_with_grpc',
          parties: ['Carol'],
        },
      ],
    });
    vi.mocked(fetchLocalParties).mockResolvedValue({
      nodes: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          mode: 'pqs_only',
          parties: [],
        },
        {
          nodeId: 'participant-2',
          label: 'Participant 2',
          mode: 'pqs_with_grpc',
          parties: ['LocalCarol'],
        },
      ],
    });

    render(PartiesView, {
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to" v-bind="$attrs"><slot /></a>',
          },
        },
      },
    });

    expect(await screen.findByRole('button', { name: 'Active Parties' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Participant 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('link', { name: 'Alice' })).toHaveAttribute('href', '/parties/Alice');
    expect(screen.getByRole('link', { name: 'Bob' })).toHaveAttribute('href', '/parties/Bob');

    await fireEvent.click(screen.getByRole('button', { name: 'All Parties' }));

    const disabledNode = screen.getByRole('button', { name: /Participant 1/ });
    expect(disabledNode).toBeDisabled();
    expect(within(disabledNode).getByText('No gRPC')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Participant 2' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
    expect(await screen.findByRole('link', { name: 'LocalCarol' })).toHaveAttribute(
      'href',
      '/parties/LocalCarol',
    );
  });
});
