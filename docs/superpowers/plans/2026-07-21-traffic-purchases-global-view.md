# Traffic Purchases Global View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Traffic Purchases a Contracts-style global browser with one combined table, all nodes selected by default, and server-side node/date/amount filtering and pagination.

**Architecture:** Add a global `/traffic-purchases` backend endpoint that follows the existing `fetchGlobalContracts` merge/cursor pattern. The frontend will keep one global response, pass selected node IDs and filters to that endpoint, and render node identity as a table column rather than separate node cards.

**Tech Stack:** NestJS, TypeScript, Vue 3 `<script setup>`, Vitest, Jest, PostgreSQL/PQS, existing `UpdatesToolbar` and advanced-filter styles.

---

### Task 1: Add global traffic-purchase domain types and cursor helpers

**Files:**
- Modify: `backend/src/domain/node.types.ts`
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Modify: `frontend/src/types/nodes.ts`

- [ ] **Step 1: Write the failing type/service tests**

Add service tests that expect a global response to contain combined purchases with `nodeId` and `label`, combined current-state entries, and global `nextBefore`/`nextAfter` cursors. Add frontend type usage through the API/view tests so the new response shape is compiled.

- [ ] **Step 2: Run the targeted backend tests to verify the new expectations fail**

Run from `backend`:

```bash
npm test -- --runInBand test/pqs/pqs-summary.service.spec.ts
```

Expected: the new global traffic tests fail because the global response types and service method do not exist.

- [ ] **Step 3: Add the response and row types**

Define global purchase rows with `nodeId`, `label`, and the existing purchase fields. Define global current-state entries with `nodeId`, `label`, and `NodeTrafficState[]`. Define the response with `limit`, cursors, purchases, current states, and per-node PQS/gRPC status/error metadata.

- [ ] **Step 4: Add traffic-specific global cursor comparison/encoding helpers**

Use the established global ordering: record time descending when present, missing record times last, node ID ascending, event offset descending, and update ID descending. Encode/decode the final row boundary as base64url; invalid cursors are treated as absent.

- [ ] **Step 5: Run typechecking and the targeted tests**

Run:

```bash
npm test -- --runInBand test/pqs/pqs-summary.service.spec.ts
npm run build
```

Expected: existing tests pass; new service tests remain red until the global service method is implemented in Task 2, while the typecheck succeeds.

### Task 2: Implement the global backend endpoint and server-side aggregation

**Files:**
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Modify: `backend/src/api/nodes.controller.ts`
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`
- Modify: `backend/test/api/nodes.controller.spec.ts`

- [ ] **Step 1: Add the failing controller contract test**

Test `GET /traffic-purchases` query normalization for omitted `node` (all configured nodes), repeated node IDs, explicitly empty `node`, the existing date/amount filters, and pagination values. Assert that the controller passes the normalized values to the service.

- [ ] **Step 2: Run the controller test and confirm the expected failure**

Run:

```bash
npm test -- --runInBand test/api/nodes.controller.spec.ts
```

Expected: failure because the route and service method are not present.

- [ ] **Step 3: Implement `fetchGlobalTrafficPurchases`**

Follow `fetchGlobalContracts`:

1. Normalize the requested limit and resolve selected IDs against configured nodes, ignoring unknown IDs.
2. Return an empty result without querying PQS/gRPC when `nodeIds` is explicitly empty.
3. Fetch per-node purchase pages with existing date/amount filters using `Promise.allSettled` so one node failure does not discard successful nodes.
4. Convert purchases to global rows, merge and sort deterministically by the specified global order, and apply the decoded before/after row boundary.
5. Fetch additional node pages as needed to fill the global page and return global cursors for Older/Newer navigation.
6. Fetch current traffic states for selected `pqs_with_grpc` nodes and return concise status/error metadata. If all selected nodes fail, return an empty result with node errors rather than throwing a global HTTP error.

- [ ] **Step 4: Add `GET /traffic-purchases`**

Parse repeated `node` values exactly as the Contracts route does, preserving omitted versus explicitly empty selection. Forward the existing date and numeric filters and call `fetchGlobalTrafficPurchases(this.configService.list(), ...)`.

- [ ] **Step 5: Complete backend service and controller tests**

Cover all-node defaults, selected-node filtering, empty selection, unknown IDs, merged ordering and ties, before/after cursors, partial failures, all-node failures, and query forwarding. Run:

```bash
npm test -- --runInBand test/pqs/pqs-summary.service.spec.ts test/api/nodes.controller.spec.ts
npm run build
```

Expected: all targeted backend tests pass and TypeScript compiles.

### Task 3: Add the frontend global API client and write view behavior tests

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/types/nodes.ts`
- Modify: `frontend/src/views/TrafficPurchasesView.test.ts`

