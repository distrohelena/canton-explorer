import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { defineComponent } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NodeUpdatesView from './NodeUpdatesView.vue';
import { fetchNodeTemplates, fetchNodeUpdates } from '../lib/api';
import type { NodeUpdatesResponse } from '../types/updates';

vi.mock('../lib/api', () => ({
  fetchNodeTemplates: vi.fn().mockResolvedValue({
    templates: [
      { templateId: 'Main:Asset' },
      { templateId: 'Main:Wallet' },
      { templateId: 'Splice.Amulet:Amulet' },
    ],
  }),
  fetchNodeUpdates: vi.fn(),
}));

const HomeStub = defineComponent({
  template: '<div>Home View</div>',
});

const UpdateDetailStub = defineComponent({
  template: '<div>Update Detail View</div>',
});

async function renderAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: HomeStub },
      { path: '/nodes/:id/updates', component: NodeUpdatesView, props: true },
      { path: '/nodes/:id/updates/:eventOffset', component: UpdateDetailStub, props: true },
    ],
  });

  router.push(path);
  await router.isReady();

  const rendered = render(
    {
      template: '<RouterView />',
    },
    {
      global: {
        plugins: [router],
      },
    },
  );

  return { ...rendered, router };
}

describe('NodeUpdatesView', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('renders offset-based updates pagination for the selected node', async () => {
    vi.mocked(fetchNodeUpdates)
      .mockResolvedValueOnce({
        nodeId: 'participant-1',
        label: 'Participant 1',
        limit: 25,
        nextBefore: '000000000000000099',
        nextAfter: null,
        updates: [
          {
            eventOffset: '000000000000000101',
            updateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
            recordTime: '2026-07-01T12:00:00.000Z',
            parties: ['Alice', 'Bob'],
          },
          {
            eventOffset: '000000000000000100',
            updateId: '00000000000000000000000000000000',
            recordTime: '2026-07-01T11:59:00.000Z',
            parties: [],
          },
        ],
      })
      .mockResolvedValueOnce({
        nodeId: 'participant-1',
        label: 'Participant 1',
        limit: 25,
        nextBefore: null,
        nextAfter: '000000000000000098',
        updates: [
          {
            eventOffset: '000000000000000098',
            updateId: '00000000000000000000000000000098',
            recordTime: '2026-07-01T11:58:00.000Z',
            parties: ['Carol'],
          },
          {
            eventOffset: '000000000000000097',
            updateId: '00000000000000000000000000000097',
            recordTime: '2026-07-01T11:57:00.000Z',
            parties: [],
          },
        ],
      });

    const formatMock = vi
      .fn()
      .mockReturnValueOnce('Jul 1, 2026')
      .mockReturnValueOnce('12:00:00 PM')
      .mockReturnValueOnce('Jul 1, 2026')
      .mockReturnValueOnce('11:59:00 AM')
      .mockReturnValueOnce('Jul 1, 2026')
      .mockReturnValueOnce('11:58:00 AM')
      .mockReturnValueOnce('Jul 1, 2026')
      .mockReturnValueOnce('11:57:00 AM');
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      function MockDateTimeFormat() {
        return {
          format: formatMock,
        } as unknown as Intl.DateTimeFormat;
      } as unknown as typeof Intl.DateTimeFormat,
    );

    const { container } = await renderAt('/nodes/participant-1/updates');

    expect(await screen.findByRole('heading', { name: 'Participant 1 Updates' })).toBeInTheDocument();
    expect(fetchNodeUpdates).toHaveBeenNthCalledWith(1, 'participant-1', { limit: 10 });
    expect(screen.queryByText('Latest 25 updates')).not.toBeInTheDocument();
    expect(screen.getByText('000000000000000101')).toBeInTheDocument();
    expect(screen.getAllByText('Alice')).toHaveLength(1);
    expect(screen.getAllByText('Bob')).toHaveLength(1);
    expect(screen.queryByText('Alice, Bob')).not.toBeInTheDocument();
    expect(container.querySelector('.node-updates__parties')).not.toBeNull();
    expect(screen.getByText('No parties')).toBeInTheDocument();
    expect(screen.queryByText('Advanced Filter Parameters')).not.toBeInTheDocument();

    const pagerButtons = screen.getAllByRole('button');
    expect(pagerButtons[0]).toHaveTextContent('Advanced Filter');
    expect(pagerButtons[1]).toHaveTextContent('Newer');
    expect(pagerButtons[2]).toHaveTextContent('Older');

    await fireEvent.click(screen.getByRole('button', { name: 'Advanced Filter' }));

    expect(await screen.findByText('Advanced Filter Parameters')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Party ID')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add party filter' })).toHaveTextContent('+');
    expect(screen.getByRole('button', { name: 'Newer' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Older' })).not.toBeDisabled();
    expect(screen.getByRole('link', { name: 'Back to overview' })).toHaveAttribute('href', '/');

    await fireEvent.click(screen.getByRole('button', { name: 'Older' }));

    await waitFor(() =>
      expect(fetchNodeUpdates).toHaveBeenNthCalledWith(2, 'participant-1', {
        before: '000000000000000099',
        limit: 10,
      }),
    );

    expect(await screen.findByText('000000000000000098')).toBeInTheDocument();
    expect(screen.getByText('Carol')).toBeInTheDocument();
    expect(screen.getAllByText('Jul 1, 2026')).toHaveLength(2);
    expect(screen.getByText('11:58:00 AM')).toBeInTheDocument();
    expect(screen.getByText('11:57:00 AM')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Older' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Newer' })).not.toBeDisabled();

    expect(
      container.querySelector('a[href="/nodes/participant-1/updates/000000000000000098?from=node"]'),
    ).not.toBeNull();
  });

  it('shows a spinner overlay while refreshing an already loaded updates list', async () => {
    let resolveOlderPage: ((value: NodeUpdatesResponse) => void) | undefined;

    vi.mocked(fetchNodeUpdates)
      .mockResolvedValueOnce({
        nodeId: 'participant-1',
        label: 'Participant 1',
        limit: 25,
        nextBefore: '000000000000000099',
        nextAfter: null,
        updates: [
          {
            eventOffset: '000000000000000101',
            updateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
            recordTime: '2026-07-01T12:00:00.000Z',
            parties: ['Alice'],
          },
        ],
      })
      .mockImplementationOnce(
        () =>
          new Promise<NodeUpdatesResponse>((resolve) => {
            resolveOlderPage = resolve;
          }),
      );

    await renderAt('/nodes/participant-1/updates');

    expect(await screen.findByRole('heading', { name: 'Participant 1 Updates' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Updating node updates')).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Older' }));

    expect(await screen.findByLabelText('Updating node updates')).toBeInTheDocument();

    const resolve = resolveOlderPage;
    if (!resolve) {
      throw new Error('Expected pending refresh request to expose a resolver');
    }

    resolve({
      nodeId: 'participant-1',
      label: 'Participant 1',
      limit: 25,
      nextBefore: null,
      nextAfter: '000000000000000100',
      updates: [
        {
          eventOffset: '000000000000000100',
          updateId: '00000000000000000000000000000000',
          recordTime: '2026-07-01T11:59:00.000Z',
          parties: [],
        },
      ],
    });

    await waitFor(() =>
      expect(screen.queryByLabelText('Updating node updates')).not.toBeInTheDocument(),
    );
  });

  it('changes the updates page size, resets cursors, and persists the limit in the URL', async () => {
    vi.mocked(fetchNodeUpdates)
      .mockResolvedValueOnce({
        nodeId: 'participant-1',
        label: 'Participant 1',
        limit: 10,
        nextBefore: '000000000000000099',
        nextAfter: null,
        updates: [
          {
            eventOffset: '000000000000000101',
            updateId: '00000000000000000000000000000001',
            recordTime: '2026-07-01T12:00:00.000Z',
            parties: ['Alice'],
          },
        ],
      })
      .mockResolvedValueOnce({
        nodeId: 'participant-1',
        label: 'Participant 1',
        limit: 50,
        nextBefore: null,
        nextAfter: null,
        updates: [
          {
            eventOffset: '000000000000000050',
            updateId: '00000000000000000000000000000050',
            recordTime: '2026-07-01T11:00:00.000Z',
            parties: ['Bob'],
          },
        ],
      });

    const { router } = await renderAt('/nodes/participant-1/updates?before=000000000000000099');

    expect(await screen.findByRole('heading', { name: 'Participant 1 Updates' })).toBeInTheDocument();

    await fireEvent.update(screen.getByRole('combobox', { name: 'Items per page' }), '50');

    await waitFor(() =>
      expect(fetchNodeUpdates).toHaveBeenNthCalledWith(2, 'participant-1', {
        limit: 50,
      }),
    );
    await waitFor(() =>
      expect(router.currentRoute.value.fullPath).toBe('/nodes/participant-1/updates?limit=50'),
    );
    expect(await screen.findByText('000000000000000050')).toBeInTheDocument();
  });

  it('adds and removes party filter chips and applies global OR and AND modes', async () => {
    vi.mocked(fetchNodeUpdates).mockResolvedValue({
      nodeId: 'participant-1',
      label: 'Participant 1',
      limit: 25,
      nextBefore: null,
      nextAfter: null,
      updates: [
        {
          eventOffset: '000000000000000101',
          updateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
          recordTime: '2026-07-01T12:00:00.000Z',
          parties: ['Alice', 'Bob'],
        },
      ],
    });

    await renderAt('/nodes/participant-1/updates');

    expect(await screen.findByRole('heading', { name: 'Participant 1 Updates' })).toBeInTheDocument();
    expect(fetchNodeUpdates).toHaveBeenNthCalledWith(1, 'participant-1', { limit: 10 });

    await fireEvent.click(screen.getByRole('button', { name: 'Advanced Filter' }));
    await fireEvent.update(screen.getByPlaceholderText('Party ID'), 'Alice');
    await fireEvent.click(screen.getByRole('button', { name: 'Add party filter' }));

    await waitFor(() =>
      expect(fetchNodeUpdates).toHaveBeenLastCalledWith('participant-1', {
        limit: 10,
        parties: ['Alice'],
        partyMode: 'or',
      }),
    );

    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);

    await fireEvent.update(screen.getByPlaceholderText('Party ID'), 'Bob');
    await fireEvent.click(screen.getByRole('button', { name: 'Add party filter' }));

    await waitFor(() =>
      expect(fetchNodeUpdates).toHaveBeenLastCalledWith('participant-1', {
        limit: 10,
        parties: ['Alice', 'Bob'],
        partyMode: 'or',
      }),
    );

    expect(screen.getAllByText('Bob').length).toBeGreaterThan(0);

    await fireEvent.click(screen.getByRole('button', { name: 'AND' }));

    await waitFor(() =>
      expect(fetchNodeUpdates).toHaveBeenLastCalledWith('participant-1', {
        limit: 10,
        parties: ['Alice', 'Bob'],
        partyMode: 'and',
      }),
    );

    await fireEvent.click(screen.getByRole('button', { name: 'Remove party filter Alice' }));

    await waitFor(() =>
      expect(fetchNodeUpdates).toHaveBeenLastCalledWith('participant-1', {
        limit: 10,
        parties: ['Bob'],
        partyMode: 'and',
      }),
    );

    expect(screen.queryByRole('button', { name: 'Remove party filter Alice' })).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Remove party filter Bob' }));

    await waitFor(() => expect(fetchNodeUpdates).toHaveBeenLastCalledWith('participant-1', { limit: 10 }));
    expect(screen.queryByRole('button', { name: 'Remove party filter Bob' })).not.toBeInTheDocument();
  });

  it('applies and persists the hide Splice offsets filter', async () => {
    vi.mocked(fetchNodeUpdates).mockResolvedValue({
      nodeId: 'participant-1',
      label: 'Participant 1',
      limit: 25,
      nextBefore: null,
      nextAfter: null,
      updates: [],
    });

    await renderAt('/nodes/participant-1/updates');

    expect(await screen.findByRole('heading', { name: 'Participant 1 Updates' })).toBeInTheDocument();
    expect(fetchNodeUpdates).toHaveBeenNthCalledWith(1, 'participant-1', { limit: 10 });

    await fireEvent.click(screen.getByRole('button', { name: 'Advanced Filter' }));

    const hideSpliceToggle = screen.getByRole('checkbox', { name: 'Hide Splice Offsets' });
    expect(hideSpliceToggle).toHaveClass('node-updates__advanced-filter-checkbox');
    expect(hideSpliceToggle).not.toBeChecked();

    await fireEvent.click(hideSpliceToggle);

    await waitFor(() =>
      expect(fetchNodeUpdates).toHaveBeenLastCalledWith('participant-1', {
        limit: 10,
        hideSplice: true,
      }),
    );

    expect(hideSpliceToggle).toBeChecked();
  });

  it('adds a template filter from the searchable combobox', async () => {
    vi.mocked(fetchNodeUpdates).mockResolvedValue({
      nodeId: 'participant-1',
      label: 'Participant 1',
      limit: 25,
      nextBefore: null,
      nextAfter: null,
      updates: [],
    });

    await renderAt('/nodes/participant-1/updates');

    expect(await screen.findByRole('heading', { name: 'Participant 1 Updates' })).toBeInTheDocument();
    expect(fetchNodeUpdates).toHaveBeenNthCalledWith(1, 'participant-1', { limit: 10 });

    await fireEvent.click(screen.getByRole('button', { name: 'Advanced Filter' }));

    await waitFor(() => expect(fetchNodeTemplates).toHaveBeenCalledWith('participant-1'));

    const input = screen.getByRole('combobox', { name: 'Template ID' });
    await fireEvent.focus(input);
    await fireEvent.update(input, 'wallet');
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByDisplayValue('Main:Wallet')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Add template filter' }));

    await waitFor(() =>
      expect(fetchNodeUpdates).toHaveBeenLastCalledWith('participant-1', {
        limit: 10,
        templates: ['Main:Wallet'],
      }),
    );

    expect(screen.getAllByText('Main:Wallet').length).toBeGreaterThan(0);
  });

  it('does not persist party mode before any party filter is added', async () => {
    vi.mocked(fetchNodeUpdates).mockResolvedValue({
      nodeId: 'participant-1',
      label: 'Participant 1',
      limit: 25,
      nextBefore: null,
      nextAfter: null,
      updates: [],
    });

    const { router } = await renderAt('/nodes/participant-1/updates');

    expect(await screen.findByRole('heading', { name: 'Participant 1 Updates' })).toBeInTheDocument();
    expect(fetchNodeUpdates).toHaveBeenNthCalledWith(1, 'participant-1', { limit: 10 });

    await fireEvent.click(screen.getByRole('button', { name: 'Advanced Filter' }));
    const initialCallCount = vi.mocked(fetchNodeUpdates).mock.calls.length;
    await fireEvent.click(screen.getByRole('button', { name: 'AND' }));
    await waitFor(() =>
      expect(vi.mocked(fetchNodeUpdates).mock.calls.length).toBe(initialCallCount),
    );
    expect(router.currentRoute.value.query.partyMode).toBeUndefined();
  });

  it('opens the advanced filter panel when filter query params are present in the URL', async () => {
    vi.mocked(fetchNodeUpdates).mockResolvedValue({
      nodeId: 'participant-1',
      label: 'Participant 1',
      limit: 25,
      nextBefore: null,
      nextAfter: null,
      updates: [],
    });

    await renderAt('/nodes/participant-1/updates?party=Alice&partyMode=and');

    expect(await screen.findByRole('heading', { name: 'Participant 1 Updates' })).toBeInTheDocument();
    expect(await screen.findByText('Advanced Filter Parameters')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'AND' })).toHaveClass(
      'node-updates__advanced-filter-mode--active',
    );
  });

  it('opens the advanced filter panel when hideSplice is present in the URL', async () => {
    vi.mocked(fetchNodeUpdates).mockResolvedValue({
      nodeId: 'participant-1',
      label: 'Participant 1',
      limit: 25,
      nextBefore: null,
      nextAfter: null,
      updates: [],
    });

    await renderAt('/nodes/participant-1/updates?hideSplice=true');

    expect(await screen.findByRole('heading', { name: 'Participant 1 Updates' })).toBeInTheDocument();
    expect(await screen.findByText('Advanced Filter Parameters')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Hide Splice Offsets' })).toBeChecked();
    expect(fetchNodeUpdates).toHaveBeenCalledWith('participant-1', {
      limit: 10,
      hideSplice: true,
    });
  });

  it('opens the advanced filter panel when template filters are present in the URL', async () => {
    vi.mocked(fetchNodeUpdates).mockResolvedValue({
      nodeId: 'participant-1',
      label: 'Participant 1',
      limit: 25,
      nextBefore: null,
      nextAfter: null,
      updates: [],
    });

    await renderAt('/nodes/participant-1/updates?template=Main:Asset');

    expect(await screen.findByRole('heading', { name: 'Participant 1 Updates' })).toBeInTheDocument();
    expect(await screen.findByText('Advanced Filter Parameters')).toBeInTheDocument();
    expect(screen.getByText('Main:Asset')).toBeInTheDocument();
    expect(fetchNodeUpdates).toHaveBeenCalledWith('participant-1', {
      limit: 10,
      templates: ['Main:Asset'],
    });
  });

  it('does not add partyMode to the URL when only template filters are present', async () => {
    vi.mocked(fetchNodeUpdates).mockResolvedValue({
      nodeId: 'participant-1',
      label: 'Participant 1',
      limit: 25,
      nextBefore: null,
      nextAfter: null,
      updates: [],
    });

    const { router } = await renderAt('/nodes/participant-1/updates');

    expect(await screen.findByRole('heading', { name: 'Participant 1 Updates' })).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Advanced Filter' }));
    await waitFor(() => expect(fetchNodeTemplates).toHaveBeenCalled());

    const input = screen.getByRole('combobox', { name: 'Template ID' });
    await fireEvent.focus(input);
    await fireEvent.update(input, 'wallet');
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await fireEvent.keyDown(input, { key: 'Enter' });
    await fireEvent.click(screen.getByRole('button', { name: 'Add template filter' }));

    await waitFor(() =>
      expect(fetchNodeUpdates).toHaveBeenLastCalledWith('participant-1', {
        limit: 10,
        templates: ['Main:Wallet'],
      }),
    );
    expect(router.currentRoute.value.query.template).toEqual(['Main:Wallet']);
    expect(router.currentRoute.value.query.partyMode).toBeUndefined();
  });
});
