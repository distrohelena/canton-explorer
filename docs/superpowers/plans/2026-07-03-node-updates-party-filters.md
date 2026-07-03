# Node Updates Party Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shareable party filters to the node updates page so users can add and remove multiple Party IDs, switch global `OR` / `AND` semantics, and have the backend filter the paginated updates route.

**Architecture:** Extend the `/api/nodes/:id/updates` contract to accept repeated `party` params and a global `mode=or|and`, then thread those query params through the frontend API and `NodeUpdatesView`. The page will keep filter state in the URL, render removable chips, and reset paging cursors when filters change so pagination stays consistent with the filtered result set.

**Tech Stack:** NestJS, TypeScript, PostgreSQL PQS queries, Vue 3, Vue Router, Vitest, Jest

---

### Task 1: Add backend party-filter contract coverage

**Files:**
- Modify: `backend/test/api/nodes.controller.spec.ts`
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Write the failing backend tests**

Add coverage for:
- repeated `party` query params plus `mode`
- service options passed from controller
- generated filtered query behavior for `OR` / `AND`

- [ ] **Step 2: Run backend tests to verify they fail**

Run: `rtk npm test -- --runTestsByPath test/api/nodes.controller.spec.ts test/pqs/pqs-summary.service.spec.ts`
Expected: FAIL because the updates route does not accept or apply party filters yet.

### Task 2: Implement backend updates filtering

**Files:**
- Modify: `backend/src/api/nodes.controller.ts`
- Modify: `backend/src/pqs/pqs-summary.service.ts`

- [ ] **Step 1: Write the minimal backend implementation**

Add support for:
- `party` query arrays
- global `mode=or|and`
- filtered `recentUpdatesQuery(...)` conditions against PQS witness tables

- [ ] **Step 2: Run backend tests to verify they pass**

Run: `rtk npm test -- --runTestsByPath test/api/nodes.controller.spec.ts test/pqs/pqs-summary.service.spec.ts`
Expected: PASS

### Task 3: Add frontend API contract coverage

**Files:**
- Modify: `frontend/src/lib/api.test.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Write the failing frontend API test**

Add a test proving `fetchNodeUpdates(...)` sends repeated `party` params and `mode`.

- [ ] **Step 2: Run the API test to verify it fails**

Run: `rtk npm test -- --run src/lib/api.test.ts`
Expected: FAIL because the client only sends paging cursors today.

- [ ] **Step 3: Write the minimal API implementation**

Extend the options object for `fetchNodeUpdates(...)` to serialize `party` and `mode`.

- [ ] **Step 4: Run the API test to verify it passes**

Run: `rtk npm test -- --run src/lib/api.test.ts`
Expected: PASS

### Task 4: Add Updates page filter chips and URL behavior

**Files:**
- Modify: `frontend/src/views/NodeUpdatesView.test.ts`
- Modify: `frontend/src/views/NodeUpdatesView.vue`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Write the failing view test**

Add coverage for:
- adding a Party ID with `+`
- global `OR` / `AND` mode toggles
- removable chips
- route-driven fetch reloads for add/remove/mode changes

- [ ] **Step 2: Run the view test to verify it fails**

Run: `rtk npm test -- --run src/views/NodeUpdatesView.test.ts`
Expected: FAIL because the page has no real chip state or route-driven party filters yet.

- [ ] **Step 3: Write the minimal view implementation**

Add:
- Party ID input state
- `+` add action
- `OR` / `AND` global mode buttons
- removable chips
- route query synchronization that clears `before` / `after` when filters change

- [ ] **Step 4: Run the view test to verify it passes**

Run: `rtk npm test -- --run src/views/NodeUpdatesView.test.ts`
Expected: PASS

### Task 5: Verify the integrated slice

**Files:**
- Modify: `docs/superpowers/plans/2026-07-03-node-updates-party-filters.md`

- [ ] **Step 1: Run targeted frontend verification**

Run: `rtk npm test -- --run src/lib/api.test.ts src/views/NodeUpdatesView.test.ts src/App.test.ts`
Expected: PASS

- [ ] **Step 2: Run targeted backend verification**

Run: `rtk npm test -- --runTestsByPath test/api/nodes.controller.spec.ts test/pqs/pqs-summary.service.spec.ts`
Expected: PASS

- [ ] **Step 3: Run builds**

Run: `rtk npm run build`
Workdir: `frontend`
Expected: PASS

Run: `rtk npm run build`
Workdir: `backend`
Expected: PASS
