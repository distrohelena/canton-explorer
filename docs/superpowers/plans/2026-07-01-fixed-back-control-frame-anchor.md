# Fixed Back Control Frame Anchor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the circular back control visually to the left of node detail pages without letting it change the centered content width.

**Architecture:** Remove the width-reserving page rail layout and return the main page content to the normal centered flow. Re-anchor the back control with positioning relative to the app content frame, while preserving the existing arrow-only accessible link behavior and mobile fallback.

**Tech Stack:** Vue 3, Vue Router, TypeScript, Vitest, Testing Library, Vite, CSS

---

### File Structure

**Files and responsibilities:**

- `frontend/src/views/NodeDetailView.vue`
  - simplify markup so the main content no longer depends on a width-reserving rail
- `frontend/src/views/NodeUpdatesView.vue`
  - apply the same markup simplification
- `frontend/src/styles.css`
  - remove the grid-coupled layout and replace it with frame-anchored back control positioning
- `frontend/src/views/NodeDetailView.test.ts`
  - remain the regression test for the shared arrow-only back control
- `frontend/src/views/NodeUpdatesView.test.ts`
  - remain the regression test for the shared arrow-only back control

### Task 1: Keep the existing back-control tests as the regression

**Files:**
- Verify only: `frontend/src/views/NodeDetailView.test.ts`
- Verify only: `frontend/src/views/NodeUpdatesView.test.ts`

- [ ] **Step 1: Run the existing back-control tests before layout changes**

Run: `npm test --workspace frontend -- src/views/NodeDetailView.test.ts src/views/NodeUpdatesView.test.ts`

Expected: PASS

- [ ] **Step 2: Commit**

```bash
git add frontend/src/views/NodeDetailView.test.ts frontend/src/views/NodeUpdatesView.test.ts
git commit -m "test: preserve shared back control regression"
```

### Task 2: Remove the width-reserving wrapper from the views

**Files:**
- Modify: `frontend/src/views/NodeDetailView.vue`
- Modify: `frontend/src/views/NodeUpdatesView.vue`

- [ ] **Step 1: Write minimal view markup changes**

Update both views so:

- the main content returns to the normal centered flow
- the back control remains rendered on the page
- no wrapper reserves a left column width for the back button

Keep the back control markup intact enough that the existing tests should still pass.

- [ ] **Step 2: Run the view tests after the markup change**

Run: `npm test --workspace frontend -- src/views/NodeDetailView.test.ts src/views/NodeUpdatesView.test.ts`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/views/NodeDetailView.vue frontend/src/views/NodeUpdatesView.vue
git commit -m "refactor: decouple back control from content width"
```

### Task 3: Re-anchor the back control to the app content frame in CSS

**Files:**
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Use the existing tests as the behavior guardrail**

No additional layout-specific tests are needed; preserve the existing behavior while changing placement.

- [ ] **Step 2: Write minimal CSS changes**

Update styles so that:

- the page content keeps its normal centered width
- the back control is positioned against the left edge of the app content frame
- the control does not consume layout width in the middle content area
- the mobile breakpoint returns the control to normal top flow

- [ ] **Step 3: Run the affected view tests**

Run: `npm test --workspace frontend -- src/views/NodeDetailView.test.ts src/views/NodeUpdatesView.test.ts`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/styles.css
git commit -m "style: anchor back control to app frame edge"
```

### Task 4: Run final verification

**Files:**
- Verify only

- [ ] **Step 1: Run the affected frontend tests**

Run: `npm test --workspace frontend -- src/views/NodeDetailView.test.ts src/views/NodeUpdatesView.test.ts src/App.test.ts`

Expected: PASS

- [ ] **Step 2: Run the frontend production build**

Run: `npm run build --workspace frontend`

Expected: PASS
