# Contracts Bottom Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the same cursor-pagination arrow buttons below the Contracts table that are already available above it and on the Updates page.

**Architecture:** Keep pagination behavior in `ContractsBrowser`; render a second pager using the existing `showNewer` and `showOlder` handlers and the same button/icon classes already used by Updates. Extend the existing Contracts view integration test to prove the bottom controls render, reflect cursor availability, and preserve the current query behavior when clicked.

**Tech Stack:** Vue 3 SFCs, TypeScript, Vue Testing Library, Vitest, Vue Router, existing CSS classes in `frontend/src/styles.css`.

## Global Constraints

- Reuse the existing cursor pagination, filters, and page-size query handling; add no backend or API changes.
- Match the established Updates pager controls and accessibility labels.
- Render the bottom pager only when there is no error and the browser is loading or has contracts.
- Preserve the existing unrelated `backend/package.json` working-tree change.

---

### Task 1: Add and test the Contracts bottom pager

**Files:**
- Modify: `frontend/src/components/ContractsBrowser.vue:644-686` — render the bottom pager after the Contracts table section.
- Test: `frontend/src/views/ContractsView.test.ts:320-370` — extend the existing cursor-pagination scenario.

**Interfaces:**
- Consumes: `contractsResponse.nextAfter`, `contractsResponse.nextBefore`, `loading`, `error`, `renderedContracts`, `showNewer()`, and `showOlder()` already defined in `ContractsBrowser.vue`.
- Produces: a `role="group"` with accessible name `Bottom contracts pagination`, containing `Newer` and `Older` buttons that call the existing handlers.

- [ ] **Step 1: Write the failing test**

  In the existing global Contracts pagination test, assert that the bottom group
  is present after the initial response, that its `Newer` button is disabled
  when `nextAfter` is absent, and that its `Older` button is enabled when
  `nextBefore` is present. Click the bottom `Older` button and assert the same
  filtered cursor request already expected for the top control:

  ```ts
  const bottomPager = screen.getByRole('group', { name: 'Bottom contracts pagination' });
  expect(within(bottomPager).getByRole('button', { name: 'Newer' })).toBeDisabled();
  expect(within(bottomPager).getByRole('button', { name: 'Older' })).not.toBeDisabled();

  await fireEvent.click(within(bottomPager).getByRole('button', { name: 'Older' }));

  await waitFor(() =>
    expect(fetchLatestContracts).toHaveBeenLastCalledWith(15, {
      before: '199',
      nodeIds: ['participant-2'],
      parties: ['Alice'],
      templates: ['Main:Asset'],
      partyMode: 'and',
      hideSplice: true,
    }),
  );
  ```

- [ ] **Step 2: Run the focused test to verify it fails**

  Run:

  ```bash
  npm test -- --run src/views/ContractsView.test.ts
  ```

  Expected: the existing pagination test fails because no group named
  `Bottom contracts pagination` is rendered.

- [ ] **Step 3: Implement the minimal bottom pager**

  Append this block after the Contracts table section and before the closing
  `</section>` of `ContractsBrowser`:

  ```vue
  <div
    v-if="!error && (loading || renderedContracts.length > 0)"
    class="node-updates__pager node-updates__pager--bottom"
    role="group"
    aria-label="Bottom contracts pagination"
  >
    <button
      type="button"
      class="dashboard__refresh"
      :disabled="!contractsResponse?.nextAfter || loading"
      aria-label="Newer"
      title="Newer"
      @click="showNewer"
    >
      <svg
        class="node-updates__pagination-icon node-updates__pagination-icon--newer"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M15 5l-7 7 7 7"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.75"
        />
      </svg>
    </button>
    <button
      type="button"
      class="dashboard__refresh"
      :disabled="!contractsResponse?.nextBefore || loading"
      aria-label="Older"
      title="Older"
      @click="showOlder"
    >
      <svg
        class="node-updates__pagination-icon node-updates__pagination-icon--older"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M9 5l7 7-7 7"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.75"
        />
      </svg>
    </button>
  </div>
  ```

  Do not add CSS or duplicate pagination state; the existing
  `.node-updates__pager--bottom` and `.node-updates__pagination-icon` rules
  already provide the correct layout and sizing.

- [ ] **Step 4: Run the focused tests to verify they pass**

  Run:

  ```bash
  npm test -- --run src/views/ContractsView.test.ts src/components/UpdatesBrowser.test.ts
  ```

  Expected: both test files pass, including the new bottom-control assertions.

- [ ] **Step 5: Run the full verification suite**

  Run from `frontend/`:

  ```bash
  npm test -- --run
  npm run build
  ```

  Run from the repository root:

  ```bash
  git diff --check
  ```

  Expected: all frontend tests pass, the production build exits successfully,
  and the diff check produces no output.

- [ ] **Step 6: Commit the implementation**

  ```bash
  git add frontend/src/components/ContractsBrowser.vue frontend/src/views/ContractsView.test.ts
  git commit -m "feat: add bottom contracts pagination"
  ```

  The commit must not include the pre-existing `backend/package.json` change.
