# Party Topology Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `Party Topology` section to `/parties/:partyId` that shows effective party-to-participant and party-to-key mappings per node using gRPC, without changing the existing PQS-backed updates/contracts flows.

**Architecture:** Extend the backend party-detail payload with a node-scoped topology collection assembled inside `PqsSummaryService.fetchPartyDetail(...)`. Use `GrpcOperationsService` as the only layer that talks to the SDK topology read APIs, normalize node-local error states there, then render the new section in `PartyDetailView.vue` with the existing `gRPC` source pill and party-detail page styling.

**Tech Stack:** NestJS, TypeScript, Jest, Vue 3, Vue Router, Vitest

---

### Task 1: Add the backend topology read helper

**Files:**
- Modify: `backend/src/grpc/grpc-client.factory.ts`
- Modify: `backend/src/grpc/grpc-operations.service.ts`
- Test: `backend/test/grpc/grpc-operations.service.spec.ts`

- [ ] **Step 1: Write failing gRPC helper tests**

Add Jest coverage in `backend/test/grpc/grpc-operations.service.spec.ts` for:

```ts
await service.fetchPartyTopology(node, 'Alice')
```

Scenarios:

- successful `partyToParticipant` + `partyToKey` reads
- `pqs_only` node returns `grpc_not_configured`
- thrown SDK error returns `grpc_error`

- [ ] **Step 2: Run the targeted backend gRPC test**

Run:

```bash
rtk npm run test --workspace backend -- --runInBand backend/test/grpc/grpc-operations.service.spec.ts
```

Expected: FAIL because `fetchPartyTopology(...)` and related result mapping do not exist yet.

- [ ] **Step 3: Extend the SDK client typing and implement the helper**

In `backend/src/grpc/grpc-client.factory.ts`, extend `SdkCantonClient` so the created SDK client exposes the topology read surface used by the updated SDK:

```ts
topologyManagerReadService: {
  listPartyToParticipantAsync(...): Promise<...>;
  listPartyToKeyMappingAsync(...): Promise<...>;
};
```

In `backend/src/grpc/grpc-operations.service.ts`, add explorer-owned result types and `fetchPartyTopology(node, partyId)` that:

- short-circuits `pqs_only` nodes
- calls both SDK methods inside `withClient(...)`
- filters by the target party
- normalizes permission, participant identity, key fingerprint, and synchronizer ids
- catches transport failures and converts them into:

```ts
{ status: 'grpc_error', errorMessage: string, partyToParticipants: [], partyToKeyMappings: [] }
```

- [ ] **Step 4: Re-run the targeted backend gRPC test**

Run:

```bash
rtk npm run test --workspace backend -- --runInBand backend/test/grpc/grpc-operations.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the backend gRPC helper**

Run:

```bash
rtk git add backend/src/grpc/grpc-client.factory.ts backend/src/grpc/grpc-operations.service.ts backend/test/grpc/grpc-operations.service.spec.ts
rtk git commit -m "feat: add party topology grpc reader"
```

### Task 2: Extend the party-detail backend response and aggregate topology

**Files:**
- Modify: `backend/src/domain/node.types.ts`
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`
- Modify: `backend/test/api/nodes.controller.spec.ts`

- [ ] **Step 1: Write failing party-detail aggregation tests**

Add/extend tests in `backend/test/pqs/pqs-summary.service.spec.ts` so `fetchPartyDetail(...)` proves:

- topology is returned per node
- one node can return `grpc_error` without failing the whole page
- `ok` with empty arrays is preserved
- `Party not found` still throws when there is no PQS activity at all

Also update the typed party-detail fixture in `backend/test/api/nodes.controller.spec.ts` so the controller tests expect the new response shape.

- [ ] **Step 2: Run the targeted party-detail backend tests**

Run:

```bash
rtk npm run test --workspace backend -- --runInBand backend/test/pqs/pqs-summary.service.spec.ts backend/test/api/nodes.controller.spec.ts
```

Expected: FAIL because `PartyDetailResponse` does not yet contain `partyTopologyByNode`.

- [ ] **Step 3: Add the response shape and wire topology into `fetchPartyDetail(...)`**

In `backend/src/domain/node.types.ts`, add:

```ts
export type PartyTopologyNodeStatus = 'ok' | 'grpc_not_configured' | 'grpc_error';

export interface PartyTopologyParticipantMapping { ... }
export interface PartyTopologyKeyMapping { ... }
export interface PartyTopologyNodeEntry { ... }
```

Then extend `PartyDetailResponse` with:

```ts
partyTopologyByNode: PartyTopologyNodeEntry[];
```

In `backend/src/pqs/pqs-summary.service.ts`:

- keep PQS update/contract discovery logic unchanged
- fetch topology in parallel with the existing node-level party work
- only call the gRPC helper after the party is normalized
- attach one `partyTopologyByNode` entry per observed/configured node that matters for the party detail page
- sort topology entries by node label to match the rest of the page

