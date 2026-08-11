# Dark Grape Theme

## Goal

Make the dark Canton Explorer theme feel more like the supplied purple/grape reference while leaving the light theme unchanged.

## Scope

Only the `:root[data-theme="dark"]` design tokens in `frontend/src/styles.css` change. Component structure, spacing, typography, light-mode tokens, semantic status colors, and theme-toggle behavior remain unchanged.

## Design

Use a deep aubergine foundation with slightly lighter plum cards and muted grape borders:

- Page/background surfaces: `#160f20`, `#1d1428`, `#24162f`, `#2a1b37`, `#382342`
- Text: warm lavender-white primary text with lavender-gray secondary text
- Interactive accents: `#a978f2`, `#c09aff`, and pale lavender `#eddfff`
- Navigation and filter states: grape-tinted borders/backgrounds instead of blue-violet defaults
- Shadows and chart guides: darker plum-tinted neutrals

Keep green, amber, and red status colors recognizable, with only small tonal adjustments where needed for contrast against the new surfaces.

Apply the palette through the existing theme variables so menus, links, tables, cards, filters, charts, and controls shift coherently without component-specific overrides.

## Validation

- Add a focused stylesheet assertion that the dark theme contains the approved grape surface and accent tokens.
- Run the focused styles test.
- Run the full workspace test suite and `git diff --check`.
- Confirm light-mode variables remain unchanged and the worktree is clean after committing.
