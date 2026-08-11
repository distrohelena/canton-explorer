# Dark Grape Theme

## Goal

Make the dark Canton Explorer theme feel more like the supplied purple/grape reference while leaving the light theme unchanged.

## Scope

Update the dark theme tokens in `frontend/src/styles.css` and route the existing hard-coded editor/debugger surfaces through dark-only fallback tokens. Component structure, spacing, typography, light-mode appearance, semantic status colors, and theme-toggle behavior remain unchanged.

## Design

Use lighter tones within the same purple/grape hue family, raising HSL lightness while preserving saturation instead of blending surfaces toward white. The dark block must use this exact map:

| Variable group | Exact dark values |
| --- | --- |
| Text | `--text-900: #f7f0ff`, `--text-800: #e9ddf6`, `--text-700: #d0c0e0`, `--text-600: #b5a1c8`, `--text-500: #9b87ae`, `--muted-text: #a491b9` |
| Surfaces | `--surface-0: #2e1f43`, `--surface-2: #543563`, `--surface-page: #36254a`, `--surface-card: #442c59`, `--surface-muted: #3f2652` |
| Lines and accents | `--line-soft: #66437e`, `--line-strong: #845497`, `--accent-600: #c7a7f6`, `--blue-500: #e0cdff`, `--blue-600: #c7a7f6`, `--blue-700: #e8d6ff`, `--blue-50: #543370` |
| Shadows and charts | `--shadow-soft: 0 16px 28px rgba(7, 2, 15, 0.28)`, `--chart-gradient-start: #3f2652`, `--chart-gradient-end: #3f2652`, `--chart-guide: rgba(224, 205, 255, 0.18)`, `--chart-line: #e0cdff` |
| Navigation | `--nav-active-border: #926bb1`, `--nav-active-bg: #553473`, `--nav-active-text: #f7f0ff` |
| Panels | `--panel-border: #7b4e91`, `--panel-gradient-start: #442c59`, `--panel-gradient-end: #442c59`, `--panel-divider: #66437e` |
| Filters and back button | `--filter-active-border: #a37dc1`, `--filter-active-bg: #613979`, `--filter-chip-border: #84569d`, `--filter-chip-bg: #4e3161`, `--back-button-border: #8858a0`, `--back-button-bg: #4e3161`, `--back-button-shadow: 0 12px 22px rgba(45, 14, 64, 0.22)` |

Keep the existing dark green, amber, red, danger, error, and status background/border values unchanged. Route each existing hard-coded editor/debugger color through a dark-only alias. Each alias keeps the current literal as its fallback outside dark mode and uses the grape value after the arrow in dark mode:

| Alias | Fallback → dark value |
| --- | --- |
| `--editor-surface` | `#252845 → #442c59` |
| `--editor-tab-surface` | `#1a1f37 → #2e1f43` |
| `--editor-divider` | `#5b527d → #66437e` |
| `--editor-hover-surface` | `#222947 → #3f2652` |
| `--editor-active-border` | `#9eadff → #e0cdff` |
| `--editor-summary-glow` | `#9f8cff → #e0cdff` |
| `--editor-summary-surface` | `#14182c → #2e1f43` |
| `--editor-column-surface` | `#18203a → #36254a` |
| `--editor-header-surface` | `#101526 → #2e1f43` |
| `--editor-signal-accent` | `#5f7dff → #c7a7f6` |
| `--editor-signal-surface` | `#0f1528 → #2e1f43` |
| `--editor-signal-text` | `#d8e1ff → #e8d6ff` |
| `--editor-status-surface` | `#1f2844 → #3f2652` |
| `--editor-control-surface` | `#12172a → #2e1f43` |
| `--editor-control-button` | `#1c2440 → #3f2652` |
| `--editor-control-hover-border` | `#7e96ff → #e0cdff` |
| `--editor-control-hover-surface` | `#243056 → #543563` |
| `--editor-tree-surface` | `#11172a → #2e1f43` |
| `--editor-tabs-surface` | `#13192d → #36254a` |
| `--editor-tab-active-border` | `#8c9fff → #e0cdff` |
| `--editor-event-active-surface` | `#27365f → #543563` |
| `--editor-event-active-accent` | `#95a4ff → #e0cdff` |
| `--editor-event-expanded-surface` | `#202944 → #3f2652` |
| `--editor-event-details-surface` | `#171f36 → #36254a` |
| `--editor-code-surface` | `#0f1424 → #2e1f43` |
| `--editor-workspace-shadow` | `0 18px 44px rgba(9, 11, 22, 0.22) → 0 16px 28px rgba(7, 2, 15, 0.28)` |
| `--editor-control-shadow` | `0 14px 32px rgba(8, 10, 20, 0.34) → 0 14px 32px rgba(7, 2, 15, 0.28)` |
| `--metadata-surface` | `#0f172a → #2e1f43` |
| `--metadata-text` | `#dbe7ff → #e8d6ff` |
| `--explore-divider` | `#5b527d → #66437e` |

The aliases may be declared only in the dark root; declarations using them must provide the listed fallback value with `var(--alias, fallback)` so the light theme is unchanged.

Replace hard-coded editor/debugger surface, accent, shadow, metadata, and Explore divider colors with `var()` aliases that fall back to their current values outside dark mode. Leave fixed exchange-series colors and semantic amber/success colors unchanged.

Apply the palette through shared variables so menus, links, tables, cards, filters, charts, debugger panels, and controls shift coherently without changing component behavior.

## Validation

- Add a focused stylesheet assertion for the complete approved dark-token map, chart tokens, dark-only aliases, replacement of the targeted raw editor/debugger color and shadow declarations, and unchanged light root values.
- Run the focused styles test.
- Run the full workspace test suite and `git diff --check`.
- Confirm light-mode variables remain unchanged and the worktree is clean after committing.
