# Node Activity Updates Route Design

## Goal

Allow a user to click a node activity card on the home page and open a separate route that lists the latest updates for that node in a minimal explorer-style view.

## Current State

- `/` shows per-node activity panels from cached history data.
- `/nodes` shows connected nodes.
- `/nodes/:id` shows operational node detail.
- There is no route or backend endpoint for listing per-node updates.
- The backend already queries `participant.lapi_update_meta` for summary data, but not for update lists.

## Decision

Add a new route at `/nodes/:id/updates` and keep `/nodes/:id` unchanged.

This preserves the current node detail page, keeps the explorer interaction model clean, and supports a future drilldown page for a specific update ID without overloading the operational detail view.

## Backend Design

- Add a dedicated PQS query path for recent node updates instead of trying to reuse the polling cache.
- Expose a new API endpoint:
  - `GET /api/nodes/:id/updates?limit=25`
- Response shape:
  - `nodeId`
  - `label`
  - `limit`
  - `updates: [{ updateId, recordTime, parties[] }]`

### Query behavior

- Default limit is `25`.
- Results are newest-first.
- `updateId` and `recordTime` come from PQS update metadata.
- `parties` are gathered from participant event tables on a best-effort basis.
- If no parties are found for an update, return an empty array.
- If party extraction is unavailable or incomplete, do not fail the whole endpoint just for that field.

### Error behavior

- Unknown node returns `404`.
- PQS/database failures return a normal API error so the frontend can show a page-level error state.

## Frontend Design

- Make each home activity panel navigate to `/nodes/:id/updates`.
- Add a new updates page view that renders a compact explorer-style list.
- Each row shows:
  - `Update ID`
  - `record time`
  - `parties`
- `Update ID` should read as a clickable/drilldown-ready identifier, even though the update-detail page is out of scope for this slice.
- Add a back link to the home/activity page.

## Interaction Model

- Clicking a node’s activity from `/` opens the updates route for that node.
- `/nodes/:id` remains the node health and ledger snapshot page.
- `/nodes/:id/updates` becomes the list page for recent updates only.

## Testing

### Backend

- Verify PQS update rows normalize into the API response shape.
- Verify default `25` limit behavior.
- Verify empty or missing parties return `[]` instead of failing the response.
- Verify the controller returns the per-node updates payload for a known node.

### Frontend

- Verify the home activity card links to `/nodes/:id/updates`.
- Verify the updates page renders a minimal list from mocked API data.
- Verify `/nodes/:id` still renders the existing node detail page unchanged.

## Out of Scope

- Pagination
- Filtering
- Search within updates
- Caching update lists in the backend
- The update-detail page for a specific `Update ID`
