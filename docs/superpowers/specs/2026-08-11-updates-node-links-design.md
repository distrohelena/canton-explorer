# Global Updates Node Links

## Goal

Make the global Updates table's Node column 30% narrower and let users open a node detail view by clicking a node label.

## Scope

This change applies to the global Updates table rendered by `HomeUpdatesView`, whose rows use `activity-home__updates-row` and whose section uses `activity-home__updates-section--global-updates`. Other UpdatesBrowser instances and other tables remain unchanged.

## Design

Reduce the Node grid track from `minmax(120px, 0.8fr)` to `minmax(84px, 0.56fr)`, reducing both its minimum and flexible width by 30% while keeping the other columns and responsive layout unchanged.

When `showNodeColumn` is enabled and an update has a `nodeId`, render the node label as a `RouterLink` to `/nodes/<encoded nodeId>`. Stop the link click from bubbling to the clickable update row so node clicks open the node detail view instead of the update detail view. Preserve `Unknown node` as non-link text when the update has no node ID.

The node link should retain the existing Updates content-link styling and accessible link semantics. Keyboard activation of the link must follow normal RouterLink behavior; keyboard activation of the surrounding row must continue to open the update detail view when focus is on the row itself.

## Validation

- Add focused Home Updates assertions for the node link text, class, and encoded destination.
- Verify clicking the node link navigates to the node route without invoking update-row navigation.
- Run the focused Home Updates test and the full workspace test suite.
- Run `git diff --check`.
