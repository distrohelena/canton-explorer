# Event Offset Primary Identity Design

## Goal

Make `event_offset` the primary update identifier across the node activity list, update-detail route, and update-detail page, while keeping the canonical `update_id` available as secondary detail.

## Current State

- The recent activity page lists updates by `updateId`.
- Update detail routes use `/nodes/:id/updates/:updateId`.
- Backend detail lookup resolves rows by `participant.lapi_update_meta.update_id`.
- `event_offset` is present only inside raw metadata.

## Decision

Promote `event_offset` to the primary UI and routing identifier for update exploration.

This keeps the UI closer to an explorer mental model, gives users an ordered human-meaningful identifier, and still preserves `update_id` for traceability and raw inspection.

## Backend Design

### Response Shape

Extend the recent-updates and update-detail payloads so they always include `eventOffset`.

Recent update items should contain:

- `eventOffset`
- `updateId`
- `recordTime`
- `parties`

Update detail responses should contain:

- `eventOffset`
- `updateId`
- `recordTime`
- `parties`
- `meta`
- `events`

`updateId` remains part of the response, but it is no longer the primary display field or route key.

### Lookup Behavior

- Recent updates still read from `participant.lapi_update_meta`.
- The recent-updates query should select `event_offset` explicitly and return it as text.
- Update-detail lookup should resolve by `participant.lapi_update_meta.event_offset`, not by `update_id`.
- The backend should accept the route param as an offset string and return `404` when no row matches that offset for the selected node.
- Once the matching row is found, existing event and party loading should continue using the raw matched `update_id`, since related event tables are keyed by update id rather than offset.

### Scope Guard

- Do not add dual-mode lookup in this slice.
- Do not preserve `update_id`-based URLs in parallel.
- The canonical `update_id` remains available only as returned data, not as the route identity.

## Frontend Design

### Recent Activity List

- Rename the first column from `Update ID` to `Event Offset`.
- Use `eventOffset` as the primary displayed identifier in the list.
- Build row links with `eventOffset`:
  - `/nodes/:id/updates/:eventOffset`
- Keep record time and parties unchanged apart from layout adjustments handled separately.

### Update Detail Page

- Read the route param as `eventOffset`.
- Request detail data using the selected node id and event offset.
- Update the page title and summary block so the primary identifier is `Event Offset`.
- Keep `Canonical Update ID` as a secondary summary field.
- Keep raw metadata and event rendering unchanged aside from the new primary label.

## Data Flow

1. Recent updates API returns both `eventOffset` and `updateId`.
2. The list page displays `eventOffset` and links with it.
3. The detail page sends the offset to the backend.
4. The backend resolves the matching `lapi_update_meta` row by offset.
5. The backend loads parties and event rows using the matched update id.
6. The frontend renders offset first and update id second.

## Error Behavior

- Unknown node remains `404`.
- Unknown event offset for a valid node remains `404`.
- Empty events for a valid update remain a normal `events: []` case.

## Testing

### Backend

- Verify recent updates include `eventOffset`.
- Verify update detail resolves by `event_offset`.
- Verify unknown offsets return `Update not found`.
- Verify the matched detail response still includes the canonical `updateId`.

### Frontend

- Verify the recent updates list displays `Event Offset` and uses offset-based links.
- Verify the detail page fetches data using the offset route param.
- Verify the detail summary shows `Event Offset` as primary and `Canonical Update ID` as secondary.
- Verify existing event rendering still works.

## Out of Scope

- Offset search from the global titlebar
- Redirects from old `update_id`-based URLs
- Multi-key lookup accepting both offsets and update ids
