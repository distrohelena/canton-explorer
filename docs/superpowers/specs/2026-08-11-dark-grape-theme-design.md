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
| Shadows and charts | `--shadow-soft: 0 16px 28px rgba(7, 2, 15, 0.35)`, `--chart-guide: rgba(192, 154, 255, 0.16)`, `--chart-line: #c09aff` |
| Navigation | `--nav-active-border: #795099`, `--nav-active-bg: #3b2450`, `--nav-active-text: #f7f0ff` |
| Panels | `--panel-border: #5f3c70`, `--panel-gradient-start: #2a1b37`, `--panel-gradient-end: #2a1b37`, `--panel-divider: #4b315d` |
| Filters and back button | `--filter-active-border: #8a5ab1`, `--filter-active-bg: #452956`, `--filter-chip-border: #68447c`, `--filter-chip-bg: #33203f`, `--back-button-border: #6c467f`, `--back-button-bg: #33203f`, `--back-button-shadow: 0 12px 22px rgba(45, 14, 64, 0.28)` |

Keep the existing dark green, amber, red, danger, error, and status background/border values unchanged. Add these dark-only aliases for currently hard-coded dark UI surfaces: `--editor-surface: #2a1b37`, `--editor-deep-surface: #160f20`, `--editor-muted-surface: #24162f`, `--editor-raised-surface: #382342`, `--editor-accent: #c09aff`, `--editor-accent-muted: #3a234d`, `--editor-text-strong: #eddfff`, `--editor-shadow: 0 14px 32px rgba(7, 2, 15, 0.35)`, `--metadata-surface: #160f20`, `--metadata-text: #eddfff`, and `--explore-divider: #4b315d`.

Replace hard-coded editor/debugger surface, accent, shadow, metadata, and Explore divider colors with `var()` aliases that fall back to their current values outside dark mode. Leave fixed exchange-series colors and semantic amber/success colors unchanged.

Apply the palette through shared variables so menus, links, tables, cards, filters, charts, debugger panels, and controls shift coherently without changing component behavior.

## Validation

- Add a focused stylesheet assertion for the complete approved dark-token map, the dark-only aliases, and the unchanged light root values.
- Run the focused styles test.
- Run the full workspace test suite and `git diff --check`.
- Confirm light-mode variables remain unchanged and the worktree is clean after committing.
