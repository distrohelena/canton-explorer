# Nested Array Event Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render decoded list fields as one outer event-data row containing a grouped nested table for each array item.

**Architecture:** Preserve list values at the event-data flattening boundary instead of expanding their items into dotted array-index labels. Render preserved lists in the existing Value cell using a nested table with item group headers (`Field 1`, `Field 2`, etc.) and schema-aware Field/Type/Value rows. Scalar and record fields that are not lists keep their current rendering.

**Tech Stack:** Vue 3, TypeScript, Vitest, Testing Library, existing event-data table CSS.

## Global Constraints

- Keep the outer event-data table columns as `Field`, `Type`, and `Value`.
- Preserve schema-derived DAML types for list fields and their nested item fields.
- Do not change backend response shapes or flatten scalar fields differently.
- Empty lists remain represented in the outer row without fabricated array items.

### Task 1: Add the nested array rendering regression test

**Files:**
- Modify: `frontend/src/views/UpdateDetailView.test.ts`

**Interfaces:**
- Use the existing update-detail fixture and `UpdateDetailView` rendering harness.
- Assert user-visible table structure and values, not Vue implementation details.

- [x] **Step 1: Add a decoded list field to the fixture**

Add an `inputs` record field containing two record items with `tag` and `value` fields, plus a list schema whose item type is the corresponding record. Keep the existing flattened-value assertions for unrelated fields.

- [x] **Step 2: Replace the flattened list assertions**

Assert that the outer table contains one `Inputs` field and no `Inputs[1] / Tag` label. Assert the nested table exposes `Field 1`, `Field 2`, `Tag`, `Value`, both input tags, and both input values.

- [x] **Step 3: Run the focused test and verify the expected failure**

Run:

```bash
npm test -- --run src/views/UpdateDetailView.test.ts
```

Expected: FAIL because the current renderer expands list items into `Inputs[1] / ...` rows and does not render a nested table.

### Task 2: Preserve lists and render them as nested tables

**Files:**
- Modify: `frontend/src/views/UpdateDetailView.vue`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Extend the event-data renderable value type to carry decoded list values.
- Keep `flattenDecodedValue` returning `EventDataEntry[]`; a list field returns one entry rooted at its field label.
- Add a nested list value renderer in the existing event-data table cell, using the item schema when recursively flattening each item.

- [x] **Step 1: Preserve list values in `flattenDecodedValue`**

For a decoded list, return one `[label, listValue, optionalDepth, schemaNode]` entry. Keep the existing empty-list handling compatible with the current `n/a` behavior and pass the list item schema to nested item flattening.

- [x] **Step 2: Add nested list table markup**

When a Value cell contains a list, render a nested table with the same three columns. Insert a full-width item header row for each item (`Field 1`, `Field 2`, ...), then render that item’s flattened fields without an array-index prefix. Reuse the existing contract and party link behavior for nested scalar values.

- [x] **Step 3: Add focused nested-table styles**

Add only the styles needed for the nested table and item header rows, reusing existing colors, borders, spacing, and horizontal overflow behavior. Do not alter the outer table widths.

- [x] **Step 4: Run focused tests and fix only implementation failures**

Run:

```bash
npm test -- --run src/views/UpdateDetailView.test.ts
```

Expected: all UpdateDetailView tests pass, including the nested array regression.

### Task 3: Verify the frontend change

**Files:**
- No additional source files.

- [x] **Step 1: Run the full frontend suite**

Run `npm test -- --run` from `frontend/`; expect all test files and tests to pass.

- [x] **Step 2: Build the frontend**

Run `npm run build --workspace frontend` from the repository root; expect `vue-tsc` and Vite to exit successfully.

- [x] **Step 3: Check the scoped diff**

Run `git diff --check -- frontend/src/views/UpdateDetailView.vue frontend/src/views/UpdateDetailView.test.ts frontend/src/styles.css`; expect no whitespace errors in the files changed for this feature.
