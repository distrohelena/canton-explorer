import { cleanup, fireEvent, render, screen } from '@testing-library/vue';
import { afterEach, describe, expect, it } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import DebuggerScopePanel from './DebuggerScopePanel.vue';

describe('DebuggerScopePanel', () => {
  afterEach(() => {
    cleanup();
  });

  async function renderScopePanel(props: {
    scopes: Array<{
      frameId: string | null;
      name: string | null;
      variables: Array<{
        name: string | null;
        kind: string | null;
        value: string | null;
      }>;
    }>;
    nodeId?: string | null;
  }) {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div>Home</div>' } },
        { path: '/nodes/:id/contracts/:contractId', component: { template: '<div>Contract</div>' } },
        { path: '/parties/:partyId', component: { template: '<div>Party</div>' } },
      ],
    });

    router.push('/');
    await router.isReady();

    return render(DebuggerScopePanel, {
      props,
      global: {
        plugins: [router],
      },
    });
  }

  it('renders grouped scope variables by frame', async () => {
    await renderScopePanel({
        scopes: [
          {
            frameId: 'frame-1',
            name: 'Archive',
            variables: [
              {
                name: 'owner',
                kind: 'text',
                value: 'Alice',
              },
            ],
          },
        ],
    });

    expect(screen.getByText('In-Scope Variables')).toBeInTheDocument();
    expect(screen.getByText('Archive')).toBeInTheDocument();
    expect(screen.getByText('owner')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Archive/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders selfContractId as self while preserving the contractId kind', async () => {
    await renderScopePanel({
        nodeId: 'cnqs-sv',
        scopes: [
          {
            frameId: 'frame-1',
            name: 'Choice',
            variables: [
              {
                name: 'selfContractId',
                kind: 'contractId',
                value: '00abc',
              },
            ],
          },
        ],
    });

    expect(screen.getByText('self')).toBeInTheDocument();
    expect(screen.getByText('contractId')).toBeInTheDocument();
    expect(screen.queryByText('selfContractId')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '00abc' })).toHaveAttribute('href', '/nodes/cnqs-sv/contracts/00abc');
    expect(screen.getByRole('link', { name: '00abc' })).toHaveAttribute('target', '_blank');
  });

  it('allows each scope frame to be collapsed and expanded', async () => {
    await renderScopePanel({
        scopes: [
          {
            frameId: 'frame-1',
            name: 'Archive',
            variables: [
              {
                name: 'owner',
                kind: 'text',
                value: 'Alice',
              },
            ],
          },
        ],
    });

    const toggle = screen.getByRole('button', { name: /Archive/ });

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('owner')).toBeInTheDocument();

    await fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('owner')).not.toBeInTheDocument();

    await fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('owner')).toBeInTheDocument();
  });

  it('renders party-typed values as party detail links', async () => {
    await renderScopePanel({
        scopes: [
          {
            frameId: 'frame-1',
            name: 'Choice',
            variables: [
              {
                name: 'ds10',
                kind: 'party',
                value: 'vault-integration-alice-simulation-user-17::12205af0d2665949f3e6ddc38133b790acf63907a1d49fdf41c43a4649b5aa2050fb',
              },
            ],
          },
        ],
    });

    expect(screen.getByText('party')).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: 'vault-integration-alice-simulation-user-17::12205af0d2665949f3e6ddc38133b790acf63907a1d49fdf41c43a4649b5aa2050fb',
      }),
    ).toHaveAttribute(
      'href',
      '/parties/vault-integration-alice-simulation-user-17%3A%3A12205af0d2665949f3e6ddc38133b790acf63907a1d49fdf41c43a4649b5aa2050fb',
    );
    expect(
      screen.getByRole('link', {
        name: 'vault-integration-alice-simulation-user-17::12205af0d2665949f3e6ddc38133b790acf63907a1d49fdf41c43a4649b5aa2050fb',
      }),
    ).toHaveAttribute('target', '_blank');
  });
});
