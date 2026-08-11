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

  it('keeps party copy controls aligned at the right edge of each row', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const partyRowStyles =
      styles.match(/\.parties-page__party-row \{([\s\S]*?)\n\}/)?.[1] ?? '';
    const copyButtonStyles =
      styles.match(/\.copy-to-clipboard-button \{([\s\S]*?)\n\}/)?.[1] ?? '';
    const copyButtonInteractionStyles =
      styles.match(/\.copy-to-clipboard-button:hover,[\s\S]*?\{([\s\S]*?)\n\}/)?.[1] ?? '';

    expect(partyRowStyles).toContain('display: grid;');
    expect(partyRowStyles).toContain('grid-template-columns: minmax(0, 1fr) auto;');
    expect(partyRowStyles).toContain('align-items: center;');
    expect(styles).toContain('.party-detail__heading {');
    expect(styles).toContain('width: 100%;');
    expect(copyButtonStyles).toContain('flex: 0 0 32px;');
    expect(copyButtonStyles).toContain('width: 32px;');
    expect(copyButtonStyles).toContain('height: 32px;');
    expect(copyButtonStyles).toContain('border: none;');
    expect(copyButtonStyles).toContain('background: transparent;');
    expect(copyButtonInteractionStyles).toContain('background: var(--blue-50);');
  });

  it('keeps update party copy controls aligned at the right edge of each row', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const partyRowStyles =
      styles.match(/\.node-updates__party-row \{([\s\S]*?)\n\}/)?.[1] ?? '';

    expect(partyRowStyles).toContain('display: grid;');
    expect(partyRowStyles).toContain('grid-template-columns: minmax(0, 1fr) auto;');
    expect(partyRowStyles).toContain('align-items: center;');
    expect(partyRowStyles).toContain('width: 100%;');
  });

  it('uses compact vertical padding for update rows', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const updateRowStyles =
      styles.match(/\.node-updates__row \{([\s\S]*?)\n\}/)?.[1] ?? '';

    expect(updateRowStyles).toContain('padding: 6px 20px;');
  });

  it('aligns update node and offset copy controls to the right edge', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const cellStyles =
      styles.match(/\.node-updates__cell-with-copy \{([\s\S]*?)\n\}/)?.[1] ?? '';

    expect(cellStyles).toContain('display: grid;');
    expect(cellStyles).toContain('grid-template-columns: minmax(0, 1fr) auto;');
    expect(cellStyles).toContain('width: 100%;');
  });

  it('defines the approved dark grape palette without changing light mode', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const lightRoot = styles.match(/^:root \{([\s\S]*?)^\}/m)?.[1] ?? '';
    const darkRoot =
      styles.match(/^:root\[data-theme="dark"\] \{([\s\S]*?)^\}/m)?.[1] ?? '';

    const darkTokens = {
      '--text-900': '#f7f0ff',
      '--text-800': '#e9ddf6',
      '--text-700': '#d0c0e0',
      '--text-600': '#b5a1c8',
      '--text-500': '#9b87ae',
      '--muted-text': '#a491b9',
      '--surface-0': '#2e1f43',
      '--surface-2': '#543563',
      '--surface-page': '#36254a',
      '--surface-card': '#442c59',
      '--surface-muted': '#3f2652',
      '--line-soft': '#66437e',
      '--line-strong': '#845497',
      '--accent-600': '#c7a7f6',
      '--blue-500': '#e0cdff',
      '--blue-600': '#c7a7f6',
      '--blue-700': '#e8d6ff',
      '--blue-50': '#543370',
      '--shadow-soft': '0 16px 28px rgba(7, 2, 15, 0.28)',
      '--nav-active-border': '#926bb1',
      '--nav-active-bg': '#553473',
      '--nav-active-text': '#f7f0ff',
      '--panel-border': '#7b4e91',
      '--panel-gradient-start': '#442c59',
      '--panel-gradient-end': '#442c59',
      '--chart-gradient-start': '#3f2652',
      '--chart-gradient-end': '#3f2652',
      '--chart-guide': 'rgba(224, 205, 255, 0.18)',
      '--chart-line': '#e0cdff',
      '--panel-divider': '#66437e',
      '--filter-active-border': '#a37dc1',
      '--filter-active-bg': '#613979',
      '--filter-chip-border': '#84569d',
      '--filter-chip-bg': '#4e3161',
      '--back-button-border': '#8858a0',
      '--back-button-bg': '#4e3161',
      '--back-button-shadow': '0 12px 22px rgba(45, 14, 64, 0.22)',
      '--editor-surface': '#442c59',
      '--editor-tab-surface': '#2e1f43',
      '--editor-divider': '#66437e',
      '--editor-hover-surface': '#3f2652',
      '--editor-active-border': '#e0cdff',
      '--editor-summary-glow': '#e0cdff',
      '--editor-summary-surface': '#2e1f43',
      '--editor-column-surface': '#36254a',
      '--editor-header-surface': '#2e1f43',
      '--editor-signal-accent': '#c7a7f6',
      '--editor-signal-surface': '#2e1f43',
      '--editor-signal-text': '#e8d6ff',
      '--editor-status-surface': '#3f2652',
      '--editor-control-surface': '#2e1f43',
      '--editor-control-button': '#3f2652',
      '--editor-control-hover-border': '#e0cdff',
      '--editor-control-hover-surface': '#543563',
      '--editor-tree-surface': '#2e1f43',
      '--editor-tabs-surface': '#36254a',
      '--editor-tab-active-border': '#e0cdff',
      '--editor-event-active-surface': '#543563',
      '--editor-event-active-accent': '#e0cdff',
      '--editor-event-expanded-surface': '#3f2652',
      '--editor-event-details-surface': '#36254a',
      '--editor-code-surface': '#2e1f43',
      '--editor-workspace-shadow': '0 16px 28px rgba(7, 2, 15, 0.28)',
      '--editor-control-shadow': '0 14px 32px rgba(7, 2, 15, 0.28)',
      '--metadata-surface': '#2e1f43',
      '--metadata-text': '#e8d6ff',
      '--explore-divider': '#66437e',
    };

    for (const [name, value] of Object.entries(darkTokens)) {
      expect(darkRoot).toContain(`${name}: ${value};`);
    }

    expect(darkRoot).toContain('--green-600: #79e6cc;');
    expect(darkRoot).toContain('--amber-600: #ffbe78;');
    expect(darkRoot).toContain('--red-600: #ffa1c1;');
    expect(darkRoot).toContain('--danger-600: #ffa1c1;');
    expect(darkRoot).toContain('--status-healthy-bg: #21403d;');
    expect(darkRoot).toContain('--status-degraded-bg: #4a392a;');
    expect(darkRoot).toContain('--status-down-bg: #4d3140;');

    expect(lightRoot).toContain('--surface-page: #f6f8fb;');
    expect(lightRoot).toContain('--surface-card: #ffffff;');
    expect(lightRoot).toContain('--blue-600: #1f6feb;');
    expect(lightRoot).toContain('--chart-gradient-start: #f6f8fb;');
    expect(lightRoot).toContain('--chart-gradient-end: #f6f8fb;');

    expect(styles).toContain('background: var(--editor-surface, #252845);');
    expect(styles).toContain('background: color-mix(in srgb, var(--editor-tab-surface, #1a1f37) 92%, black 8%);');
    expect(styles).toContain('var(--editor-summary-surface, #14182c) 96%, black 4%');
    expect(styles).toContain('box-shadow: var(--editor-workspace-shadow, 0 18px 44px rgba(9, 11, 22, 0.22));');
    expect(styles).toContain('box-shadow: var(--editor-control-shadow, 0 14px 32px rgba(8, 10, 20, 0.34));');
    expect(styles).toContain('background: var(--metadata-surface, #0f172a);');
    expect(styles).toContain('color: var(--metadata-text, #dbe7ff);');
  });

  it('uses the adjusted wider shared central content frame', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const appFrameStyles = styles.match(/\.app-frame \{([\s\S]*?)\n\}/)?.[1] ?? '';
    const headerStyles = styles.match(/\.app-header__inner \{([\s\S]*?)\n\}/)?.[1] ?? '';
    const footerStyles = styles.match(/\.app-footer__inner \{([\s\S]*?)\n\}/)?.[1] ?? '';

    expect(appFrameStyles).toContain('max-width: 1398px;');
    expect(headerStyles).toContain('max-width: 1398px;');
    expect(footerStyles).toContain('max-width: 1398px;');
  });

  it('reduces shared table body text by five percent', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const tableBodyRule = styles.match(
      /\.search-results-row,[\s\S]*?\.tokens-page__row:not\(\.tokens-page__row--head\) \{([\s\S]*?)\n\}/,
    )?.[1] ?? '';

    expect(tableBodyRule).toContain('font-size: 0.95rem;');
  });

  it('styles the Updates offset range subtitle below the title', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const subtitleStyles =
      styles.match(/\.node-updates__subtitle \{([\s\S]*?)\n\}/)?.[1] ?? '';

    expect(subtitleStyles).toContain('margin: 4px 0 0;');
    expect(subtitleStyles).toContain('color: var(--text-500);');
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

  it('keeps the Advanced Filter control as a compact icon button', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const filterButtonStyles =
      styles.match(/\.node-updates__filter-button \{([\s\S]*?)\n\}/)?.[1] ?? '';
    const filterIconStyles =
      styles.match(/\.node-updates__filter-icon \{([\s\S]*?)\n\}/)?.[1] ?? '';
    const filterButtonOverrideStyles =
      styles.match(/\.node-updates__pager \.node-updates__filter-button \{([\s\S]*?)\n\}/)?.[1] ?? '';

    expect(filterButtonStyles).toContain('width: 40px;');
    expect(filterButtonStyles).toContain('height: 40px;');
    expect(filterButtonStyles).toContain('padding: 0;');
    expect(filterButtonOverrideStyles).toContain('padding: 8px;');
    expect(filterIconStyles).toContain('width: 32.8px;');
    expect(filterIconStyles).toContain('height: 32.8px;');
  });

  it('sizes the Updates pagination arrow icons', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const paginationIconStyles =
      styles.match(/\.node-updates__pagination-icon \{([\s\S]*?)\n\}/)?.[1] ?? '';

    expect(paginationIconStyles).toContain('width: 18px;');
    expect(paginationIconStyles).toContain('height: 18px;');
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

  it('keeps the bottom updates pager close to the table', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const updatesStyles = styles.match(/\.node-updates \{([\s\S]*?)\n\}/)?.[1] ?? '';
    const collapsedFilterShellStyles =
      styles.match(/\.node-updates-filter-shell \{([\s\S]*?)\n\}/)?.[1] ?? '';
    const bottomPagerStyles =
      styles.match(/\.node-updates__pager--bottom \{([\s\S]*?)\n\}/)?.[1] ?? '';

    expect(updatesStyles).toContain('gap: 8px;');
    expect(collapsedFilterShellStyles).toContain('margin-bottom: -8px;');
    expect(bottomPagerStyles).toContain('margin-top: 0;');
  });

  it('makes the Updates and Contracts titles roughly 50 percent larger', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const explorerTitleStyles =
      styles.match(/\.node-updates > \.node-detail__hero h3 \{([\s\S]*?)\n\}/)?.[1] ?? '';

    expect(explorerTitleStyles).toContain('font-size: 1.2rem;');
    expect(explorerTitleStyles).toContain('line-height: 1.2;');
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

  it('keeps shared eyebrow labels styled as uppercase when present', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const activityEyebrowStyles =
      styles.match(/\.activity-home__eyebrow \{([\s\S]*?)\n\}/)?.[1] ?? '';
    const eyebrowStyles = styles.match(/\.eyebrow \{([\s\S]*?)\n\}/)?.[1] ?? '';

    expect(activityEyebrowStyles).toContain('text-transform: uppercase;');
    expect(eyebrowStyles).toContain('text-transform: uppercase;');
  });
});
