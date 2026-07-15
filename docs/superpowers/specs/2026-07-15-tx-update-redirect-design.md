# Legacy Transaction URL Redirect Design

## Goal

Make a legacy transaction URL, `/tx/:updateId`, resolve its update and forward
the browser to that update's current node-scoped detail page.

## Current State

- Update detail pages are addressed as
  `/nodes/:nodeId/updates/:eventOffset`.
- The global search API returns update matches containing both `nodeId` and
  `eventOffset`.
- `/tx/:updateId` is not currently a frontend route.

## Decision

Add a small route-only view for `/tx/:updateId`. On mount, it will query the
existing search API with the supplied update ID, choose the first update in the
returned results, and use `router.replace` to forward to
`/nodes/:nodeId/updates/:eventOffset`.

Using `replace` keeps the legacy address out of browser history once the
destination is known. Selecting the first returned match is intentional and
matches the requested ambiguity policy when more than one node reports the
same update ID.

## Error Handling

- While lookup is pending, the view shows a concise resolving state.
- If no update result is returned, or the search request fails, replace the
  route with `/search?q=<updateId>` so the user can inspect available results.
- The legacy route preserves no additional query or hash state.

## Scope

- Reuse the existing frontend search API; do not add a backend endpoint.
- Do not alter the current update-detail route or search ordering.
- Do not create a selection UI for duplicate update IDs.

## Testing

- Verify a legacy URL searches by its update ID and replaces itself with the
  first matching update's node-scoped detail route.
- Verify an unmatched update ID falls back to the corresponding search page.
- Keep existing routing coverage green.
