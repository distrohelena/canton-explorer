# Titlebar Search Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the `Search by Update ID or Party ID...` textbox into the shared titlebar so it appears once across all routes.

**Architecture:** Keep the search control in the global app shell rather than any route view. Update the route views so they no longer render their own copy, then adjust shared header styles and tests to match the new ownership boundary.

**Tech Stack:** Vue 3, Vue Router, TypeScript, Vitest, Testing Library, Vite

---

### File Structure

**Files and responsibilities:**

- `frontend/src/App.vue`
  - own the shared titlebar markup, including nav links and the global search textbox
- `frontend/src/styles.css`
  - own layout and responsive styling for the header search control
- `frontend/src/views/OperationsDashboardView.vue`
  - render only the connected-nodes page content, without titlebar-owned controls
- `frontend/src/views/HomeActivityView.vue`
  - render only home-page content, without a duplicate titlebar search control
- `frontend/src/App.test.ts`
  - verify the shared app shell renders the global search textbox
- `frontend/src/views/HomeActivityView.test.ts`
  - verify the home view does not render its own duplicate search textbox
- `frontend/src/views/NodesView.test.ts`
  - verify the nodes route does not render its own duplicate search textbox

### Task 1: Move the search textbox into the shared app shell

**Files:**
- Modify: `frontend/src/App.test.ts`
- Modify: `frontend/src/App.vue`

- [ ] **Step 1: Write the failing shell test**

Update the app-shell test so it asserts:

- `⌂ Home` nav still renders
- `Nodes` nav still renders
- one textbox with placeholder `Search by Update ID or Party ID...` exists in the shared shell

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace frontend -- src/App.test.ts`

Expected: FAIL because `App.vue` does not yet render the shared titlebar search textbox.

- [ ] **Step 3: Write minimal shared-shell implementation**

Add the textbox to the titlebar in `App.vue`, keeping it adjacent to the existing navigation rather than embedding it in page content.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --workspace frontend -- src/App.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.vue frontend/src/App.test.ts
git commit -m "feat: move explorer search into shared titlebar"
```

### Task 2: Remove the page-owned search textbox from the nodes page

**Files:**
- Modify: `frontend/src/views/NodesView.test.ts`
- Modify: `frontend/src/views/OperationsDashboardView.vue`

- [ ] **Step 1: Write the failing nodes-page test**

Change the nodes view test so it asserts:

- `Connected Nodes` still renders
- node cards still render
- the page no longer owns a textbox with placeholder `Search by Update ID or Party ID...`

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace frontend -- src/views/NodesView.test.ts`

Expected: FAIL because `OperationsDashboardView.vue` still renders the page-level search input.

- [ ] **Step 3: Write minimal nodes-page implementation**

Remove the input from `OperationsDashboardView.vue` and keep only the route-specific page controls that belong to connected-node content.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --workspace frontend -- src/views/NodesView.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/OperationsDashboardView.vue frontend/src/views/NodesView.test.ts
git commit -m "refactor: remove page-owned nodes search control"
```

### Task 3: Verify home view stays free of duplicate search UI

**Files:**
- Modify: `frontend/src/views/HomeActivityView.test.ts`
- Modify: `frontend/src/views/HomeActivityView.vue` only if the test reveals duplication

- [ ] **Step 1: Write the failing or guarding home-view test**

Update the home-view test so it asserts:

- `Network Activity` still renders
- activity content still renders
- the home page does not render its own textbox with placeholder `Search by Update ID or Party ID...`

- [ ] **Step 2: Run the test to verify current behavior**

Run: `npm test --workspace frontend -- src/views/HomeActivityView.test.ts`

Expected: PASS if no duplicate textbox exists, or FAIL if the view has drifted.

- [ ] **Step 3: Write minimal implementation only if needed**

If the test fails, remove any page-owned search control from `HomeActivityView.vue`. Otherwise leave the view unchanged.

- [ ] **Step 4: Re-run the test**

Run: `npm test --workspace frontend -- src/views/HomeActivityView.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/HomeActivityView.vue frontend/src/views/HomeActivityView.test.ts
git commit -m "test: lock home view to content-only search ownership"
```

### Task 4: Adjust shared header styling for the new control

**Files:**
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Write the failing visual/layout assertions indirectly through shell tests**

Use the existing shell tests as the regression while styling the new header control. No separate CSS-only test is required.

- [ ] **Step 2: Run focused frontend tests before styling**

Run: `npm test --workspace frontend -- src/App.test.ts src/views/NodesView.test.ts src/views/HomeActivityView.test.ts`

Expected: PASS on behavior, while manual inspection may still show layout issues.

- [ ] **Step 3: Write minimal responsive styling**

Add titlebar layout rules so the brand, nav, and search textbox:

- align cleanly on desktop
- stack without overlap on smaller screens
- preserve the existing full-width header

- [ ] **Step 4: Run focused tests after styling**

Run: `npm test --workspace frontend -- src/App.test.ts src/views/NodesView.test.ts src/views/HomeActivityView.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/styles.css
git commit -m "style: fit shared search into explorer titlebar"
```

### Task 5: Run final verification

**Files:**
- Verify only

- [ ] **Step 1: Run the affected frontend tests**

Run: `npm test --workspace frontend -- src/App.test.ts src/views/HomeActivityView.test.ts src/views/NodesView.test.ts`

Expected: PASS

- [ ] **Step 2: Run the frontend API test that shares the shell context**

Run: `npm test --workspace frontend -- src/lib/api.test.ts`

Expected: PASS

- [ ] **Step 3: Run the frontend production build**

Run: `npm run build --workspace frontend`

Expected: PASS
