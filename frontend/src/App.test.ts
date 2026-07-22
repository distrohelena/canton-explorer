import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { defineComponent } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.vue';

const HomeStub = defineComponent({
  template: '<div>Home Activity View</div>',
});

const ActivityStub = defineComponent({
  template: '<div>Nodes View</div>',
});

const PartiesStub = defineComponent({
  template: '<div>Parties View</div>',
});

const ContractsStub = defineComponent({
  template: '<div>Contracts View</div>',
});

const TokensStub = defineComponent({
  template: '<div>Tokens View</div>',
});

const SettingsStub = defineComponent({
  template: '<div>Settings View</div>',
});

const TrafficStub = defineComponent({
  template: '<div>Traffic Purchases View</div>',
});

const DebuggerStub = defineComponent({
  template: '<div>Debugger View</div>',
});

const TokenTransferDetailStub = defineComponent({
  template: '<div>Token Transfer Detail View</div>',
});

const UpdateDetailStub = defineComponent({
  template: '<div>Update Detail View</div>',
});

const ContractDetailStub = defineComponent({
  template: '<div>Contract Detail View</div>',
});

const NodeStub = defineComponent({
  template: '<div>Node View</div>',
});

const PartyDetailStub = defineComponent({
  template: '<div>Party Detail View</div>',
});

const SearchResultsStub = defineComponent({
  template: '<div>Search Results View</div>',
});

const themePreference = {
  matches: false,
};

async function renderAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: HomeStub },
      { path: '/nodes', component: ActivityStub },
      { path: '/parties', component: PartiesStub },
      { path: '/contracts', component: ContractsStub },
      { path: '/tokens', component: TokensStub },
      { path: '/settings', component: SettingsStub },
      { path: '/traffic', component: TrafficStub },
      { path: '/debugger', component: DebuggerStub },
      { path: '/tokens/transfers/:updateId', component: TokenTransferDetailStub, props: true },
      { path: '/search', component: SearchResultsStub },
      { path: '/nodes/:id/updates/:eventOffset', component: UpdateDetailStub, props: true },
      { path: '/nodes/:id/contracts/:contractId', component: ContractDetailStub, props: true },
      { path: '/parties/:partyId', component: PartyDetailStub, props: true },
      { path: '/nodes/:id', component: NodeStub, props: true },
    ],
  });

  router.push(path);
  await router.isReady();

  return {
    router,
    ...render(App, {
    global: {
      plugins: [router],
    },
    }),
  };
}

