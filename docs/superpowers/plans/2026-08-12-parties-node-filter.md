# Parties Node Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Contracts-style, URL-persisted node checklist to the Parties page that immediately filters Active Parties, All Parties, and Namespaces.

**Architecture:** PartiesView will own the selected node IDs, route synchronization, per-mode loading, pagination resets, and unified filter-panel visibility. The existing UpdatesAdvancedFilter will gain a template-controls toggle and an additional-fields slot so its node checklist and the existing namespace key fields render inside one expanded panel. The backend global fingerprint route will parse repeated `node` query values and pass the filtered node configuration into the existing global fingerprint builder.

**Tech Stack:** Vue 3 `<script setup>`, Vue Router, TypeScript, Vue Testing Library/Vitest, NestJS, Jest.

---

### Task 1: Extend the frontend API and backend namespace route with node filters

**Files:**
- Modify: `frontend/src/lib/api.ts` (`fetchPartyFingerprints` options and query serialization)
- Test: `frontend/src/lib/api.test.ts`
- Modify: `backend/src/api/nodes.controller.ts` (`listPartyFingerprints` query parsing and empty-node handling)
- Test: `backend/test/api/nodes.controller.spec.ts`
- Modify: `backend/src/api/nodes.controller.ts` (`buildGlobalPartyFingerprintsEntry` empty/all-PQS behavior if needed)

- [ ] **Step 1: Write failing frontend serialization tests**

Add tests showing `fetchPartyFingerprints({ nodeIds: ['participant-1', 'participant-2'] })` sends repeated `node` parameters, `nodeIds: []` sends `node=`, and an omitted `nodeIds` option does not add a node parameter.

- [ ] **Step 2: Run the focused frontend API tests and verify they fail**

Run: `npm run test --workspace frontend -- --run src/lib/api.test.ts`

Expected: the new assertions fail because `fetchPartyFingerprints` does not accept or serialize `nodeIds`.

- [ ] **Step 3: Implement frontend node query serialization**

Add `nodeIds?: string[]` to the fingerprint options and append each nonblank node ID as `node`; for an explicitly empty array append one empty `node` value so the backend can distinguish no selection from all nodes.

- [ ] **Step 4: Write failing backend controller/service tests**

Exercise `listPartyFingerprints` with omitted, repeated, empty, valid-plus-unknown, and unknown-only node values. Assert all-PQS, all-gRPC, mixed, and gRPC-failure fallback source behavior, sorted/paginated results, and that an empty selection returns an empty response without invoking gRPC or PQS work. Ensure the empty branch executes before the `nodes.every(...)` gRPC capability check.

- [ ] **Step 5: Implement backend node parsing and selection**

Accept `@Query('node') node?: string | string[]`, preserve an explicit empty value, deduplicate/filter IDs against `configService.list()`, and pass the eligible nodes to `buildGlobalPartyFingerprintsEntry`. Return a valid empty `PartyFingerprintsResponse` with `source: 'pqs'` when no nodes are eligible. Preserve gRPC-first behavior only when every eligible node supports gRPC; all-PQS and mixed selections use PQS.

- [ ] **Step 6: Run the focused backend/API tests and verify they pass**

Run: `npm run test --workspace backend -- --runInBand test/api/nodes.controller.spec.ts`

Expected: the existing controller tests and the new node-filter cases pass.

- [ ] **Step 7: Commit the API/backend slice**

```bash
git add frontend/src/lib/api.ts frontend/src/lib/api.test.ts backend/src/api/nodes.controller.ts backend/test/api/nodes.controller.spec.ts
git commit -m "feat: filter party fingerprints by node"
```

### Task 2: Make the shared advanced filter support a node-only mode

**Files:**
- Modify: `frontend/src/components/UpdatesAdvancedFilter.vue`
- Test: `frontend/src/components/UpdatesAdvancedFilter.test.ts`

- [ ] **Step 1: Write a failing node-only rendering test**

Render `UpdatesAdvancedFilter` with node options, `show-party-filters=false`, and `show-template-filters=false`. Assert that the Nodes checklist is present while Party ID, Template ID, template chips, and Hide Splice controls are absent. Add an additional-fields slot fixture and assert it renders inside the same filter section.

- [ ] **Step 2: Run the focused component test and verify it fails**

Run: `npm run test --workspace frontend -- --run src/components/UpdatesAdvancedFilter.test.ts`

Expected: the node checklist exists, but Template ID controls still render because the component has no template visibility prop.

- [ ] **Step 3: Add the minimal template visibility prop and slot**

Add an optional `showTemplateFilters` prop defaulting to `true`, condition the Template ID field and active-template chips on it, and render an `additional-fields` slot inside the advanced-filter grid. Keep all existing callers unchanged.

- [ ] **Step 4: Run the component test and verify it passes**

Run: `npm run test --workspace frontend -- --run src/components/UpdatesAdvancedFilter.test.ts`

