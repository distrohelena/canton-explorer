# Read-Only Indexing Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a read-only `/settings` page reached from an expandable header Explore menu that reports the current PQS indexing state for every configured node.

**Architecture:** Reuse the existing backend `GET /nodes` cache and `fetchNodes()` frontend helper. Replace the fixed header destination links with an accessible, expandable Explore menu while leaving the existing Search bar unchanged. Add the settings route, aligned node typing, focused settings view, and styles; do not add new persistence or direct PQS/gRPC calls.

**Tech Stack:** Vue 3, Vue Router, TypeScript, Vitest, Testing Library, existing NestJS node snapshot API.

---

## Context and constraints

- Work in the existing workspace because no usable ignored worktree exists and `.git` is read-only. Preserve unrelated changes in `backend/package.json` and `docs/superpowers/plans/2026-07-17-static-token-grpc-auth.md`.
- Follow `@superpowers:test-driven-development`: every production change starts with a failing focused test.
- Use the existing `/nodes` snapshot fields: `sourceStatus`, `ledgerSummary.latestOffset`, `ledgerSummary.latestEventAt`, and backend `ledgerSummary.totalUpdateCount`.
- Do not claim exact indexing lag or “fully synced”; the current API does not compare PQS with participant ledger end.

## File map

- Modify `frontend/src/App.vue`: replace fixed destination links with the Explore menu, preserving Search and theme behavior.
- Modify `frontend/src/router.ts`: register `/settings`.
- Create `frontend/src/views/SettingsView.vue`: load, refresh, and render the read-only indexing dashboard.
- Modify `frontend/src/types/nodes.ts`: add `ledgerSummary.totalUpdateCount` to the frontend snapshot type.
- Modify `frontend/src/styles.css`: style the settings page, status cards, and footer settings link using existing design tokens.
- Modify `frontend/src/App.test.ts`: test the Explore menu, unchanged Search behavior, and debugger shell behavior.
- Create `frontend/src/views/SettingsView.test.ts`: test the settings page states and refresh lifecycle.
- Modify `frontend/src/router.test.ts` if needed by the existing test setup; otherwise cover route registration through the view test and App shell tests.

### Task 1: Align the node contract and add the Explore menu tests

**Files:**
- Modify: `frontend/src/types/nodes.ts`
- Modify: `frontend/src/router.ts`
- Modify: `frontend/src/App.test.ts`

- [ ] **Step 1: Add failing Explore menu tests.**

Extend the existing App shell test setup with a Settings stub route and assert that normal routes render an `Explore` button, keep the existing Search input, and reveal links for Updates, Nodes, Parties, Contracts, Tokens, and Settings after activation. Assert that the debugger route keeps the footer hidden while the header remains usable.

- [ ] **Step 2: Run the focused App test and verify it fails.**

Run: `rtk npm test --workspace frontend -- frontend/src/App.test.ts --run`

Expected: FAIL because the fixed navigation has not been replaced by the Explore menu.

- [ ] **Step 3: Add the route and minimal Explore menu.**

Register `/settings` with `SettingsView` in `frontend/src/router.ts`, import the view, and replace the fixed destination links in `App.vue` with an `Explore` button and expandable menu. Keep the existing Search form and theme button unchanged.

- [ ] **Step 4: Add the missing `totalUpdateCount` frontend field.**

Extend `NodeSnapshot.ledgerSummary` in `frontend/src/types/nodes.ts` with `totalUpdateCount: number`. Update only fixture objects that TypeScript or focused tests require.

- [ ] **Step 5: Run the focused App test and verify it passes.**

Run: `rtk npm test --workspace frontend -- frontend/src/App.test.ts --run`

Expected: PASS.

### Task 2: Define the settings view behavior with failing tests

**Files:**
- Create: `frontend/src/views/SettingsView.test.ts`
- Create: `frontend/src/views/SettingsView.vue`

- [ ] **Step 1: Write tests for the loaded healthy state.**

