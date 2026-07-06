# Contracts Browser Advanced Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize the `/contracts` page around reusable browser components and add backend-backed advanced filtering by `Party ID`, `Template ID`, `OR` / `AND`, and `Hide Splice Templates`.

**Architecture:** The backend will extend the node ACS PQS query so contracts are filtered before pagination, preserving honest `Older` / `Newer` cursors. The frontend will replace page-specific contracts browsing logic with a reusable `ContractsBrowser` plus a `ContractsAdvancedFilter`, keeping the existing node-selector shell while aligning URL, filter, and pager behavior with Updates.

**Tech Stack:** NestJS, TypeScript, PostgreSQL/PQS SQL, Vue 3, Vue Router, Vitest, Jest

---

### Task 1: Extend the contracts API contract

**Files:**
- Modify: `backend/src/domain/node.types.ts`
- Modify: `frontend/src/types/contracts.ts`
- Modify: `frontend/src/lib/api.ts`
- Test: `frontend/src/lib/api.test.ts`
- Test: `backend/test/api/nodes.controller.spec.ts`

- [ ] **Step 1: Write the failing API contract tests**

Add or extend tests so `fetchNodeContracts('participant-1', ...)` and the controller both expect:

```ts
{
  before: 'cursor-1',
  after: undefined,
  parties: ['Alice', 'Bob'],
  templates: ['Main:Asset'],
  partyMode: 'and',
  hideSplice: true,
}
```

Expected query string shape:

```text
/api/nodes/participant-1/contracts?before=cursor-1&party=Alice&party=Bob&template=Main%3AAsset&partyMode=and&hideSplice=true
```

- [ ] **Step 2: Run the targeted contract/API tests to verify they fail**

Run:

```bash
npm test --workspace frontend -- api.test.ts
npm test --workspace backend -- nodes.controller.spec.ts --testNamePattern="node contracts|contracts query"
```

Expected: failing assertions because contracts filters are not yet parsed/serialized.

- [ ] **Step 3: Update the shared contracts types and API helper signature**

Add the filter-bearing options shape to:

- `frontend/src/lib/api.ts`
- `frontend/src/types/contracts.ts`
- `backend/src/domain/node.types.ts` if a dedicated options-facing type is warranted locally

Use the same naming conventions already established in the updates API:

- `parties?: string[]`
- `templates?: string[]`
- `partyMode?: 'or' | 'and'`
- `hideSplice?: boolean`

- [ ] **Step 4: Update the controller query parsing**

Extend `NodesController.listNodeContracts(...)` in `backend/src/api/nodes.controller.ts` to parse:

- repeated `party`
- repeated `template`
- `partyMode`
- legacy `mode` fallback if kept for consistency
- `hideSplice`

and pass the normalized options to `pqsSummaryService.fetchNodeContracts(...)`.

- [ ] **Step 5: Run the targeted API contract tests and make sure they pass**

Run:

```bash
npm test --workspace frontend -- api.test.ts
npm test --workspace backend -- nodes.controller.spec.ts --testNamePattern="node contracts|contracts query"
```

Expected: PASS

### Task 2: Add backend ACS filtering before pagination

**Files:**
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Test: `backend/test/pqs/pqs-summary.service.spec.ts`
- Test: `backend/test/api/nodes.controller.spec.ts`

- [ ] **Step 1: Write failing service tests for contracts filtering**

Add focused tests covering:

- template filtering
- party filtering in `or` mode
- party filtering in `and` mode
- `hideSplice` filtering
- filtered pagination still returning the correct `nextBefore` / `nextAfter`

Use explicit ACS fixtures with:

- one `Splice.*` template row
- one `Main:Asset` row with witness `Alice`
- one `Main:Wallet` row with witnesses `Alice`, `Bob`

- [ ] **Step 2: Run the targeted PQS service tests to verify they fail**

Run:

```bash
npm test --workspace backend -- pqs-summary.service.spec.ts --testNamePattern="contracts filter|active contracts"
```

Expected: FAIL because the current ACS query ignores all new filter params.

- [ ] **Step 3: Extend `fetchNodeContracts(...)` to accept filter options**

Update the method signature in `backend/src/pqs/pqs-summary.service.ts` to accept:

```ts
{
  limit?: number;
  before?: string;
  after?: string;
  parties?: string[];
  templates?: string[];
  partyMode?: string;
  hideSplice?: boolean;
}
```

Normalize empty arrays and invalid mode values the same way updates code already does.

- [ ] **Step 4: Enhance the ACS SQL query so filtering happens before slicing**

Update the contracts query helper in `backend/src/pqs/pqs-summary.service.ts` so:

- template filters are applied in SQL
- splice templates are excluded in SQL when `hideSplice` is true
- party visibility is filtered in SQL using the node’s active-contract witness data

Implementation rule:

- do not filter the already-trimmed 25-row result set in memory
- keep cursor calculation based on the filtered, ordered result set

If witness data is not already present in the current ACS query, extend the query with the minimum additional join/aggregation needed to support party filtering.

- [ ] **Step 5: Run the targeted backend tests and make sure they pass**

Run:

```bash
npm test --workspace backend -- pqs-summary.service.spec.ts --testNamePattern="contracts filter|active contracts"
npm test --workspace backend -- nodes.controller.spec.ts --testNamePattern="node contracts|contracts query"
```

Expected: PASS

### Task 3: Build reusable frontend contracts filter components

**Files:**
- Create: `frontend/src/components/ContractsAdvancedFilter.vue`
- Create: `frontend/src/components/ContractsBrowser.vue`
- Modify: `frontend/src/components/ContractsTable.vue`
- Reuse: `frontend/src/components/SearchableCombobox.vue`
- Reuse: `frontend/src/components/UpdatesToolbar.vue`
- Modify: `frontend/src/styles.css`
- Test: `frontend/src/views/ContractsView.test.ts`

