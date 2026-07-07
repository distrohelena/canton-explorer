import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PartiesView from './PartiesView.vue';
import {
  fetchNodeActiveParties,
  fetchNodeLocalParties,
  fetchNodes,
} from '../lib/api';

vi.mock('../lib/api', () => ({
  fetchNodes: vi.fn(),
  fetchNodeActiveParties: vi.fn(),
  fetchNodeLocalParties: vi.fn(),
}));

describe('PartiesView', () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it('shows a loading state before active parties resolve', () => {
    vi.mocked(fetchNodes).mockResolvedValue([
      {
        id: 'participant-1',
        label: 'Participant 1',
        role: 'participant',
        mode: 'pqs_only',
        ledgerLabel: 'Retail Ledger',
        status: 'healthy',
        latencyMs: 1,
        lastSuccessAt: null,
        lastErrorAt: null,
        errorSummary: null,
        serviceInfo: {
          target: null,
          reachable: false,
          healthCheckImplemented: false,
          servingStatus: null,
        },
        ledgerSummary: {
          ledgerLabel: 'Retail Ledger',
          pqsDatabase: 'participant_1',
          activeContractCount: 1,
          latestOffset: null,
          latestEventAt: null,
        },
        sourceStatus: {
          pqs: { ok: true, checkedAt: '', latencyMs: 1, message: null },
          grpc: { ok: false, checkedAt: '', latencyMs: null, message: null },
        },
      },
    ]);
    vi.mocked(fetchNodeActiveParties).mockReturnValue(new Promise(() => undefined));
    vi.mocked(fetchNodeLocalParties).mockResolvedValue({
      nodeId: 'participant-1',
      label: 'Participant 1',
      mode: 'pqs_only',
      parties: [],
      localPartiesStatus: 'grpc_not_configured',
      localPartiesError: null,
      localPartiesErrorCode: null,
      localPartiesErrorDetails: null,
      localPartiesErrorTid: null,
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

    expect(screen.getByText('Loading parties...')).toBeInTheDocument();
  });

  it('renders the first node parties first and lazy-loads the other node on click', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([
      {
        id: 'participant-1',
        label: 'Participant 1',
        role: 'participant',
        mode: 'pqs_only',
        ledgerLabel: 'Retail Ledger',
        status: 'healthy',
        latencyMs: 1,
        lastSuccessAt: null,
        lastErrorAt: null,
        errorSummary: null,
        serviceInfo: {
          target: null,
          reachable: false,
          healthCheckImplemented: false,
          servingStatus: null,
        },
        ledgerSummary: {
          ledgerLabel: 'Retail Ledger',
          pqsDatabase: 'participant_1',
          activeContractCount: 1,
          latestOffset: null,
          latestEventAt: null,
        },
        sourceStatus: {
          pqs: { ok: true, checkedAt: '', latencyMs: 1, message: null },
          grpc: { ok: false, checkedAt: '', latencyMs: null, message: null },
        },
      },
      {
        id: 'participant-2',
        label: 'Participant 2',
        role: 'participant',
        mode: 'pqs_with_grpc',
        ledgerLabel: 'Retail Ledger 2',
        status: 'healthy',
        latencyMs: 1,
        lastSuccessAt: null,
        lastErrorAt: null,
        errorSummary: null,
        serviceInfo: {
          target: 'localhost:5012',
          reachable: true,
          healthCheckImplemented: true,
          servingStatus: 'SERVING',
        },
        ledgerSummary: {
          ledgerLabel: 'Retail Ledger 2',
          pqsDatabase: 'participant_2',
          activeContractCount: 1,
          latestOffset: null,
          latestEventAt: null,
        },
        sourceStatus: {
          pqs: { ok: true, checkedAt: '', latencyMs: 1, message: null },
          grpc: { ok: true, checkedAt: '', latencyMs: 1, message: null },
        },
      },
    ]);
    vi.mocked(fetchNodeActiveParties)
      .mockResolvedValueOnce({
        nodeId: 'participant-1',
        label: 'Participant 1',
        mode: 'pqs_only',
        parties: ['Alice', 'Bob'],
      })
      .mockResolvedValueOnce({
        nodeId: 'participant-2',
        label: 'Participant 2',
        mode: 'pqs_with_grpc',
        parties: ['Carol'],
      });
    vi.mocked(fetchNodeLocalParties).mockResolvedValue({
      nodeId: 'participant-2',
      label: 'Participant 2',
      mode: 'pqs_with_grpc',
      parties: ['LocalCarol'],
      localPartiesStatus: 'ok',
      localPartiesError: null,
      localPartiesErrorCode: null,
      localPartiesErrorDetails: null,
      localPartiesErrorTid: null,
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
    expect(screen.getByText('PQS')).toHaveAttribute('title', 'Data sourced from PQS');
    expect(fetchNodeActiveParties).toHaveBeenCalledTimes(1);
    expect(fetchNodeActiveParties).toHaveBeenCalledWith('participant-1');
    expect(screen.getByRole('button', { name: 'Participant 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('link', { name: 'Alice' })).toHaveAttribute('href', '/parties/Alice');
    expect(screen.getByRole('link', { name: 'Bob' })).toHaveAttribute('href', '/parties/Bob');

    await fireEvent.click(screen.getByRole('button', { name: 'Participant 2' }));

    expect(await screen.findByRole('link', { name: 'Carol' })).toHaveAttribute(
      'href',
      '/parties/Carol',
    );
    expect(fetchNodeActiveParties).toHaveBeenCalledTimes(2);
    expect(fetchNodeActiveParties).toHaveBeenLastCalledWith('participant-2');

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
    expect(screen.getByText('gRPC')).toHaveAttribute('title', 'Data sourced from gRPC');
    expect(screen.queryByText('Local party inventory via gRPC.')).not.toBeInTheDocument();
    expect(fetchNodeLocalParties).toHaveBeenCalledTimes(1);
    expect(fetchNodeLocalParties).toHaveBeenCalledWith('participant-2');
  });

  it('shows a grpc error message instead of the empty-state copy when local party loading fails', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([
      {
        id: 'participant-2',
        label: 'Participant 2',
        role: 'participant',
        mode: 'pqs_with_grpc',
        ledgerLabel: 'Retail Ledger 2',
        status: 'healthy',
        latencyMs: 1,
        lastSuccessAt: null,
        lastErrorAt: null,
        errorSummary: null,
        serviceInfo: {
          target: 'localhost:5012',
          reachable: true,
          healthCheckImplemented: true,
          servingStatus: 'SERVING',
        },
        ledgerSummary: {
          ledgerLabel: 'Retail Ledger 2',
          pqsDatabase: 'participant_2',
          activeContractCount: 1,
          latestOffset: null,
          latestEventAt: null,
        },
        sourceStatus: {
          pqs: { ok: true, checkedAt: '', latencyMs: 1, message: null },
          grpc: { ok: true, checkedAt: '', latencyMs: 1, message: null },
        },
      },
    ]);
    vi.mocked(fetchNodeActiveParties).mockResolvedValue({
      nodeId: 'participant-2',
      label: 'Participant 2',
      mode: 'pqs_with_grpc',
      parties: [],
    });
    vi.mocked(fetchNodeLocalParties).mockResolvedValue({
      nodeId: 'participant-2',
      label: 'Participant 2',
      mode: 'pqs_with_grpc',
      parties: [],
      localPartiesStatus: 'grpc_error',
      localPartiesError:
        'An error occurred. Please contact the operator and inquire about the request 66f620d5014db408ba2d552b8d78b99f with tid 66f620d5014db408ba2d552b8d78b99f',
      localPartiesErrorCode: '13',
      localPartiesErrorDetails:
        'An error occurred. Please contact the operator and inquire about the request 66f620d5014db408ba2d552b8d78b99f with tid 66f620d5014db408ba2d552b8d78b99f',
      localPartiesErrorTid: '66f620d5014db408ba2d552b8d78b99f',
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

    await fireEvent.click(await screen.findByRole('button', { name: 'All Parties' }));

    expect(
      await screen.findByText('gRPC error while listing local parties for this node.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Status code: 13/)).toBeInTheDocument();
    expect(screen.getByText(/Request ID: 66f620d5014db408ba2d552b8d78b99f/)).toBeInTheDocument();
    expect(screen.getByText(/Please contact the operator/)).toBeInTheDocument();
    expect(screen.queryByText('No local parties found for this node.')).not.toBeInTheDocument();
  });
});
