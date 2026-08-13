# Separate Exercise Data Tables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Render exercise arguments and results in separate labeled tables without including `Argument /` or `Result /` in field labels.

**Architecture:** Keep the existing flattened event-data entry format and schema-aware type handling. Change the exercise-data helper to return an array of table models, each rooted at an empty label, and render those models with the existing table markup.

**Tech Stack:** Vue 3, TypeScript, Vitest, Testing Library.

## Global Constraints

- Preserve the existing Field, Type, Value columns and schema-aware DAML type rendering.
- Preserve create-data rendering as one `Create Data` table.
- Keep invalid and unavailable decode states scoped to their corresponding Argument or Result table.

### Task 1: Split exercise table models

**Files:**
- Modify: `frontend/src/views/UpdateDetailView.vue`
- Test: `frontend/src/views/UpdateDetailView.test.ts`

**Interfaces:**
- Change `getExerciseEntries` to return `EventDataTableModel[]`, using `Argument` and `Result` labels.
- Change `getEventDataTables` to return all create/exercise tables for an event.

- [x] **Step 1: Add failing assertions**

Update the nested exercise test to expect headings `Argument` and `Result`, field labels without their root prefixes, and no `Exercise Data` heading.

- [x] **Step 2: Run the focused test**

Run: `npm test -- --run src/views/UpdateDetailView.test.ts`

Expected: FAIL because the current view renders one `Exercise Data` table with `Argument /` and `Result /` labels.

- [x] **Step 3: Implement the table-model change**

Return separate non-empty models:

```ts
return [
  { label: "Argument", entries: getBranchEntries(state.argument, "") },
  { label: "Result", entries: getBranchEntries(state.result, "") },
].filter((table) => table.entries.length > 0);
```

Render each returned model using the existing table markup and unique heading/table IDs.

- [x] **Step 4: Run focused and full frontend tests**

Run: `npm test -- --run src/views/UpdateDetailView.test.ts`

Then run: `npm test -- --run`

Expected: all UpdateDetailView tests and all frontend tests pass.

- [x] **Step 5: Build the frontend**

Run: `npm run build --workspace frontend`

Expected: TypeScript checking and Vite build succeed.
