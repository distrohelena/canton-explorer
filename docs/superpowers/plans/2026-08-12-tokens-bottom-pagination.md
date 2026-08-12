# Tokens Bottom Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add matching bottom cursor-pagination arrow buttons to the Known Tokens and Latest Transfers blocks on the Tokens page.

**Architecture:** Keep pagination state and query handling in the existing owners: `TokensView` for Known Tokens and `TokenTransfersBrowser` for Latest Transfers. Each owner will render a second small pager using its current navigation handlers and the existing Updates/Contracts pager CSS; compact transfer previews remain unchanged.

**Tech Stack:** Vue 3 SFCs, TypeScript, Vue Testing Library, Vitest, Vue Router, existing `node-updates__pager` styles.

## Global Constraints

- Reuse the existing token and transfer cursor query handling; add no API or backend changes.
- Match the existing top controls and Contracts/Updates bottom arrow buttons.
- Render Known Tokens controls only without a token error and while loading or showing token rows.
- Render Latest Transfers controls only for non-compact instances without an error and while loading or showing transfer rows.
- Preserve the existing unrelated `backend/package.json` working-tree change.

---

### Task 1: Add bottom pagination to Known Tokens

**Files:**
- Modify: `frontend/src/views/TokensView.vue` after the Known Tokens table shell — render the bottom pager.
- Test: `frontend/src/views/TokensView.test.ts` in the Known Tokens rendering and pagination scenarios.

**Interfaces:**
- Consumes: `tokensResponse`, `tokensError`, `loadingTokens`, `showPreviousTokens()`, and `showNextTokens()` already defined in `TokensView.vue`.
- Produces: a `role="group"` named `Bottom known tokens pagination` with `Newer` and `Older` buttons using the existing token cursor handlers.

- [ ] **Step 1: Write the failing test**

  In `renders known tokens and the latest transfer feed`, assert that the Known
  Tokens bottom pager mirrors the initial response cursors:

  ```ts
  const knownTokensSection = sectionForHeading('Known Tokens');
  const knownTokensBottomPager = within(knownTokensSection).getByRole('group', {
    name: 'Bottom known tokens pagination',
  });
  expect(within(knownTokensBottomPager).getByRole('button', { name: 'Newer' })).toBeDisabled();
  expect(within(knownTokensBottomPager).getByRole('button', { name: 'Older' })).not.toBeDisabled();
  ```

  In `paginates known tokens independently from the transfer feed`, click the
  bottom `Older` button instead of the top button and retain the existing
  `fetchTokens` and URL assertions. After the first page loads, scope the
  control with:

  ```ts
  const knownTokensBottomPager = within(knownTokensSection).getByRole('group', {
    name: 'Bottom known tokens pagination',
  });
  await fireEvent.click(within(knownTokensBottomPager).getByRole('button', { name: 'Older' }));
  ```

- [ ] **Step 2: Run the focused test to verify it fails**

  Run:

  ```bash
  npm test -- --run src/views/TokensView.test.ts
  ```

  Expected: the Known Tokens rendering test fails because the bottom pager
  group does not exist.

