# Wrappable Event Data Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep long DAML type names inside the Type column instead of letting them overflow into Value.

**Architecture:** Preserve the existing compact table column proportions and change only Type-cell wrapping behavior. A regression test will load the existing long schema-derived type and verify its rendered cell uses normal whitespace and anywhere wrapping.

**Tech Stack:** Vue 3, TypeScript, Vitest, Testing Library, global CSS.

## Global Constraints

- Short types must remain in the existing compact Type column.
- Long types such as `Optional<Splice.ValidatorLicense:ValidatorLicenseMetadata>` must wrap inside Type.
- Type text must not overflow into the Value column.
- Do not change event-data values, schema inference, or table column proportions.

### Task 1: Add the regression coverage

**Files:**
- Modify: `frontend/src/views/UpdateDetailView.test.ts`

- [ ] Add a focused assertion for the existing long schema-derived type cell:

```ts
const longTypeCell = within(nestedContextTable)
  .getByText("GenMap<Party, ContractId<Splice.Amulet:ValidatorRight>>")
  .closest("td");
expect(longTypeCell).not.toBeNull();
expect(longTypeCell).toHaveClass(
  "update-detail__data-table-type--wrappable",
);
```

- [ ] Run `npm run test --workspace frontend -- src/views/UpdateDetailView.test.ts --run` and confirm it fails because Type currently uses `white-space: nowrap`.

### Task 2: Enable safe Type-cell wrapping

**Files:**
- Modify: `frontend/src/styles.css:4841-4847`

- [ ] Replace the Type-cell no-wrap rule with:

```css
.update-detail__data-table-type {
  width: 12%;
  color: var(--text-500);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}
```

- [ ] Keep the existing 12% Type-column width and all Value/Field widths unchanged.

### Task 3: Verify the frontend

**Files:** None.

- [ ] Run the focused update-detail test and confirm it passes.
- [ ] Run `npm run test --workspace frontend -- --run` and confirm the complete frontend suite passes.
- [ ] Run `npm run build --workspace frontend` and confirm TypeScript/Vite compilation succeeds.
- [ ] Run `git diff --check` for the changed files.
