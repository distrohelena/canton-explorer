# Event Offset Primary Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `event_offset` the primary identifier in the recent activity list, update-detail route, and update-detail page while keeping canonical `update_id` as secondary detail.

**Architecture:** Extend the backend update contracts so recent updates and update detail both expose `eventOffset`, and switch detail lookup from `update_id` to `participant.lapi_update_meta.event_offset`. On the frontend, route rows by offset, render offset as the primary identifier, and keep canonical update id in the detail summary and metadata.

**Tech Stack:** NestJS, TypeScript, PostgreSQL/PQS queries, Vue 3, Vue Router, Vitest, Jest

---

## File Map

- Modify: `backend/src/domain/node.types.ts`
  - Add `eventOffset` to recent-update and update-detail response types.
- Modify: `backend/src/pqs/pqs-summary.service.ts`
  - Select `event_offset` in recent/detail queries and resolve detail rows by offset.
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`
  - Add failing tests for offset-first contracts and offset-based detail lookup.
- Modify: `backend/test/api/nodes.controller.spec.ts`
  - Update controller expectations for offset-based route payloads.
- Modify: `frontend/src/types/updates.ts`
  - Extend recent/detail response types with `eventOffset`.
- Modify: `frontend/src/lib/api.test.ts`
  - Update API contract tests for offset-first payloads.
- Modify: `frontend/src/views/NodeUpdatesView.vue`
  - Display `Event Offset` and link rows with offset.
- Modify: `frontend/src/views/NodeUpdatesView.test.ts`
  - Update list view expectations to match the new primary identifier.
- Modify: `frontend/src/views/UpdateDetailView.vue`
  - Fetch and render update detail by offset, with offset as the primary summary field.
- Modify: `frontend/src/views/UpdateDetailView.test.ts`
  - Update detail page expectations for the new summary and route identity.

### Task 1: Define Backend Offset Contracts

**Files:**
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`
- Modify: `backend/src/domain/node.types.ts`

- [ ] **Step 1: Write the failing backend contract test**

Add or update spec assertions so:
- recent update rows must include `eventOffset`
- update detail responses must include `eventOffset`
- `fetchUpdateDetail()` is called with an offset route key and still returns canonical `updateId`

- [ ] **Step 2: Run the backend PQS spec to verify it fails**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts`
Expected: FAIL because `eventOffset` is missing or detail lookup still assumes `update_id`

- [ ] **Step 3: Add the minimal response type changes**

Update `backend/src/domain/node.types.ts` so:
- `NodeRecentUpdate` includes `eventOffset: string`
- `NodeUpdateDetailResponse` includes `eventOffset: string`

- [ ] **Step 4: Re-run the backend PQS spec**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts`
Expected: still FAIL, now only on service behavior

- [ ] **Step 5: Commit**

```bash
git add backend/src/domain/node.types.ts backend/test/pqs/pqs-summary.service.spec.ts
git commit -m "test: define event offset update contracts"
```

### Task 2: Switch Backend Lookup and Recent Update Payloads to Offsets

**Files:**
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Test: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Implement recent update `event_offset` selection**

Update the recent-updates query to select `event_offset::text as event_offset` and map it into each returned update row.

- [ ] **Step 2: Implement detail lookup by `event_offset`**

Replace the current single-update lookup-by-id query with a lookup on `participant.lapi_update_meta.event_offset`.

- [ ] **Step 3: Keep downstream event/party loading keyed by matched raw update id**

After the detail row is found by offset, continue using the matched raw `update_id` for party and event queries.

- [ ] **Step 4: Re-run the focused backend PQS spec**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/pqs/pqs-summary.service.ts backend/test/pqs/pqs-summary.service.spec.ts
git commit -m "feat: resolve node updates by event offset"
```

### Task 3: Update Controller/API Expectations

**Files:**
- Modify: `backend/test/api/nodes.controller.spec.ts`
- Modify: `frontend/src/types/updates.ts`
- Modify: `frontend/src/lib/api.test.ts`

- [ ] **Step 1: Write/update failing controller and API contract tests**

Ensure the mocked backend/frontend payloads include `eventOffset` and the detail response keeps `updateId` as a secondary field.

- [ ] **Step 2: Run the touched backend/frontend contract tests**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/api/nodes.controller.spec.ts`

Run: `rtk npm test --workspace frontend -- src/lib/api.test.ts`

