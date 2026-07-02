# Home And Node Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the frontend into a boutique enterprise UI with a calm overview home page and a denser, more polished node detail page.

**Architecture:** Keep the existing Vue Router structure and data flow intact while reshaping the presentation layer. The shell, dashboard view, node card, and node detail view will be redesigned together through a stronger shared visual system in `styles.css`, with tests updated first to lock in the new markup and simplified home-page content.

**Tech Stack:** Vue 3, Vue Router, Vitest, Testing Library, Vite, CSS

---

### File Structure

**Files and responsibilities:**

- `frontend/src/App.vue`
  - shared application frame, titlebar, route-level composition
- `frontend/src/views/OperationsDashboardView.vue`
  - home page overview copy, layout, and node-grid framing
- `frontend/src/components/NodeStatusCard.vue`
  - premium overview tile showing only node name and status
- `frontend/src/views/NodeDetailView.vue`
  - denser node workspace with clearer grouping of existing information
- `frontend/src/styles.css`
  - shared visual tokens, page layout, cards, type hierarchy, motion, responsive behavior
- `frontend/src/App.test.ts`
  - shell navigation and home-page presentation assertions
- `frontend/src/views/OperationsDashboardView.test.ts`
  - home page copy and overview-card assertions
- `frontend/src/views/NodeDetailView.test.ts`
  - node detail structure assertions after layout changes

### Task 1: Update the frontend tests for the new home-page purpose

**Files:**
- Modify: `frontend/src/App.test.ts`
- Modify: `frontend/src/views/OperationsDashboardView.test.ts`
- Modify: `frontend/src/views/NodeDetailView.test.ts`

- [ ] **Step 1: Write the failing home-page and detail-page expectations**

Update the tests so they express the new design intent:

- `App.test.ts`
  - keep navigation assertions
  - assert the shell still renders the shared heading
- `OperationsDashboardView.test.ts`
  - assert the home page presents refined overview copy
  - assert each card shows node name and status
  - stop asserting ledger, latency, and contract-count text on the home page
- `NodeDetailView.test.ts`
  - assert the node detail page still shows the selected node
  - assert the detail page groups existing operational information under stronger labels or sections introduced by the redesign

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --workspace frontend -- src/App.test.ts src/views/OperationsDashboardView.test.ts src/views/NodeDetailView.test.ts`

Expected: FAIL because the current UI still uses the old dashboard copy and the node card still renders dense metrics.

- [ ] **Step 3: Write minimal test-only adjustments**

Keep the test assertions focused on user-visible behavior:

- shell title and nav still render
- home page card content is simplified
- node detail still exposes the current operational facts

Do not add assertions for decorative CSS classes unless necessary for behavior.

- [ ] **Step 4: Run tests to verify the failures are now meaningful**

Run: `npm test --workspace frontend -- src/App.test.ts src/views/OperationsDashboardView.test.ts src/views/NodeDetailView.test.ts`

Expected: FAIL on missing new copy/structure rather than on test harness errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.test.ts frontend/src/views/OperationsDashboardView.test.ts frontend/src/views/NodeDetailView.test.ts
git commit -m "test: define boutique redesign expectations"
```

### Task 2: Redesign the shared shell and visual system

**Files:**
- Modify: `frontend/src/App.vue`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Use the failing tests from Task 1 as the active regression**

Keep `src/App.test.ts` and the view tests as the design safety net while updating the shared shell.

- [ ] **Step 2: Run tests to verify the baseline still fails**

Run: `npm test --workspace frontend -- src/App.test.ts src/views/OperationsDashboardView.test.ts src/views/NodeDetailView.test.ts`

Expected: FAIL on missing redesigned shell and page presentation.

- [ ] **Step 3: Write minimal shell and system implementation**

Update `frontend/src/App.vue` and `frontend/src/styles.css` to establish the new visual system:

- premium titlebar composition
- stronger page frame and spacing rhythm
- boutique enterprise typography choices within the constraints of the current frontend
- richer surfaces, restrained accent palette, and subtle motion
- responsive shell behavior that still works on smaller screens

Keep routing behavior unchanged.

- [ ] **Step 4: Run tests to confirm shell-related behavior still passes or improves**

Run: `npm test --workspace frontend -- src/App.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.vue frontend/src/styles.css
git commit -m "feat: establish premium application shell"
```

### Task 3: Rebuild the home page as a calm overview

**Files:**
- Modify: `frontend/src/views/OperationsDashboardView.vue`
- Modify: `frontend/src/components/NodeStatusCard.vue`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Keep the home-page tests failing for the right reason**

Use the updated dashboard test as the active regression for:

- refined home-page framing copy
- simplified overview cards
- node name + status only

- [ ] **Step 2: Run tests to verify the home page still fails before implementation**

Run: `npm test --workspace frontend -- src/views/OperationsDashboardView.test.ts`

Expected: FAIL because the page still says `Operations Dashboard` and the card still shows metrics.

- [ ] **Step 3: Write minimal home-page implementation**

Update `frontend/src/views/OperationsDashboardView.vue` to:

- present calmer, more editorial overview copy
- keep refresh affordance if still useful, but restyle it into the new system
- make the node grid feel like a curated landing view instead of a utilitarian dashboard

Update `frontend/src/components/NodeStatusCard.vue` to:

- preserve the route link to `/nodes/:id`
- show only node identity and simple state
- remove ledger, latency, and contract-count content from the home card
- present status in a more integrated premium composition

Add only the CSS needed to support the new home-page and card layout.

- [ ] **Step 4: Run tests to verify the home page passes**

Run: `npm test --workspace frontend -- src/views/OperationsDashboardView.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/OperationsDashboardView.vue frontend/src/components/NodeStatusCard.vue frontend/src/styles.css
git commit -m "feat: redesign home page overview cards"
```

### Task 4: Reorganize the node detail page into a denser workspace

**Files:**
- Modify: `frontend/src/views/NodeDetailView.vue`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Use the node detail test as the active regression**

The detail page must still render the selected node and existing operational facts, but under a clearer layout.

- [ ] **Step 2: Run test to verify it fails before the redesign**

Run: `npm test --workspace frontend -- src/views/NodeDetailView.test.ts`

Expected: FAIL on the new grouping or copy introduced in Task 1.

- [ ] **Step 3: Write minimal node detail implementation**

Update `frontend/src/views/NodeDetailView.vue` to:

- keep the current data fetch behavior
- reorganize existing content into clearer grouped sections
- make the page feel more serious and information-dense than the home page
- preserve a route back to the overview

Add only the CSS needed for section hierarchy, panel composition, and readable detail presentation.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --workspace frontend -- src/views/NodeDetailView.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/NodeDetailView.vue frontend/src/styles.css
git commit -m "feat: redesign node detail workspace"
```

### Task 5: Run final frontend verification

**Files:**
- Verify only

- [ ] **Step 1: Run focused frontend tests**

Run: `npm test --workspace frontend -- src/App.test.ts src/views/OperationsDashboardView.test.ts src/views/NodeDetailView.test.ts`

Expected: PASS

- [ ] **Step 2: Run the frontend production build**

Run: `npm run build --workspace frontend`

Expected: PASS
