import { cleanup, fireEvent, render, screen } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CopyToClipboardButton from './CopyToClipboardButton.vue';

describe('CopyToClipboardButton', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('copies the value and announces the copied state', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    render(CopyToClipboardButton, { props: { value: 'Alice::1220abcd' } });

    const button = screen.getByRole('button', { name: 'Copy party ID Alice::1220abcd' });
    expect(button.querySelector('svg')).toBeInTheDocument();

    await fireEvent.click(button);

    expect(writeText).toHaveBeenCalledWith('Alice::1220abcd');
    expect(button).toHaveAccessibleName('Copied party ID Alice::1220abcd');
    expect(button).toHaveClass('copy-to-clipboard-button--copied');
    expect(screen.getByText('Copied!')).toBeInTheDocument();
    expect(button.querySelector('.copy-to-clipboard-button__icon--copied')).toBeInTheDocument();
  });
});
