import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { defineComponent } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NodeUpdatesView from './NodeUpdatesView.vue';
import { fetchNodeUpdates } from '../lib/api';

vi.mock('../lib/api', () => ({
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

  return render(
    {
      template: '<RouterView />',
    },
    {
      global: {
        plugins: [router],
      },
    },
  );
}

describe('NodeUpdatesView', () => {
  afterEach(() => {
    cleanup();
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
    expect(fetchNodeUpdates).toHaveBeenNthCalledWith(1, 'participant-1');
    expect(screen.queryByText('Latest 25 updates')).not.toBeInTheDocument();
    expect(screen.getByText('000000000000000101')).toBeInTheDocument();
    expect(screen.getByText('Alice, Bob')).toBeInTheDocument();
    expect(screen.getByText('No parties')).toBeInTheDocument();
    expect(screen.queryByText('Advanced Search Parameters')).not.toBeInTheDocument();

    const pagerButtons = screen.getAllByRole('button');
    expect(pagerButtons[0]).toHaveTextContent('Advanced Filter');
    expect(pagerButtons[1]).toHaveTextContent('Newer');
    expect(pagerButtons[2]).toHaveTextContent('Older');

    await fireEvent.click(screen.getByRole('button', { name: 'Advanced Filter' }));

    expect(await screen.findByText('Advanced Search Parameters')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Party ID')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add party filter' })).toHaveTextContent('+');
    expect(screen.getByRole('button', { name: 'Newer' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Older' })).not.toBeDisabled();
    expect(screen.getByRole('link', { name: 'Back to overview' })).toHaveAttribute('href', '/');

    await fireEvent.click(screen.getByRole('button', { name: 'Older' }));

    await waitFor(() =>
      expect(fetchNodeUpdates).toHaveBeenNthCalledWith(2, 'participant-1', {
        before: '000000000000000099',
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
      container.querySelector('a[href="/nodes/participant-1/updates/000000000000000098"]'),
    ).not.toBeNull();
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
    expect(fetchNodeUpdates).toHaveBeenNthCalledWith(1, 'participant-1');

    await fireEvent.click(screen.getByRole('button', { name: 'Advanced Filter' }));
    await fireEvent.update(screen.getByPlaceholderText('Party ID'), 'Alice');
    await fireEvent.click(screen.getByRole('button', { name: 'Add party filter' }));

    await waitFor(() =>
      expect(fetchNodeUpdates).toHaveBeenLastCalledWith('participant-1', {
        parties: ['Alice'],
        mode: 'or',
      }),
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();

    await fireEvent.update(screen.getByPlaceholderText('Party ID'), 'Bob');
    await fireEvent.click(screen.getByRole('button', { name: 'Add party filter' }));

    await waitFor(() =>
      expect(fetchNodeUpdates).toHaveBeenLastCalledWith('participant-1', {
        parties: ['Alice', 'Bob'],
        mode: 'or',
      }),
    );

    expect(screen.getByText('Bob')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'AND' }));

    await waitFor(() =>
      expect(fetchNodeUpdates).toHaveBeenLastCalledWith('participant-1', {
        parties: ['Alice', 'Bob'],
        mode: 'and',
      }),
    );

    await fireEvent.click(screen.getByRole('button', { name: 'Remove party filter Alice' }));

    await waitFor(() =>
      expect(fetchNodeUpdates).toHaveBeenLastCalledWith('participant-1', {
        parties: ['Bob'],
        mode: 'and',
      }),
    );

    expect(screen.queryByText('Alice')).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Remove party filter Bob' }));

    await waitFor(() => expect(fetchNodeUpdates).toHaveBeenLastCalledWith('participant-1'));
    expect(screen.queryByText('Bob')).not.toBeInTheDocument();
  });

  it('toggles OR and AND mode state even before any party filter is added', async () => {
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
    expect(fetchNodeUpdates).toHaveBeenNthCalledWith(1, 'participant-1');

    await fireEvent.click(screen.getByRole('button', { name: 'Advanced Filter' }));
    await fireEvent.click(screen.getByRole('button', { name: 'AND' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'AND' })).toHaveClass(
        'node-updates__advanced-filter-mode--active',
      ),
    );
    expect(screen.getByRole('button', { name: 'OR' })).not.toHaveClass(
      'node-updates__advanced-filter-mode--active',
    );

    await fireEvent.click(screen.getByRole('button', { name: 'OR' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'OR' })).toHaveClass(
        'node-updates__advanced-filter-mode--active',
      ),
    );
    expect(screen.getByRole('button', { name: 'AND' })).not.toHaveClass(
      'node-updates__advanced-filter-mode--active',
    );
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

    await renderAt('/nodes/participant-1/updates?party=Alice&mode=and');

    expect(await screen.findByRole('heading', { name: 'Participant 1 Updates' })).toBeInTheDocument();
    expect(await screen.findByText('Advanced Search Parameters')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'AND' })).toHaveClass(
      'node-updates__advanced-filter-mode--active',
    );
  });
});
