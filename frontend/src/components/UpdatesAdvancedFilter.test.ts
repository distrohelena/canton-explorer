import { render, screen } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import UpdatesAdvancedFilter from './UpdatesAdvancedFilter.vue';

describe('UpdatesAdvancedFilter', () => {
  it('renders Hide Splice Offsets in the Template ID input row after the add button', () => {
    render(UpdatesAdvancedFilter, {
      props: {
        id: 'advanced-filter',
        partyDraft: '',
        templateDraft: '',
        activeParties: [],
        activeTemplates: [],
        templateOptions: [],
        filterMode: 'or',
        hideSplice: false,
      },
    });

    const templateLabel = screen.getByText('Template ID');
    const hideSpliceToggle = screen.getByRole('checkbox', { name: 'Hide Splice Offsets' });
    const templateField = templateLabel.closest('.node-updates__advanced-filter-field');
    const templateRow = templateField?.querySelector('.node-updates__advanced-filter-input-row') ?? null;
    const addTemplateButton = screen.getByRole('button', { name: 'Add template filter' });

    expect(templateField).not.toBeNull();
    expect(hideSpliceToggle.closest('.node-updates__advanced-filter-field')).toBe(templateField);
    expect(hideSpliceToggle.closest('.node-updates__advanced-filter-input-row')).toBe(templateRow);
    expect(
      addTemplateButton.compareDocumentPosition(
        hideSpliceToggle.closest('.node-updates__advanced-filter-toggle') as Node,
      ),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(templateRow).toHaveClass('node-updates__advanced-filter-input-row--template');
    expect(templateRow?.contains(hideSpliceToggle)).toBe(
      true,
    );
  });
});
