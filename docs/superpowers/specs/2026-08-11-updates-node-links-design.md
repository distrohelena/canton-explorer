# Global Updates Node Links

## Goal

Make the global Updates table's Node column 30% narrower and let users open a node detail view by clicking a node label.

## Scope

This change applies to the global Updates table rendered by `HomeUpdatesView`, whose rows use `activity-home__updates-row` and whose section uses `activity-home__updates-section--global-updates`. Other UpdatesBrowser instances and other tables remain unchanged.

## Design

Keep the shared node-column grid rule at `minmax(120px, 0.8fr)` for other UpdatesBrowser instances, and add a later global-Updates-only override for `.node-updates__row.activity-home__updates-row` using `minmax(84px, 0.56fr)`. This reduces both the global Updates Node column's minimum and flexible width by 30% while keeping other tables and the responsive layout unchanged.

Inside the existing mobile media query, add a more-specific global Updates override for `.activity-home__updates-section--global-updates .node-updates__row.activity-home__updates-row` with `grid-template-columns: 1fr` so the table retains its single-column mobile layout.

When `showNodeColumn` is enabled and an update has a `nodeId`, render the node label as a `RouterLink` to `/nodes/${encodeURIComponent(nodeId)}`. Add click, Enter, and Space event stops on the link so node activation cannot bubble to the clickable update row. Node clicks and Enter activation open the node detail view instead of the update detail view; Space on the focused link must not activate the row. Preserve `Unknown node` as non-link text when the update has no node ID.

The node link should retain the existing Updates content-link styling and accessible link semantics. Keyboard activation of the link must follow normal RouterLink behavior; keyboard activation of the surrounding row must continue to open the update detail view when focus is on the row itself.

## Validation

- Add focused Home Updates assertions for the node link text, class, and an encoded destination containing a reserved-character node ID.
- Verify clicking the node link does not invoke update-row navigation, while clicking or pressing Enter/Space on the row itself still invokes update navigation.
- Verify the global Updates row retains its single-column grid rule under the mobile breakpoint.
- Run the focused Home Updates test and the full workspace test suite.
- Run `git diff --check`.
