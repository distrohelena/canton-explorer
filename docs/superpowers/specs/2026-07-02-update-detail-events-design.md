# Update Detail Events Design

## Goal

Extend the update-details endpoint and page so a user can inspect the actual event rows associated with an update, not just update metadata and parties.

## Current State

- `GET /api/nodes/:id/updates/:updateId` returns:
  - `nodeId`
  - `label`
  - `updateId`
  - `recordTime`
  - `parties`
  - `meta`
- The backend anchors detail lookup on `participant.lapi_update_meta`.
- Parties are gathered separately from the participant event tables.
- The frontend details page renders summary fields plus a prettified raw `meta` block.
- No actual create or exercise event rows are returned yet.

## Decision

Keep the existing update-details endpoint and extend its response with a normalized `events` list that also preserves the raw event row payload.

This avoids adding a second endpoint, keeps the detail route stable, and gives the frontend both a compact rendering contract and source-fidelity inspection data.

## Backend Design

### Data Source Strategy

- Keep `participant.lapi_update_meta` as the update header source.
- Do not inner-join `lapi_update_meta` directly to all event tables.
- Fetch event rows from a derived `union all` over:
  - `participant.lapi_events_create`
  - `participant.lapi_events_consuming_exercise`
  - `participant.lapi_events_non_consuming_exercise`

This avoids dropping valid updates that only appear in one event table.

### Response Shape

Extend the existing response with:

- `events: NodeUpdateEvent[]`

Each event item contains:

- `eventKind`
- `eventId`
- `contractId`
- `templateId`
- `choice`
- `witnesses`
- `raw`

Field rules:

- `eventKind` is one of:
  - `create`
  - `consuming_exercise`
  - `non_consuming_exercise`
- `eventId`, `contractId`, `templateId`, and `choice` are nullable when the source row does not provide them.
- `witnesses` is always returned as an array, defaulting to `[]`.
- `raw` contains the full original source-table row serialized as JSON before the row enters the union.
- If a normalized field cannot be derived cleanly from a source row, set that normalized field to `null` and preserve the source data in `raw`.

Example response excerpt:

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
  },
  "events": [
    {
      "eventKind": "create",
      "eventId": "#0:0",
      "contractId": "00abc",
      "templateId": "Main:Asset",
      "choice": null,
      "witnesses": ["Alice", "Bob"],
      "raw": {
        "update_id": "\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1",
        "event_id": "#0:0",
        "contract_id": "00abc",
        "template_id": "Main:Asset",
        "tree_event_witnesses": ["Alice", "Bob"]
      }
    }
  ]
}
```

### Query Behavior

- Reuse the existing update ID normalization rules for canonical, raw `\x...`, and display-shortened forms.
- Query the matched update header first.
- Query event rows second using the matched raw update ID.
- In each event-table branch, select:
  - normalized fields needed for the shared event contract
  - a `raw` JSON object built from the full source-table row
- Normalize mixed event rows into a single ordered `events` array.
- Order events deterministically by:
  - `eventId` ascending
  - `eventKind` ascending as a tiebreaker
  - `contractId` ascending as a final fallback
  - `templateId` ascending as a last tiebreaker

### Error Behavior

- Unknown node remains `404`.
- Unknown update remains `404`.
- Missing event rows for a valid update are not an error; return `events: []`.
- If optional event parsing fails for a field, preserve the row in `raw` where possible instead of failing the entire endpoint.

## Frontend Design

### Update Details Page

- Keep the existing summary section and raw `meta` section.
- Add an `Events` section below the summary.
- Render each event with stable explorer-style fields first:
  - kind
  - event ID
  - contract ID
  - template ID
  - choice
  - witnesses
- Show the raw event payload in a secondary preformatted block for each event.

### Empty State

- If `events` is empty, show a clear empty state such as `No event rows found for this update.`
- This is a normal state, not an error.

### Scope Guard

- Do not attempt to semantically model all PQS event-table columns in this slice.
- Any field not explicitly normalized stays inside `raw`, which is serialized per source table before the union.

## Testing

### Backend

- Verify the unioned event lookup returns mixed create and exercise rows in one `events` array.
- Verify the endpoint still succeeds when one or more event tables contribute no rows.
- Verify normalized event fields are populated from the correct source columns.
- Verify `events: []` is returned for an update with no event rows.
- Verify a row is preserved with `null` normalized fields when a field cannot be derived cleanly but the source row is still available in `raw`.

### Frontend

- Verify the details page renders normalized event fields.
- Verify raw event payload text is shown for each event.
- Verify the empty state renders when `events` is empty.
- Verify existing summary and metadata rendering still works.

## Out of Scope

- Event pagination
- Event filtering
- Contract payload decoding beyond raw row exposure
- Additional per-event drilldown routes
- Replacing `raw` with a fully normalized domain model
