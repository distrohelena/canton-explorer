import { render, screen } from '@testing-library/vue';
import { describe, expect, it, vi } from 'vitest';
import ContractsTable from './ContractsTable.vue';

describe('ContractsTable', () => {
  it('renders with the updates table structure and splits template ids on the last colon', () => {
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

    const { container } = render(ContractsTable, {
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
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    });

    expect(container.querySelector('.node-updates__table[role="table"]')).not.toBeNull();
    expect(container.querySelector('.node-updates__row.node-updates__row--head')).not.toBeNull();
    expect(container.querySelector('.node-updates__row.contracts-table__row')).not.toBeNull();
    expect(screen.getByText('Contract ID')).toBeInTheDocument();
    expect(screen.getByText('Created Record Time')).toBeInTheDocument();
    expect(screen.getByText('Splice.ValidatorLicense')).toHaveClass('contracts-table__template-namespace');
    expect(screen.getByText('ValidatorLicense')).toHaveClass('contracts-table__template-name');
    expect(screen.getByText('Jul 1, 2026')).toHaveClass('node-updates__time-date');
    expect(screen.getByText('12:00:00 PM')).toHaveClass('node-updates__time-clock');
    expect(container.querySelector('a[href="/nodes/participant-1/contracts/00abc"]')).not.toBeNull();
  });
});