- [ ] **Step 1: Add failing view tests**

Extend the existing Traffic Purchases tests to assert no node selector tablist is rendered; all node checkboxes are checked when Advanced Search opens; the initial global fetch omits `node`; unchecking one node sends only the remaining ID; unchecking every node sends an explicit empty selection; rows from multiple nodes render together in one table; and pagination/date/amount filters preserve selected-node IDs.

- [ ] **Step 2: Run the focused frontend tests to verify they fail**

Run from `frontend`:

```bash
npm test -- --run src/views/TrafficPurchasesView.test.ts
```

Expected: the new assertions fail because the page still uses per-node state and the per-node API.

- [ ] **Step 3: Add the global API client**

Serialize repeated `node` parameters, including one empty `node` value for an empty selection. Serialize limit, cursors, and all existing date/amount filters. Return the global traffic-purchases response type.

### Task 4: Rebuild the Traffic Purchases view around one global browser

**Files:**
- Modify: `frontend/src/views/TrafficPurchasesView.vue`
- Modify: `frontend/src/views/TrafficPurchasesView.test.ts`

- [ ] **Step 1: Replace per-node state with global state**

Track one response, one page size, one Advanced Search expansion state, selected node IDs, active filters, and filter drafts. Initialize selected nodes from the fetched node list so all nodes are checked by default. Preserve active selections when refreshing if the node still exists.

- [ ] **Step 2: Implement server-backed node and filter changes**

When a checkbox changes, update the active selection and reload through the global API. Omit `node` when every configured node is selected; send an explicit empty selection when none are selected. Apply date/amount filters, page size, Older, and Newer through the same global request path, resetting cursors when filters or node selection changes.

- [ ] **Step 3: Render one combined table**

Remove the outside node selector and the per-node article, title link, per-node toolbar, and nested table. Render one page-level toolbar and one rounded table with `Node`, `Purchased`, `Paid`, `Time`, and `Offset` columns. Render current-state summaries using node labels without node-card headings.

- [ ] **Step 4: Keep existing states and concise error handling**

Retain loading, retry, empty configured-node, empty result, and unavailable/partial-data behavior. Do not display raw gRPC error strings.

- [ ] **Step 5: Run the focused frontend tests and fix regressions**

Run:

```bash
npm test -- --run src/views/TrafficPurchasesView.test.ts
```

Expected: all Traffic Purchases tests pass.

### Task 5: Match Contracts styling and complete verification

**Files:**
- Modify: `frontend/src/styles.css`
- Modify: `frontend/src/views/TrafficPurchasesView.test.ts` if accessibility selectors need adjustment

- [ ] **Step 1: Replace node-card styles with page/table styles**

Remove styles that only support per-node titles/cards and apply the existing Contracts table/panel treatment to the combined Traffic Purchases table. Keep the rounded Advanced Search shell animation and make its node checkbox grid match `UpdatesAdvancedFilter`.

- [ ] **Step 2: Run the complete frontend suite and build**

Run from `frontend`:

```bash
npm test -- --run
npm run build
```

Expected: all frontend tests pass and the production build succeeds.

- [ ] **Step 3: Run complete backend tests**

Run from `backend`:

```bash
npm test -- --runInBand
npm run build
```

Expected: all backend tests pass and the production build succeeds.

- [ ] **Step 4: Run final diff validation**

Run from the repository root:

```bash
git diff --check -- backend frontend docs/superpowers/specs/2026-07-21-traffic-purchases-global-view-design.md docs/superpowers/plans/2026-07-21-traffic-purchases-global-view.md
```

Expected: no whitespace errors.
