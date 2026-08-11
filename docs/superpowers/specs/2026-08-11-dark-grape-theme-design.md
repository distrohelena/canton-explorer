# Dark Grape Theme

## Goal

Make the dark Canton Explorer theme feel more like the supplied purple/grape reference while leaving the light theme unchanged.

## Scope

Update the dark theme tokens in `frontend/src/styles.css` and route the existing hard-coded editor/debugger surfaces through dark-only fallback tokens. Component structure, spacing, typography, light-mode appearance, semantic status colors, and theme-toggle behavior remain unchanged.

## Design

Use a soft, dusty-plum foundation with gently lighter cards and muted lavender-grape borders. The dark block must use this exact map:

| Variable group | Exact dark values |
| --- | --- |
| Text | `--text-900: #f3eaf7`, `--text-800: #e5d9eb`, `--text-700: #d1c2d8`, `--text-600: #b9a8c1`, `--text-500: #a291ab`, `--muted-text: #aa9ab2` |
| Surfaces | `--surface-0: #21182a`, `--surface-2: #493b54`, `--surface-page: #281e32`, `--surface-card: #382c44`, `--surface-muted: #30243a` |
| Lines and accents | `--line-soft: #594a61`, `--line-strong: #75637d`, `--accent-600: #b79bd2`, `--blue-500: #cbb8df`, `--blue-600: #b79bd2`, `--blue-700: #eadff0`, `--blue-50: #46374f` |
| Shadows and charts | `--shadow-soft: 0 16px 28px rgba(15, 8, 22, 0.24)`, `--chart-gradient-start: #30243a`, `--chart-gradient-end: #30243a`, `--chart-guide: rgba(203, 184, 223, 0.16)`, `--chart-line: #cbb8df` |
| Navigation | `--nav-active-border: #8f7b98`, `--nav-active-bg: #493b54`, `--nav-active-text: #f3eaf7` |
| Panels | `--panel-border: #6c5a73`, `--panel-gradient-start: #382c44`, `--panel-gradient-end: #382c44`, `--panel-divider: #594a61` |
| Filters and back button | `--filter-active-border: #a18aad`, `--filter-active-bg: #4a3c53`, `--filter-chip-border: #786681`, `--filter-chip-bg: #40334a`, `--back-button-border: #806b88`, `--back-button-bg: #40334a`, `--back-button-shadow: 0 12px 22px rgba(47, 31, 59, 0.24)` |

Keep the existing dark green, amber, red, danger, error, and status background/border values unchanged. Route each existing hard-coded editor/debugger color through a dark-only alias. Each alias keeps the current literal as its fallback outside dark mode and uses the grape value after the arrow in dark mode:

| Alias | Fallback → dark value |
| --- | --- |
| `--editor-surface` | `#252845 → #382c44` |
| `--editor-tab-surface` | `#1a1f37 → #21182a` |
| `--editor-divider` | `#5b527d → #594a61` |
| `--editor-hover-surface` | `#222947 → #30243a` |
| `--editor-active-border` | `#9eadff → #cbb8df` |
| `--editor-summary-glow` | `#9f8cff → #cbb8df` |
| `--editor-summary-surface` | `#14182c → #21182a` |
| `--editor-column-surface` | `#18203a → #281e32` |
| `--editor-header-surface` | `#101526 → #21182a` |
| `--editor-signal-accent` | `#5f7dff → #b79bd2` |
| `--editor-signal-surface` | `#0f1528 → #21182a` |
| `--editor-signal-text` | `#d8e1ff → #eadff0` |
| `--editor-status-surface` | `#1f2844 → #30243a` |
| `--editor-control-surface` | `#12172a → #21182a` |
| `--editor-control-button` | `#1c2440 → #30243a` |
| `--editor-control-hover-border` | `#7e96ff → #cbb8df` |
| `--editor-control-hover-surface` | `#243056 → #493b54` |
| `--editor-tree-surface` | `#11172a → #21182a` |
| `--editor-tabs-surface` | `#13192d → #281e32` |
| `--editor-tab-active-border` | `#8c9fff → #cbb8df` |
| `--editor-event-active-surface` | `#27365f → #493b54` |
| `--editor-event-active-accent` | `#95a4ff → #cbb8df` |
| `--editor-event-expanded-surface` | `#202944 → #30243a` |
| `--editor-event-details-surface` | `#171f36 → #281e32` |
| `--editor-code-surface` | `#0f1424 → #21182a` |
| `--editor-workspace-shadow` | `0 18px 44px rgba(9, 11, 22, 0.22) → 0 16px 28px rgba(15, 8, 22, 0.24)` |
| `--editor-control-shadow` | `0 14px 32px rgba(8, 10, 20, 0.34) → 0 14px 32px rgba(15, 8, 22, 0.24)` |
| `--metadata-surface` | `#0f172a → #21182a` |
| `--metadata-text` | `#dbe7ff → #eadff0` |
| `--explore-divider` | `#5b527d → #594a61` |

The aliases may be declared only in the dark root; declarations using them must provide the listed fallback value with `var(--alias, fallback)` so the light theme is unchanged.

Replace hard-coded editor/debugger surface, accent, shadow, metadata, and Explore divider colors with `var()` aliases that fall back to their current values outside dark mode. Leave fixed exchange-series colors and semantic amber/success colors unchanged.

Apply the palette through shared variables so menus, links, tables, cards, filters, charts, debugger panels, and controls shift coherently without changing component behavior.

## Validation

- Add a focused stylesheet assertion for the complete approved dark-token map, chart tokens, dark-only aliases, replacement of the targeted raw editor/debugger color and shadow declarations, and unchanged light root values.
- Run the focused styles test.
- Run the full workspace test suite and `git diff --check`.
- Confirm light-mode variables remain unchanged and the worktree is clean after committing.
