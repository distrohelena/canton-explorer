# Node Activity Updates Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/nodes/:id/updates` route that lists the latest 25 PQS-backed updates for a node when the user clicks that node’s activity panel on the home page.

**Architecture:** Extend the backend PQS layer with a dedicated recent-updates query and expose it through a new node-scoped API endpoint. On the frontend, make each home activity panel navigate to the updates route, add a focused updates-list view, and keep the existing `/nodes/:id` detail page unchanged.

**Tech Stack:** NestJS, TypeScript, Vue 3, Vue Router, Vitest, Testing Library, Jest, Vite

---

### File Structure

**Files and responsibilities:**

- `backend/src/domain/node.types.ts`
  - define the API types for recent updates responses
- `backend/src/pqs/pqs-summary.service.ts`
  - continue to own PQS access and gain a new recent-updates query path
- `backend/src/api/nodes.controller.ts`
  - expose `GET /api/nodes/:id/updates`
- `backend/test/pqs/pqs-summary.service.spec.ts`
  - verify PQS update query normalization and limit behavior
- `backend/test/api/nodes.controller.spec.ts`
  - verify controller payload for the new updates endpoint
- `frontend/src/types/activity.ts` or a new focused updates type file
  - define recent-updates frontend response types
- `frontend/src/lib/api.ts`
  - add the API client for node updates
- `frontend/src/router.ts`
  - register `/nodes/:id/updates`
- `frontend/src/views/HomeActivityView.vue`
  - make activity panels navigate to the updates route
- `frontend/src/views/NodeUpdatesView.vue`
  - render the minimal explorer-style updates list
- `frontend/src/views/NodeDetailView.vue`
  - remain unchanged functionally; only verify route isolation
- `frontend/src/styles.css`
  - add updates-list layout and clickable activity-card styling
- `frontend/src/views/HomeActivityView.test.ts`
  - verify activity cards link to the updates route
- `frontend/src/views/NodeUpdatesView.test.ts`
  - verify the updates page renders minimal rows from mocked API data
- `frontend/src/App.test.ts` or route-specific tests
  - verify `/nodes/:id` still routes to node detail and `/nodes/:id/updates` routes to the new page

### Task 1: Define backend recent-updates contracts

**Files:**
- Modify: `backend/src/domain/node.types.ts`
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Write the failing backend type/normalization test**

Add a focused PQS test that defines the expected normalized payload:

- `nodeId`
- `label`
- `limit`
- `updates: [{ updateId, recordTime, parties }]`

The test should include:

- one row with parties
- one row with no parties
- newest-first ordering

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts`

Expected: FAIL because the recent-updates query API and types do not exist yet.

- [ ] **Step 3: Write minimal backend contract types**

Add explicit backend types for:

- one update row
- one node updates response

- [ ] **Step 4: Re-run the test**

Run: `npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts`

Expected: FAIL on missing implementation rather than missing types.

- [ ] **Step 5: Commit**

```bash
git add backend/src/domain/node.types.ts backend/test/pqs/pqs-summary.service.spec.ts
git commit -m "test: define node updates response contracts"
```

### Task 2: Add the PQS recent-updates query

**Files:**
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Extend the failing PQS test**

Add cases that assert:

- default limit is `25`
- the service queries `participant.lapi_update_meta`
- parties are returned as `[]` when unavailable

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts`

Expected: FAIL because the service does not yet fetch recent updates.

- [ ] **Step 3: Write minimal PQS implementation**

Implement a new service method in `PqsSummaryService` that:

- accepts `(node, limit = 25)`
- reads the latest update metadata from `participant.lapi_update_meta`
- gathers parties on a best-effort basis from participant event tables
- normalizes rows into `{ updateId, recordTime, parties }`
- does not fail the whole response when parties are missing

Keep this separate from the cached polling path; it should execute live on request.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/pqs/pqs-summary.service.ts backend/test/pqs/pqs-summary.service.spec.ts
git commit -m "feat: query recent node updates from pqs"
```

### Task 3: Expose the node updates API endpoint

**Files:**
- Modify: `backend/src/api/nodes.controller.ts`
- Modify: `backend/test/api/nodes.controller.spec.ts`

- [ ] **Step 1: Write the failing controller test**

Add a controller-level test that asserts:

- `listNodeUpdates(id)` or the HTTP-shaped controller method exists
- known nodes return `{ nodeId, label, limit, updates }`
- unknown nodes return `404`

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace backend -- --runTestsByPath test/api/nodes.controller.spec.ts`

