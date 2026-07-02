# Node Update Details Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a clickable recent-updates list that opens a dedicated `/nodes/:id/updates/:updateId` details page backed by its own API endpoint.

**Architecture:** Extend the backend PQS service with single-update lookup logic sourced from `participant.lapi_update_meta`, expose it through the node controller, and keep update ID normalization server-side. On the frontend, keep `/nodes/:id/updates` as the lightweight list page, make each data row interactive, and add a separate details view that loads its own data and renders a summary plus prettified raw metadata.

**Tech Stack:** NestJS, TypeScript, Jest, Vue 3, Vue Router, Vitest, Testing Library, Vite

---

### File Structure

**Files and responsibilities:**

- `backend/src/domain/node.types.ts`
  - extend backend response types for single-update detail payloads
- `backend/src/pqs/pqs-summary.service.ts`
  - keep owning PQS queries and gain a dedicated single-update lookup path plus shared update ID normalization helpers
- `backend/src/api/nodes.controller.ts`
  - expose `GET /api/nodes/:id/updates/:updateId`
- `backend/test/pqs/pqs-summary.service.spec.ts`
  - verify single-update lookup, normalization, and not-found behavior at the service layer
- `backend/test/api/nodes.controller.spec.ts`
  - verify controller wiring for the new endpoint
- `frontend/src/types/updates.ts`
  - continue to own updates-list types and add the single-update detail response type
- `frontend/src/lib/api.ts`
  - add the frontend client for node update details
- `frontend/src/lib/api.test.ts`
  - verify the new API helper
- `frontend/src/router.ts`
  - register `/nodes/:id/updates/:updateId`
- `frontend/src/App.test.ts`
  - verify the shared shell stays intact on the new route
- `frontend/src/views/NodeUpdatesView.vue`
  - make list rows navigate to the details route while keeping display-normalized IDs
- `frontend/src/views/NodeUpdatesView.test.ts`
  - verify row interaction and navigation targets
- `frontend/src/views/UpdateDetailView.vue`
  - render loading, error, summary, and raw metadata states for a single update
- `frontend/src/views/UpdateDetailView.test.ts`
  - verify the details view behavior from mocked API data
- `frontend/src/styles.css`
  - add row hover/pointer styling and details-page presentation styles

### Task 1: Define backend single-update contracts and failing service expectations

**Files:**
- Modify: `backend/src/domain/node.types.ts`
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Write the failing service tests**

Add focused Jest coverage that defines the expected single-update response shape:

- `nodeId`
- `label`
- `updateId`
- `recordTime`
- `parties`
- `meta`

Include cases for:

- lookup by the existing canonical list `updateId`
- lookup by a `\x...`-prefixed raw ID variant
- lookup by a shorter display-normalized ID with the `1220` prefix omitted
- `404`/not-found style behavior when the update does not exist

- [ ] **Step 2: Run the service test to verify it fails**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts`

Expected: FAIL because the single-update service method and types do not exist yet.

- [ ] **Step 3: Add minimal backend contract types**

Extend `backend/src/domain/node.types.ts` with explicit types for:

- the canonical single-update response
- the raw `meta` payload shape used by the controller/service boundary

Do not add frontend-specific display fields here.

- [ ] **Step 4: Re-run the service test**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts`

Expected: FAIL on missing implementation rather than missing types.

- [ ] **Step 5: Commit**

```bash
git add backend/src/domain/node.types.ts backend/test/pqs/pqs-summary.service.spec.ts
git commit -m "test: define node update detail contracts"
```

### Task 2: Implement PQS single-update lookup and normalization

**Files:**
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Extend the failing service tests**

Add assertions that the PQS layer:

- reads the target row from `participant.lapi_update_meta`
- preserves canonical `updateId` values with the `1220` prefix intact
- accepts raw `\x...` input and canonical input through the same normalization path
- accepts a shorter display-normalized ID by restoring the omitted `1220` prefix during lookup
- aggregates parties best-effort from participant event tables
- returns `parties: []` when witness lookup fails

