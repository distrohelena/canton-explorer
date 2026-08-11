# Explore Menu Hover Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open the shared Explore navigation menu on pointer hover while retaining click support for touch and keyboard users.

**Architecture:** Reuse the existing `exploreMenuOpen` Vue state and outside-click/route-close behavior. Add pointer-enter and pointer-leave handlers to the `.app-explore` wrapper so the trigger and submenu share one hover region; do not replace the menu with CSS-only visibility rules.

**Tech Stack:** Vue 3 `<script setup>`, Vue Router, Testing Library for Vue, Vitest, TypeScript.

---

### Task 1: Add the hover regression test

**Files:**
- Modify: `frontend/src/App.test.ts` near the existing Explore menu tests

- [ ] **Step 1: Write the failing test**

Add a test that renders the home route, obtains `.app-explore`, dispatches `pointerEnter`, asserts the Settings submenu link is present and the trigger has `aria-expanded="true"`, then dispatches `pointerLeave` and asserts the submenu link is absent and `aria-expanded="false"`.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `rtk npm run test --workspace frontend -- src/App.test.ts --run`

Expected: the new hover test fails because the wrapper does not yet handle pointer events.

### Task 2: Implement pointer hover behavior

**Files:**
- Modify: `frontend/src/App.vue` on the `.app-explore` wrapper

- [ ] **Step 1: Add pointer-enter and pointer-leave bindings**

Bind `pointerenter` to open the existing menu state and `pointerleave` to close it. Keep the existing trigger click handler and all current close handlers unchanged.

- [ ] **Step 2: Run the focused test to verify it passes**

Run: `rtk npm run test --workspace frontend -- src/App.test.ts --run`

Expected: all App tests pass, including the hover regression test.

### Task 3: Verify and commit

**Files:**
- Test: `frontend/src/App.test.ts`
- Implementation: `frontend/src/App.vue`

- [ ] **Step 1: Run the relevant frontend checks**

Run: `rtk npm run test --workspace frontend -- src/App.test.ts --run`

Expected: zero failed tests.

- [ ] **Step 2: Check the diff**

Run: `rtk git diff --check`

Expected: no whitespace errors.

- [ ] **Step 3: Commit the implementation**

Run: `rtk git add frontend/src/App.vue frontend/src/App.test.ts && rtk git commit -m "feat: open explore menu on hover"`

Expected: a new commit containing only the hover behavior and its regression test.
