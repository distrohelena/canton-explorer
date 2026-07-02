# Index Search Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a visual-only explorer-style search textbox to the index page header with the placeholder `Search by Update ID or Party ID...`.

**Architecture:** Keep the change local to the index page and its existing styles. Add the rendered textbox in the home-page header beside the refresh button, update the dashboard test first, and style the control so it fits the current explorer shell without adding any behavior.

**Tech Stack:** Vue 3, Vitest, Testing Library, CSS

---

### File Structure

**Files and responsibilities:**

- `frontend/src/views/OperationsDashboardView.vue`
  - render the visual-only search control in the index-page header
- `frontend/src/views/OperationsDashboardView.test.ts`
  - assert the textbox and placeholder are present
- `frontend/src/styles.css`
  - style the search control and responsive header layout

### Task 1: Add the visual-only index search control

**Files:**
- Modify: `frontend/src/views/OperationsDashboardView.test.ts`
- Modify: `frontend/src/views/OperationsDashboardView.vue`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Write the failing test**

Update `frontend/src/views/OperationsDashboardView.test.ts` to assert:

- a textbox is rendered on the page
- its placeholder is exactly `Search by Update ID or Party ID...`

Keep the existing overview assertions intact.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace frontend -- src/views/OperationsDashboardView.test.ts`

Expected: FAIL because the textbox does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Update `frontend/src/views/OperationsDashboardView.vue` to add:

- a visual-only search input in the right side of the header
- no `v-model`, submit, filtering, or navigation behavior

Update `frontend/src/styles.css` to:

- align the search field with the refresh button
- keep the control practical and explorer-like
- preserve tidy stacking on smaller screens

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --workspace frontend -- src/views/OperationsDashboardView.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/OperationsDashboardView.test.ts frontend/src/views/OperationsDashboardView.vue frontend/src/styles.css
git commit -m "feat: add index page search control"
```

### Task 2: Run final frontend verification

**Files:**
- Verify only

- [ ] **Step 1: Run focused frontend tests**

Run: `npm test --workspace frontend -- src/App.test.ts src/views/OperationsDashboardView.test.ts src/views/NodeDetailView.test.ts`

Expected: PASS

- [ ] **Step 2: Run the frontend production build**

Run: `npm run build --workspace frontend`

Expected: PASS
