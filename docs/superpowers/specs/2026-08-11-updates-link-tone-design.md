# Updates Link Tone Preview

## Goal

Make content links feel less visually dominant while keeping them recognizable and clearly interactive.

## Scope

This first preview is limited to the Updates page. It affects content links rendered inside Updates rows, including update offsets and party links, without changing navigation links, toolbar controls, or the shared link styling used elsewhere in the application.

## Design

Keep the existing link affordance and interaction behavior, including the hover underline and keyboard focus treatment. Override only the Updates-page link color with a muted version of the existing blue palette using `color-mix`, blending the current blue link color with the page's secondary text color. This keeps the treatment consistent in light and dark themes while lowering contrast and visual distraction.

The implementation should target the Updates component's existing link class or an Updates-specific ancestor selector, avoiding changes to the shared `.contract-detail__link` rule. If the preview looks appropriate, the same palette decision can be applied to the shared content-link rule in a later, separately reviewed change.

## Validation

- Add or update a focused Updates view assertion for the link class/color hook if needed.
- Run the focused Updates view test.
- Run `git diff --check`.
- Confirm the working tree is clean after committing the preview.