Expected: FAIL because the controller endpoint is not present yet.

- [ ] **Step 3: Write minimal controller implementation**

Add `GET /api/nodes/:id/updates` with:

- node existence validation
- optional `limit` query parsing
- call to the PQS recent-updates service

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --workspace backend -- --runTestsByPath test/api/nodes.controller.spec.ts test/pqs/pqs-summary.service.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/api/nodes.controller.ts backend/test/api/nodes.controller.spec.ts
git commit -m "feat: expose node updates endpoint"
```

### Task 4: Add frontend route and API client coverage

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify or Create: `frontend/src/types/activity.ts` or a new updates type file
- Modify: `frontend/src/router.ts`
- Modify: `frontend/src/App.test.ts` or route coverage tests

- [ ] **Step 1: Write the failing frontend route/API tests**

Add tests that define:

- a client helper for node updates
- `/nodes/:id/updates` resolves to the new updates view
- `/nodes/:id` still resolves to the existing node detail view

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace frontend -- src/lib/api.test.ts src/App.test.ts`

Expected: FAIL because the route and API client do not exist yet.

- [ ] **Step 3: Write minimal route/API/type implementation**

Add:

- frontend updates response types
- `fetchNodeUpdates(id, limit?)`
- router entry for `/nodes/:id/updates`

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --workspace frontend -- src/lib/api.test.ts src/App.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/router.ts frontend/src/types frontend/src/App.test.ts frontend/src/lib/api.test.ts
git commit -m "feat: add node updates route and api client"
```

### Task 5: Make home activity cards navigate to the updates page

**Files:**
- Modify: `frontend/src/views/HomeActivityView.test.ts`
- Modify: `frontend/src/views/HomeActivityView.vue`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Write the failing home-view test**

Update the home view test so it asserts each activity panel links to `/nodes/<id>/updates`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace frontend -- src/views/HomeActivityView.test.ts`

Expected: FAIL because the activity panels are not currently clickable links.

- [ ] **Step 3: Write minimal home-view implementation**

Wrap or replace the activity panel root with a router link so the whole panel acts like an explorer-style click target without changing the displayed summary content.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --workspace frontend -- src/views/HomeActivityView.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/HomeActivityView.vue frontend/src/views/HomeActivityView.test.ts frontend/src/styles.css
git commit -m "feat: link activity panels to node updates"
```

### Task 6: Build the node updates page

**Files:**
- Create: `frontend/src/views/NodeUpdatesView.vue`
- Create: `frontend/src/views/NodeUpdatesView.test.ts`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Write the failing updates-page test**

Add a focused test that asserts the new view:

- loads updates for the route node id
- shows a heading for the node
- renders rows with `Update ID`, `record time`, and `parties`
- includes a back link to `/`

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace frontend -- src/views/NodeUpdatesView.test.ts`

Expected: FAIL because the view does not exist yet.

- [ ] **Step 3: Write minimal updates-page implementation**

Create the page with:

- route-prop node id
- fetch on mount
- loading/error states matching existing patterns
- compact explorer-style list/table
- `Update ID` visually ready for future drilldown, without adding the detail route yet

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --workspace frontend -- src/views/NodeUpdatesView.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/NodeUpdatesView.vue frontend/src/views/NodeUpdatesView.test.ts frontend/src/styles.css
git commit -m "feat: add node updates list page"
```

### Task 7: Run final verification

**Files:**
- Verify only

- [ ] **Step 1: Run focused backend tests**

Run: `npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts test/api/nodes.controller.spec.ts`

Expected: PASS

- [ ] **Step 2: Run focused frontend tests**

Run: `npm test --workspace frontend -- src/App.test.ts src/lib/api.test.ts src/views/HomeActivityView.test.ts src/views/NodeUpdatesView.test.ts`

Expected: PASS

- [ ] **Step 3: Run the frontend production build**

Run: `npm run build --workspace frontend`

Expected: PASS
