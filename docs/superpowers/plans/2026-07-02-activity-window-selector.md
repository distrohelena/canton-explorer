# Activity Window Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shared `1`, `7`, and `30` day activity-window buttons beneath the home activity graph area and reload the activity history data for the selected window.

**Architecture:** Extend the activity-history API path to accept a window selection, keep the response shape stable, and thread that selection through the existing frontend activity-history composable. The home activity view renders a shared segmented control that updates the selected window and rerenders all node graphs from the refreshed dataset.

**Tech Stack:** NestJS, TypeScript, Vue 3, composables, Vitest, Jest

---

## File Map

- Modify: `backend/src/domain/node.types.ts`
  - Add any shared activity-window typing only if needed.
- Modify: `backend/src/api/nodes.controller.ts`
  - Accept a window selector for the activity-history route.
- Modify: `backend/src/cache/node-cache.service.ts`
  - Support reading cached samples for the selected window.
- Modify: `backend/test/api/nodes.controller.spec.ts`
  - Add controller tests for windowed activity-history requests.
- Modify: `frontend/src/lib/api.ts`
  - Accept a selected window for the activity-history request.
- Modify: `frontend/src/lib/api.test.ts`
  - Verify the selected window is sent correctly.
- Modify: `frontend/src/composables/useActivityHistory.ts`
  - Track the selected window and refetch when it changes.
- Modify: `frontend/src/views/HomeActivityView.vue`
  - Render the `1 / 7 / 30` selector beneath the graph area and wire it to the composable.
- Modify: `frontend/src/views/HomeActivityView.test.ts`
  - Verify selector rendering, active state, and refetch behavior.
- Modify: `frontend/src/styles.css`
  - Add compact segmented-control styles beneath the graph area.

### Task 1: Define the Windowed Activity API Contract

**Files:**
- Modify: `backend/test/api/nodes.controller.spec.ts`
- Modify: `frontend/src/lib/api.test.ts`

- [ ] **Step 1: Write the failing controller and API tests**

Add tests that expect:
- the activity-history endpoint to accept a selected window
- the frontend activity-history API helper to include the selected window in the request

- [ ] **Step 2: Run the focused backend and frontend tests to verify failure**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/api/nodes.controller.spec.ts`

Run: `rtk npm test --workspace frontend -- src/lib/api.test.ts`

Expected: FAIL because the route/helper do not yet carry a selectable window

- [ ] **Step 3: Implement the minimal API contract updates**

Update:
- controller request handling for the window selector
- frontend activity-history API helper signature and request path

- [ ] **Step 4: Re-run the focused tests**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/api/nodes.controller.spec.ts`

Run: `rtk npm test --workspace frontend -- src/lib/api.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/api/nodes.controller.ts backend/test/api/nodes.controller.spec.ts frontend/src/lib/api.ts frontend/src/lib/api.test.ts
git commit -m "feat: add activity history window selection api"
```

### Task 2: Support Selected Windows in Cached Activity History

**Files:**
- Modify: `backend/src/cache/node-cache.service.ts`
- Test: `backend/test/api/nodes.controller.spec.ts`

- [ ] **Step 1: Write the failing backend behavior test**

Add or extend a test so the selected window changes the activity-history slice that is returned and the reported `windowMinutes` matches the requested preset.

- [ ] **Step 2: Run the focused backend test to verify failure**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/api/nodes.controller.spec.ts`
Expected: FAIL until the cache/history path honors the selected window

- [ ] **Step 3: Implement minimal cache/history window support**

Update the activity-history read path so:
- `1`, `7`, and `30` map to day windows
- the returned sample slice and `windowMinutes` reflect the selection
- unsupported values fall back safely

- [ ] **Step 4: Re-run the focused backend test**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/api/nodes.controller.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/cache/node-cache.service.ts backend/test/api/nodes.controller.spec.ts
git commit -m "feat: support selectable activity history windows"
```

### Task 3: Thread Window Selection Through the Frontend Composable

**Files:**
- Modify: `frontend/src/composables/useActivityHistory.ts`
- Test: `frontend/src/views/HomeActivityView.test.ts`

- [ ] **Step 1: Write the failing home activity interaction test**

Add a test that expects:
- buttons `1`, `7`, and `30` to exist
- one button to be active
- clicking another button to trigger a refetch using that window

- [ ] **Step 2: Run the home activity test to verify failure**

Run: `rtk npm test --workspace frontend -- src/views/HomeActivityView.test.ts`
Expected: FAIL because no selector exists and no window state is tracked

- [ ] **Step 3: Implement minimal composable window state**

Update `useActivityHistory()` so it:
- tracks the selected day window
- exposes a setter/select handler
- refetches when the window changes

- [ ] **Step 4: Re-run the home activity test**

Run: `rtk npm test --workspace frontend -- src/views/HomeActivityView.test.ts`
Expected: may still FAIL on missing UI, but the composable path should be in place

- [ ] **Step 5: Commit**

```bash
git add frontend/src/composables/useActivityHistory.ts frontend/src/views/HomeActivityView.test.ts
git commit -m "feat: track selected activity history window"
```

### Task 4: Render the `1 / 7 / 30` Selector Beneath the Graph Area

**Files:**
- Modify: `frontend/src/views/HomeActivityView.vue`
- Modify: `frontend/src/styles.css`
- Test: `frontend/src/views/HomeActivityView.test.ts`

- [ ] **Step 1: Implement the minimal selector UI**

Render:
- a compact control beneath the graph area
- buttons `1`, `7`, `30`
- active-state styling for the selected button

- [ ] **Step 2: Wire the buttons to the composable**

Ensure clicking a button updates the selected window and reloads the activity cards.

- [ ] **Step 3: Add the matching styles**

Style the selector as a compact segmented control that fits the explorer UI without competing with the graph cards.

- [ ] **Step 4: Re-run the home activity test**

Run: `rtk npm test --workspace frontend -- src/views/HomeActivityView.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/HomeActivityView.vue frontend/src/views/HomeActivityView.test.ts frontend/src/styles.css
git commit -m "feat: add activity window selector"
```

### Task 5: Final Verification

**Files:**
- Verify: `backend/src/api/nodes.controller.ts`
- Verify: `backend/src/cache/node-cache.service.ts`
- Verify: `backend/test/api/nodes.controller.spec.ts`
- Verify: `frontend/src/lib/api.ts`
- Verify: `frontend/src/lib/api.test.ts`
- Verify: `frontend/src/composables/useActivityHistory.ts`
- Verify: `frontend/src/views/HomeActivityView.vue`
- Verify: `frontend/src/views/HomeActivityView.test.ts`
- Verify: `frontend/src/styles.css`

- [ ] **Step 1: Run the touched backend tests**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/api/nodes.controller.spec.ts`
Expected: PASS

- [ ] **Step 2: Run the touched frontend tests**

Run: `rtk npm test --workspace frontend -- src/lib/api.test.ts src/App.test.ts src/views/HomeActivityView.test.ts`
Expected: PASS

- [ ] **Step 3: Run the frontend build**

Run: `rtk npm run build --workspace frontend`
Expected: PASS

- [ ] **Step 4: Run the backend build**

Run: `rtk npm run build --workspace backend`
Expected: PASS

- [ ] **Step 5: Inspect final git state**

Run: `rtk git status --short`
Expected: only intended files changed, plus any known unrelated existing worktree changes
