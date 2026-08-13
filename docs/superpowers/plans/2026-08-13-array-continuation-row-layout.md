# Array Continuation Row Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move decoded array details out of the parent Value cell into a full-width continuation row beneath the array field.

**Architecture:** Keep the parent array field row as a compact summary with its schema type and an item count. Render the nested array table in a following `<tr>` with `colspan="3"`, indented by 10% of the parent table width and expanded through the table’s right edge. Preserve the existing nested item grouping and scalar link behavior.

**Tech Stack:** Vue 3, TypeScript, Vitest, Testing Library, existing event-data table CSS.

## Global Constraints

- The array summary must show the field name, its DAML type, and a count such as `2 items`.
- The nested array table must begin on the row below the summary and span the full parent table width after a 10% left indent.
- Keep nested `Field 1`, `Field 2`, `Field`, `Type`, and `Value` content unchanged.
- Do not change backend response shapes or scalar event-data rendering.

### Task 1: Add layout regression assertions

**Files:**
- Modify: `frontend/src/views/UpdateDetailView.test.ts`

**Interfaces:**
- Use the existing grouped-array fixture and `UpdateDetailView` test harness.
- Assert the parent summary row, continuation row, `colspan`, and nested table placement through rendered DOM behavior.

- [x] **Step 1: Require the compact array summary**

Assert that the Argument table contains an `Inputs` row with `2 items` and that the nested table is not inside that summary row’s Value cell.

- [x] **Step 2: Require the full-width continuation row**

Assert that the nested `Inputs` table is inside a following row with `colspan="3"` and the existing `Field 1`/`Field 2` content remains present.

- [x] **Step 3: Run the focused test and verify failure**

Run:

```bash
npm test -- --run src/views/UpdateDetailView.test.ts
```

Expected: FAIL because the current nested table is rendered inside the parent Value cell and there is no continuation row or count summary.

### Task 2: Render arrays in a full-width continuation row

**Files:**
- Modify: `frontend/src/views/UpdateDetailView.vue`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Keep `isListValue`, `getListItemEntries`, and the existing nested table content.
- Change the event-data table loop to render a summary row and, for list values, a separate continuation row.

- [x] **Step 1: Move nested markup below the array row**

Wrap each outer entry in a Vue `<template>`. Render the normal field/type/value row first. For a list value, render the nested table in a second `<tr>` whose single cell has `colspan="3"`.

- [x] **Step 2: Show the item count**

Render `0 items`, `1 item`, or `N items` in the summary Value cell instead of the generic `List` text.

- [x] **Step 3: Apply the 10% continuation layout**

Style the continuation cell so the nested table has `margin-left: 10%` and `width: 90%`, while retaining horizontal overflow and existing nested table borders.

- [x] **Step 4: Run the focused test**

Run `npm test -- --run src/views/UpdateDetailView.test.ts`; expect all UpdateDetailView tests to pass.

### Task 3: Verify the frontend change

**Files:**
- No additional source files.

- [x] **Step 1: Run the full frontend suite**

Run `npm test -- --run` from `frontend/`; expect all test files and tests to pass.

- [x] **Step 2: Build the frontend**

Run `npm run build --workspace frontend` from the repository root; expect `vue-tsc` and Vite to exit successfully.

- [x] **Step 3: Check the scoped diff**

Run `git diff --check -- frontend/src/views/UpdateDetailView.vue frontend/src/views/UpdateDetailView.test.ts frontend/src/styles.css`; expect no whitespace errors in the files changed for this layout refinement.
