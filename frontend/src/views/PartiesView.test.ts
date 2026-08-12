import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PartiesView from './PartiesView.vue';
import {
  fetchNodeActiveParties,
  fetchPartyFingerprints,
  fetchNodeLocalParties,
  fetchNodes,
} from '../lib/api';

vi.mock('../lib/api', () => ({
  fetchNodes: vi.fn(),
  fetchNodeActiveParties: vi.fn(),
  fetchPartyFingerprints: vi.fn(),
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
          ledgerApiVersion: null,
        },
        ledgerSummary: {
          ledgerLabel: 'Retail Ledger',
          pqsDatabase: 'participant_1',
          activeContractCount: 1,
          latestOffset: null,
          latestEventAt: null,
          totalUpdateCount: 0,
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

    expect(screen.getByRole('tablist', { name: 'Party source modes' })).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Party source modes' }).querySelectorAll('button')).toHaveLength(3);
    expect(screen.queryByRole('tablist', { name: 'Node selectors' })).not.toBeInTheDocument();
    expect(screen.queryByText('Loading nodes...')).not.toBeInTheDocument();
  });

  it('loads active parties across all nodes by default', async () => {
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
          ledgerApiVersion: null,
        },
        ledgerSummary: {
          ledgerLabel: 'Retail Ledger',
          pqsDatabase: 'participant_1',
          activeContractCount: 1,
          latestOffset: null,
          latestEventAt: null,
          totalUpdateCount: 0,
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
          ledgerApiVersion: null,
        },
        ledgerSummary: {
          ledgerLabel: 'Retail Ledger 2',
          pqsDatabase: 'participant_2',
          activeContractCount: 1,
          latestOffset: null,
          latestEventAt: null,
          totalUpdateCount: 0,
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
    vi.mocked(fetchPartyFingerprints).mockResolvedValue({
      source: 'grpc',
      limit: 15,
      nextBefore: null,
      nextAfter: null,
      fingerprints: ['1220carol'],
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

    await screen.findByRole('link', { name: 'Carol' });

    expect(screen.queryByText('PQS')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Active Parties' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('tablist', { name: 'Party source modes' }).querySelectorAll('button')).toHaveLength(3);
    expect(screen.queryByRole('tablist', { name: 'Node selectors' })).not.toBeInTheDocument();
    expect(screen.queryByText('Show')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'No gRPC nodes available' }),
    ).not.toBeInTheDocument();
    expect(fetchNodeActiveParties).toHaveBeenCalledTimes(2);
    expect(fetchNodeActiveParties).toHaveBeenCalledWith('participant-1');
    expect(fetchNodeActiveParties).toHaveBeenCalledWith('participant-2');
    expect(screen.getByRole('heading', { name: 'All Nodes' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alice' })).toHaveAttribute('href', '/parties/Alice');
    expect(screen.getByRole('link', { name: 'Bob' })).toHaveAttribute('href', '/parties/Bob');
    expect(
      screen.getByRole('link', { name: 'Alice' }).closest('.node-detail__section'),
    ).toBeNull();
    expect(
      document.querySelector('.parties-page__results.parties-page__results--inline-actions'),
    ).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy party ID Alice' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy party ID Bob' })).toBeInTheDocument();

    expect(await screen.findByRole('link', { name: 'Carol' })).toHaveAttribute(
      'href',
      '/parties/Carol',
    );
    expect(fetchNodeActiveParties).toHaveBeenCalledTimes(2);

    await fireEvent.click(screen.getByRole('button', { name: 'All Parties' }));

    expect(await screen.findByRole('link', { name: 'LocalCarol' })).toHaveAttribute(
      'href',
      '/parties/LocalCarol',
    );
    expect(screen.getByText('gRPC')).toHaveAttribute('title', 'Data sourced from gRPC');
    expect(
      screen.getByText('gRPC').closest('.results-header__actions'),
    ).not.toBeNull();
    expect(screen.queryByText('Local party inventory via gRPC.')).not.toBeInTheDocument();
    expect(fetchNodeLocalParties).toHaveBeenCalledTimes(1);
    expect(fetchNodeLocalParties).toHaveBeenCalledWith('participant-2');
  });

  it('keeps all-node selection when switching between party sources', async () => {
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
          ledgerApiVersion: null,
        },
        ledgerSummary: {
          ledgerLabel: 'Retail Ledger',
          pqsDatabase: 'participant_1',
          activeContractCount: 1,
          latestOffset: null,
          latestEventAt: null,
          totalUpdateCount: 0,
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
          ledgerApiVersion: null,
        },
        ledgerSummary: {
          ledgerLabel: 'Retail Ledger 2',
          pqsDatabase: 'participant_2',
          activeContractCount: 1,
          latestOffset: null,
          latestEventAt: null,
          totalUpdateCount: 0,
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
        parties: ['Bob', 'Alice'],
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
    vi.mocked(fetchPartyFingerprints).mockResolvedValue({
      source: 'pqs',
      limit: 15,
      nextBefore: '1220carol',
      nextAfter: null,
      fingerprints: ['1220alice', '1220carol'],
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

    await screen.findByRole('link', { name: 'Carol' });

    expect(fetchNodeActiveParties).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('tablist', { name: 'Node selectors' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'All Nodes' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alice' })).toHaveAttribute('href', '/parties/Alice');
    expect(screen.getByRole('link', { name: 'Bob' })).toHaveAttribute('href', '/parties/Bob');
    expect(screen.getByRole('link', { name: 'Carol' })).toHaveAttribute('href', '/parties/Carol');

    await fireEvent.click(screen.getByRole('button', { name: 'Namespaces' }));

    await waitFor(() =>
      expect(fetchPartyFingerprints).toHaveBeenCalledTimes(1),
    );
    expect(screen.getByText('1220alice')).toBeInTheDocument();
    expect(screen.getByText('1220carol')).toBeInTheDocument();
    expect(screen.queryByText('PQS')).not.toBeInTheDocument();
    expect(screen.queryAllByText('gRPC')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Older' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Newer' })).toBeDisabled();
  });

  it('paginates namespaces with newer and older controls', async () => {
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
          ledgerApiVersion: null,
        },
        ledgerSummary: {
          ledgerLabel: 'Retail Ledger',
          pqsDatabase: 'participant_1',
          activeContractCount: 1,
          latestOffset: null,
          latestEventAt: null,
          totalUpdateCount: 0,
        },
        sourceStatus: {
          pqs: { ok: true, checkedAt: '', latencyMs: 1, message: null },
          grpc: { ok: false, checkedAt: '', latencyMs: null, message: null },
        },
      },
    ]);
    vi.mocked(fetchNodeActiveParties).mockResolvedValue({
      nodeId: 'participant-1',
      label: 'Participant 1',
      mode: 'pqs_only',
      parties: ['Alice'],
    });
    vi.mocked(fetchPartyFingerprints)
      .mockResolvedValueOnce({
        source: 'pqs',
        limit: 15,
        nextBefore: '1220j',
        nextAfter: null,
        fingerprints: ['1220a', '1220b'],
      })
      .mockResolvedValueOnce({
        source: 'pqs',
        limit: 15,
        nextBefore: null,
        nextAfter: '1220k',
        fingerprints: ['1220k', '1220l'],
      })
      .mockResolvedValueOnce({
        source: 'pqs',
        limit: 15,
        nextBefore: '1220j',
        nextAfter: null,
        fingerprints: ['1220a', '1220b'],
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

    await fireEvent.click(await screen.findByRole('button', { name: 'Namespaces' }));

    expect(await screen.findByText('1220a')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Older' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Newer' })).toBeDisabled();

    await fireEvent.click(screen.getByRole('button', { name: 'Older' }));

    expect(await screen.findByText('1220k')).toBeInTheDocument();
    expect(fetchPartyFingerprints).toHaveBeenLastCalledWith({
      before: '1220j',
      limit: 15,
    });
    expect(screen.getByRole('button', { name: 'Older' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Newer' })).not.toBeDisabled();

    await fireEvent.click(screen.getByRole('button', { name: 'Newer' }));

    expect(await screen.findByText('1220a')).toBeInTheDocument();
    expect(fetchPartyFingerprints).toHaveBeenLastCalledWith({
      after: '1220k',
      limit: 15,
    });
  });

  it('links namespace rows to the namespace detail page', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([
      {
        id: 'participant-1',
        label: 'Participant 1',
        role: 'participant',
        mode: 'pqs_with_grpc',
        ledgerLabel: 'Retail Ledger 1',
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
          ledgerApiVersion: null,
        },
        ledgerSummary: {
          ledgerLabel: 'Retail Ledger 1',
          pqsDatabase: 'participant_1',
          activeContractCount: 1,
          latestOffset: null,
          latestEventAt: null,
          totalUpdateCount: 0,
        },
        sourceStatus: {
          pqs: { ok: true, checkedAt: '', latencyMs: 1, message: null },
          grpc: { ok: true, checkedAt: '', latencyMs: 1, message: null },
        },
      },
    ]);
    vi.mocked(fetchNodeActiveParties).mockResolvedValue({
      nodeId: 'participant-1',
      label: 'Participant 1',
      mode: 'pqs_with_grpc',
      parties: ['Alice::1220abcd'],
    });
    vi.mocked(fetchPartyFingerprints).mockResolvedValue({
      source: 'grpc',
      limit: 15,
      nextBefore: null,
      nextAfter: null,
      fingerprints: ['1220abcd'],
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

    await fireEvent.click(await screen.findByRole('button', { name: 'Namespaces' }));

    expect(await screen.findByRole('link', { name: '1220abcd' })).toHaveAttribute(
      'href',
      '/namespaces/1220abcd',
    );
    expect(screen.getByRole('link', { name: '1220abcd' })).toHaveClass(
      'contract-detail__link',
      'parties-page__party-link',
    );
  });

  it('filters namespaces through the advanced filter panel', async () => {
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
          ledgerApiVersion: null,
        },
        ledgerSummary: {
          ledgerLabel: 'Retail Ledger',
          pqsDatabase: 'participant_1',
          activeContractCount: 1,
          latestOffset: null,
          latestEventAt: null,
          totalUpdateCount: 0,
        },
        sourceStatus: {
          pqs: { ok: true, checkedAt: '', latencyMs: 1, message: null },
          grpc: { ok: false, checkedAt: '', latencyMs: null, message: null },
        },
      },
    ]);
    vi.mocked(fetchNodeActiveParties).mockResolvedValue({
      nodeId: 'participant-1',
      label: 'Participant 1',
      mode: 'pqs_only',
      parties: ['Alice'],
    });
    vi.mocked(fetchPartyFingerprints)
      .mockResolvedValueOnce({
        source: 'pqs',
        limit: 15,
        nextBefore: null,
        nextAfter: null,
        fingerprints: ['1220a', '1220b'],
      })
      .mockResolvedValueOnce({
        source: 'pqs',
        limit: 15,
        nextBefore: null,
        nextAfter: null,
        fingerprints: ['1220a'],
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

    await fireEvent.click(await screen.findByRole('button', { name: 'Namespaces' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Advanced Filter' }));

    expect(await screen.findByText('Advanced Filter Parameters')).toBeInTheDocument();

    await fireEvent.update(screen.getByLabelText('Public Key'), '302a300506032b6570032100010203');
    await fireEvent.update(screen.getByLabelText('Encoding'), 'hex');
    await fireEvent.update(screen.getByLabelText('Key Format'), 'derX509SubjectPublicKeyInfo');
    await fireEvent.update(screen.getByLabelText('Key Type'), 'ed25519');
    await fireEvent.click(screen.getByRole('button', { name: 'Search Namespaces' }));

    expect(await screen.findByText('1220a')).toBeInTheDocument();
    expect(fetchPartyFingerprints).toHaveBeenLastCalledWith({
      limit: 15,
      publicKey: '302a300506032b6570032100010203',
      encoding: 'hex',
      keyFormat: 'derX509SubjectPublicKeyInfo',
      keyType: 'ed25519',
    });
  });

  it('paginates active parties and local parties with newer and older controls', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([
      {
        id: 'participant-1',
        label: 'Participant 1',
        role: 'participant',
        mode: 'pqs_with_grpc',
        ledgerLabel: 'Retail Ledger',
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
          ledgerApiVersion: null,
        },
        ledgerSummary: {
          ledgerLabel: 'Retail Ledger',
          pqsDatabase: 'participant_1',
          activeContractCount: 1,
          latestOffset: null,
          latestEventAt: null,
          totalUpdateCount: 0,
        },
        sourceStatus: {
          pqs: { ok: true, checkedAt: '', latencyMs: 1, message: null },
          grpc: { ok: true, checkedAt: '', latencyMs: 1, message: null },
        },
      },
    ]);
    vi.mocked(fetchNodeActiveParties).mockResolvedValue({
      nodeId: 'participant-1',
      label: 'Participant 1',
      mode: 'pqs_with_grpc',
      parties: Array.from({ length: 18 }, (_, index) => `Active ${String(index + 1).padStart(2, '0')}`),
    });
    vi.mocked(fetchNodeLocalParties).mockResolvedValue({
      nodeId: 'participant-1',
      label: 'Participant 1',
      mode: 'pqs_with_grpc',
      parties: Array.from({ length: 18 }, (_, index) => `Local ${String(index + 1).padStart(2, '0')}`),
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

    expect(await screen.findByRole('link', { name: 'Active 01' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Active 16' })).not.toBeInTheDocument();
    const newerButton = screen.getByRole('button', { name: 'Newer' });
    const olderButton = screen.getByRole('button', { name: 'Older' });
    expect(newerButton).toHaveClass('dashboard__refresh');
    expect(newerButton.querySelector('.node-updates__pagination-icon--newer')).not.toBeNull();
    expect(olderButton.querySelector('.node-updates__pagination-icon--older')).not.toBeNull();
    expect(olderButton).not.toBeDisabled();
    expect(newerButton).toBeDisabled();

    await fireEvent.click(olderButton);

    expect(await screen.findByRole('link', { name: 'Active 16' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Older' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Newer' })).not.toBeDisabled();

    await fireEvent.click(screen.getByRole('button', { name: 'All Parties' }));

    expect(await screen.findByRole('link', { name: 'Local 01' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Local 16' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Older' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Newer' })).toBeDisabled();

    await fireEvent.click(screen.getByRole('button', { name: 'Older' }));

    expect(await screen.findByRole('link', { name: 'Local 16' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Older' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Newer' })).not.toBeDisabled();
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
          ledgerApiVersion: null,
        },
        ledgerSummary: {
          ledgerLabel: 'Retail Ledger 2',
          pqsDatabase: 'participant_2',
          activeContractCount: 1,
          latestOffset: null,
          latestEventAt: null,
          totalUpdateCount: 0,
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

  it('shows a pqs error message instead of the empty-state copy when active party loading fails', async () => {
    vi.mocked(fetchNodes).mockResolvedValue([
      {
        id: 'participant-2',
        label: 'Participant 2',
        role: 'participant',
        mode: 'pqs_with_grpc',
        ledgerLabel: 'Retail Ledger 2',
        status: 'degraded',
        latencyMs: 1,
        lastSuccessAt: null,
        lastErrorAt: null,
        errorSummary: 'PQS unavailable',
        serviceInfo: {
          target: 'localhost:5012',
          reachable: true,
          healthCheckImplemented: true,
          servingStatus: 'SERVING',
          ledgerApiVersion: null,
        },
        ledgerSummary: {
          ledgerLabel: 'Retail Ledger 2',
          pqsDatabase: 'participant_2',
          activeContractCount: 1,
          latestOffset: null,
          latestEventAt: null,
          totalUpdateCount: 0,
        },
        sourceStatus: {
          pqs: { ok: false, checkedAt: '', latencyMs: 1, message: 'connect ECONNREFUSED' },
          grpc: { ok: true, checkedAt: '', latencyMs: 1, message: null },
        },
      },
    ]);
    vi.mocked(fetchNodeActiveParties).mockResolvedValue({
      nodeId: 'participant-2',
      label: 'Participant 2',
      mode: 'pqs_with_grpc',
      parties: [],
      activePartiesStatus: 'pqs_error',
      activePartiesError: 'connect ECONNREFUSED 127.0.0.1:5542',
    });
    vi.mocked(fetchNodeLocalParties).mockResolvedValue({
      nodeId: 'participant-2',
      label: 'Participant 2',
      mode: 'pqs_with_grpc',
      parties: [],
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

    expect(
      await screen.findByText('PQS error while listing active parties for this node.'),
    ).toBeInTheDocument();
    expect(screen.getByText('connect ECONNREFUSED 127.0.0.1:5542')).toBeInTheDocument();
    expect(screen.queryByText('No active parties found for this node.')).not.toBeInTheDocument();
  });
});
