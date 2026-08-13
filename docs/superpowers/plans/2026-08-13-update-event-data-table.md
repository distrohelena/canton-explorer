# Update Event Data Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace stacked Create Data and Exercise Data blocks on update detail event cards with a compact, accessible three-column table.

**Architecture:** Keep the existing event normalization and value-link helpers. Add a small view-level selector that chooses the event's one non-empty payload, render that payload as a native `Field`/`Type`/`Value` table labeled by a deterministic event-index heading, and add dedicated table styles that mirror the Updates table tokens without reusing its unrelated column layout. Infer DAML type labels from the normalized value and existing field semantics, preserving Optional depth so populated values render as `Optional<T>`.

**Tech Stack:** Vue 3 `<script setup>`, TypeScript, native HTML table semantics, Vitest, Testing Library, CSS.

---

## File map

- Modify `frontend/src/views/UpdateDetailView.vue`: select the single event data payload and render its fields and values as an accessible table.
- Modify `frontend/src/views/UpdateDetailView.test.ts`: assert table headings, field/value rows, payload labels, and preserved contract/party links.
- Modify `frontend/src/styles.css`: style the event data table with Updates-like header/row tokens and a `560px` minimum-width overflow wrapper.
- Modify `frontend/src/styles.test.js`: protect the table structure, spacing, and responsive overflow rules.
- Reference `docs/superpowers/specs/2026-08-13-update-event-data-table-design.md` for the approved behavior.

### Task 1: Add failing rendering tests

**Files:**

- Test: `frontend/src/views/UpdateDetailView.test.ts`

- [ ] **Step 1: Assert the Create Data table structure**

Import `within` from Testing Library and extend the existing update-detail fixture with a party-valued create-data field such as `recipientParty: "Alice"`. Find the table by accessible name with `screen.getByRole("table", { name: "Create Data" })`, assert its `Field`, `Type`, and `Value` column headers, and assert the flattened `Reward Round`, `Coupon Contract Id`, and party rows within that table. Assert representative DAML types (`Int64`, `ContractId`, `Party`, and `Optional<T>`). Assert the `00coupon` contract value remains linked to `/nodes/participant-1/contracts/00coupon` and, scoped within the Create Data table, the party value is a link to `/parties/Alice`.

Also assert the table's `aria-labelledby` points to a visible heading with the deterministic id `update-detail-event-data-heading-0`, and assert that the legacy `.update-detail__event-item--exercise-data` nodes are absent.

- [ ] **Step 2: Assert the Exercise Data table structure**

In the same rendered fixture, assert a second table named `Exercise Data`, its `Field`/`Type`/`Value` headers, and rows for `Result / Reward Amount`, `Result / Reward Round`, and `Result / Coupon Contract Id`. Assert the amount row displays `Numeric`, and its table label points to `update-detail-event-data-heading-1`.

- [ ] **Step 3: Add selector edge-case tests**

Add focused view tests using small mocked responses: when both payloads are populated, assert exactly one table is rendered and it is labeled `Create Data`; when neither payload has entries, assert no data table or data heading is rendered.

- [ ] **Step 4: Run the focused test and verify it fails for the old block markup**

Run:

```bash
VITE_API_BASE_URL=http://localhost:4600/api npm run test --workspace frontend -- --run src/views/UpdateDetailView.test.ts --reporter=dot
```

Expected: the existing event-detail test fails because no accessible data tables exist yet.

### Task 2: Implement the event data table

**Files:**

- Modify: `frontend/src/views/UpdateDetailView.vue` around the event `v-for` and current `update-detail__event-item--exercise-data` blocks.

- [ ] **Step 1: Add a typed event-data selector helper**

Create this typed helper:

```ts
type EventDataTableModel = {
  label: "Create Data" | "Exercise Data";
  entries: EventDataEntry[];
};

function getEventDataTable(
  event: NodeUpdateDetailResponse["events"][number],
): EventDataTableModel | null;
```

Also add a view-level `formatEventDataType(label: string, value: RenderableValue, optionalDepth?: number): string` helper and preserve Optional depth in flattened entries. It returns `ContractId` for contract markers or contract-id field names, `Party` for party references, `Unit` for unit markers, `Bool` for booleans, `Optional<T>` for Optional values, `Numeric` for amount-like numeric fields, `Int64` for other numbers, and `Text` for remaining strings.

It returns Create Data when `getRecordEntries(event.createData)` has entries, otherwise Exercise Data when `getExerciseEntries(event.exerciseData)` has entries, otherwise `null`. This encodes the existing one-payload-per-event contract and avoids duplicating table markup.

- [ ] **Step 2: Add a deterministic event index to the event loop**

