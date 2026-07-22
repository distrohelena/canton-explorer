# Contracts Node Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/contracts` show all configured nodes by default and move node selection into a backend-enforced checkbox group in Advanced Filter.

**Architecture:** Keep the existing globally merged contracts endpoint and pagination. Add optional repeated `node` query parameters from the Contracts browser through the API controller into `PqsSummaryService`, where selected configured nodes become the merge inputs; the filter UI remains reusable by making node controls optional.

**Tech Stack:** Vue 3, TypeScript, Vue Router, NestJS, Jest, Vitest.

---

### Task 1: Add backend node-selection coverage

**Files:**
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`
- Modify: `backend/test/api/nodes.controller.spec.ts`

- [ ] **Step 1: Write failing service tests** for selecting one configured node and for an explicit empty selection returning an empty response without querying nodes.
- [ ] **Step 2: Run the focused service tests** and confirm they fail because `fetchGlobalContracts` does not accept node selection.
- [ ] **Step 3: Write a failing controller test** asserting repeated `node` query values are passed as selected node IDs and an explicit empty query is preserved as an empty selection.
- [ ] **Step 4: Run the focused controller test** and confirm it fails for the missing query wiring.

### Task 2: Implement backend node filtering

**Files:**
- Modify: `backend/src/api/nodes.controller.ts`
- Modify: `backend/src/pqs/pqs-summary.service.ts`

- [ ] **Step 1: Add the repeated `node` query parameter** to `/api/contracts`, distinguishing an absent parameter (all nodes) from an explicit empty selection.
- [ ] **Step 2: Add `nodeIds?: string[]` to `fetchGlobalContracts` options** and restrict the service’s node merge states to configured matching IDs.
- [ ] **Step 3: Run the focused backend tests** and confirm all new and existing cases pass.

### Task 3: Add frontend API and Advanced Filter coverage

**Files:**
- Modify: `frontend/src/lib/api.test.ts`
- Modify: `frontend/src/components/UpdatesAdvancedFilter.test.ts` (create if absent)

- [ ] **Step 1: Write failing API tests** for repeated `node` parameters and explicit empty selection.
- [ ] **Step 2: Write failing Advanced Filter tests** for accessible checked node controls and node-selection events.
- [ ] **Step 3: Run the focused frontend tests** and confirm the expected failures.

### Task 4: Implement reusable node controls and global Contracts behavior

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/components/UpdatesAdvancedFilter.vue`
- Modify: `frontend/src/components/ContractsBrowser.vue`
- Modify: `frontend/src/views/ContractsView.vue`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Add optional node-filter props/events** to `UpdatesAdvancedFilter` and render one checked checkbox per supplied node.
- [ ] **Step 2: Remove the Contracts page’s top node selector** and always mount a global Contracts browser with configured nodes passed into Advanced Filter.
- [ ] **Step 3: Read and write node selections from the Contracts route query**, defaulting to all nodes and preserving explicit zero selection.
- [ ] **Step 4: Pass selected node IDs to `fetchLatestContracts`** while preserving party/template/splice filters, cursors, and page size.
- [ ] **Step 5: Add styling consistent with the existing rounded Advanced Filter controls.**
- [ ] **Step 6: Run focused frontend tests** and confirm they pass.

### Task 5: Update Contracts integration tests

**Files:**
- Modify: `frontend/src/views/ContractsView.test.ts`

- [ ] **Step 1: Replace top-selector expectations** with all-node default and Advanced Filter node-checkbox expectations.
- [ ] **Step 2: Add coverage for one checked node** calling `fetchLatestContracts` with its node ID.
- [ ] **Step 3: Add coverage for all nodes unchecked** showing the empty state and sending an explicit empty selection.
- [ ] **Step 4: Run the Contracts view test file** and confirm it passes.

### Task 6: Verify the complete change

- [ ] **Step 1: Run the complete backend test suite.**
- [ ] **Step 2: Run the complete frontend test suite.**
- [ ] **Step 3: Run backend and frontend builds.**
- [ ] **Step 4: Run `git diff --check` on changed files and inspect the final diff for unrelated edits.**