describe('App', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
    themePreference.matches = false;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: themePreference.matches,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('renders home and the available navigation on the home route', async () => {
    const { container } = await renderAt('/');

    expect(screen.getByRole('heading', { name: 'Canton Explorer' })).toBeInTheDocument();
    expect(container.querySelector('img[src="/cantonexplorer.png"]')).not.toBeNull();
    expect(screen.queryByRole('link', { name: 'Updates' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Nodes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Parties' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Contracts' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Tokens' })).not.toBeInTheDocument();
    const exploreButton = screen.getByRole('button', { name: 'Ledger' });
    expect(exploreButton).toHaveAttribute('aria-expanded', 'false');
    expect(container.querySelector('svg.app-explore__arrow')).not.toBeNull();
    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Traffic Purchases' })).not.toBeInTheDocument();
    expect(screen.queryByText('Traffic', { selector: '.app-explore__group-label' })).not.toBeInTheDocument();
    await fireEvent.click(exploreButton);
    expect(exploreButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
    expect(screen.getByRole('link', { name: 'Updates' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('link', { name: 'Activity' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nodes' })).toHaveAttribute('href', '/nodes');
    expect(screen.getByText('Traffic', { selector: '.app-explore__group-label' })).toBeInTheDocument();
    expect(screen.getByText('Ledger', { selector: '.app-explore__group-label' })).toBeInTheDocument();
    expect(screen.getByText('Network', { selector: '.app-explore__group-label' })).toBeInTheDocument();
    expect(screen.getByText('Assets', { selector: '.app-explore__group-label' })).toBeInTheDocument();
    expect(screen.getByText('Tools', { selector: '.app-explore__group-label' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Traffic Purchases' })).toHaveAttribute('href', '/traffic');
    expect(screen.getByRole('link', { name: 'Debugger' })).toHaveAttribute('href', '/debugger');
    expect(
      screen.getByPlaceholderText('Search'),
    ).toBeInTheDocument();
    expect(screen.getByText('Home Activity View')).toBeInTheDocument();
    expect(screen.queryByText('Canton Operations')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Operational clarity for connected Canton environments.'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      'powered by @distrohelena/canton-typescript-sdk',
    );
    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      `version ${__CANTON_EXPLORER_VERSION__}`,
    );
    expect(
      screen.getByRole('link', { name: '@distrohelena/canton-typescript-sdk' }),
    ).toHaveAttribute('href', 'https://www.npmjs.com/package/@distrohelena/canton-typescript-sdk');
  });

  it('closes the Explore menu when clicking outside it', async () => {
    await renderAt('/');

    const exploreButton = screen.getByRole('button', { name: 'Ledger' });
    await fireEvent.click(exploreButton);
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();

    await fireEvent.click(document.body);

    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
    expect(exploreButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('updates the Explore label to the selected high-level section', async () => {
    const { router } = await renderAt('/');

    await router.push('/nodes/participant-1');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Network' })).toBeInTheDocument();
    });

    await router.push('/nodes');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Network' })).toBeInTheDocument();
      expect(screen.getByText('Nodes View')).toBeInTheDocument();
    });
  });

  it('keeps the shared shell on the nodes route', async () => {
    await renderAt('/nodes');

    expect(screen.getByRole('button', { name: 'Network' })).toBeInTheDocument();
    expect(screen.getByText('Nodes View')).toBeInTheDocument();
  });

  it('keeps the shared shell on the parties route', async () => {
    await renderAt('/parties');

    expect(screen.getByRole('button', { name: 'Network' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Debugger' })).not.toBeInTheDocument();
    expect(screen.getByText('Parties View')).toBeInTheDocument();
  });

  it('keeps the shared shell on the contracts route', async () => {
    await renderAt('/contracts');

    expect(screen.getByRole('button', { name: 'Ledger' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Debugger' })).not.toBeInTheDocument();
    expect(screen.getByText('Contracts View')).toBeInTheDocument();
  });

  it('keeps the shared shell on the tokens route', async () => {
    await renderAt('/tokens');

    expect(screen.getByRole('button', { name: 'Assets' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Debugger' })).not.toBeInTheDocument();
    expect(screen.getByText('Tokens View')).toBeInTheDocument();
  });

  it('renders the Traffic menu and keeps the shared shell on traffic purchases', async () => {
    const { container, router } = await renderAt('/traffic');

    const exploreButton = screen.getByRole('button', { name: 'Traffic' });
    expect(container.querySelector('.app-explore__group-label')).not.toBeInTheDocument();
    await fireEvent.click(exploreButton);
    expect(screen.getByText('Traffic', { selector: '.app-explore__group-label' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Traffic' })).toBe(exploreButton);
    expect(screen.getByRole('link', { name: 'Traffic Purchases' })).toHaveAttribute('href', '/traffic');
    expect(screen.getByText('Traffic Purchases View')).toBeInTheDocument();
    expect(router.currentRoute.value.path).toBe('/traffic');
  });

  it('keeps the shared shell on the debugger route', async () => {
    const { container } = await renderAt('/debugger');

    expect(screen.getByRole('button', { name: 'Tools' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Debugger' })).not.toBeInTheDocument();
    expect(screen.getByText('Debugger View')).toBeInTheDocument();
    expect(container.querySelector('.app-shell--debugger')).not.toBeNull();
    expect(container.querySelector('.app-frame--debugger')).not.toBeNull();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tools' })).toBeInTheDocument();
  });

  it('keeps the shared shell on a token transfer detail route', async () => {
    await renderAt('/tokens/transfers/token-update-2');

    expect(screen.getByRole('button', { name: 'Assets' })).toBeInTheDocument();
    expect(screen.getByText('Token Transfer Detail View')).toBeInTheDocument();
  });

  it('keeps the shared shell on a node detail route', async () => {
    await renderAt('/nodes/participant-1');

    expect(screen.getByRole('button', { name: 'Network' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Canton Explorer' })).toBeInTheDocument();
    expect(screen.queryByText('Current Node')).not.toBeInTheDocument();
  });

  it('keeps the shared shell on an update detail route', async () => {
    await renderAt(
      '/nodes/participant-1/updates/1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
    );

    expect(screen.getByRole('button', { name: 'Network' })).toBeInTheDocument();
    expect(screen.getByText('Update Detail View')).toBeInTheDocument();
  });

  it('keeps the shared shell on a contract detail route', async () => {
    await renderAt('/nodes/participant-1/contracts/00abc');

    expect(screen.getByRole('button', { name: 'Network' })).toBeInTheDocument();
    expect(screen.getByText('Contract Detail View')).toBeInTheDocument();
  });

  it('routes the logo and title brand link back to home', async () => {
    const { container } = await renderAt('/nodes');

    const brandLink = screen.getByRole('link', { name: 'Canton Explorer' });
    expect(brandLink).toHaveAttribute('href', '/');
    expect(container.querySelector('img[src="/cantonexplorer.png"]')?.closest('a')).toBe(brandLink);

    await fireEvent.click(brandLink);

    expect(await screen.findByText('Home Activity View')).toBeInTheDocument();
  });

  it('routes titlebar search input to the search page on submit', async () => {
    await renderAt('/');

    const searchInput = screen.getByPlaceholderText('Search');
    await fireEvent.update(searchInput, 'Alice');
    await fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    expect(await screen.findByText('Search Results View')).toBeInTheDocument();
  });

  it('trims the titlebar search input before routing to the search page', async () => {
    await renderAt('/');

    const searchInput = screen.getByPlaceholderText('Search');
    await fireEvent.update(searchInput, ' Alice ');
    await fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    expect(await screen.findByText('Search Results View')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument();
  });

  it('does not navigate on whitespace-only titlebar search input', async () => {
    await renderAt('/');

    const searchInput = screen.getByPlaceholderText('Search');
    await fireEvent.update(searchInput, '   ');
    await fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    expect(screen.getByText('Home Activity View')).toBeInTheDocument();
    expect(screen.queryByText('Search Results View')).not.toBeInTheDocument();
  });

  it('restores the titlebar search input from the search query string', async () => {
    await renderAt('/search?q=Alice');

    expect(screen.getByText('Search Results View')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument();
  });

  it('defaults to dark mode when the system preference is dark', async () => {
    themePreference.matches = true;
    const { container } = await renderAt('/');

    expect(container.querySelector('.app-shell')).toHaveAttribute('data-theme', 'dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toHaveTextContent('☀');
  });

  it('restores a saved theme override over the system preference', async () => {
    themePreference.matches = true;
    window.localStorage.setItem('canton-explorer-theme', 'light');
    const { container } = await renderAt('/');

    expect(container.querySelector('.app-shell')).toHaveAttribute('data-theme', 'light');
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toHaveTextContent('☾');
  });

  it('toggles theme from the round header button and persists the override', async () => {
    const { container } = await renderAt('/');
    const toggleButton = screen.getByRole('button', { name: 'Switch to dark mode' });

    await fireEvent.click(toggleButton);

    expect(container.querySelector('.app-shell')).toHaveAttribute('data-theme', 'dark');
    expect(window.localStorage.getItem('canton-explorer-theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toHaveTextContent('☀');
  });

});
