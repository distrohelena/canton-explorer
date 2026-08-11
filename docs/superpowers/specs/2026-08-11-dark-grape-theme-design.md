# Dark Grape Theme

## Goal

Make the dark Canton Explorer theme feel more like the supplied purple/grape reference while leaving the light theme unchanged.

## Scope

Update the dark theme tokens in `frontend/src/styles.css` and route the existing hard-coded editor/debugger surfaces through dark-only fallback tokens. Component structure, spacing, typography, light-mode appearance, semantic status colors, and theme-toggle behavior remain unchanged.

## Design

Use a deep aubergine foundation with slightly lighter plum cards and muted grape borders. The dark block must use this exact map:

| Variable group | Exact dark values |
| --- | --- |
| Text | `--text-900: #f7f0ff`, `--text-800: #e9ddf6`, `--text-700: #d0c0e0`, `--text-600: #b5a1c8`, `--text-500: #9b87ae`, `--muted-text: #a491b9` |
| Surfaces | `--surface-0: #160f20`, `--surface-2: #382342`, `--surface-page: #1d1428`, `--surface-card: #2a1b37`, `--surface-muted: #24162f` |
| Lines and accents | `--line-soft: #4b315d`, `--line-strong: #674276`, `--accent-600: #a978f2`, `--blue-500: #c09aff`, `--blue-600: #a978f2`, `--blue-700: #eddfff`, `--blue-50: #3a234d` |
| Shadows and charts | `--shadow-soft: 0 16px 28px rgba(7, 2, 15, 0.35)`, `--chart-gradient-start: #24162f`, `--chart-gradient-end: #24162f`, `--chart-guide: rgba(192, 154, 255, 0.16)`, `--chart-line: #c09aff` |
| Navigation | `--nav-active-border: #795099`, `--nav-active-bg: #3b2450`, `--nav-active-text: #f7f0ff` |
| Panels | `--panel-border: #5f3c70`, `--panel-gradient-start: #2a1b37`, `--panel-gradient-end: #2a1b37`, `--panel-divider: #4b315d` |
| Filters and back button | `--filter-active-border: #8a5ab1`, `--filter-active-bg: #452956`, `--filter-chip-border: #68447c`, `--filter-chip-bg: #33203f`, `--back-button-border: #6c467f`, `--back-button-bg: #33203f`, `--back-button-shadow: 0 12px 22px rgba(45, 14, 64, 0.28)` |

Keep the existing dark green, amber, red, danger, error, and status background/border values unchanged. Route each existing hard-coded editor/debugger color through a dark-only alias. Each alias keeps the current literal as its fallback outside dark mode and uses the grape value after the arrow in dark mode:

| Alias | Fallback → dark value |
| --- | --- |
| `--editor-surface` | `#252845 → #2a1b37` |
| `--editor-tab-surface` | `#1a1f37 → #160f20` |
| `--editor-divider` | `#5b527d → #4b315d` |
| `--editor-hover-surface` | `#222947 → #24162f` |
| `--editor-active-border` | `#9eadff → #c09aff` |
| `--editor-summary-glow` | `#9f8cff → #c09aff` |
| `--editor-summary-surface` | `#14182c → #160f20` |
| `--editor-column-surface` | `#18203a → #1d1428` |
| `--editor-header-surface` | `#101526 → #160f20` |
| `--editor-signal-accent` | `#5f7dff → #a978f2` |
| `--editor-signal-surface` | `#0f1528 → #160f20` |
| `--editor-signal-text` | `#d8e1ff → #eddfff` |
| `--editor-status-surface` | `#1f2844 → #24162f` |
| `--editor-control-surface` | `#12172a → #160f20` |
| `--editor-control-button` | `#1c2440 → #24162f` |
| `--editor-control-hover-border` | `#7e96ff → #c09aff` |
| `--editor-control-hover-surface` | `#243056 → #382342` |
| `--editor-tree-surface` | `#11172a → #160f20` |
| `--editor-tabs-surface` | `#13192d → #1d1428` |
| `--editor-tab-active-border` | `#8c9fff → #c09aff` |
| `--editor-event-active-surface` | `#27365f → #382342` |
| `--editor-event-active-accent` | `#95a4ff → #c09aff` |
| `--editor-event-expanded-surface` | `#202944 → #24162f` |
| `--editor-event-details-surface` | `#171f36 → #1d1428` |
| `--editor-code-surface` | `#0f1424 → #160f20` |
| `--editor-workspace-shadow` | `0 18px 44px rgba(9, 11, 22, 0.22) → 0 16px 28px rgba(7, 2, 15, 0.35)` |
| `--editor-control-shadow` | `0 14px 32px rgba(8, 10, 20, 0.34) → 0 14px 32px rgba(7, 2, 15, 0.35)` |
| `--metadata-surface` | `#0f172a → #160f20` |
| `--metadata-text` | `#dbe7ff → #eddfff` |
| `--explore-divider` | `#5b527d → #4b315d` |

The aliases may be declared only in the dark root; declarations using them must provide the listed fallback value with `var(--alias, fallback)` so the light theme is unchanged.

Replace hard-coded editor/debugger surface, accent, shadow, metadata, and Explore divider colors with `var()` aliases that fall back to their current values outside dark mode. Leave fixed exchange-series colors and semantic amber/success colors unchanged.

Apply the palette through shared variables so menus, links, tables, cards, filters, charts, debugger panels, and controls shift coherently without changing component behavior.

## Validation

- Add a focused stylesheet assertion for the complete approved dark-token map, chart tokens, dark-only aliases, replacement of the targeted raw editor/debugger color and shadow declarations, and unchanged light root values.
- Run the focused styles test.
- Run the full workspace test suite and `git diff --check`.
- Confirm light-mode variables remain unchanged and the worktree is clean after committing.
