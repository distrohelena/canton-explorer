# Home Dashboard and Updates Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/` into a compact home dashboard and move the full updates browser to `/updates`.

**Architecture:** Preserve the existing data-fetching and navigation behavior in `UpdatesBrowser` and `TokenTransfersBrowser`, adding explicit compact-preview props instead of duplicating API logic. Add a dedicated `HomeView` composition and route the existing full updates view at `/updates`; update the shared Explore menu label and link accordingly.

**Tech Stack:** Vue 3 `<script setup>`, Vue Router, Testing Library for Vue, Vitest, existing TypeScript API and table components, shared CSS.

---

### Task 1: Add route and home-shell tests

**Files:**
- Modify: `frontend/src/App.test.ts`
- Create: `frontend/src/views/HomeView.test.ts`

- [ ] **Step 1: Write failing route-shell assertions**

Update the App test router fixtures to include `/updates`, assert that the Explore Updates link targets `/updates`, and assert that the selected shell label is `Home` on `/` and `Updates` on `/updates`. Add HomeView tests for the two preview headings and their `View all` links.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `rtk npm run test --workspace frontend -- src/App.test.ts src/views/HomeView.test.ts --run`

Expected: the new assertions fail because `/updates`, `HomeView`, and the updated Explore metadata do not exist yet.

### Task 2: Create the dedicated home view and move full updates to `/updates`

**Files:**
- Create: `frontend/src/views/HomeView.vue`
- Modify: `frontend/src/views/HomeUpdatesView.vue`
- Modify: `frontend/src/router.ts`
- Modify: `frontend/src/App.vue`
- Modify: `frontend/src/App.test.ts`
- Modify: `frontend/src/views/HomeUpdatesView.test.ts`

- [ ] **Step 1: Implement the route split**

Add `HomeView` as a composition of compact `UpdatesBrowser` and `TokenTransfersBrowser` instances. Register it at `/`, register the existing full updates view at `/updates`, and update the Explore menu link and route-label logic.

- [ ] **Step 2: Point the full updates browser at `/updates`**

Change the existing full updates view’s browser path and preserve its full filters, pagination, source tag, detail links, and existing table assertions.

- [ ] **Step 3: Run route and view tests**

Run: `rtk npm run test --workspace frontend -- src/App.test.ts src/views/HomeView.test.ts src/views/HomeUpdatesView.test.ts --run`

Expected: route-shell tests pass once compact browser props are stubbed or implemented in the next task; existing full updates behavior remains covered.

### Task 3: Add compact preview mode to the updates browser

**Files:**
- Modify: `frontend/src/components/UpdatesBrowser.vue`
- Modify: `frontend/src/views/HomeView.test.ts`

- [ ] **Step 1: Write the failing compact updates assertions**

Mock six update entries and assert the compact table has only Node, Offset, Record Time, and Parties columns, requests/loads six records, omits toolbar controls, and renders the seventh `View all` row linking to `/updates`.

- [ ] **Step 2: Run the compact updates test to verify it fails**

Run: `rtk npm run test --workspace frontend -- src/views/HomeView.test.ts --run`

Expected: the compact assertions fail because the browser always uses the route page size, renders the full columns, and shows the toolbar.

- [ ] **Step 3: Implement compact updates mode**

Add a `compact` prop, a fixed compact limit of six, conditional toolbar/filter/estimate rendering, compact table classes/columns, and a final `View all` row. Keep the existing full mode as the default.

- [ ] **Step 4: Run the compact updates test to verify it passes**

Run: `rtk npm run test --workspace frontend -- src/views/HomeView.test.ts --run`

Expected: compact updates assertions pass.

### Task 4: Add compact preview mode to token transfers

**Files:**
- Modify: `frontend/src/components/TokenTransfersBrowser.vue`
- Modify: `frontend/src/views/HomeView.test.ts`

- [ ] **Step 1: Write the failing compact trades assertions**

Mock six transfers and assert the compact table has Token, Amount, From → To, and Record Time columns, loads six records, omits filters/pagination, and renders the seventh `View all` row linking to `/tokens`.

- [ ] **Step 2: Run the compact trades test to verify it fails**

Run: `rtk npm run test --workspace frontend -- src/views/HomeView.test.ts --run`

Expected: the compact trades assertions fail because the browser always renders the full transfer columns and controls.

- [ ] **Step 3: Implement compact trade mode**

Add a `compact` prop, a fixed compact limit of six, conditional toolbar/filter rendering, a combined sender/receiver cell, compact table classes, and a final `View all` row. Preserve full mode for the Tokens page and detail pages.

- [ ] **Step 4: Run the compact trades test to verify it passes**

Run: `rtk npm run test --workspace frontend -- src/views/HomeView.test.ts --run`

Expected: compact trades assertions pass.

### Task 5: Style the home preview layout

**Files:**
- Modify: `frontend/src/styles.css`
- Modify: `frontend/src/styles.test.js`

- [ ] **Step 1: Write failing style assertions**

Assert that the home preview grid uses two columns at desktop widths, stacks at the existing mobile breakpoint, and has dedicated compact row grid definitions plus a full-width view-all row.

- [ ] **Step 2: Run the style test to verify it fails**

Run: `rtk npm run test --workspace frontend -- src/styles.test.js --run`

Expected: the new home preview selectors are absent.

- [ ] **Step 3: Implement the responsive preview styles**

Add the home dashboard grid/card styles and compact update/trade row templates, reusing existing surface, border, typography, and link tokens. Keep the tables usable on narrow screens by stacking their rows at the mobile breakpoint.

- [ ] **Step 4: Run the style tests**

Run: `rtk npm run test --workspace frontend -- src/styles.test.js --run`

Expected: all style tests pass.

### Task 6: Verify, review, and commit the feature

**Files:**
- Test: `frontend/src/App.test.ts`, `frontend/src/views/HomeView.test.ts`, `frontend/src/views/HomeUpdatesView.test.ts`, `frontend/src/styles.test.js`
- Implementation: `frontend/src/App.vue`, `frontend/src/router.ts`, `frontend/src/views/HomeView.vue`, `frontend/src/views/HomeUpdatesView.vue`, `frontend/src/components/UpdatesBrowser.vue`, `frontend/src/components/TokenTransfersBrowser.vue`, `frontend/src/styles.css`

- [ ] **Step 1: Run the full frontend suite**

Run: `rtk npm run test --workspace frontend -- --run`

Expected: zero failed tests.

- [ ] **Step 2: Check the diff**

Run: `rtk git diff --check`

Expected: no whitespace errors.

- [ ] **Step 3: Commit the implementation**

Run: `rtk git add frontend/src/App.vue frontend/src/App.test.ts frontend/src/router.ts frontend/src/views/HomeView.vue frontend/src/views/HomeView.test.ts frontend/src/views/HomeUpdatesView.vue frontend/src/views/HomeUpdatesView.test.ts frontend/src/components/UpdatesBrowser.vue frontend/src/components/TokenTransfersBrowser.vue frontend/src/styles.css frontend/src/styles.test.js && rtk git commit -m "feat: add home dashboard and updates route"`

Expected: one feature commit containing the route split, compact previews, responsive layout, and regression coverage.
