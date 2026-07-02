# Update Detail Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing update-details endpoint and page so a user can inspect normalized event rows plus raw source payloads for a single update.

**Architecture:** Keep `participant.lapi_update_meta` as the update header source and add a second PQS query that unions create and exercise tables into a normalized `events` array with per-branch `raw` JSON payloads. On the frontend, extend the existing detail response type and render an `Events` section beneath the current summary and metadata blocks, including a clear empty state when no event rows exist.

**Tech Stack:** NestJS, TypeScript, Jest, Vue 3, Vitest, Testing Library, Vite

---

### File Structure

**Files and responsibilities:**

- `backend/src/domain/node.types.ts`
  - extend backend response contracts for normalized update-detail events
- `backend/src/pqs/pqs-summary.service.ts`
  - keep owning PQS access and gain the unioned event-row lookup plus normalization logic
- `backend/src/api/nodes.controller.ts`
  - continue delegating the existing update-details endpoint without changing the route shape
- `backend/test/pqs/pqs-summary.service.spec.ts`
  - verify mixed event-row normalization, deterministic ordering, empty states, and null-field fallback
- `backend/test/api/nodes.controller.spec.ts`
  - verify the controller response includes the new `events` payload from the existing endpoint
- `frontend/src/types/updates.ts`
  - extend the update-details frontend type with normalized event entries
- `frontend/src/lib/api.test.ts`
  - verify the existing detail API helper accepts the extended payload shape
- `frontend/src/views/UpdateDetailView.vue`
  - render the new events section while preserving the existing summary and raw metadata blocks
- `frontend/src/views/UpdateDetailView.test.ts`
  - verify normalized event rendering, raw event payload rendering, and the empty state
- `frontend/src/styles.css`
  - add event-list and raw-event payload presentation styles without disrupting the existing detail layout

### Task 1: Define event contracts and failing backend expectations

**Files:**
- Modify: `backend/src/domain/node.types.ts`
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Write the failing service tests**

Extend `backend/test/pqs/pqs-summary.service.spec.ts` with single-update detail expectations that define:

- `events: []` on the response by default
- one mixed event payload containing at least:
  - one `create` row
  - one `consuming_exercise` or `non_consuming_exercise` row
- normalized event fields:
  - `eventKind`
  - `eventId`
  - `contractId`
  - `templateId`
  - `choice`
  - `witnesses`
  - `raw`
- a fallback case where one normalized field becomes `null` while the original row is still preserved in `raw`

- [ ] **Step 2: Run the service test to verify it fails**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts`

Expected: FAIL because the update-detail response does not yet include normalized event rows.

- [ ] **Step 3: Add minimal backend event contract types**

Extend `backend/src/domain/node.types.ts` with explicit types for:

- one normalized update-detail event row
- the `events` array on `NodeUpdateDetailResponse`

Keep the contract intentionally small and aligned to the approved spec.

- [ ] **Step 4: Re-run the service test**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts`

Expected: FAIL on missing implementation rather than missing types.

- [ ] **Step 5: Commit**

```bash
git add backend/src/domain/node.types.ts backend/test/pqs/pqs-summary.service.spec.ts
git commit -m "test: define update detail event contracts"
```

### Task 2: Implement unioned event lookup in the PQS service

**Files:**
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Extend the failing service tests**

Add assertions that the PQS layer:

- reuses the existing canonical, raw `\x...`, and display-shortened update-ID lookup behavior
- reads the update header from `participant.lapi_update_meta`
- reads event rows from a `union all` over:
  - `participant.lapi_events_create`
  - `participant.lapi_events_consuming_exercise`
  - `participant.lapi_events_non_consuming_exercise`
- queries event rows using the matched raw update ID returned by the header lookup
- preserves per-branch `raw` JSON payloads from the full original source-table row
- orders normalized events deterministically by:
  - `eventId`
  - `eventKind`
  - `contractId`
  - `templateId`
- returns `events: []` when no event rows are found

- [ ] **Step 2: Run the service test to verify it fails**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts`

Expected: FAIL because `fetchUpdateDetail()` does not yet query or normalize event rows.

- [ ] **Step 3: Write minimal PQS implementation**

In `backend/src/pqs/pqs-summary.service.ts`:

- add a unioned event query builder with one branch per participant event table
- keep the existing update-ID normalization flow for header lookup unchanged
- use the matched raw update ID from the resolved header row as the input to the event-row query
- select the normalized shared fields in each branch
- serialize the full original source-table row to `raw` before unioning
- normalize witnesses to arrays
- set any non-derivable normalized field to `null` while preserving `raw`
- extend `fetchUpdateDetail()` to return the full detail response with `events`

Do not refactor the existing update-list endpoint beyond what this detail response requires.

- [ ] **Step 4: Run the service test to verify it passes**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/pqs/pqs-summary.service.ts backend/test/pqs/pqs-summary.service.spec.ts
git commit -m "feat: load update detail events from pqs"
```

### Task 3: Expand controller-level response coverage

**Files:**
- Modify: `backend/test/api/nodes.controller.spec.ts`
- Modify: `backend/src/api/nodes.controller.ts` only if the tests reveal shape translation work is needed

- [ ] **Step 1: Extend controller response coverage**

Extend the existing update-detail controller test so the mocked `fetchUpdateDetail()` response includes:

- one normalized event row
- one `raw` event payload object

Assert that the controller returns `events` unchanged on the existing `GET /api/nodes/:id/updates/:updateId` flow.