- [ ] **Step 3: Implement the minimal Known Tokens pager**

  Add this block directly after the Known Tokens table `</div>` and before the
  closing `</section>` for `.tokens-page__table-section`:

  ```vue
  <div
    v-if="!tokensError && (loadingTokens || tokensResponse?.tokens.length > 0)"
    class="node-updates__pager node-updates__pager--bottom"
    role="group"
    aria-label="Bottom known tokens pagination"
  >
    <button
      type="button"
      class="dashboard__refresh"
      :disabled="!tokensResponse?.nextAfter || loadingTokens"
      aria-label="Newer"
      title="Newer"
      @click="showPreviousTokens"
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
      :disabled="!tokensResponse?.nextBefore || loadingTokens"
      aria-label="Older"
      title="Older"
      @click="showNextTokens"
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

  Do not add CSS or alter the existing token query handlers.

- [ ] **Step 4: Run the Known Tokens tests to verify they pass**

  Run:

  ```bash
  npm test -- --run src/views/TokensView.test.ts
  ```

  Expected: the full Tokens view test file passes, including the bottom Known
  Tokens assertions and cursor navigation.

### Task 2: Add bottom pagination to Latest Transfers

**Files:**
- Modify: `frontend/src/components/TokenTransfersBrowser.vue` after the transfer table section — render the non-compact bottom pager.
- Test: `frontend/src/views/TokensView.test.ts` in the transfer rendering and cursor-pagination scenarios.

**Interfaces:**
- Consumes: `tokenTransfersResponse`, `tokenTransfersError`, `loadingTransfers`, `compact`, `renderedTransfers`, `showNewer()`, and `showOlder()` already defined in `TokenTransfersBrowser.vue`.
- Produces: a non-compact-only `role="group"` named `Bottom latest transfers pagination` with `Newer` and `Older` buttons using the existing transfer cursor handlers.

- [ ] **Step 1: Write the failing test**

  In `renders known tokens and the latest transfer feed`, assert the initial
  transfer pager state:

  ```ts
  const transfersSection = sectionForHeading('Latest Transfers');
  const transfersBottomPager = within(transfersSection).getByRole('group', {
    name: 'Bottom latest transfers pagination',
  });
  expect(within(transfersBottomPager).getByRole('button', { name: 'Newer' })).toBeDisabled();
  expect(within(transfersBottomPager).getByRole('button', { name: 'Older' })).not.toBeDisabled();
  ```

  In `paginates the token transfer feed with opaque cursors`, click the bottom
  `Older` and `Newer` buttons through that group and keep the existing request
  and URL assertions. Also assert that the compact preview path does not
  expose the group if the reusable component is rendered with `compact` in an
  existing test fixture.

- [ ] **Step 2: Run the focused test to verify it fails**

  Run:

  ```bash
  npm test -- --run src/views/TokensView.test.ts
  ```

  Expected: the transfer rendering test fails because no bottom transfer pager
  group is rendered.

- [ ] **Step 3: Implement the minimal Latest Transfers pager**

  Add this block after the transfer table `</section>` and before the closing
  component `</section>`:

  ```vue
  <div
    v-if="!compact && !tokenTransfersError && (loadingTransfers || renderedTransfers.length > 0)"
    class="node-updates__pager node-updates__pager--bottom"
    role="group"
    aria-label="Bottom latest transfers pagination"
  >
    <button
      type="button"
      class="dashboard__refresh"
      :disabled="!tokenTransfersResponse?.nextAfter || loadingTransfers"
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
      :disabled="!tokenTransfersResponse?.nextBefore || loadingTransfers"
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

  Reuse the existing pager CSS and leave compact transfer previews without a
  bottom group.

- [ ] **Step 4: Run the focused tests to verify they pass**

  Run:

  ```bash
  npm test -- --run src/views/TokensView.test.ts src/components/TokenTransfersAdvancedFilter.test.ts
  ```

  Expected: all focused Tokens tests pass.

### Task 3: Full verification and commit

**Files:**
- Verify: `frontend/src/views/TokensView.test.ts`, `frontend/src/views/TokensView.vue`, and `frontend/src/components/TokenTransfersBrowser.vue`.

- [ ] **Step 1: Run the full frontend test suite**

  ```bash
  npm test -- --run
  ```

  Expected: all frontend test files and tests pass.

- [ ] **Step 2: Build the frontend**

  ```bash
  npm run build
  ```

  Expected: `vue-tsc` and Vite complete successfully.

- [ ] **Step 3: Check the changed files for whitespace errors**

  ```bash
  git diff --check -- frontend/src/views/TokensView.vue frontend/src/components/TokenTransfersBrowser.vue frontend/src/views/TokensView.test.ts
  ```

  Expected: no output. Repository-wide diff checks may still report the
  pre-existing CRLF trailing whitespace in `backend/package.json`; do not edit
  that unrelated file.

- [ ] **Step 4: Commit the implementation**

  ```bash
  git add frontend/src/views/TokensView.vue frontend/src/components/TokenTransfersBrowser.vue frontend/src/views/TokensView.test.ts
  git commit -m "feat: add bottom tokens pagination"
  ```

  Keep the existing backend package change out of the commit.
