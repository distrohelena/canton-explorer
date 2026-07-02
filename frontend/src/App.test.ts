import { render, screen } from '@testing-library/vue';
import { defineComponent } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App.vue';

const HomeStub = defineComponent({
  template: '<div>Home Activity View</div>',
});

const NodesStub = defineComponent({
  template: '<div>Nodes View</div>',
});

const NodeUpdatesStub = defineComponent({
  template: '<div>Node Updates View</div>',
});

const UpdateDetailStub = defineComponent({
  template: '<div>Update Detail View</div>',
});

const NodeStub = defineComponent({
  template: '<div>Node View</div>',
});

async function renderAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: HomeStub },
      { path: '/nodes', component: NodesStub },
      { path: '/nodes/:id/updates', component: NodeUpdatesStub, props: true },
      { path: '/nodes/:id/updates/:updateId', component: UpdateDetailStub, props: true },
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
  });

  it('renders home and nodes navigation on the home route', async () => {
    await renderAt('/');

    expect(screen.getByRole('heading', { name: 'Canton Explorer' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '⌂ Home' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nodes' })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Search by Update ID or Party ID...'),
    ).toBeInTheDocument();
    expect(screen.getByText('Home Activity View')).toBeInTheDocument();
    expect(screen.queryByText('Canton Operations')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Operational clarity for connected Canton environments.'),
    ).not.toBeInTheDocument();
  });

  it('keeps the shared shell on the nodes route', async () => {
    await renderAt('/nodes');

    expect(screen.getByRole('link', { name: '⌂ Home' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nodes' })).toBeInTheDocument();
    expect(screen.getByText('Nodes View')).toBeInTheDocument();
  });

  it('keeps the shared shell on a node detail route', async () => {
    await renderAt('/nodes/participant-1');

    expect(screen.getByRole('link', { name: '⌂ Home' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nodes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Canton Explorer' })).toBeInTheDocument();
    expect(screen.queryByText('Current Node')).not.toBeInTheDocument();
  });

  it('keeps the shared shell on a node updates route', async () => {
    await renderAt('/nodes/participant-1/updates');

    expect(screen.getByRole('link', { name: '⌂ Home' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nodes' })).toBeInTheDocument();
    expect(screen.getByText('Node Updates View')).toBeInTheDocument();
  });

  it('keeps the shared shell on an update detail route', async () => {
    await renderAt(
      '/nodes/participant-1/updates/1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
    );

    expect(screen.getByRole('link', { name: '⌂ Home' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nodes' })).toBeInTheDocument();
    expect(screen.getByText('Update Detail View')).toBeInTheDocument();
  });
});
