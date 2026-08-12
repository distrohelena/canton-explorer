import { render, screen, within } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import { h } from 'vue';
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
        showPartyFilters: true,
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

  it('marks the Party ID field for the shared Template ID width', () => {
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

    expect(
      screen.getByText('Party ID').closest('.node-updates__advanced-filter-field'),
    ).toHaveClass('node-updates__advanced-filter-field--party-id');
  });

  it('hides party and template controls in node-only mode', () => {
    const { container } = render(UpdatesAdvancedFilter, {
      props: {
        id: 'advanced-filter',
        partyDraft: '',
        templateDraft: '',
        activeParties: ['party-1'],
        activeTemplates: ['template-1'],
        templateOptions: ['template-1'],
        filterMode: 'or',
        hideSplice: false,
        showPartyFilters: false,
        showTemplateFilters: false,
        nodeOptions: [{ id: 'node-1', label: 'Node 1' }],
        activeNodes: [],
      },
    });

    const view = within(container as HTMLElement);

    expect(view.getByLabelText('Node 1')).toBeInTheDocument();
    expect(view.queryByText('Party ID')).toBeNull();
    expect(view.queryByRole('button', { name: 'Add party filter' })).toBeNull();
    expect(view.queryByText('party-1')).toBeNull();
    expect(view.queryByText('Template ID')).toBeNull();
    expect(view.queryByRole('button', { name: 'Add template filter' })).toBeNull();
    expect(view.queryByText('template-1')).toBeNull();
    expect(view.queryByRole('checkbox', { name: 'Hide Splice Offsets' })).toBeNull();
  });

  it('renders additional fields inside the advanced filter grid', () => {
    const { container } = render(UpdatesAdvancedFilter, {
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
      slots: {
        'additional-fields': () => h('div', { 'data-testid': 'namespace-field' }, 'Namespace'),
      },
    });

    const additionalField = within(container as HTMLElement).getByTestId('namespace-field');
    const filterSection = additionalField.closest('section');

    expect(additionalField.closest('.node-updates__advanced-filter-grid')).not.toBeNull();
    expect(filterSection).not.toBeNull();
    expect(filterSection?.contains(additionalField)).toBe(true);
  });
});
