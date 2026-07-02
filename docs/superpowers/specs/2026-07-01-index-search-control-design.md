# Index Search Control Design

## Goal

Add a non-functional explorer-style search control to the index page so the home view feels more like a production explorer product.

The control is visual-only in this phase. It does not trigger filtering, routing, or backend behavior.

## Scope

Included:

- search input on the home page
- placeholder text: `Search by Update ID or Party ID...`
- explorer-style visual treatment aligned with the existing home-page header
- responsive layout behavior alongside the existing refresh button
- frontend test coverage for the rendered control

Excluded:

- search execution
- filtering node cards
- navigation based on search
- validation or empty-state behavior

## Placement

The search control should live in the index-page header area on `frontend/src/views/OperationsDashboardView.vue`.

The header should have two zones:

- left: page title and supporting subtext
- right: search control and refresh button

This matches the common explorer pattern more closely than placing search in the global shell or as a separate row above the grid.

## Visual Direction

The control should look like an explorer search entry point:

- clean, practical, product-oriented
- consistent with the lighter explorer shell
- visually prominent but not louder than the page title

The search box should feel ready for future behavior even though it is not wired yet.

## Responsive Behavior

On narrower screens:

- the right-side controls may wrap or stack below the title
- the input should remain usable and readable
- the layout should stay tidy rather than compressed

## Testing

Update the dashboard view test to assert:

- the textbox is rendered
- the placeholder text is exactly `Search by Update ID or Party ID...`

No behavior tests are needed yet because the control is intentionally visual-only.

## Risks

The only real risk is making the search look interactive enough that users expect it to work immediately. That is acceptable for this phase as long as we keep the scope explicitly visual-only in implementation and planning.
