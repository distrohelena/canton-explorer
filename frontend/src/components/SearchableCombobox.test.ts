import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { defineComponent, ref } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SearchableCombobox from './SearchableCombobox.vue';

describe('SearchableCombobox', () => {
  afterEach(() => {
    cleanup();
  });

  it('filters options and selects the highlighted option with the keyboard', async () => {
    const handleSelect = vi.fn();

    render(defineComponent({
      components: { SearchableCombobox },
      setup() {
        const modelValue = ref('');

        return {
          modelValue,
          handleSelect,
          options: [
            { value: 'Main:Asset', label: 'Main:Asset' },
            { value: 'Main:Wallet', label: 'Main:Wallet' },
            { value: 'Splice.Amulet:Amulet', label: 'Splice.Amulet:Amulet' },
          ],
        };
      },
      template: `
        <SearchableCombobox
          v-model="modelValue"
          :options="options"
          label="Template ID"
          placeholder="Template ID"
          empty-text="No templates found"
          @select="handleSelect"
        />
      `,
    }));

    const input = screen.getByRole('combobox', { name: 'Template ID' });

    await fireEvent.focus(input);
    await fireEvent.update(input, 'wallet');

    expect(input).toHaveValue('wallet');
    expect(await screen.findByRole('option', { name: 'Main:Wallet' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Main:Asset' })).not.toBeInTheDocument();

    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await fireEvent.keyDown(input, { key: 'Enter' });

    expect(handleSelect).toHaveBeenCalledWith('Main:Wallet');
    expect(input).toHaveValue('Main:Wallet');
  });

  it('shows the empty state when no option matches the search text', async () => {
    render(defineComponent({
      components: { SearchableCombobox },
      setup() {
        const modelValue = ref('missing');

        return {
          modelValue,
          options: [{ value: 'Main:Asset', label: 'Main:Asset' }],
        };
      },
      template: `
        <SearchableCombobox
          v-model="modelValue"
          :options="options"
          label="Template ID"
          placeholder="Template ID"
          empty-text="No templates found"
        />
      `,
    }));

    const input = screen.getByRole('combobox', { name: 'Template ID' });
    await fireEvent.focus(input);

    await waitFor(() => expect(screen.getByText('No templates found')).toBeInTheDocument());
  });
});
