import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('styles.css', () => {
  it('themes the advanced filter checkbox to match the form surfaces', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

    expect(styles).toContain('.node-updates__advanced-filter-checkbox {');
    expect(styles).toContain('position: relative;');
    expect(styles).toContain('background: var(--surface-muted);');
    expect(styles).toContain('border: 1px solid var(--line-soft);');
    expect(styles).toContain('.node-updates__advanced-filter-checkbox::after {');
    expect(styles).toContain('position: absolute;');
    expect(styles).toContain('inset: 0;');
    expect(styles).toContain('margin: auto;');
    expect(styles).toContain('.node-updates__advanced-filter-checkbox:checked {');
    expect(styles).toContain('background: var(--blue-600);');
  });

  it('keeps the template combobox from overlapping the add button', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

    expect(styles).toContain('.searchable-combobox {');
    expect(styles).toContain('flex: 1 1 auto;');
    expect(styles).toContain('min-width: 0;');
    expect(styles).toContain('.searchable-combobox__input {');
    expect(styles).toContain('box-sizing: border-box;');
    expect(styles).toContain('.node-updates__advanced-filter-add {');
    expect(styles).toContain('flex: 0 0 40px;');
  });

  it('allows the template combobox menu to escape the advanced filter card', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

    expect(styles).toContain('.node-updates__advanced-filter {');
    expect(styles).toContain('overflow: visible;');
    expect(styles).toContain('.searchable-combobox__menu {');
    expect(styles).toContain('z-index: 50;');
  });

  it('emphasizes the inline package schema kind label as primary type text', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

    expect(styles).toContain('.package-schema__kind {');
    expect(styles).toContain('color: var(--text-900);');
    expect(styles).toContain('font-weight: 800;');
    expect(styles).toContain('.package-schema__group-title {');
  });

  it('uses the shared explorer surface tokens for search results instead of white panel fallbacks', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

    expect(styles).toContain('.search-results-view__loading,');
    expect(styles).toContain('.search-results-group {');
    expect(styles).toContain('border: 1px solid var(--line-soft);');
    expect(styles).toContain('background: var(--surface-card);');
    expect(styles).not.toContain('background: var(--panel-bg, rgba(255, 255, 255, 0.92));');
  });
});
