import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('styles.css', () => {
  it('highlights the search input with only a bottom line when focused', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const searchStyles = styles.match(/\.app-search \{([\s\S]*?)\n\}/)?.[1];
    const searchHoverStyles = styles.match(/\.app-search:hover \{([\s\S]*?)\n\}/)?.[1];
    const searchFocusStyles = styles.match(/\.app-search:focus \{([\s\S]*?)\n\}/)?.[1];
    const searchFocusVisibleStyles = styles.match(/\.app-search:focus-visible \{([\s\S]*?)\n\}/)?.[1];

    expect(searchStyles).toContain('background: transparent;');
    expect(searchStyles).toContain('border-bottom: 2px solid transparent;');
    expect(searchHoverStyles).toContain('border-bottom-color: var(--line-soft);');
    expect(searchFocusStyles).toContain('background: transparent;');
    expect(searchFocusStyles).toContain('border-bottom-color: var(--accent-600);');
    expect(searchFocusStyles).not.toContain('background: color-mix');
    expect(searchFocusVisibleStyles).toContain('outline: none;');
  });

  it('centers the Explore arrow within its own icon box', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const arrowStyles = styles.match(/\.app-explore__arrow \{([\s\S]*?)\n\}/)?.[1];

    expect(arrowStyles).toContain('display: block;');
    expect(arrowStyles).toContain('width: 1rem;');
    expect(arrowStyles).toContain('height: 1rem;');
    expect(arrowStyles).toContain('transform-origin: center;');
  });

  it('uses theme tokens for the Explore menu in both color modes', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const menuStyles = styles.match(/\.app-explore__menu \{([\s\S]*?)\n\}/)?.[1] ?? '';
    const linkStyles = styles.match(/\.app-explore__link \{([\s\S]*?)\n\}/)?.[1] ?? '';
    const hoverStyles = styles.match(/\.app-explore__link:hover,[\s\S]*?\{([\s\S]*?)\n\}/)?.[1] ?? '';
    const labelStyles = styles.match(/\.app-explore__group-label \{([\s\S]*?)\n\}/)?.[1] ?? '';

    expect(menuStyles).toContain('border: 1px solid var(--line-soft);');
    expect(menuStyles).toContain('background: var(--surface-card);');
    expect(menuStyles).toContain('box-shadow: var(--shadow-soft);');
    expect(linkStyles).toContain('color: var(--text-700);');
    expect(hoverStyles).toContain('background: var(--blue-50);');
    expect(hoverStyles).toContain('color: var(--text-900);');
    expect(labelStyles).toContain('color: var(--text-500);');
  });

  it('keeps the Contracts PQS pill beside the Created Time header', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const headerStyles = styles.match(/\.contracts-table__record-time-header \{([\s\S]*?)\n\}/)?.[1] ?? '';
    const pillStyles = styles.match(/\.contracts-table__source-pill \{([\s\S]*?)\n\}/)?.[1] ?? '';

    expect(headerStyles).toContain('display: flex;');
    expect(headerStyles).toContain('align-items: center;');
    expect(headerStyles).toContain('justify-content: space-between;');
    expect(headerStyles).toContain('gap: 12px;');
    expect(pillStyles).toContain('flex: 0 0 auto;');
    expect(pillStyles).not.toContain('position: absolute;');
  });

  it('lets the open advanced filter show its combobox menu', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const openFilterStyles =
      styles.match(/\.node-updates-filter-shell--open \{([\s\S]*?)\n\}/)?.[1] ?? '';

    expect(openFilterStyles).toContain('overflow: visible;');
    expect(openFilterStyles).toContain('position: relative;');
    expect(openFilterStyles).toContain('z-index: 3;');
  });

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

  it('gives the Party ID field the Template ID width', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const partyIdStyles =
      styles.match(/\.node-updates__advanced-filter-field--party-id \{([\s\S]*?)\n\}/)?.[1] ?? '';

    expect(partyIdStyles).toContain('max-width: 720px;');
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
