# Activity Home And Nodes Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the explorer so `/` shows cached per-node activity history, `/nodes` shows connected nodes, and `/nodes/:id` remains the detail page.

**Architecture:** Extend the existing backend polling/cache path with a lightweight rolling activity-history store and expose it through a new API endpoint. On the frontend, add a dedicated home activity view, move the current connected-node overview to a new `/nodes` route, and update navigation and tests around the new route split.

**Tech Stack:** NestJS, TypeScript, Vue 3, Vue Router, Vitest, Testing Library, Vite

---

### File Structure

**Files and responsibilities:**

- `backend/src/cache/node-cache.service.ts`
  - continue to hold latest node snapshots; may also hold or coordinate the rolling history store
- `backend/src/domain/node.types.ts`
  - define the activity-history sample and API response types
- `backend/src/orchestrator/node-poller.service.ts`
  - append one activity sample per node on successful refresh
- `backend/src/api/nodes.controller.ts`
  - expose the new activity-history endpoint
- `backend/test/...`
  - add focused tests for history accumulation and endpoint shape
- `frontend/src/router.ts`
  - add `/nodes` route and point `/` at the new activity view
- `frontend/src/lib/api.ts`
  - add frontend API call for activity history
- `frontend/src/types/...`
  - add types for activity-history responses
- `frontend/src/views/HomeActivityView.vue`
  - render the home activity overview graph
- `frontend/src/views/NodesView.vue`
  - render the connected-nodes page using the current overview card pattern
- `frontend/src/views/OperationsDashboardView.vue`
  - either be replaced by `NodesView` or repurposed explicitly for `/nodes`
- `frontend/src/App.vue`
  - update nav to include both `Home` and `Nodes`
- `frontend/src/styles.css`
  - add layout and graph styling for the new home page and nodes page
- `frontend/src/**/*.test.ts`
  - update route and view coverage

### Task 1: Define backend history types and tests

**Files:**
- Modify: `backend/src/domain/node.types.ts`
- Create or Modify: focused backend test files for history storage and endpoint shape

- [ ] **Step 1: Write the failing backend tests**

Add tests that define:

- a history sample shape with timestamp, node id, and activity value
- rolling accumulation behavior
- grouped API response shape by node id

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --workspace backend -- --runTestsByPath <history-test-paths>`

Expected: FAIL because the history types and store behavior do not exist yet.

- [ ] **Step 3: Write minimal type definitions**

Add explicit backend types for:

- one activity sample
- one node series
- the full activity-history response payload

- [ ] **Step 4: Run tests to verify the failures move to missing implementation**

Run: `npm test --workspace backend -- --runTestsByPath <history-test-paths>`

Expected: FAIL on missing storage/endpoint implementation rather than type errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/domain/node.types.ts backend/test
git commit -m "test: define activity history backend contracts"
```

### Task 2: Add backend rolling history storage and sampling

**Files:**
- Modify: `backend/src/cache/node-cache.service.ts`
- Modify: `backend/src/orchestrator/node-poller.service.ts`

- [ ] **Step 1: Use the failing history tests as the regression**

Keep the backend tests active while implementing rolling history.

- [ ] **Step 2: Run tests to verify they still fail**

Run: `npm test --workspace backend -- --runTestsByPath <history-test-paths>`

Expected: FAIL because no rolling history is stored yet.

- [ ] **Step 3: Write minimal backend implementation**

Implement:

- in-memory rolling activity history storage
- append one sample per node on successful PQS refresh
- a simple v1 activity metric derived from sampled PQS-backed values
- bounded history retention for a recent window only

Prefer a cheap and explicit metric such as change in active-contract count between samples.

- [ ] **Step 4: Run tests to verify storage behavior passes**

Run: `npm test --workspace backend -- --runTestsByPath <history-test-paths>`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/cache/node-cache.service.ts backend/src/orchestrator/node-poller.service.ts backend/test
git commit -m "feat: cache rolling node activity history"
```

### Task 3: Add the backend activity-history API endpoint

**Files:**
- Modify: `backend/src/api/nodes.controller.ts`
- Modify: backend API or controller tests

- [ ] **Step 1: Write the failing endpoint test**

Add or extend controller/API tests to assert:

- the new endpoint exists
- it returns grouped series by node id
- the payload uses the defined history response shape

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --workspace backend -- --runTestsByPath <api-history-test-paths>`

