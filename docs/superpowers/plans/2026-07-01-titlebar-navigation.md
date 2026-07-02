# Titlebar Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent titlebar with route-aware buttons for the existing dashboard and current-node routes.

**Architecture:** Keep the titlebar in `App.vue` so it wraps both existing routes through `RouterView`. Use Vue Router route state to drive button targets and disabled state, and cover the shared shell behavior with focused frontend tests.

**Tech Stack:** Vue 3, Vue Router, Vitest, Testing Library, Vite

---

### Task 1: Add the route-aware titlebar test

**Files:**
- Modify: `frontend/src/App.test.ts`

- [ ] **Step 1: Write the failing tests**

Add tests that render the app shell with router state and assert:

- `Dashboard` button is rendered
- `Current Node` button is rendered
- `Current Node` is disabled on `/`
- `Current Node` is enabled on `/nodes/:id`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace frontend -- src/App.test.ts`
Expected: FAIL because the titlebar buttons do not exist yet

- [ ] **Step 3: Write minimal implementation**

Update the app shell test setup to use the real router or route mocks needed to exercise both route states.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --workspace frontend -- src/App.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.test.ts
git commit -m "test: add titlebar navigation coverage"
```

### Task 2: Implement the shared titlebar

**Files:**
- Modify: `frontend/src/App.vue`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Write the failing implementation expectation**

Use the failing test from Task 1 as the active regression.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace frontend -- src/App.test.ts`
Expected: FAIL on missing or incorrect titlebar navigation

- [ ] **Step 3: Write minimal implementation**

Add a small titlebar above `RouterView` with:

- app title
- `Dashboard` router button pointing to `/`
- `Current Node` router button pointing to the active node route
- disabled `Current Node` state when no node id exists

Add only the CSS needed to lay out and style the titlebar consistently with the current app.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --workspace frontend -- src/App.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.vue frontend/src/styles.css
git commit -m "feat: add titlebar navigation"
```

### Task 3: Run final frontend verification

**Files:**
- Verify only

- [ ] **Step 1: Run focused frontend tests**

Run: `npm test --workspace frontend -- src/App.test.ts src/views/OperationsDashboardView.test.ts src/views/NodeDetailView.test.ts`
Expected: PASS

- [ ] **Step 2: Run production build**

Run: `npm run build --workspace frontend`
Expected: PASS
