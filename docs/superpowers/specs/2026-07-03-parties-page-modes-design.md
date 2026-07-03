# Parties Page Modes Design

## Goal

Add a real `Parties` page with two top-level modes:

- `Active Parties`
- `All Parties`

The first mode is implemented now using PQS data. The second mode is represented in the UI immediately, but its node-level content remains unavailable until the separate SDK/gRPC work lands.

## Scope

This design covers only the first delivery slice:

- build the final `Parties` page shell
- implement `Active Parties` using PQS
- model `All Parties` in the UI
- disable `All Parties` per node when that node has no gRPC capability

This design does not include:

- implementing gRPC-backed local-party listing
- extending the TypeScript SDK
- merging active and local party data

## Requirements

### Page Layout

The `Parties` route becomes a real operational page rather than a placeholder.

The page contains:

1. A mode switch row at the top with:
   - `Active Parties`
   - `All Parties`
2. A node selector row beneath it with one button per configured node
3. A content section below that showing the parties for the selected mode and selected node

### Mode Behavior

#### Active Parties

- Available for every node
- Uses PQS-backed data only
- Shows active parties for the selected node

#### All Parties

- Always visible and selectable at the page level
- Node buttons are selectively disabled based on node capability
- For nodes without gRPC support, the node button is greyed out and indicates `No gRPC`
- For nodes with gRPC support, the node remains selectable
- In this first slice, content for selectable `All Parties` nodes can show a placeholder/unavailable state until the SDK work is merged

### Node Capability Rules

Node capability comes from the explicit node mode already added to config:

- `pqs_only`
- `pqs_with_grpc`

Rules:

- `pqs_only`
  - supports `Active Parties`
  - does not support `All Parties`
- `pqs_with_grpc`
  - supports `Active Parties`
  - supports `All Parties`

### Selection Rules

The page keeps both:

- the selected page mode
- the selected node id

Default behavior:

- default mode is `Active Parties`
- default node is the first configured node

When switching to `All Parties`:

- if the currently selected node is `pqs_only`, the page should not attempt a load
- the content area should show a clear unavailable state such as `No gRPC`
- the user can select another enabled node

## Backend Design

### New PQS Endpoint

Add a backend endpoint dedicated to active parties grouped by node.

Suggested response shape:

```ts
interface ActivePartiesNodeEntry {
  nodeId: string;
  label: string;
  mode: 'pqs_only' | 'pqs_with_grpc';
  parties: string[];
}

interface ActivePartiesResponse {
  nodes: ActivePartiesNodeEntry[];
}
```

### Data Source

Use PQS event party data already present in participant tables / normalized tables.

The backend should:

- collect active/observed parties per configured node
- normalize returned party ids the same way the rest of the explorer does
- strip the leading `p|` prefix for display and routing consistency

### Inclusion Rules

Return all configured nodes in the response, even if a node currently has zero active parties.

That keeps the frontend page shape stable and avoids special-casing missing nodes.

## Frontend Design

### Route

Keep `/parties` as the top-level page route.

### Page State

The page manages:

- `selectedMode: 'active' | 'all'`
- `selectedNodeId: string | null`

### UI States

#### Active Parties Mode

- node buttons are all enabled
- selected node shows a list of party links
- each party links to `/parties/:partyId`
- if no parties exist, show `No active parties found`

#### All Parties Mode

- node buttons for `pqs_only` nodes are greyed out
- those buttons include `No gRPC`
- enabled nodes are nodes with mode `pqs_with_grpc`
- until SDK work lands, the content area can show a placeholder such as `All parties not available yet for this node`

## Testing

### Backend

- config tests already cover explicit node mode semantics
- add service/controller tests for the new active-parties endpoint
- verify nodes with no active parties still appear
- verify `p|` prefixes are stripped in returned party ids

### Frontend

- `PartiesView` renders both mode buttons
- `PartiesView` renders one node button per node
- switching to `Active Parties` shows party links for the selected node
- `pqs_only` nodes are disabled in `All Parties` mode
- disabled nodes show `No gRPC`
- empty PQS results show `No active parties found`

## Implementation Order

1. Add backend active-parties response types and endpoint
2. Implement PQS-backed active-party extraction and normalization
3. Replace placeholder `PartiesView` with the two-mode page shell
4. Wire frontend data loading for `Active Parties`
5. Add disabled-node behavior and placeholder content for `All Parties`
6. Verify with backend tests, frontend tests, and full builds

## Out Of Scope Follow-Up

The follow-up slice will add:

- SDK support for local-party listing over gRPC
- backend endpoint for `All Parties`
- frontend content loading for enabled nodes in `All Parties` mode