Change the event loop to expose `eventIndex`, and derive a heading id such as `update-detail-event-data-heading-${eventIndex}`. Use the id for the visible `Create Data` or `Exercise Data` heading and reference it from the table with `aria-labelledby`.

- [ ] **Step 3: Replace both stacked data blocks with one native table**

Render the selected payload only when it has entries. Place the table outside the event metadata `<dl>` but inside the event `<article>` so native table semantics are valid. Use this structure:

```html
<section
  class="update-detail__data-section"
  aria-labelledby="update-detail-event-data-heading-0"
>
  <h4 id="update-detail-event-data-heading-0">Create Data</h4>
  <div class="update-detail__data-table-wrap">
    <table
      class="update-detail__data-table"
      aria-labelledby="update-detail-event-data-heading-0"
    >
      <thead>
        ...
      </thead>
      <tbody>
        ...
      </tbody>
    </table>
  </div>
</section>
```

Keep the current `formatEventDataLabel`, `formatEventDataValue`, `isContractReference`, `isContractIdStringReference`, `contractReferenceValue`, and `isPartyReference` branches unchanged inside the Value cell so links and display formatting remain identical.

Use a `<table class="update-detail__data-table" aria-labelledby="...">` wrapped in `<div class="update-detail__data-table-wrap">`. Render a `<thead>` with `Field`, `Type`, and `Value`, and one `<tbody>` row per entry. Put the type label in a dedicated `.update-detail__data-table-type` cell between the field and value cells. Give each table a visible heading matching its payload label.

- [ ] **Step 4: Run the focused test and verify it passes**

Run the Task 1 command. Expected: the UpdateDetailView test passes.

### Task 3: Add table styling and CSS regression coverage

**Files:**

- Modify: `frontend/src/styles.css` near the existing update-detail event styles.
- Test: `frontend/src/styles.test.js`.

- [ ] **Step 1: Add dedicated event data table styles**

Add these dedicated selectors: `.update-detail__data-section`, `.update-detail__data-table-wrap`, `.update-detail__data-table`, `.update-detail__data-table thead`, `.update-detail__data-table th`, `.update-detail__data-table td`, `.update-detail__data-table tbody tr`, `.update-detail__data-table-field`, `.update-detail__data-table-type`, and `.update-detail__data-table-value`. Use the shared surface, muted, line, and text tokens and match the compact Updates table rhythm. Set `min-width: 0` and `overflow-x: auto` on `.update-detail__data-table-wrap`, and `min-width: 560px`, `width: 100%`, `border-collapse: collapse`, and `table-layout: fixed` on `.update-detail__data-table` so narrow screens preserve the three-column field/type/value association. Remove all obsolete stacked-data selectors: `.update-detail__event-item--exercise-data`, `.update-detail__exercise-data`, `.update-detail__exercise-data-row`, `.update-detail__exercise-data-key`, and `.update-detail__exercise-data-value`.

- [ ] **Step 2: Add style regression assertions**

Assert `.update-detail__data-table-wrap` has `min-width: 0` and `overflow-x: auto`; `.update-detail__data-table` has `min-width: 560px`, `width: 100%`, `border-collapse: collapse`, and `table-layout: fixed`; `.update-detail__data-table thead` uses `var(--surface-muted)` and `var(--text-500)`; `.update-detail__data-table th` and `.update-detail__data-table td` use compact padding and `var(--line-soft)` borders; `.update-detail__data-table-type` exists; and `.update-detail__data-table tbody tr` uses the shared line treatment. Assert all obsolete stacked-data selectors are absent from the stylesheet.

- [ ] **Step 3: Run the focused style and view tests**

Run:

```bash
VITE_API_BASE_URL=http://localhost:4600/api npm run test --workspace frontend -- --run src/views/UpdateDetailView.test.ts src/styles.test.js --reporter=dot
```

Expected: both files pass.

### Task 4: Full verification

**Files:**

- No additional files.

- [ ] **Step 1: Format changed Vue/test files**

Run:

```bash
./node_modules/.bin/prettier --write frontend/src/views/UpdateDetailView.vue frontend/src/views/UpdateDetailView.test.ts frontend/src/styles.test.js
```

- [ ] **Step 2: Run the full frontend test suite**

Run:

```bash
VITE_API_BASE_URL=http://localhost:4600/api npm run test --workspace frontend -- --run --reporter=dot
```

Expected: all frontend test files and tests pass.

- [ ] **Step 3: Run the production build**

Run:

```bash
npm run build --workspace frontend
```

Expected: `vue-tsc` and Vite complete successfully.

- [ ] **Step 4: Check the diff**

Run:

```bash
git diff --check
```

Expected: no whitespace errors.
