# Node Update Details Route Design

## Goal

Allow a user to hover and click a recent update row from a node's updates list and open a separate update-details page for that specific update ID.

## Current State

- `/nodes/:id/updates` renders a recent-updates list for a node.
- The list currently shows minimal update data: `updateId`, `recordTime`, and `parties`.
- Update IDs are display-normalized in the frontend, but there is no route or API for a single update details page.
- Update rows are static content today, with no hover affordance or drilldown behavior.

## Decision

Add a dedicated update-details route and backend endpoint instead of trying to carry detail data through the list page.

- List route remains: `/nodes/:id/updates`
- New details route: `/nodes/:id/updates/:updateId`
- New API endpoint: `GET /api/nodes/:id/updates/:updateId`

This keeps the list lightweight, supports direct page loads and refreshes for a single update, and avoids coupling the overview payload to detail-page needs.

## Backend Design

- Add a dedicated backend query path for one update under a node.
- Reuse the node validation and PQS access patterns already used by the updates list endpoint.
- Normalize inbound update IDs server-side so the endpoint can resolve:
  - the existing list-route `updateId` value
  - `\x...`-prefixed values
  - display-normalized values where the `1220` prefix was omitted for presentation
- Use `participant.lapi_update_meta` as the source of truth for the update detail record.
- Reuse the existing event-table witness aggregation approach for parties:
  - `participant.lapi_events_create`
  - `participant.lapi_events_consuming_exercise`
  - `participant.lapi_events_non_consuming_exercise`

### Response Shape

Return a stable response with a small top-level wrapper and a minimally reshaped detail payload:

- `nodeId`
- `label`
- `updateId`
- `recordTime`
- `parties`
- `meta`

Field rules:

- `updateId` is the canonical API and route identifier. It should match the existing list response contract: strip a leading `\x` if present, but do not strip the `1220` prefix.
- `recordTime` mirrors the matched update's record time in the existing ISO-string form.
- `parties` remains a best-effort distinct witness list.
- `meta` contains the matched `participant.lapi_update_meta` row serialized for the frontend. Preserve source fidelity rather than inventing a richer domain model in this first pass.

Example response:

```json
{
  "nodeId": "participant-1",
  "label": "Participant 1",
  "updateId": "1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1",
  "recordTime": "2026-07-01T12:00:00.000Z",
  "parties": ["Alice", "Bob"],
  "meta": {
    "update_id": "\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1",
    "record_time": 1782907200000000,
    "event_offset": "0000000000000001"
  }
}
```

### Error Behavior

- Unknown node returns `404`.
- Unknown update ID for a known node returns `404`.
- PQS/database failures return a normal API error so the frontend can show a page-level failure state.
- If some optional detail fields are unavailable, the endpoint should still return the update when possible rather than failing purely because a nonessential field is missing.

## Frontend Design

### Updates List Page

- Make each update row behave like a clickable table row.
- Add hover background feedback and `cursor: pointer`.
- Clicking anywhere on a data row navigates to `/nodes/:id/updates/:updateId`.
- The route should use the existing list response `updateId` value for navigation.
- The frontend may continue deriving a shorter display form from that value for presentation only.

### Update Details Page

- Add a dedicated view for `/nodes/:id/updates/:updateId`.
- Reuse the existing app content frame and back-arrow layout pattern.
- Back navigation returns to `/nodes/:id/updates`.
- Render the response in a clean detail layout that preserves backend fidelity:
  - top summary fields for node label, display-normalized update ID, record time, and parties
  - the canonical route/API `updateId` shown as secondary technical text if needed
  - the `meta` object rendered by default as a prettified raw JSON block in this first pass

### Time and Identifier Presentation

- Continue displaying record time in the browser's local timezone.
- Continue using the normalized display form for human-readable update IDs.
- The canonical route value is the API `updateId` field from the list response.
- Route lookup must not depend on the shorter display-normalized value alone; backend normalization is the source of truth.

## Interaction Model

- User opens `/nodes/:id/updates`.
- Hovering a data row visually indicates it is interactive.
- Clicking a row opens `/nodes/:id/updates/:updateId`.
- The details page loads independently through its own API call and remains stable on refresh or direct deep link access.

## Testing

### Backend

- Verify single-update lookup resolves normalized and raw update ID variants to the same record when supported.
- Verify the controller returns the expected payload for a known node/update pair.
- Verify unknown node returns `404`.
- Verify unknown update for a valid node returns `404`.

### Frontend

- Verify update rows expose interactive behavior through navigation wiring.
- Verify clicking a rendered row navigates to the details route.
- Verify hover styles and pointer affordance are applied to data rows, not the header row.
- Verify the details page loads and renders backend data.
- Verify the details page shows explicit loading and error states for failed fetches.

## Out of Scope

- Pagination across updates
- Search or filtering within the update list
- Rich semantic modeling of every nested detail field
- Cross-node update lookup
- Preloading full detail payloads into the list response