Expected: FAIL until shared payload assumptions are updated consistently

- [ ] **Step 3: Apply the minimal type and expectation updates**

Update:
- backend controller expectations for offset-based payloads
- frontend shared response types
- frontend API tests

- [ ] **Step 4: Re-run the touched contract tests**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/api/nodes.controller.spec.ts`

Run: `rtk npm test --workspace frontend -- src/lib/api.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/test/api/nodes.controller.spec.ts frontend/src/types/updates.ts frontend/src/lib/api.test.ts
git commit -m "test: align update api contracts with event offsets"
```

### Task 4: Move the Recent Activity UI to Offset-First Routing

**Files:**
- Modify: `frontend/src/views/NodeUpdatesView.vue`
- Modify: `frontend/src/views/NodeUpdatesView.test.ts`

- [ ] **Step 1: Write/update the failing list view test**

Adjust expectations so the list:
- labels the first column `Event Offset`
- displays offsets instead of update ids
- links rows to `/nodes/:id/updates/:eventOffset`

- [ ] **Step 2: Run the list view test to verify it fails**

Run: `rtk npm test --workspace frontend -- src/views/NodeUpdatesView.test.ts`
Expected: FAIL because the view still displays and links by update id

- [ ] **Step 3: Implement the minimal list view change**

Update `NodeUpdatesView.vue` so:
- `displayUpdateId` becomes offset-oriented rendering
- row links use `eventOffset`
- first column heading reads `Event Offset`

- [ ] **Step 4: Re-run the list view test**

Run: `rtk npm test --workspace frontend -- src/views/NodeUpdatesView.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/NodeUpdatesView.vue frontend/src/views/NodeUpdatesView.test.ts
git commit -m "feat: route recent node updates by event offset"
```

### Task 5: Move the Detail Page to Offset-First Identity

**Files:**
- Modify: `frontend/src/views/UpdateDetailView.vue`
- Modify: `frontend/src/views/UpdateDetailView.test.ts`

- [ ] **Step 1: Write/update the failing detail view test**

Adjust expectations so the detail view:
- reads the route prop as `eventOffset`
- shows `Event Offset` as the primary summary field
- keeps `Canonical Update ID` as a secondary summary field
- keeps the back link and event rendering intact

- [ ] **Step 2: Run the detail view test to verify it fails**

Run: `rtk npm test --workspace frontend -- src/views/UpdateDetailView.test.ts`
Expected: FAIL because the view still centers on update id

- [ ] **Step 3: Implement the minimal detail view change**

Update `UpdateDetailView.vue` so:
- the prop and request flow use offset semantics
- the summary grid leads with `eventOffset`
- canonical `updateId` remains visible

- [ ] **Step 4: Re-run the detail view test**

Run: `rtk npm test --workspace frontend -- src/views/UpdateDetailView.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/UpdateDetailView.vue frontend/src/views/UpdateDetailView.test.ts
git commit -m "feat: make update detail offset-first"
```

### Task 6: Final Verification

**Files:**
- Verify: `backend/src/domain/node.types.ts`
- Verify: `backend/src/pqs/pqs-summary.service.ts`
- Verify: `backend/test/pqs/pqs-summary.service.spec.ts`
- Verify: `backend/test/api/nodes.controller.spec.ts`
- Verify: `frontend/src/types/updates.ts`
- Verify: `frontend/src/lib/api.test.ts`
- Verify: `frontend/src/views/NodeUpdatesView.vue`
- Verify: `frontend/src/views/NodeUpdatesView.test.ts`
- Verify: `frontend/src/views/UpdateDetailView.vue`
- Verify: `frontend/src/views/UpdateDetailView.test.ts`

- [ ] **Step 1: Run the touched backend tests**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts test/api/nodes.controller.spec.ts`
Expected: PASS

- [ ] **Step 2: Run the touched frontend tests**

Run: `rtk npm test --workspace frontend -- src/lib/api.test.ts src/views/NodeUpdatesView.test.ts src/views/UpdateDetailView.test.ts`
Expected: PASS

- [ ] **Step 3: Run the frontend build**

Run: `rtk npm run build --workspace frontend`
Expected: PASS

- [ ] **Step 4: Run the backend build**

Run: `rtk npm run build --workspace backend`
Expected: PASS

- [ ] **Step 5: Inspect final git state**

Run: `rtk git status --short`
Expected: only intended files changed, plus any known unrelated existing worktree changes