Expected: all component tests pass.

- [ ] **Step 5: Commit the reusable filter slice**

```bash
git add frontend/src/components/UpdatesAdvancedFilter.vue frontend/src/components/UpdatesAdvancedFilter.test.ts
git commit -m "feat: support node-only advanced filters"
```

### Task 3: Add URL-backed node selection and the unified Parties filter panel

**Files:**
- Modify: `frontend/src/views/PartiesView.vue`
- Test: `frontend/src/views/PartiesView.test.ts`
- Possibly modify: `frontend/src/styles.css` only for a small Parties filter-shell/layout adjustment if existing classes do not cover the unified panel.

- [ ] **Step 1: Update Parties test rendering to use a memory router**

Add a `renderAt(path)` helper like ContractsView tests, route `/parties` to PartiesView, and retain the existing RouterLink stub. This enables assertions for initial query filters and URL updates.

- [ ] **Step 2: Write failing Parties filter tests**

Cover: the Advanced Filter button and one unified filter section; all nodes checked by default; an initial `?node=participant-2` checks only Participant 2 and auto-opens the panel; duplicate IDs are deduplicated; `node=` and unknown-only queries select none; blank-plus-valid selects the valid node; all-selected state removes `node` from the URL; unchecking/rechecking immediately reloads Active Parties; All Parties restricts requests to checked gRPC nodes; Namespaces passes selected node IDs to `fetchPartyFingerprints`; empty selection makes no node requests and shows the empty state; page-size, pagination, and mode interactions preserve node query state; concurrent loads show independent loading state; partial failures retain successful rows; stale active, local, and namespace responses are ignored.

- [ ] **Step 3: Run the focused Parties tests and verify they fail**

Run: `npm run test --workspace frontend -- --run src/views/PartiesView.test.ts`

Expected: the new filter/button/query assertions fail because PartiesView currently has no router state or node checklist.

- [ ] **Step 4: Add route/query state helpers**

Use `useRoute`/`useRouter`, read node query values after `fetchNodes()` resolves, select all nodes when `node` is absent, ignore unknown IDs, treat explicit empty/unknown-only filters as no selected nodes, and auto-open the unified filter for explicit node queries. Add a query builder that removes `node` for all selected nodes and writes `node=''` for none while preserving unrelated query keys.

- [ ] **Step 5: Add unified filter controls**

Use `UpdatesAdvancedFilter` with party/template controls hidden for the node checklist and pass the existing namespace key fields through its `additional-fields` slot when Namespaces is active. Assert the Nodes and namespace fields share one expanded filter section. Replace the namespace-only Advanced Filter toggle with one button available in all modes. Wire node checkbox events to immediate route updates and mode reloads.

- [ ] **Step 6: Filter per-node loading and aggregation**

Derive eligible nodes from the selected IDs and current mode; keep the All Parties gRPC eligibility rule. Track active/local loading and node errors per node, use request generations/tokens so stale active, local, and namespace responses cannot replace current selection data, and clear/reset namespace responses and pagination when selection changes. Keep successful node entries and their rows visible if another selected node fails, while rendering the selected node’s error details.

- [ ] **Step 7: Connect Namespaces to the filtered API**

Short-circuit no-node selections locally. Otherwise call `fetchPartyFingerprints` with omitted `nodeIds` for all selected nodes or the selected IDs for a subset, preserving namespace filters and cursors. Keep source-pill behavior unchanged except that PQS remains hidden as already requested.

- [ ] **Step 8: Run the focused Parties tests and verify they pass**

Run: `npm run test --workspace frontend -- --run src/views/PartiesView.test.ts`

Expected: all Parties tests pass, including URL, mode, loading, empty-selection, and stale-response cases.

- [ ] **Step 9: Commit the Parties slice**

```bash
git add frontend/src/views/PartiesView.vue frontend/src/views/PartiesView.test.ts frontend/src/styles.css
git commit -m "feat: add parties node filter"
```

### Task 4: Full verification and handoff

**Files:**
- No source changes expected; inspect all changed files and generated test artifacts.

- [ ] **Step 1: Run the complete test suite**

Run: `npm run test --workspace backend -- --runInBand` and `rtk npm test --workspace frontend -- --run`

Expected: all backend and frontend test files pass.

- [ ] **Step 2: Run the frontend production build**

Run: `npm run build --workspace frontend`

Expected: `vue-tsc` and Vite complete successfully.

- [ ] **Step 3: Check formatting and scope**

Run: `git diff --check` and `git status --short`. If tests create SQLite WAL sidecars, remove only those generated files, and confirm unrelated pre-existing package changes remain unstaged.

- [ ] **Step 4: Review the final diff and commit any required fix**

Confirm that the filter behavior, URL semantics, and backend node selection match the approved spec, then commit any narrowly scoped correction.