- [ ] **Step 2: Run the controller tests to verify coverage**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/api/nodes.controller.spec.ts`

Expected: PASS if the controller already delegates the full payload transparently, or FAIL only if the test scaffolding or controller assumptions still reflect the old response shape.

- [ ] **Step 3: Write the minimal controller-side change**

Keep the existing endpoint and error behavior unchanged.

If needed, update only the mocked response handling or any strict response assumptions so the existing endpoint continues to delegate the full detail payload transparently.

- [ ] **Step 4: Run the backend tests to verify they pass**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/api/nodes.controller.spec.ts test/pqs/pqs-summary.service.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/test/api/nodes.controller.spec.ts backend/src/api/nodes.controller.ts
git commit -m "test: cover update detail events response"
```

If `backend/src/api/nodes.controller.ts` does not need code changes, omit it from the commit.

### Task 4: Extend frontend detail contracts and API coverage

**Files:**
- Modify: `frontend/src/types/updates.ts`
- Modify: `frontend/src/lib/api.test.ts`
- Modify: `frontend/src/views/UpdateDetailView.test.ts`

- [ ] **Step 1: Write the frontend response-shape checks**

Extend `frontend/src/lib/api.test.ts` so the existing `fetchNodeUpdateDetail()` test expects:

- an `events` array
- normalized event fields on the first event
- a raw event payload object under `raw`

- Extend `frontend/src/views/UpdateDetailView.test.ts` with typed mocked detail data that reads `events` so the new field is exercised by typed consumer code.

- [ ] **Step 2: Run the frontend type and runtime checks to verify the gap**

Run: `rtk npm test --workspace frontend -- src/lib/api.test.ts src/views/UpdateDetailView.test.ts`

Expected: FAIL because the updated runtime expectations include `events` before the type and fixture coverage is in place.

- [ ] **Step 3: Write minimal frontend type coverage**

Extend `frontend/src/types/updates.ts` with:

- one `NodeUpdateDetailEvent` type
- an `events` field on `NodeUpdateDetailResponse`

No new API helper is needed; the existing fetch path stays the same.

- [ ] **Step 4: Run the frontend type and runtime checks to verify they pass**

Run: `rtk npm run build --workspace frontend`

Expected: PASS. This is the post-type-update verification gate, not the primary red-step trigger.

Run: `rtk npm test --workspace frontend -- src/lib/api.test.ts src/views/UpdateDetailView.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/updates.ts frontend/src/lib/api.test.ts frontend/src/views/UpdateDetailView.test.ts
git commit -m "feat: extend update detail response types"
```

### Task 5: Render event rows on the update details page

**Files:**
- Modify: `frontend/src/views/UpdateDetailView.vue`
- Modify: `frontend/src/views/UpdateDetailView.test.ts`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Write the failing details view tests**

Extend `frontend/src/views/UpdateDetailView.test.ts` to assert:

- an `Events` section renders below the summary
- normalized event fields are visible for at least one event
- raw event payload text is visible for each event
- the page shows `No event rows found for this update.` when `events` is empty
- the existing summary, metadata, and back-arrow behavior still work

- [ ] **Step 2: Run the details view test to verify it fails**

Run: `rtk npm test --workspace frontend -- src/views/UpdateDetailView.test.ts`

Expected: FAIL because the page does not yet render `events`.

- [ ] **Step 3: Write minimal details page implementation**

Update `frontend/src/views/UpdateDetailView.vue` to:

- render an `Events` section under the summary
- show normalized event fields first
- render each event’s `raw` payload in a preformatted block
- show the explicit empty state when `events.length === 0`

Update `frontend/src/styles.css` only as needed to keep the new section legible and consistent with the current explorer-style detail layout.

- [ ] **Step 4: Run the focused frontend checks**

Run: `rtk npm test --workspace frontend -- src/views/UpdateDetailView.test.ts src/lib/api.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/UpdateDetailView.vue frontend/src/views/UpdateDetailView.test.ts frontend/src/styles.css
git commit -m "feat: render update detail event rows"
```

### Task 6: Final integrated verification

**Files:**
- Verify only; no new product files expected unless follow-up fixes are required

- [ ] **Step 1: Run backend verification**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts test/api/nodes.controller.spec.ts`

Expected: PASS

- [ ] **Step 2: Run frontend verification**

Run: `rtk npm test --workspace frontend -- src/lib/api.test.ts src/App.test.ts src/views/NodeUpdatesView.test.ts src/views/UpdateDetailView.test.ts`

Expected: PASS

- [ ] **Step 3: Run production build verification**

Run: `rtk npm run build --workspace frontend`

Expected: PASS

- [ ] **Step 4: Review the diff for scope**

Confirm the changes are limited to:

- update-detail backend event lookup
- existing endpoint response extension
- update-detail frontend rendering and type coverage

- [ ] **Step 5: Commit only if verification required follow-up code changes**

```bash
git add backend/src/domain/node.types.ts backend/src/pqs/pqs-summary.service.ts backend/src/api/nodes.controller.ts backend/test/pqs/pqs-summary.service.spec.ts backend/test/api/nodes.controller.spec.ts frontend/src/types/updates.ts frontend/src/lib/api.test.ts frontend/src/views/UpdateDetailView.vue frontend/src/views/UpdateDetailView.test.ts frontend/src/styles.css
git commit -m "chore: finalize update detail events flow"
```

If verification is already green and no follow-up code changes were needed, skip this commit step.