Mock `fetchNodes()` and assert that the page renders the `Settings` heading, read-only notice, `Indexing status` heading, node label, healthy status, PQS state, latest offset, latest event time, total indexed updates, and a node-detail link.

- [ ] **Step 2: Write tests for source-specific states.**

Add a `pqs_only` fixture and assert it does not render a misleading gRPC failure. Add a degraded fixture and assert its PQS/gRPC error text is shown while available indexing fields remain visible.

- [ ] **Step 3: Write tests for loading, empty, API error, and retry.**

Use a deferred `fetchNodes()` promise for loading, an empty result for no configured nodes, and a rejected request for the error state. Assert that retry invokes the fetch again.

- [ ] **Step 4: Write the refresh cleanup test.**

Use fake timers to assert an interval refresh occurs and is cleared when the component unmounts. Keep the refresh interval a named constant in the view.

- [ ] **Step 5: Run the new test file and verify it fails for missing view behavior.**

Run: `rtk npm test --workspace frontend -- frontend/src/views/SettingsView.test.ts --run`

Expected: FAIL because `SettingsView.vue` does not exist or does not yet implement the required states.

### Task 3: Implement the read-only settings view

**Files:**
- Modify: `frontend/src/views/SettingsView.vue`

- [ ] **Step 1: Implement minimal loading and fetch state.**

Call `fetchNodes()` on mount, keep `nodes`, `loading`, `error`, and a last-refresh indicator in local state, and expose a retry method. Preserve already loaded nodes if a later interval refresh fails.

- [ ] **Step 2: Implement periodic refresh with cleanup.**

Start a 15-second interval after mounting and clear it in `onBeforeUnmount`. Prevent overlapping requests with a small in-flight guard or equivalent promise state.

- [ ] **Step 3: Implement the page markup.**

Render the title, read-only notice, indexing section, and per-node cards. Use semantic headings, definition lists or labeled rows, status attributes, and RouterLinks to `/nodes/:id`. Display `Last indexed` wording and `Unavailable` values where fields are null; do not substitute zeroes.

- [ ] **Step 4: Implement all page states.**

Render loading treatment, empty configured-node copy, page-level retry error, and inline source errors. Show gRPC only for `pqs_with_grpc` nodes.

- [ ] **Step 5: Run the settings tests and verify they pass.**

Run: `rtk npm test --workspace frontend -- frontend/src/views/SettingsView.test.ts --run`

Expected: PASS.

### Task 4: Style and integrate the page

**Files:**
- Modify: `frontend/src/styles.css`
- Modify: `frontend/src/views/SettingsView.vue` if class names need adjustment.

- [ ] **Step 1: Add footer settings-link styles.**

Match the existing footer typography, make the gear target visibly interactive, and preserve keyboard focus visibility.

- [ ] **Step 2: Add responsive settings layout styles.**

Use existing color/status variables for healthy, degraded, and unavailable states. Keep cards readable on narrow screens and consistent with the current page panel treatment.

- [ ] **Step 3: Run frontend tests and build.**

Run: `rtk npm test --workspace frontend -- --run`

Expected: PASS with no failures.

Run: `rtk npm run build --workspace frontend`

Expected: Vue type-check and Vite build succeed.

### Task 5: Verify the complete change

**Files:**
- No new files; inspect all changed files and the working tree.

- [ ] **Step 1: Run focused shell and view tests again.**

Run: `rtk npm test --workspace frontend -- frontend/src/App.test.ts frontend/src/views/SettingsView.test.ts --run`

Expected: PASS.

- [ ] **Step 2: Run the full frontend test suite.**

Run: `rtk npm test --workspace frontend -- --run`

Expected: PASS.

- [ ] **Step 3: Run the repository build if dependencies and existing workspace state permit.**

Run: `rtk npm run build`

Expected: PASS, or record any pre-existing unrelated failure precisely.

- [ ] **Step 4: Inspect the final diff and preserve unrelated changes.**

Run: `rtk git diff --check` and `rtk git status --short`.

Expected: only the settings feature files and the already-existing unrelated changes are present; no generated artifacts or accidental backend edits are introduced.