- [ ] **Step 1: Write the failing frontend browser tests**

Add tests for `ContractsView` that expect:

- `Advanced Filter` button to render
- filter panel to open and close
- party chips to add/remove
- template filters to add/remove
- `OR` / `AND` toggle to update fetch behavior
- `Hide Splice Templates` to update fetch behavior
- URL-driven auto-open when contracts filters are present

- [ ] **Step 2: Run the targeted contracts view tests to verify they fail**

Run:

```bash
npm test --workspace frontend -- ContractsView.test.ts
```

Expected: FAIL because the current view has no advanced filter behavior.

- [ ] **Step 3: Create `ContractsAdvancedFilter.vue`**

Mirror the interaction model from `UpdatesAdvancedFilter.vue`, but use contracts wording:

- `Party ID`
- `Template ID`
- `Hide Splice Templates`

Keep:

- `+` add buttons
- `OR` / `AND` mode toggles
- searchable single-select combobox for template entry

- [ ] **Step 4: Create `ContractsBrowser.vue`**

Implement a browser component analogous to `UpdatesBrowser.vue` that owns:

- reading query params
- building query params
- loading filtered contract pages
- managing loading/error state
- auto-opening the advanced filter when filter params exist
- rendering `UpdatesToolbar`, `ContractsAdvancedFilter`, `ContractsTable`, and the `PQS` pill in the correct order after `Older`

Recommended query keys:

- `before`
- `after`
- `party`
- `template`
- `partyMode`
- `hideSplice`

- [ ] **Step 5: Keep `ContractsTable.vue` presentational**

Only make the minimum changes needed so it cleanly supports the browser component:

- continue receiving rows as props
- keep no URL or fetch logic inside the table
- preserve the current fixed-width contracts layout

- [ ] **Step 6: Update contracts browser styles**

Add any missing styles in `frontend/src/styles.css` for:

- the contracts advanced-filter panel
- alignment of the `PQS` pill after `Older`
- responsive behavior matching the updates filter layout

- [ ] **Step 7: Run the targeted contracts browser tests and make sure they pass**

Run:

```bash
npm test --workspace frontend -- ContractsView.test.ts
```

Expected: PASS

### Task 4: Replace page-specific `/contracts` logic with the reusable browser

**Files:**
- Modify: `frontend/src/views/ContractsView.vue`
- Test: `frontend/src/views/ContractsView.test.ts`

- [ ] **Step 1: Write the failing integration test for node-selector + reusable browser behavior**

Cover:

- first node loads automatically
- switching node preserves active filters
- paging applies to the selected node only
- `PQS` remains after `Older`

- [ ] **Step 2: Run the targeted contracts integration test to verify it fails**

Run:

```bash
npm test --workspace frontend -- ContractsView.test.ts
```

Expected: FAIL because the current view owns the browser logic directly.

- [ ] **Step 3: Refactor `ContractsView.vue` into a thin shell**

Keep in `ContractsView.vue`:

- node loading
- selected-node state
- node-selector button rendering

Move out of `ContractsView.vue`:

- page-specific fetch logic
- direct pager logic
- advanced-filter state handling

Replace the results block with `ContractsBrowser.vue`.

- [ ] **Step 4: Run the targeted contracts integration tests and make sure they pass**

Run:

```bash
npm test --workspace frontend -- ContractsView.test.ts
```

Expected: PASS

### Task 5: Final verification and regression sweep

**Files:**
- Modify: none expected
- Test: `backend/test/api/nodes.controller.spec.ts`
- Test: `backend/test/pqs/pqs-summary.service.spec.ts`
- Test: `frontend/src/lib/api.test.ts`
- Test: `frontend/src/views/ContractsView.test.ts`
- Test: `frontend/src/views/PartyDetailView.test.ts`

- [ ] **Step 1: Run the focused backend contracts tests**

Run:

```bash
npm test --workspace backend -- nodes.controller.spec.ts --testNamePattern="node contracts|contracts query"
npm test --workspace backend -- pqs-summary.service.spec.ts --testNamePattern="contracts filter|active contracts"
```

Expected: PASS

- [ ] **Step 2: Run the focused frontend contracts tests**

Run:

```bash
npm test --workspace frontend -- api.test.ts ContractsView.test.ts PartyDetailView.test.ts
```

Expected: PASS

- [ ] **Step 3: Run the frontend build**

Run:

```bash
npm run build --workspace frontend
```

Expected: successful production build with no contracts-browser type errors.

- [ ] **Step 4: Run the backend build**

Run:

```bash
npm run build --workspace backend
```

Expected: successful Nest/TypeScript build with no controller or PQS service type errors.

- [ ] **Step 5: Commit the implementation**

Run:

```bash
git add backend/src/api/nodes.controller.ts \
  backend/src/pqs/pqs-summary.service.ts \
  backend/src/domain/node.types.ts \
  backend/test/api/nodes.controller.spec.ts \
  backend/test/pqs/pqs-summary.service.spec.ts \
  frontend/src/lib/api.ts \
  frontend/src/lib/api.test.ts \
  frontend/src/types/contracts.ts \
  frontend/src/components/ContractsAdvancedFilter.vue \
  frontend/src/components/ContractsBrowser.vue \
  frontend/src/components/ContractsTable.vue \
  frontend/src/views/ContractsView.vue \
  frontend/src/views/ContractsView.test.ts \
  frontend/src/styles.css
git commit -m "feat: add advanced contracts browser filters"
```

Expected: one commit containing the contracts browser standardization and filter support.
