# Advanced Search Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `Advanced Search` button to the shared titlebar that animates open and closed a placeholder `Advanced Search Parameters` box.

**Architecture:** Extend the shared `App.vue` titlebar shell with a local toggle state, a search-controls cluster, and a transition-wrapped panel rendered directly under the existing search area. Keep the panel placeholder-only for now, with no changes to routing or search execution.

**Tech Stack:** Vue 3, Vue Router, TypeScript, Vitest, CSS transitions

---

### Task 1: Add regression test for the advanced search toggle

**Files:**
- Modify: `frontend/src/App.test.ts`

- [ ] **Step 1: Write the failing test**

Add a test that renders the shell, verifies `Advanced Search` exists, confirms the parameters box is hidden by default, then clicks the button and expects `Advanced Search Parameters` to appear.

- [ ] **Step 2: Run the test to verify it fails**

Run: `rtk npm test -- --run src/App.test.ts`
Expected: FAIL because the shared shell has no advanced-search button or panel.

### Task 2: Implement the shared titlebar toggle and animated panel

**Files:**
- Modify: `frontend/src/App.vue`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Write the minimal implementation**

Add:
- local toggle state in `App.vue`
- `Advanced Search` button beside the current search box
- transition-wrapped `Advanced Search Parameters` panel
- lightweight placeholder-only fields
- CSS for layout and expand/collapse animation

- [ ] **Step 2: Run the test to verify it passes**

Run: `rtk npm test -- --run src/App.test.ts`
Expected: PASS

### Task 3: Verify the shared shell slice

**Files:**
- Modify: `docs/superpowers/plans/2026-07-03-advanced-search-toggle.md`

- [ ] **Step 1: Run targeted frontend verification**

Run: `rtk npm test -- --run src/App.test.ts`
Expected: PASS

- [ ] **Step 2: Run frontend build**

Run: `rtk npm run build`
Workdir: `frontend`
Expected: PASS
