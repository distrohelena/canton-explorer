import { fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it, vi } from 'vitest';
import ContractsTable from './ContractsTable.vue';

async function renderTable() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div>Home</div>' } },
      { path: '/nodes/:id/contracts/:contractId', component: { template: '<div>Contract</div>' } },
    ],
  });

  router.push('/');
  await router.isReady();

  const rendered = render(ContractsTable, {
    props: {
      contracts: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          contractId: '00abc',
          templateId: 'Splice.ValidatorLicense:ValidatorLicense',
          createdRecordTime: '2026-07-01T12:00:00.000Z',
        },
      ],
      ariaLabel: 'Node contracts',
    },
    global: {
      plugins: [router],
    },
  });

  return { ...rendered, router };
}

describe('ContractsTable', () => {
  it('renders with the updates table structure and splits template ids on the last colon', async () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      function MockDateTimeFormat(
        _locales?: Intl.LocalesArgument,
        options?: Intl.DateTimeFormatOptions,
      ) {
        return {
          format: () => (options?.timeStyle ? '12:00:00 PM' : 'Jul 1, 2026'),
        } as unknown as Intl.DateTimeFormat;
      } as unknown as typeof Intl.DateTimeFormat,
    );

    const { container } = await renderTable();

    expect(container.querySelector('.node-updates__table[role="table"]')).not.toBeNull();
    expect(container.querySelector('.node-updates__row.node-updates__row--head')).not.toBeNull();
    expect(container.querySelector('.node-updates__row.contracts-table__row')).not.toBeNull();
    expect(screen.getByText('Contract ID')).toBeInTheDocument();
    const createdRecordTimeHeader = screen.getByText('Created Time');
    const sourcePill = screen.getByText('PQS');
    expect(createdRecordTimeHeader).toBeInTheDocument();
    expect(sourcePill).toHaveClass('contracts-table__source-pill');
    expect(sourcePill.closest('.contracts-table__record-time-header')).toBe(
      createdRecordTimeHeader.closest('.contracts-table__record-time-header'),
    );
    expect(
      createdRecordTimeHeader.compareDocumentPosition(sourcePill) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(screen.getByText('Splice.ValidatorLicense')).toHaveClass('contracts-table__template-namespace');
    expect(screen.getByText('ValidatorLicense')).toHaveClass('contracts-table__template-name');
    expect(screen.getByText('Jul 1, 2026')).toHaveClass('node-updates__time-date');
    expect(screen.getByText('12:00:00 PM')).toHaveClass('node-updates__time-clock');
    expect(container.querySelector('a[href="/nodes/participant-1/contracts/00abc"]')).not.toBeNull();
  });

  it('makes the entire row clickable, matching the updates table row behavior', async () => {
    const { container, router } = await renderTable();

    const row = container.querySelector('.node-updates__row--link');
    expect(row).not.toBeNull();
    expect(row).toHaveAttribute('tabindex', '0');

    await fireEvent.click(row!);

    await waitFor(() =>
      expect(router.currentRoute.value.fullPath).toBe('/nodes/participant-1/contracts/00abc'),
    );
  });
});
