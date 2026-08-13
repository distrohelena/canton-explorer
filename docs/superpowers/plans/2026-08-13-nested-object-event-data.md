# Nested Object Event Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render decoded record-valued event fields as recursive sub-tables instead of flattening their paths into labels such as `Context / Context / Open Mining Round`.

**Architecture:** Preserve record values as event-data entries, just as arrays are preserved today. Render record and list values through a shared recursive sub-table component/template: the parent row shows a summary count (`N fields` or `N items`), and a following full-width continuation row contains an indented sub-table. Nested records and lists recurse into the same layout while scalar values retain current formatting and links.

**Tech Stack:** Vue 3, TypeScript, Vitest, Testing Library, existing event-data table CSS.

## Global Constraints

- Record-valued fields must not produce flattened `Parent / Child / Field` labels.
- Record summary rows show `0 fields`, `1 field`, or `N fields`.
- Array summary rows keep `0 items`, `1 item`, or `N items`.
- Sub-tables use the existing `Field`, `Type`, and `Value` columns and 10% continuation-row indentation.
- Preserve schema-derived types and existing scalar contract/party links.

### Task 1: Add nested-record regression coverage

**Files:**
- Modify: `frontend/src/views/UpdateDetailView.test.ts`

**Interfaces:**
- Use the existing nested exercise fixture containing `context.context.validatorRights`.
- Assert rendered DOM behavior for summary rows, continuation rows, nested table names, and absence of flattened labels.

- [ ] **Step 1: Replace flattened Context assertions**

Assert that the Argument table contains a `Context` summary row with `1 field` or `1 fields` according to the implemented grammar, and no `Context / Context / Validator Rights` label.

- [ ] **Step 2: Assert recursive nested tables**

Assert that the Context sub-table contains another `Context` summary with its field count, that the nested continuation row has `colspan="3"`, and that `Validator Rights` appears as a scalar field in the deepest sub-table with its existing `GenMap<...>` type.

- [ ] **Step 3: Run the focused test and verify failure**

Run:

```bash
npm test -- --run src/views/UpdateDetailView.test.ts
```

Expected: FAIL because the current renderer flattens record paths into `Context / Context / Validator Rights`.

### Task 2: Preserve records and render recursive sub-tables

**Files:**
- Modify: `frontend/src/views/UpdateDetailView.vue`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Extend `RenderableValue` to include decoded record values.
- Keep `flattenDecodedValue` returning event entries, but return record values as one entry instead of expanding their fields into dotted labels.
- Reuse the existing `isListValue`, `getListItemEntries`, and nested table value/link behavior while adding record helpers.

- [ ] **Step 1: Preserve record values in `flattenDecodedValue`**

For a decoded record, return `[label, value, optionalDepth, schemaNode]` as one entry. Keep the root record conversion in `getRecordEntries` and branch conversion in `getExerciseBranchEntries` mapping an empty label to `value` where necessary.

- [ ] **Step 2: Add record summary and child-entry helpers**

Add helpers that identify record values, count record fields, and flatten only the direct fields of a record for its sub-table. Each child field receives the matching schema field type and remains rooted at its direct field name.

- [ ] **Step 3: Render records and lists through continuation rows**

Use a shared recursive value layout in the event-data table. Scalar values stay in the parent row. Record/list values show a count in the parent Value cell and render their child table in a following `colspan="3"` row with the existing 10% indentation. Nested records/lists recurse until scalar fields.

- [ ] **Step 4: Add/adjust nested table styles**

Reuse the current nested table style and add only record-specific summary/continuation styling if required. Keep table widths, indentation, borders, and overflow consistent for both records and arrays.

- [ ] **Step 5: Run the focused test**

Run `npm test -- --run src/views/UpdateDetailView.test.ts`; expect all UpdateDetailView tests to pass.

### Task 3: Verify the frontend change

**Files:**
- No additional source files.

- [ ] **Step 1: Run the full frontend suite**

Run `npm test -- --run` from `frontend/`; expect all test files and tests to pass.

- [ ] **Step 2: Build the frontend**

Run `npm run build --workspace frontend` from the repository root; expect `vue-tsc` and Vite to exit successfully.

- [ ] **Step 3: Check the scoped diff**

Run `git diff --check -- frontend/src/views/UpdateDetailView.vue frontend/src/views/UpdateDetailView.test.ts frontend/src/styles.css`; expect no whitespace errors in the files changed for this feature.