- [ ] **Step 4: Re-run the targeted party-detail backend tests**

Run:

```bash
rtk npm run test --workspace backend -- --runInBand backend/test/pqs/pqs-summary.service.spec.ts backend/test/api/nodes.controller.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the party-detail backend aggregation**

Run:

```bash
rtk git add backend/src/domain/node.types.ts backend/src/pqs/pqs-summary.service.ts backend/test/pqs/pqs-summary.service.spec.ts backend/test/api/nodes.controller.spec.ts
rtk git commit -m "feat: add party topology to party detail payload"
```

### Task 3: Extend frontend party-detail types and API fixtures

**Files:**
- Modify: `frontend/src/types/parties.ts`
- Modify: `frontend/src/lib/api.test.ts`

- [ ] **Step 1: Update the frontend party-detail fixture to the new shape**

Add the new topology types to `frontend/src/types/parties.ts` and update the typed `PartyDetailResponse` fixture in `frontend/src/lib/api.test.ts` so it includes:

```ts
partyTopologyByNode: []
```

- [ ] **Step 2: Run the targeted frontend API test**

Run:

```bash
rtk npm run test --workspace frontend -- src/lib/api.test.ts
```

Expected: FAIL until the frontend type definitions match the backend response shape.

- [ ] **Step 3: Finalize the frontend types**

Mirror the backend model in `frontend/src/types/parties.ts`:

```ts
export type PartyTopologyNodeStatus = 'ok' | 'grpc_not_configured' | 'grpc_error';
export interface PartyTopologyParticipantMapping { ... }
export interface PartyTopologyKeyMapping { ... }
export interface PartyTopologyNodeEntry { ... }
```

Do not change `fetchPartyDetail(...)` in `frontend/src/lib/api.ts` unless TypeScript requires it; it should continue to deserialize the same endpoint with the richer response type.

- [ ] **Step 4: Re-run the targeted frontend API test**

Run:

```bash
rtk npm run test --workspace frontend -- src/lib/api.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the frontend type contract**

Run:

```bash
rtk git add frontend/src/types/parties.ts frontend/src/lib/api.test.ts
rtk git commit -m "feat: extend frontend party detail topology types"
```

### Task 4: Render the `Party Topology` section on the party page

**Files:**
- Modify: `frontend/src/views/PartyDetailView.vue`
- Modify: `frontend/src/views/PartyDetailView.test.ts`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Write failing page tests for the new section**

Extend `frontend/src/views/PartyDetailView.test.ts` to cover:

- `Party Topology` heading is rendered
- one node card per topology entry
- successful `ok` node renders `Party to Participant` and `Party to Key`
- empty successful subsection renders `Not Present`
- `grpc_not_configured` renders a muted unavailable message
- `grpc_error` renders the node-local error text
- each node block shows the `gRPC` source pill

- [ ] **Step 2: Run the targeted party detail view test**

Run:

```bash
rtk npm run test --workspace frontend -- src/views/PartyDetailView.test.ts
```

Expected: FAIL because the page does not yet render topology.

- [ ] **Step 3: Implement the section and styles**

In `frontend/src/views/PartyDetailView.vue`:

- import and reuse `QuerySourcePill`
- insert a new full-width `Party Topology` section between `Observed Nodes` and `Recent Updates`
- render one block per `partyTopologyByNode` entry
- keep `gRPC` pill visible even for error states
- render rows without raw JSON or expanders

In `frontend/src/styles.css`, add only the styles needed to:

- keep the section full width inside the existing party-detail frame
- align the node header and pill cleanly
- present the two subsections as compact operational rows
- keep error / unavailable states visually consistent with existing detail blocks

- [ ] **Step 4: Re-run the targeted party detail view test**

Run:

```bash
rtk npm run test --workspace frontend -- src/views/PartyDetailView.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the party topology UI**

Run:

```bash
rtk git add frontend/src/views/PartyDetailView.vue frontend/src/views/PartyDetailView.test.ts frontend/src/styles.css
rtk git commit -m "feat: render party topology on party detail page"
```

### Task 5: Verify the slice end to end

**Files:**
- No additional code changes required

- [ ] **Step 1: Run the focused backend suite**

Run:

```bash
rtk npm run test --workspace backend -- --runInBand backend/test/grpc/grpc-operations.service.spec.ts backend/test/pqs/pqs-summary.service.spec.ts backend/test/api/nodes.controller.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run the focused frontend suite**

Run:

```bash
rtk npm run test --workspace frontend -- src/lib/api.test.ts src/views/PartyDetailView.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run the backend build**

Run:

```bash
rtk npm run build --workspace backend
```

Expected: PASS.

- [ ] **Step 4: Run the frontend build**

Run:

```bash
rtk npm run build --workspace frontend
```

Expected: PASS.

- [ ] **Step 5: Commit final verification-ready state**

Run:

```bash
rtk git status --short
```

Expected: only intended Party Topology files remain modified before any final integration step.
