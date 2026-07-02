# Titlebar Search Ownership Design

## Goal

Render the `Search by Update ID or Party ID...` control once in the shared application titlebar so it is visible on every route and no page owns a duplicate copy.

## Current State

- `HomeActivityView.vue` is the `/` route.
- `OperationsDashboardView.vue` powers the `/nodes` route through `NodesView.vue`.
- The offset/party search input currently lives inside the nodes overview page markup.

## Decision

Move the search control into the shared shell in `frontend/src/App.vue`.

This keeps the input aligned with the titlebar/navigation, removes duplicated page responsibility, and matches the intended UX that the search box is part of the global chrome rather than page content.

## UI Changes

- Add the search textbox to the header area in `App.vue`.
- Keep `Home` and `Nodes` navigation links in the same titlebar.
- Remove the page-level search textbox from `OperationsDashboardView.vue`.
- Do not add a second search textbox to `HomeActivityView.vue`.

## Styling

- Extend the shared header layout in `frontend/src/styles.css` so the title, nav, and search field coexist cleanly.
- Preserve full-width header behavior and responsive stacking on smaller screens.

## Testing

- Update app-shell tests to assert the shared titlebar search box is present.
- Update home view tests to ensure the page does not own a duplicate search box.
- Update nodes view tests to ensure the nodes page does not own a duplicate search box.
