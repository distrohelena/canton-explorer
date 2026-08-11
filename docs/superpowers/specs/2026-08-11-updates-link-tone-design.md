# Updates Link Tone Preview

## Goal

Make content links feel less visually dominant while keeping them recognizable and clearly interactive.

## Scope

This first preview is limited to the global Updates page rendered by `HomeUpdatesView`. It affects content links rendered inside `.activity-home__updates-section--global-updates`, including update offsets and party links, without changing party-detail Updates views, Contracts or Purchases views, navigation links, toolbar controls, or the shared link styling used elsewhere in the application.

## Design

Keep the existing link affordance and interaction behavior, including the hover underline and keyboard focus treatment. Add an Updates-only selector for `.activity-home__updates-section--global-updates .contract-detail__link` with this declaration:

```css
color: var(--blue-500);
color: color-mix(in srgb, var(--blue-600) 70%, var(--text-600));
```

The first declaration is the fallback; the second blends 70% of the existing link blue with 30% of the secondary text color. This keeps the treatment consistent in light and dark themes while lowering contrast and visual distraction.

The implementation should use the page-specific selector above and must not change the shared `.contract-detail__link` rule. If the preview looks appropriate, the same palette decision can be applied to the shared content-link rule in a later, separately reviewed change.

## Validation

- Add or update a focused Updates view assertion for the link class/color hook if needed.
- Run the focused Updates view test.
- Run `git diff --check`.
- Confirm the working tree is clean after committing the preview.
