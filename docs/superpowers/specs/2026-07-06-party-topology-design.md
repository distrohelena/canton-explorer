# Party Topology Design

## Goal

Add a `Party Topology` section to the party detail page so operators can inspect effective topology mappings for one party, split by node, while keeping the existing PQS-backed activity and contract/update summaries unchanged.

## Scope

In scope:

- extend the party detail backend response with per-node topology data
- load topology only on the party detail page
- show one topology block per node on that page
- use gRPC read APIs for topology data
- keep only effective/current mappings
- show both:
  - party-to-participant mappings
  - party-to-key mappings

Out of scope:

- raw topology transaction history
- proposal / serial / change history views
- a standalone topology endpoint or separate lazy-loaded frontend call
- topology on the top-level `Parties` page

## Current State

The party detail page currently combines:

- PQS-backed overview counts
- observed nodes
- recent updates
- recent contracts

There is no topology data in the backend response, no frontend rendering for topology, and no gRPC helper dedicated to reading party mappings from the updated SDK surfaces.

## Requirements

### User Experience

- `Party Topology` appears only on `/parties/:partyId`
- the section sits below `Observed Nodes` and above the recent activity browsers
- topology is shown per node, not as one merged global view
- each node block shows a clear source pill of `gRPC`
- when topology is available, the block shows:
  - `Party to Participant`
  - `Party to Key`
- when a subsection has no data, show `Not Present`
- when a node does not support gRPC, show a clear not-configured state
- when a gRPC request fails, show a clear error state for that node only

### Data Semantics

- only effective/current mappings are returned
- PQS remains the source of party counts, updates, and contracts
- gRPC is used only for topology in this slice
- `pqs_only` nodes return a non-error unavailable state
- `pqs_with_grpc` nodes attempt a topology read
- a node-level gRPC failure must not fail the whole party detail page

## Recommended Architecture

### 1. Keep `fetchPartyDetail(...)` as the page aggregator

`PqsSummaryService.fetchPartyDetail(...)` already owns the party detail response. It should remain the single place that assembles the page payload.

That service continues to build:

- overview counts
- observed nodes
- recent updates
- recent contracts

It also adds a new `partyTopologyByNode` collection populated from gRPC operations.

### 2. Extend `GrpcClientFactory` with topology read services

The explorer already centralizes SDK access in `GrpcClientFactory`. That factory should expose the participant-admin topology read services needed for:

- `listPartyToParticipantAsync(...)`
- `listPartyToKeyMappingAsync(...)`

This keeps SDK wiring in one place and avoids topology-specific client construction elsewhere.

### 3. Add a focused topology helper to `GrpcOperationsService`

`GrpcOperationsService` should gain a dedicated helper such as `fetchPartyTopology(node, partyId)`.

Responsibilities:

- short-circuit `pqs_only` nodes
- call the SDK topology read methods for one party on one node
- normalize SDK payloads into explorer-owned response types
- convert transport errors into a stable frontend-facing status shape

This keeps raw SDK response handling out of `PqsSummaryService`.

### 4. Render topology in `PartyDetailView.vue`

The frontend party detail page remains the only consumer in this slice. It should render one node card per topology entry and present a text-first operational layout consistent with the rest of the app.

## Response Shape

Add a new collection to `PartyDetailResponse`:

```ts
interface PartyTopologyParticipantMapping {
  participantId: string | null;
  participantUid: string | null;
  permission: string | null;
  synchronizerIds: string[];
}

interface PartyTopologyKeyMapping {
  keyFingerprint: string | null;
  purpose: string | null;
  keyType: string | null;
  synchronizerIds: string[];
}

type PartyTopologyNodeStatus = 'ok' | 'grpc_not_configured' | 'grpc_error';

interface PartyTopologyNodeEntry {
  nodeId: string;
  label: string;
  status: PartyTopologyNodeStatus;
  errorMessage: string | null;
  partyToParticipants: PartyTopologyParticipantMapping[];
  partyToKeyMappings: PartyTopologyKeyMapping[];
}

interface PartyDetailResponse {
  // existing fields
  partyTopologyByNode: PartyTopologyNodeEntry[];
}
```

Notes:

- `grpc_not_configured` means node mode is `pqs_only`
- `grpc_error` means the read was attempted but failed
- `ok` with empty arrays is valid and should render `Not Present`

## Backend Behavior

### Fetch Flow

For each observed/configured node relevant to the party detail page:

1. Build the existing PQS party summary data
2. In parallel, request topology through `GrpcOperationsService.fetchPartyTopology(...)`
3. Merge the normalized topology results into the final response

The topology request should be isolated per node so one broken node does not poison the entire payload.

### Normalization Rules

- preserve the configured `nodeId` and `label`
- flatten SDK mapping objects into the minimal fields the UI needs now
- keep permission values as stable strings
- include synchronizer ids only if the SDK response exposes them cleanly
- do not expose raw protobuf / raw JSON payloads

### Error Handling

Per node:

- `pqs_only`
  - return `grpc_not_configured`
  - empty arrays
  - no thrown error
- gRPC read throws
  - return `grpc_error`
  - include a concise `errorMessage`
  - empty arrays
- gRPC read succeeds
  - return `ok`
  - render returned mappings, even if empty

## Frontend Rendering

### Layout

The new `Party Topology` section is full width and follows the established party detail page blocks.

Each node block shows:

- node label
- `gRPC` source pill
- node status message when applicable

When `status === 'ok'`, render two subsections:

1. `Party to Participant`
2. `Party to Key`

Each mapping is rendered as one compact row. The design stays textual and operational, with no raw dumps and no expand/collapse interactions.

### Empty and Error States

- `grpc_not_configured`
  - show a muted message such as `gRPC not configured for this node.`
- `grpc_error`
  - show the error message in the node block
- empty participant or key mappings
  - show `Not Present` in that subsection

## Testing Strategy

### Backend

Add tests for:

- `GrpcOperationsService.fetchPartyTopology(...)` on:
  - successful participant/key mapping reads
  - `pqs_only` nodes
  - SDK failures
- `PqsSummaryService.fetchPartyDetail(...)` including:
  - merged topology entries
  - non-fatal node-level gRPC errors
  - empty successful topology results

### Frontend

Add `PartyDetailView` coverage for:

- successful topology rendering with both subsections
- `grpc_not_configured`
- `grpc_error`
- successful empty mappings rendering `Not Present`

## Recommendation

Extend the existing party detail response rather than adding a separate topology endpoint. That preserves one fetch for the page, keeps PQS and gRPC concerns separated in the backend, and gives the frontend a stable node-by-node topology model that can evolve later without reworking the route structure.