- [ ] **Step 2: Run the service test to verify it fails**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts`

Expected: FAIL because the PQS service cannot yet resolve a single update detail response.

- [ ] **Step 3: Write minimal PQS implementation**

In `backend/src/pqs/pqs-summary.service.ts`:

- add a single-update query builder against `participant.lapi_update_meta`
- add or reuse a canonicalization helper that:
  - strips a leading `\x` prefix
  - restores the `1220` prefix when the inbound value matches the shorter display-normalized form
- keep party aggregation best-effort and distinct
- return the full detail response shape with:
  - `nodeId`
  - `label`
  - canonical `updateId`
  - ISO `recordTime`
  - `parties`
  - raw `meta` from the full matched `participant.lapi_update_meta` row
- make the service own update-not-found detection so the controller can surface that failure as `404`

Keep this implementation independent from the polling cache.

- [ ] **Step 4: Run the service test to verify it passes**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/pqs/pqs-summary.service.ts backend/test/pqs/pqs-summary.service.spec.ts
git commit -m "feat: add pqs single update lookup"
```

### Task 3: Expose the node update-details API endpoint

**Files:**
- Modify: `backend/src/api/nodes.controller.ts`
- Modify: `backend/test/api/nodes.controller.spec.ts`

- [ ] **Step 1: Write the failing controller tests**

Add controller coverage for:

- `GET /api/nodes/:id/updates/:updateId` on a known node
- passing the route `updateId` through to the PQS summary service
- returning `404` for an unknown node
- returning `404` for an unknown update ID on a known node

If the controller test already uses a mocked `PqsSummaryService`, extend that mock with the new single-update method rather than replacing the existing recent-updates coverage.

- [ ] **Step 2: Run the controller tests to verify they fail**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/api/nodes.controller.spec.ts`

Expected: FAIL because the controller endpoint does not exist yet.

- [ ] **Step 3: Write minimal controller implementation**

Add `GET /api/nodes/:id/updates/:updateId` to `NodesController` with:

- node existence validation through `NodeConfigService`
- direct delegation to the new PQS summary service method
- unchanged behavior for the existing `/nodes/:id/updates` endpoint

- [ ] **Step 4: Run the backend tests to verify they pass**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/api/nodes.controller.spec.ts test/pqs/pqs-summary.service.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/api/nodes.controller.ts backend/test/api/nodes.controller.spec.ts
git commit -m "feat: expose node update details endpoint"
```

### Task 4: Add frontend route, types, and API client coverage

**Files:**
- Modify: `frontend/src/types/updates.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/api.test.ts`
- Modify: `frontend/src/App.test.ts`

- [ ] **Step 1: Write the failing frontend route and API tests**

Add coverage that defines:

- `fetchNodeUpdateDetail(id, updateId)` calling `/nodes/:id/updates/:updateId`
- a pending route slot expectation that will be satisfied once the details view exists
- the shared app shell expectations that must remain true when the new details route is added

- [ ] **Step 2: Run the tests to verify they fail**

Run: `rtk npm test --workspace frontend -- src/lib/api.test.ts src/App.test.ts`

Expected: FAIL because the client helper, types, and route do not exist yet.

- [ ] **Step 3: Write minimal route/API/type implementation**

Add:

- a `NodeUpdateDetailResponse` type in `frontend/src/types/updates.ts`
- `fetchNodeUpdateDetail(id, updateId)` in `frontend/src/lib/api.ts`
- the App test scaffolding needed to register a details-route stub once Task 6 creates the real view

- [ ] **Step 4: Run the tests to verify they pass**

Run: `rtk npm test --workspace frontend -- src/lib/api.test.ts src/App.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/updates.ts frontend/src/lib/api.ts frontend/src/lib/api.test.ts frontend/src/App.test.ts
git commit -m "feat: add update details api client"
```

### Task 5: Make the updates list interactive

**Files:**
- Modify: `frontend/src/views/NodeUpdatesView.vue`
- Modify: `frontend/src/views/NodeUpdatesView.test.ts`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Write the failing list interaction test**

Extend `frontend/src/views/NodeUpdatesView.test.ts` so it asserts:

- each data row links or navigates to `/nodes/:id/updates/:updateId`
- clicking a rendered data row triggers navigation to that details route
- the header row remains non-interactive
- the canonical route value uses the existing API `updateId`

Keep the current assertions around display-normalized IDs and two-line local-time rendering.

- [ ] **Step 2: Run the view test to verify it fails**

Run: `rtk npm test --workspace frontend -- src/views/NodeUpdatesView.test.ts`

Expected: FAIL because the rows are currently static spans/divs.

- [ ] **Step 3: Write minimal list interaction implementation**

Update `NodeUpdatesView.vue` to:

- wrap each data row in a `RouterLink`-backed interactive container or use row-level navigation with the router
- preserve the current visible text layout
- keep the back arrow behavior unchanged