Expected: FAIL because the endpoint is not present yet.

- [ ] **Step 3: Write minimal controller implementation**

Add the endpoint to return the cached rolling activity history.

- [ ] **Step 4: Run tests to verify the endpoint passes**

Run: `npm test --workspace backend -- --runTestsByPath <api-history-test-paths> <history-test-paths>`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/api/nodes.controller.ts backend/test
git commit -m "feat: expose activity history endpoint"
```

### Task 4: Add frontend types, API client, and route tests

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify or Create: `frontend/src/types/*`
- Modify: `frontend/src/router.ts`
- Modify or Create: focused frontend route/view tests

- [ ] **Step 1: Write the failing frontend tests**

Add tests that define:

- `/` renders the new home activity view
- `/nodes` renders the connected-nodes view
- app nav includes both `Home` and `Nodes`
- activity-history API data can be fetched through the frontend client

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --workspace frontend -- <route-and-api-test-paths>`

Expected: FAIL because the new route, nav, and API client calls do not exist yet.

- [ ] **Step 3: Write minimal route/API/type implementation**

Add:

- frontend types for the history payload
- API helper for the history endpoint
- router entry for `/nodes`
- route wiring that points `/` at the future activity view

- [ ] **Step 4: Run tests to verify routing/API expectations pass**

Run: `npm test --workspace frontend -- <route-and-api-test-paths>`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/router.ts frontend/src/types frontend/src/**/*.test.ts
git commit -m "feat: add activity home and nodes routes"
```

### Task 5: Build the new home activity view

**Files:**
- Create: `frontend/src/views/HomeActivityView.vue`
- Modify: `frontend/src/styles.css`
- Modify or Create: focused view tests

- [ ] **Step 1: Write the failing home-view test**

Add a test that asserts the new home page:

- renders an activity-overview heading
- renders one activity series per node from mocked API data
- does not render connected-node cards

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace frontend -- <home-activity-test-path>`

Expected: FAIL because the view does not exist yet.

- [ ] **Step 3: Write minimal home-view implementation**

Create a compact multi-series graph view using simple DOM/CSS/SVG rendering if possible, keeping v1 implementation lightweight and readable.

The graph should:

- read clearly
- show one series per node
- avoid heavy dependencies unless absolutely necessary

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --workspace frontend -- <home-activity-test-path>`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/HomeActivityView.vue frontend/src/styles.css frontend/src/**/*.test.ts
git commit -m "feat: add home activity history view"
```

### Task 6: Move the node overview to a dedicated `/nodes` page

**Files:**
- Create or Modify: `frontend/src/views/NodesView.vue`
- Modify: `frontend/src/views/OperationsDashboardView.vue` if repurposed
- Modify: `frontend/src/App.vue`
- Modify: `frontend/src/styles.css`
- Modify: focused frontend tests

- [ ] **Step 1: Write the failing nodes-page/nav tests**

Add tests that assert:

- `/nodes` renders the connected-node overview
- the top nav includes `Home` and `Nodes`
- the connected-node cards no longer render on `/`

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --workspace frontend -- <nodes-view-test-paths>`

Expected: FAIL because the page and nav split are not complete yet.

- [ ] **Step 3: Write minimal frontend implementation**

Move the current connected-node overview into the new nodes page while preserving:

- node name + status cards
- existing search box
- refresh behavior if still appropriate

Update `App.vue` nav to include both routes.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --workspace frontend -- <nodes-view-test-paths> <home-activity-test-path>`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.vue frontend/src/views frontend/src/styles.css frontend/src/**/*.test.ts
git commit -m "feat: move connected nodes to dedicated page"
```

### Task 7: Run final verification

**Files:**
- Verify only

- [ ] **Step 1: Run focused backend tests**

Run: `npm test --workspace backend -- --runTestsByPath <history-and-api-test-paths>`

Expected: PASS

- [ ] **Step 2: Run focused frontend tests**

Run: `npm test --workspace frontend -- <affected-frontend-test-paths>`

Expected: PASS

- [ ] **Step 3: Run frontend production build**

Run: `npm run build --workspace frontend`

Expected: PASS
