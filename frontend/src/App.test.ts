import { fireEvent, render, screen } from '@testing-library/vue';
import { defineComponent } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.vue';

const HomeStub = defineComponent({
  template: '<div>Home Activity View</div>',
});

const NodesStub = defineComponent({
  template: '<div>Nodes View</div>',
});

const PartiesStub = defineComponent({
  template: '<div>Parties View</div>',
});

const NodeUpdatesStub = defineComponent({
  template: '<div>Node Updates View</div>',
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

const themePreference = {
  matches: false,
};

async function renderAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: HomeStub },
      { path: '/nodes', component: NodesStub },
      { path: '/parties', component: PartiesStub },
      { path: '/nodes/:id/updates', component: NodeUpdatesStub, props: true },
      { path: '/nodes/:id/updates/:eventOffset', component: UpdateDetailStub, props: true },
      { path: '/nodes/:id/contracts/:contractId', component: ContractDetailStub, props: true },
      { path: '/parties/:partyId', component: PartyDetailStub, props: true },
      { path: '/nodes/:id', component: NodeStub, props: true },
    ],
  });

  router.push(path);
  await router.isReady();

  return render(App, {
    global: {
      plugins: [router],
    },
  });
}

describe('App', () => {
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

  it('renders home and nodes navigation on the home route', async () => {
    const { container } = await renderAt('/');

    expect(screen.getByRole('heading', { name: 'Canton Explorer' })).toBeInTheDocument();
    expect(container.querySelector('img[src="/cantonexplorer.png"]')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nodes' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Parties' })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Search'),
    ).toBeInTheDocument();
    expect(screen.getByText('Home Activity View')).toBeInTheDocument();
    expect(screen.queryByText('Canton Operations')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Operational clarity for connected Canton environments.'),
    ).not.toBeInTheDocument();
  });

  it('keeps the shared shell on the nodes route', async () => {
    await renderAt('/nodes');

    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nodes' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Parties' })).toBeInTheDocument();
    expect(screen.getByText('Nodes View')).toBeInTheDocument();
  });

  it('keeps the shared shell on the parties route', async () => {
    await renderAt('/parties');

    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nodes' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Parties' })).toBeInTheDocument();
    expect(screen.getByText('Parties View')).toBeInTheDocument();
  });

  it('keeps the shared shell on a node detail route', async () => {
    await renderAt('/nodes/participant-1');

    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nodes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Canton Explorer' })).toBeInTheDocument();
    expect(screen.queryByText('Current Node')).not.toBeInTheDocument();
  });

  it('keeps the shared shell on a node updates route', async () => {
    await renderAt('/nodes/participant-1/updates');

    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nodes' })).toBeInTheDocument();
    expect(screen.getByText('Node Updates View')).toBeInTheDocument();
  });

  it('keeps the shared shell on an update detail route', async () => {
    await renderAt(
      '/nodes/participant-1/updates/1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
    );

    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nodes' })).toBeInTheDocument();
    expect(screen.getByText('Update Detail View')).toBeInTheDocument();
  });

  it('keeps the shared shell on a contract detail route', async () => {
    await renderAt('/nodes/participant-1/contracts/00abc');

    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nodes' })).toBeInTheDocument();
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

  it('routes titlebar search input to the party page on submit', async () => {
    await renderAt('/');

    const searchInput = screen.getByPlaceholderText('Search');
    await fireEvent.update(searchInput, 'Alice');
    await fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    expect(await screen.findByText('Party Detail View')).toBeInTheDocument();
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