Update `frontend/src/styles.css` to:

- add a hover background change for data rows
- add `cursor: pointer`
- avoid applying interactive styling to the header row

- [ ] **Step 4: Run the view test to verify it passes**

Run: `rtk npm test --workspace frontend -- src/views/NodeUpdatesView.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/NodeUpdatesView.vue frontend/src/views/NodeUpdatesView.test.ts frontend/src/styles.css
git commit -m "feat: make node updates rows drill down"
```

### Task 6: Build the update details page

**Files:**
- Create: `frontend/src/views/UpdateDetailView.vue`
- Create: `frontend/src/views/UpdateDetailView.test.ts`
- Modify: `frontend/src/router.ts`
- Modify: `frontend/src/App.test.ts`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Write the failing details view tests**

Create `frontend/src/views/UpdateDetailView.test.ts` with coverage for:

- loading state before the API resolves
- successful rendering of:
  - node label
  - display-normalized update ID
  - record time in browser-local date/time lines or equivalent detail presentation
  - parties
  - prettified raw `meta` JSON
- page-level error message on failed fetch
- back arrow link targeting `/nodes/:id/updates`

- [ ] **Step 2: Run the details view tests to verify they fail**

Run: `rtk npm test --workspace frontend -- src/views/UpdateDetailView.test.ts`

Expected: FAIL because the view does not exist yet.

- [ ] **Step 3: Write minimal details view implementation**

Create `UpdateDetailView.vue` that:

- reads `id` and `updateId` from route props
- calls `fetchNodeUpdateDetail`
- is registered in `frontend/src/router.ts` at `/nodes/:id/updates/:updateId`
- reuses the existing page frame and back-arrow rail
- shows summary fields first
- renders `meta` in a prettified raw JSON block by default
- uses the same display-normalization rule as the updates list for human-readable IDs

Update `frontend/src/App.test.ts` in the same task so the new route is covered by an actual route entry once the view exists.

- [ ] **Step 4: Run the focused and broad frontend checks**

Run: `rtk npm test --workspace frontend -- src/views/UpdateDetailView.test.ts src/views/NodeUpdatesView.test.ts src/App.test.ts src/lib/api.test.ts`

Expected: PASS

Run: `rtk npm run build --workspace frontend`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/UpdateDetailView.vue frontend/src/views/UpdateDetailView.test.ts frontend/src/router.ts frontend/src/App.test.ts frontend/src/styles.css
git commit -m "feat: add update details page"
```

### Task 7: Final integrated verification

**Files:**
- Modify: no new product files expected
- Verify: `backend/test/api/nodes.controller.spec.ts`
- Verify: `backend/test/pqs/pqs-summary.service.spec.ts`
- Verify: `frontend/src/lib/api.test.ts`
- Verify: `frontend/src/App.test.ts`
- Verify: `frontend/src/views/NodeUpdatesView.test.ts`
- Verify: `frontend/src/views/UpdateDetailView.test.ts`

- [ ] **Step 1: Run backend verification**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts test/api/nodes.controller.spec.ts`

Expected: PASS

- [ ] **Step 2: Run frontend verification**

Run: `rtk npm test --workspace frontend -- src/lib/api.test.ts src/App.test.ts src/views/NodeUpdatesView.test.ts src/views/UpdateDetailView.test.ts`

Expected: PASS

- [ ] **Step 3: Run production build verification**

Run: `rtk npm run build --workspace frontend`

Expected: PASS

- [ ] **Step 4: Review diff for accidental scope creep**

Check that the final diff is limited to:

- single-update backend contracts and endpoint
- frontend update-details route and view
- updates-list interaction styling and navigation

- [ ] **Step 5: Commit only if verification required follow-up code changes**

```bash
git add backend/src/api/nodes.controller.ts backend/src/domain/node.types.ts backend/src/pqs/pqs-summary.service.ts backend/test/api/nodes.controller.spec.ts backend/test/pqs/pqs-summary.service.spec.ts frontend/src/types/updates.ts frontend/src/lib/api.ts frontend/src/lib/api.test.ts frontend/src/router.ts frontend/src/App.test.ts frontend/src/views/NodeUpdatesView.vue frontend/src/views/NodeUpdatesView.test.ts frontend/src/views/UpdateDetailView.vue frontend/src/views/UpdateDetailView.test.ts frontend/src/styles.css
git commit -m "chore: finalize update details flow"
```

If verification is already green and no follow-up code changes were needed, skip this commit step.
