import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/vue';
import { defineComponent } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchBranding } from './lib/api';
import App from './App.vue';

vi.mock('./lib/api', () => ({
  fetchBranding: vi.fn().mockResolvedValue({
    applicationTitle: 'Canton Explorer',
    headerTitle: 'Canton Explorer',
  }),
}));

const fetchBrandingMock = vi.mocked(fetchBranding);
const defaultBranding = {
  applicationTitle: 'Canton Explorer',
  headerTitle: 'Canton Explorer',
};

const HomeStub = defineComponent({
  template: '<div>Home Dashboard View</div>',
});

const UpdatesStub = defineComponent({
  template: '<div>Updates View</div>',
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

const CantonCoinStub = defineComponent({
  template: '<div>Canton Coin View</div>',
});

const PackageStub = defineComponent({
  template: '<div>Package View</div>',
});

const NamespaceStub = defineComponent({
  template: '<div>Namespace View</div>',
});

const LegacyTransactionStub = defineComponent({
  template: '<div>Legacy Transaction View</div>',
});

const themePreference = {
  matches: false,
};

async function renderAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: HomeStub },
      { path: '/updates', component: UpdatesStub },
      { path: '/nodes', component: ActivityStub },
      { path: '/parties', component: PartiesStub },
      { path: '/contracts', component: ContractsStub },
      { path: '/tokens', component: TokensStub },
      { path: '/canton-coin', component: CantonCoinStub },
      { path: '/settings', component: SettingsStub },
      { path: '/traffic', component: TrafficStub },
      { path: '/debugger', component: DebuggerStub },
      { path: '/tokens/transfers/:updateId', component: TokenTransferDetailStub, props: true },
      { path: '/tokens/:tokenId', component: TokensStub, props: true },
      { path: '/tx/:updateId', component: LegacyTransactionStub, props: true },
      { path: '/packages/:packageId', component: PackageStub, props: true },
      { path: '/packages/by-name/:packageName', component: PackageStub, props: true },
      { path: '/namespaces/:namespaceId', component: NamespaceStub, props: true },
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
    document.title = defaultBranding.applicationTitle;
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
    fetchBrandingMock.mockReset();
    fetchBrandingMock.mockResolvedValue(defaultBranding);
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

  it('keeps the default header and document title', async () => {
    await renderAt('/');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Canton Explorer' })).toBeInTheDocument();
      expect(document.title).toBe('Canton Explorer');
    });
  });

  it('applies configured header and application titles after loading branding', async () => {
    fetchBrandingMock.mockResolvedValueOnce({
      applicationTitle: 'Configured App',
      headerTitle: 'Configured Header',
    });

    await renderAt('/');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Configured Header' })).toBeInTheDocument();
      expect(document.title).toBe('Configured App');
    });
  });

  it('keeps independent defaults when branding loading is rejected', async () => {
    const brandingRequest = Promise.reject(new Error('branding unavailable'));
    fetchBrandingMock.mockReturnValueOnce(brandingRequest);

    await renderAt('/');

    await expect(brandingRequest).rejects.toThrow('branding unavailable');
    expect(fetchBrandingMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Canton Explorer' })).toBeInTheDocument();
    expect(document.title).toBe('Canton Explorer');
  });

  it('restores the previous document title when the shell unmounts', async () => {
    const previousTitle = 'Previous Page';
    document.title = previousTitle;
    fetchBrandingMock.mockResolvedValueOnce({
      applicationTitle: 'Configured App',
      headerTitle: 'Configured Header',
    });

    const { unmount } = await renderAt('/');

    await waitFor(() => {
      expect(document.title).toBe('Configured App');
    });

    unmount();

    expect(document.title).toBe(previousTitle);
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
    const ledgerButton = screen.getByRole('button', { name: 'Home' });
    expect(ledgerButton).toHaveAttribute('aria-expanded', 'false');
    expect(container.querySelectorAll('svg.app-navigation__arrow')).toHaveLength(3);
    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Traffic Purchases' })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Ledger navigation' })).not.toBeInTheDocument();
    await fireEvent.click(ledgerButton);
    expect(ledgerButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Updates' })).toHaveAttribute('href', '/updates');
    expect(screen.getByRole('link', { name: 'Contracts' })).toHaveAttribute('href', '/contracts');
    expect(screen.getByRole('link', { name: 'Tokens' })).toHaveAttribute('href', '/tokens');
    expect(screen.getByRole('link', { name: 'Canton Coin' })).toHaveAttribute('href', '/canton-coin');
    expect(screen.getByText('Ledger', { selector: '.app-navigation__group-label' })).toBeInTheDocument();
    expect(screen.getByText('Assets', { selector: '.app-navigation__group-label' })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Search'),
    ).toBeInTheDocument();
    expect(screen.getByText('Home Dashboard View')).toBeInTheDocument();
    expect(screen.queryByText('Canton Operations')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Operational clarity for connected Canton environments.'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      '@distrohelena/canton-explorer powered by @distrohelena/canton-typescript-sdk - version',
    );
    expect(screen.getByRole('contentinfo')).toHaveTextContent(`- version ${__CANTON_EXPLORER_VERSION__}`);
    expect(
      screen.getByRole('link', { name: '@distrohelena/canton-explorer' }),
    ).toHaveAttribute('href', 'https://www.npmjs.com/package/@distrohelena/canton-explorer');
    expect(
      screen.getByRole('link', { name: '@distrohelena/canton-typescript-sdk' }),
    ).toHaveAttribute('href', 'https://www.npmjs.com/package/@distrohelena/canton-typescript-sdk');
  });

  it('renders the three navigation menus with exact direct link sets', async () => {
    await renderAt('/');

    const ledgerTrigger = screen.getByRole('button', { name: 'Home' });
    const networkTrigger = screen.getByRole('button', { name: 'Network' });
    const systemTrigger = screen.getByRole('button', { name: 'System' });

    expect(ledgerTrigger).toHaveAttribute('aria-controls', 'app-navigation-menu-ledger');
    expect(networkTrigger).toHaveAttribute('aria-controls', 'app-navigation-menu-network');
    expect(systemTrigger).toHaveAttribute('aria-controls', 'app-navigation-menu-system');
    expect(new Set([ledgerTrigger.id, networkTrigger.id, systemTrigger.id]).size).toBe(3);

    await fireEvent.click(ledgerTrigger);

    const ledgerNavigation = screen.getByRole('navigation', { name: 'Ledger navigation' });
    expect(within(ledgerNavigation).getAllByRole('link').map((link) => link.textContent?.trim())).toEqual([
      'Home',
      'Updates',
      'Contracts',
      'Tokens',
      'Canton Coin',
    ]);
    expect(screen.queryByRole('navigation', { name: 'Network navigation' })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'System navigation' })).not.toBeInTheDocument();
  });

  it('keeps category parents inside each navigation menu', async () => {
    await renderAt('/');

    const expectedGroups = [
      ['Ledger', 'Assets'],
      ['Network', 'Traffic'],
      ['Tools'],
    ];

    for (const [index, menuId] of ['ledger', 'network', 'system'].entries()) {
      const trigger = screen.getByRole('button', {
        name: index === 0 ? 'Home' : index === 1 ? 'Network' : 'System',
      });
      await fireEvent.click(trigger);
      const navigation = screen.getByRole('navigation', { name: `${menuId[0].toUpperCase()}${menuId.slice(1)} navigation` });
      expect(
        within(navigation)
          .getAllByText((_, element) => element?.classList.contains('app-navigation__group-label') ?? false)
          .map((label) => label.textContent?.trim()),
      ).toEqual(expectedGroups[index]);
    }
  });

  it('switches menus and supports keyboard dismissal without opening on focus alone', async () => {
    await renderAt('/');

    const ledgerTrigger = screen.getByRole('button', { name: 'Home' });
    const networkTrigger = screen.getByRole('button', { name: 'Network' });

    await fireEvent.focus(ledgerTrigger);
    expect(screen.queryByRole('navigation', { name: 'Ledger navigation' })).not.toBeInTheDocument();

    await fireEvent.keyDown(ledgerTrigger, { key: 'Enter', code: 'Enter' });
    expect(screen.getByRole('navigation', { name: 'Ledger navigation' })).toBeInTheDocument();

    await fireEvent.click(networkTrigger);
    expect(screen.queryByRole('navigation', { name: 'Ledger navigation' })).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Network navigation' })).toBeInTheDocument();

    await fireEvent.keyDown(networkTrigger, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByRole('navigation', { name: 'Network navigation' })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(networkTrigger);
  });

  it('keeps a menu open when clicking immediately after hover opens it', async () => {
    const { container } = await renderAt('/');
    const networkWrapper = container.querySelectorAll('.app-navigation')[1];
    const networkTrigger = screen.getByRole('button', { name: 'Network' });

    await fireEvent.pointerEnter(networkWrapper);
    expect(screen.getByRole('navigation', { name: 'Network navigation' })).toBeInTheDocument();

    await fireEvent.click(networkTrigger);
    expect(screen.getByRole('navigation', { name: 'Network navigation' })).toBeInTheDocument();
  });

  it('closes a menu when focus leaves its trigger and menu area', async () => {
    const { container } = await renderAt('/');
    const ledgerTrigger = screen.getByRole('button', { name: 'Home' });
    const navigationWrapper = container.querySelector('.app-navigation');

    await fireEvent.click(ledgerTrigger);
    expect(screen.getByRole('navigation', { name: 'Ledger navigation' })).toBeInTheDocument();

    await fireEvent.focusOut(navigationWrapper!, { relatedTarget: document.body });
    expect(screen.queryByRole('navigation', { name: 'Ledger navigation' })).not.toBeInTheDocument();
  });

  it('uses the owning menu title for deep and utility routes', async () => {
    const cases = [
      ['/traffic', 'Network', 'Purchases'],
      ['/tokens/Amulet', 'Ledger', 'Tokens'],
      ['/nodes/participant-1/contracts/00abc', 'Ledger', 'Contracts'],
      ['/packages/pkg-1', 'Ledger', 'Contracts'],
      ['/namespaces/ns-1', 'Ledger', 'Contracts'],
      ['/tx/update-1', 'Ledger', 'Updates'],
      ['/search', 'Ledger', 'Search'],
    ] as const;

    for (const [path, section, title] of cases) {
      cleanup();
      await renderAt(path);
      expect(screen.getByRole('button', { name: title })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: section })).not.toBeInTheDocument();
    }
  });

  it('closes the active menu when the route changes', async () => {
    const { router } = await renderAt('/');
    const ledgerTrigger = screen.getByRole('button', { name: 'Home' });

    await fireEvent.click(ledgerTrigger);
    expect(screen.getByRole('navigation', { name: 'Ledger navigation' })).toBeInTheDocument();

    await router.push('/updates');
    await waitFor(() => {
      expect(screen.queryByRole('navigation', { name: 'Ledger navigation' })).not.toBeInTheDocument();
    });
  });

  it('closes the active menu when clicking outside all navigation wrappers', async () => {
    await renderAt('/');

    const ledgerButton = screen.getByRole('button', { name: 'Home' });
    await fireEvent.click(ledgerButton);
    expect(screen.getByRole('navigation', { name: 'Ledger navigation' })).toBeInTheDocument();

    await fireEvent.click(document.body);

    expect(screen.queryByRole('navigation', { name: 'Ledger navigation' })).not.toBeInTheDocument();
    expect(ledgerButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens and closes the Explore menu when hovering over its area', async () => {
    const { container } = await renderAt('/');

    const navigationArea = container.querySelector('.app-navigation');
    expect(navigationArea).not.toBeNull();

    await fireEvent.pointerEnter(navigationArea!);

    expect(screen.getByRole('navigation', { name: 'Ledger navigation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-expanded', 'true');

    await fireEvent.pointerLeave(navigationArea!);

    expect(screen.queryByRole('navigation', { name: 'Ledger navigation' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('updates the Explore label to the selected page title', async () => {
    const { router } = await renderAt('/');

    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument();

    await router.push('/updates');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Updates' })).toBeInTheDocument();
      expect(screen.getByText('Updates View')).toBeInTheDocument();
    });

    await router.push('/nodes/participant-1');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Nodes' })).toBeInTheDocument();
    });

    await router.push('/nodes');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Nodes' })).toBeInTheDocument();
      expect(screen.getByText('Nodes View')).toBeInTheDocument();
    });
  });

  it('keeps the shared shell on the nodes route', async () => {
    await renderAt('/nodes');

    expect(screen.getByRole('button', { name: 'Nodes' })).toBeInTheDocument();
    expect(screen.getByText('Nodes View')).toBeInTheDocument();
  });

  it('keeps the shared shell on the parties route', async () => {
    await renderAt('/parties');

    expect(screen.getByRole('button', { name: 'Parties' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Debugger' })).not.toBeInTheDocument();
    expect(screen.getByText('Parties View')).toBeInTheDocument();
  });

  it('keeps the shared shell on the contracts route', async () => {
    await renderAt('/contracts');

    expect(screen.getByRole('button', { name: 'Contracts' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Debugger' })).not.toBeInTheDocument();
    expect(screen.getByText('Contracts View')).toBeInTheDocument();
  });

  it('keeps the shared shell on the tokens route', async () => {
    await renderAt('/tokens');

    expect(screen.getByRole('button', { name: 'Tokens' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Debugger' })).not.toBeInTheDocument();
    expect(screen.getByText('Tokens View')).toBeInTheDocument();
  });

  it('renders the Traffic menu and keeps the shared shell on traffic purchases', async () => {
    const { router } = await renderAt('/traffic');

    const networkButton = screen.getByRole('button', { name: 'Purchases' });
    await fireEvent.click(networkButton);
    expect(screen.getByRole('navigation', { name: 'Network navigation' })).toBeInTheDocument();
    expect(screen.getByText('Traffic', { selector: '.app-navigation__group-label' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Purchases' })).toHaveAttribute('href', '/traffic');
    expect(screen.getByText('Traffic Purchases View')).toBeInTheDocument();
    expect(router.currentRoute.value.path).toBe('/traffic');
  });

  it('keeps the shared shell on the debugger route', async () => {
    const { container } = await renderAt('/debugger');

    expect(screen.getByRole('button', { name: 'Debugger' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Debugger' })).not.toBeInTheDocument();
    expect(screen.getByText('Debugger View')).toBeInTheDocument();
    expect(container.querySelector('.app-shell--debugger')).not.toBeNull();
    expect(container.querySelector('.app-frame--debugger')).not.toBeNull();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Debugger' })).toBeInTheDocument();
  });

  it('keeps the shared shell on a token transfer detail route', async () => {
    await renderAt('/tokens/transfers/token-update-2');

    expect(screen.getByRole('button', { name: 'Tokens' })).toBeInTheDocument();
    expect(screen.getByText('Token Transfer Detail View')).toBeInTheDocument();
  });

  it('keeps the shared shell on a node detail route', async () => {
    await renderAt('/nodes/participant-1');

    expect(screen.getByRole('button', { name: 'Nodes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Canton Explorer' })).toBeInTheDocument();
    expect(screen.queryByText('Current Node')).not.toBeInTheDocument();
  });

  it('keeps the shared shell on an update detail route', async () => {
    await renderAt(
      '/nodes/participant-1/updates/1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
    );

    expect(screen.getByRole('button', { name: 'Updates' })).toBeInTheDocument();
    expect(screen.getByText('Update Detail View')).toBeInTheDocument();
  });

  it('keeps the shared shell on a contract detail route', async () => {
    await renderAt('/nodes/participant-1/contracts/00abc');

    expect(screen.getByRole('button', { name: 'Contracts' })).toBeInTheDocument();
    expect(screen.getByText('Contract Detail View')).toBeInTheDocument();
  });

  it('routes the logo and title brand link back to home', async () => {
    const { container } = await renderAt('/nodes');

    const brandLink = screen.getByRole('link', { name: 'Canton Explorer' });
    expect(brandLink).toHaveAttribute('href', '/');
    expect(container.querySelector('img[src="/cantonexplorer.png"]')?.closest('a')).toBe(brandLink);

    await fireEvent.click(brandLink);

    expect(await screen.findByText('Home Dashboard View')).toBeInTheDocument();
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

    expect(screen.getByText('Home Dashboard View')).toBeInTheDocument();
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
