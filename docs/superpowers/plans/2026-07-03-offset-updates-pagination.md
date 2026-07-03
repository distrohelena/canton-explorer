# Offset Updates Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed "Latest 25 updates" list with event-offset cursor pagination so node updates can page older/newer by offset instead of page number.

**Architecture:** Extend the backend `/api/nodes/:id/updates` contract to accept offset cursors and return pagination metadata, then update the frontend API/types and `NodeUpdatesView` to drive navigation with `before` and `after` query parameters. Keep the existing update detail route untouched and preserve the current 25-row page size as a fixed window.

**Tech Stack:** NestJS, TypeScript, PostgreSQL PQS queries, Vue 3, Vue Router, Vitest, Jest

---

### Task 1: Add backend cursor contract and query behavior

**Files:**
- Modify: `backend/src/domain/node.types.ts`
- Modify: `backend/src/api/nodes.controller.ts`
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Test: `backend/test/api/nodes.controller.spec.ts`
- Test: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Write the failing backend tests**

Add controller/service expectations for:
- `before` and `after` query handling
- fixed `limit`
- `nextBefore` and `nextAfter` cursor fields in the response

- [ ] **Step 2: Run backend tests to verify they fail**

Run: `rtk npm test -- --runTestsByPath test/api/nodes.controller.spec.ts test/pqs/pqs-summary.service.spec.ts`
Expected: FAIL because the current response has no cursor fields and no cursor-aware query handling.

- [ ] **Step 3: Write the minimal backend implementation**

Implement:
- cursor-aware `recentUpdatesQuery(limit, before?, after?)`
- controller parsing of `before` / `after`
- service response metadata for older/newer pagination

- [ ] **Step 4: Run backend tests to verify they pass**

Run: `rtk npm test -- --runTestsByPath test/api/nodes.controller.spec.ts test/pqs/pqs-summary.service.spec.ts`
Expected: PASS

### Task 2: Add frontend cursor API/types

**Files:**
- Modify: `frontend/src/types/updates.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/api.test.ts`

- [ ] **Step 1: Write the failing frontend API test**

Add an API test proving `fetchNodeUpdates` sends `before` / `after` query params and returns cursor metadata.

- [ ] **Step 2: Run the API test to verify it fails**

Run: `rtk npm test -- --run src/lib/api.test.ts`
Expected: FAIL because `fetchNodeUpdates` only supports `limit`.

- [ ] **Step 3: Write the minimal frontend API implementation**

Update the type contract and `fetchNodeUpdates` signature to support cursor params.

- [ ] **Step 4: Run the API test to verify it passes**

Run: `rtk npm test -- --run src/lib/api.test.ts`
Expected: PASS

### Task 3: Rework the updates page for offset pagination

**Files:**
- Modify: `frontend/src/views/NodeUpdatesView.vue`
- Modify: `frontend/src/views/NodeUpdatesView.test.ts`

- [ ] **Step 1: Write the failing view test**

Add expectations for:
- no `Latest 25 updates` label
- `Older` / `Newer` controls
- loading the next window from cursor query params

- [ ] **Step 2: Run the view test to verify it fails**

Run: `rtk npm test -- --run src/views/NodeUpdatesView.test.ts`
Expected: FAIL because the current view is static and non-paginated.

- [ ] **Step 3: Write the minimal view implementation**

Use route query params as the source of truth for the active cursor window and wire the pager buttons to `before` / `after`.

- [ ] **Step 4: Run the view test to verify it passes**

Run: `rtk npm test -- --run src/views/NodeUpdatesView.test.ts`
Expected: PASS

### Task 4: Verify the integrated slice

**Files:**
- Modify: `docs/superpowers/plans/2026-07-03-offset-updates-pagination.md`

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
