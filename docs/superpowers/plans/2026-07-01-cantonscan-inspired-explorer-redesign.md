# Cantonscan-Inspired Explorer Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the current frontend redesign into a lighter, production-style explorer interface closer to CantonScan in visual language while preserving the existing routes and data flow.

**Architecture:** Keep the current route split and simplified home/detail responsibilities, but replace the decorative dark boutique system with a cleaner explorer shell, practical cards, and lighter neutral surfaces. The implementation should start with test expectations, then reset the shared shell and CSS tokens, then restyle the home and node detail pages against that simpler system.

**Tech Stack:** Vue 3, Vue Router, Vitest, Testing Library, Vite, CSS

---

### File Structure

**Files and responsibilities:**

- `frontend/src/App.vue`
  - compact explorer-style header and shared layout shell
- `frontend/src/styles.css`
  - reset from dark boutique system to lighter explorer tokens, spacing, borders, shadows, and component styling
- `frontend/src/views/OperationsDashboardView.vue`
  - compact connected-nodes overview copy and layout
- `frontend/src/components/NodeStatusCard.vue`
  - simplified explorer tile showing node name and status only
- `frontend/src/views/NodeDetailView.vue`
  - grouped explorer-style node detail sections using existing data
- `frontend/src/App.test.ts`
  - shared shell navigation assertions
- `frontend/src/views/OperationsDashboardView.test.ts`
  - connected-nodes overview assertions
- `frontend/src/views/NodeDetailView.test.ts`
  - grouped detail-section assertions

### Task 1: Reset the tests to the explorer-style UI expectations

**Files:**
- Modify: `frontend/src/App.test.ts`
- Modify: `frontend/src/views/OperationsDashboardView.test.ts`
- Modify: `frontend/src/views/NodeDetailView.test.ts`

- [ ] **Step 1: Write the failing explorer-style expectations**

Adjust the tests so they express the new visual and structural intent:

- `App.test.ts`
  - keep `Dashboard` and `Current Node` behavior assertions
  - keep the app title assertion, but avoid depending on decorative subtitle copy
- `OperationsDashboardView.test.ts`
  - assert compact overview content such as `Connected Nodes`
  - assert functional subtext if retained
  - assert node name and status are present
  - assert dense home-page metrics are absent
- `NodeDetailView.test.ts`
  - assert grouped practical section headings remain present
  - assert the existing operational facts still render inside the new structure

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --workspace frontend -- src/App.test.ts src/views/OperationsDashboardView.test.ts src/views/NodeDetailView.test.ts`

Expected: FAIL because the current implementation still reflects the previous boutique redesign.

- [ ] **Step 3: Tighten the tests to behavior, not decoration**

Avoid asserting visual-only implementation details such as exact CSS class names or color-dependent markup. Keep tests centered on user-visible structure and information.

- [ ] **Step 4: Run tests again to confirm the failures are meaningful**

Run: `npm test --workspace frontend -- src/App.test.ts src/views/OperationsDashboardView.test.ts src/views/NodeDetailView.test.ts`

Expected: FAIL on outdated shell/page structure rather than on test harness issues.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.test.ts frontend/src/views/OperationsDashboardView.test.ts frontend/src/views/NodeDetailView.test.ts
git commit -m "test: redefine explorer redesign expectations"
```

### Task 2: Replace the shared shell and global visual system

**Files:**
- Modify: `frontend/src/App.vue`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Use the failing shell expectations as the active regression**

Let the `App.test.ts` assertions guard routing behavior while the shell is visually reset.

- [ ] **Step 2: Run shell test to verify the current version is still the wrong baseline**

Run: `npm test --workspace frontend -- src/App.test.ts`

Expected: PASS or partial PASS on behavior, but the implementation is still visually wrong for the spec; use it as a regression guard while changing the shell.

- [ ] **Step 3: Write minimal explorer-shell implementation**

Update `frontend/src/App.vue` and `frontend/src/styles.css` to:

- remove the current premium hero framing and serif-heavy treatment
- use a clean sans-serif product stack only
- switch to a lighter neutral background and card system
- build a compact explorer-style top bar and centered content container
- preserve navigation behavior and route awareness

Do not add search, new routes, or additional data.

- [ ] **Step 4: Run the shell test to verify behavior still passes**

Run: `npm test --workspace frontend -- src/App.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.vue frontend/src/styles.css
git commit -m "feat: replace shell with explorer-style chrome"
```

### Task 3: Restyle the home page into a compact connected-nodes overview

**Files:**
- Modify: `frontend/src/views/OperationsDashboardView.vue`
- Modify: `frontend/src/components/NodeStatusCard.vue`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Keep the dashboard test as the active home-page regression**

The dashboard test should enforce:

- `Connected Nodes` overview framing
- node name + status only
- no ledger/latency/contracts text on the home page

- [ ] **Step 2: Run the dashboard test to verify the current version still fails**

Run: `npm test --workspace frontend -- src/views/OperationsDashboardView.test.ts`

Expected: FAIL because the current page still carries the previous stylized treatment or outdated card structure.

- [ ] **Step 3: Write minimal home-page implementation**

Update `frontend/src/views/OperationsDashboardView.vue` to:

- use compact explorer-style heading and subtext
- keep refresh only if it still improves utility
- reduce the hero feel into a practical page header

Update `frontend/src/components/NodeStatusCard.vue` to:

- keep the route link to `/nodes/:id`
- display only node name and status
- use a cleaner, more conventional explorer tile treatment

Add only the CSS needed for lighter cards, tighter spacing, and clearer clickable state.

- [ ] **Step 4: Run the dashboard test to verify it passes**

Run: `npm test --workspace frontend -- src/views/OperationsDashboardView.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/OperationsDashboardView.vue frontend/src/components/NodeStatusCard.vue frontend/src/styles.css
git commit -m "feat: restyle connected nodes overview"
```

### Task 4: Restyle the node detail page into a practical explorer workspace

**Files:**
- Modify: `frontend/src/views/NodeDetailView.vue`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Use the node detail test as the active regression**

The page should still render:

- selected node title
- grouped practical sections
- existing service and ledger facts

- [ ] **Step 2: Run the node detail test to verify the current implementation still needs adjustment**

Run: `npm test --workspace frontend -- src/views/NodeDetailView.test.ts`

Expected: FAIL or be visually incorrect against the spec while still serving as a structural guard.

- [ ] **Step 3: Write minimal node detail implementation**

Update `frontend/src/views/NodeDetailView.vue` and `frontend/src/styles.css` to:

- keep the grouped section structure
- remove boutique/panel styling cues
- adopt lighter explorer-style cards, headings, and metadata rows
- keep the back link simple and practical

Do not change the underlying fetched data or add new fields.

- [ ] **Step 4: Run the node detail test to verify it passes**

Run: `npm test --workspace frontend -- src/views/NodeDetailView.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/NodeDetailView.vue frontend/src/styles.css
git commit -m "feat: restyle node detail explorer workspace"
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
