import { cleanup, render, screen } from '@testing-library/vue';
import { afterEach, describe, expect, it } from 'vitest';
import TokenTransfersAdvancedFilter from './TokenTransfersAdvancedFilter.vue';

describe('TokenTransfersAdvancedFilter', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the movement type combobox with the custom select styling hook', () => {
    render(TokenTransfersAdvancedFilter, {
      props: {
        id: 'advanced-filter',
        fromDraft: '',
        toDraft: '',
        movementTypeDraft: '',
        amountGtDraft: '',
        amountLtDraft: '',
        activeFromParties: [],
        activeToParties: [],
        activeMovementTypes: [],
      },
    });

    const combobox = screen.getByRole('combobox', { name: 'Movement Type' });
    expect(combobox).toHaveClass('node-updates__advanced-filter-select');
    expect(combobox.parentElement).toHaveClass('node-updates__advanced-filter-select-shell');
  });

  it('renders active movement type chips with remove actions', () => {
    render(TokenTransfersAdvancedFilter, {
      props: {
        id: 'advanced-filter',
        fromDraft: '',
        toDraft: '',
        movementTypeDraft: '',
        amountGtDraft: '',
        amountLtDraft: '',
        activeFromParties: [],
        activeToParties: [],
        activeMovementTypes: ['Transfer', 'Mint'],
      },
    });

    expect(screen.getByRole('button', { name: 'Remove movement type filter Transfer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove movement type filter Mint' })).toBeInTheDocument();
  });
});
