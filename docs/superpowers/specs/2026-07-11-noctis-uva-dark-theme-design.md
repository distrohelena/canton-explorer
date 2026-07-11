# Noctis Uva Dark Theme Design

## Goal

Retheme Canton Explorer dark mode so the entire product, including the debugger and Monaco, adopts a restrained Noctis Uva-inspired visual system: cold unsaturated indigo-blue foundations, soft lavender-gray text, quiet separators, and sparse warm accents.

## Visual Direction

- Dark mode should feel spartan and editor-adjacent, not glossy or neon.
- The base should be a desaturated indigo slate rather than blue-black or saturated purple.
- Contrast should remain accessible, but surfaces should separate mostly through tone rather than heavy shadows or bright gradients.
- Monaco must feel native to the same system rather than like an embedded third-party surface.

## Theme Rules

### Shared tokens

- Define a complete token set for backgrounds, surfaces, text tiers, borders, shadows, active states, and semantic colors.
- Keep light theme behavior intact.
- Fix existing token gaps so shared CSS does not depend on undefined variables.

### Explorer chrome

- Flatten the header and footer slightly in dark mode.
- Keep navigation readable and compact, with active states expressed through restrained cyan-blue.
- Tone down card gradients and hover glow across list and dashboard surfaces.

### Debugger

- Make Monaco the visual anchor.
- Keep side panels darker and quieter than the current dashboard-oriented treatment.
- Use precise, low-noise states for splitter, scope panels, event lists, and step controls.

### Monaco

- Define a custom dark theme that matches Noctis Uva principles.
- Use muted cool and warm syntax accents with a soft lilac default foreground.
- Keep selection, current line, and gutter markers subtle.

## Implementation Scope

- Update shared theme tokens and common surface rules in `frontend/src/styles.css`.
- Update Monaco theme loading in `frontend/src/lib/monaco.ts`.
- Update editor theme resolution in `frontend/src/components/MonacoCodeSurface.vue`.
- Add or adjust focused frontend tests for Monaco theme registration and debugger shell rendering where behavior changes.

## Non-Goals

- No light-theme redesign.
- No route or information-architecture changes.
- No component rewrites unless the current styling hooks cannot express the theme.

## Verification

- Run focused frontend tests for Monaco and debugger shell behavior.
- Run a frontend production build.
- Inspect at least one standard Explorer view and the debugger to confirm the theme is coherent across both.
