# Contracts Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a top-level `Contracts` page that shows a paginated PQS-backed ACS list for each node with lazy loading and minimal row metadata.

**Architecture:** Extend the backend with a node-scoped active-contracts endpoint that returns 25 contracts at a time using cursor pagination. Add a frontend `/contracts` route and page modeled on the existing `Parties` page, with per-node lazy loading and `Newer` / `Older` controls for the selected node.

**Tech Stack:** NestJS, TypeScript, Jest, Vue 3, Vue Router, Vitest

---

### Task 1: Add backend ACS response contract and controller endpoint

**Files:**
- Modify: `backend/src/domain/node.types.ts`
- Modify: `backend/src/api/nodes.controller.ts`
- Test: `backend/test/api/nodes.controller.spec.ts`

- [ ] Write a failing controller test for `GET /api/nodes/:id/contracts`
- [ ] Run the controller test and confirm failure
- [ ] Add `NodeActiveContractSummary` and `NodeContractsResponse`
- [ ] Add controller wiring that delegates to `PqsSummaryService`
- [ ] Re-run the controller test and confirm pass

### Task 2: Implement PQS-backed ACS pagination

**Files:**
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Test: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] Write failing service tests for newest-first ordering and cursor pagination
- [ ] Run the targeted service tests and confirm failure
- [ ] Implement the active-contracts query and cursor handling
- [ ] Re-run the targeted service tests and confirm pass

### Task 3: Add frontend API/types and route shell

**Files:**
- Modify: `frontend/src/types/contracts.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/api.test.ts`
- Modify: `frontend/src/router.ts`
- Modify: `frontend/src/App.vue`
- Modify: `frontend/src/App.test.ts`

- [ ] Write failing frontend API/nav tests
- [ ] Run the targeted frontend tests and confirm failure
- [ ] Add `fetchNodeContracts`, the `/contracts` route, and the new nav item
- [ ] Re-run the targeted tests and confirm pass

### Task 4: Build the Contracts page

**Files:**
- Create: `frontend/src/views/ContractsView.vue`
- Create: `frontend/src/views/ContractsView.test.ts`
- Modify: `frontend/src/styles.css`

- [ ] Write failing page tests for first-node lazy loading, node switching, and pagination
- [ ] Run the page tests and confirm failure
- [ ] Implement the `Contracts` page with node buttons and 25-row ACS pagination
- [ ] Re-run the page tests and confirm pass

### Task 5: Verify end-to-end

**Files:**
- No additional code changes required

- [ ] Run targeted backend tests
- [ ] Run targeted frontend tests
- [ ] Run backend build
- [ ] Run frontend build
