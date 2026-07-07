# Token Transfers Browser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shared token transfers browser so the global Tokens page and per-token page both use the same paginated transfer list with URL-backed `before` / `after` cursors.

**Architecture:** Add token-scoped transfer pagination to the backend first, then expose it through the frontend API. Replace the duplicated transfer UIs with a single `TokenTransfersBrowser.vue` component that owns loading, pager behavior, URL query state, and transfer-row rendering for both global and token scopes.

**Tech Stack:** NestJS, TypeScript, Vue 3, Vue Router, Vitest, Testing Library

---

### Task 1: Add token-scoped transfer pagination on the backend

**Files:**
- Modify: `backend/src/domain/node.types.ts`
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Modify: `backend/src/api/nodes.controller.ts`
- Test: `backend/test/pqs/pqs-summary.service.spec.ts`
- Test: `backend/test/api/nodes.controller.spec.ts`

- [ ] **Step 1: Write failing backend tests for token-scoped transfer pagination**

Add tests that call a new token-scoped method and controller endpoint, asserting:
- only transfers for the requested token are returned
- `nextBefore` / `nextAfter` are produced for that token-specific stream
- unknown token IDs still return `NotFoundException`

- [ ] **Step 2: Run backend token tests to verify they fail**

Run: `rtk npm test --workspace backend -- test/pqs/pqs-summary.service.spec.ts test/api/nodes.controller.spec.ts`

Expected: FAIL with missing token-scoped transfer support.

- [ ] **Step 3: Implement minimal backend token-scoped transfer pagination**

Add:
- a reusable `fetchTokenTransfers(...)` method in `PqsSummaryService`
- token filtering before cursor slicing
- a `/api/tokens/:tokenId/transfers` controller endpoint

Keep cursor behavior identical to the global token transfer feed.

- [ ] **Step 4: Run backend token tests to verify they pass**

Run: `rtk npm test --workspace backend -- test/pqs/pqs-summary.service.spec.ts test/api/nodes.controller.spec.ts`

Expected: PASS

### Task 2: Add frontend API support for token-scoped transfer paging

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/api.test.ts`

- [ ] **Step 1: Write failing frontend API test for token-scoped transfer loading**

Add a test for `fetchTokenTransfers(tokenId, limit, { before, after })` that asserts the generated URL uses:
- `/api/tokens/:tokenId/transfers`
- `limit`
- `before` / `after` query params

- [ ] **Step 2: Run the frontend API test to verify it fails**

Run: `rtk npm test --workspace frontend -- src/lib/api.test.ts`

Expected: FAIL with missing API function.

- [ ] **Step 3: Implement the minimal frontend API function**

Add `fetchTokenTransfers(...)` to `frontend/src/lib/api.ts`, mirroring the existing global token transfer helper.

- [ ] **Step 4: Run the frontend API test to verify it passes**

Run: `rtk npm test --workspace frontend -- src/lib/api.test.ts`

Expected: PASS

### Task 3: Introduce a shared token transfers browser component

**Files:**
- Create: `frontend/src/components/TokenTransfersBrowser.vue`
- Modify: `frontend/src/views/TokensView.vue`
- Modify: `frontend/src/views/TokenDetailView.vue`
- Modify: `frontend/src/styles.css`
- Test: `frontend/src/views/TokensView.test.ts`
- Test: `frontend/src/views/TokenDetailView.test.ts`

- [ ] **Step 1: Write failing component/view tests for shared token paging behavior**

Add tests that assert:
- `/tokens` still shows `Newer` / `Older`
- `/tokens/:tokenId` now also shows `Newer` / `Older`
- both views persist cursors in the URL
- transfer rows and nested party/token links still navigate correctly

- [ ] **Step 2: Run the token view tests to verify they fail**

Run: `rtk npm test --workspace frontend -- src/views/TokensView.test.ts src/views/TokenDetailView.test.ts src/views/TokenTransferDetailView.test.ts`

Expected: FAIL because the shared component and token-page pagination do not exist yet.

- [ ] **Step 3: Implement `TokenTransfersBrowser.vue` with minimal shared behavior**

Move into the component:
- query parsing
- `before` / `after` URL updates
- loading / refreshing states
- pager buttons
- transfer table rendering
- row click handling
- token/party/transfer links

Support two modes:
- `scope="global"` using `fetchLatestTokenTransfers`
- `scope="token"` using `fetchTokenTransfers`

- [ ] **Step 4: Replace duplicated transfer sections in both views**

Update:
- `TokensView.vue` to keep the token inventory and delegate the transfer section
- `TokenDetailView.vue` to keep overview + holders and delegate the transfer section

- [ ] **Step 5: Adjust styling only where needed**

Keep the existing row appearance and pager placement. Limit CSS changes to the new component structure and remove obsolete duplicate transfer styles if they become unused.

- [ ] **Step 6: Run the token view tests to verify they pass**

Run: `rtk npm test --workspace frontend -- src/views/TokensView.test.ts src/views/TokenDetailView.test.ts src/views/TokenTransferDetailView.test.ts`

Expected: PASS

### Task 4: Final verification

**Files:**
- Verify only

- [ ] **Step 1: Run focused backend and frontend tests together**

Run: `rtk npm test --workspace backend -- test/pqs/pqs-summary.service.spec.ts test/api/nodes.controller.spec.ts`

Run: `rtk npm test --workspace frontend -- src/lib/api.test.ts src/views/TokensView.test.ts src/views/TokenDetailView.test.ts src/views/TokenTransferDetailView.test.ts`

Expected: PASS

- [ ] **Step 2: Run the frontend production build**

Run: `rtk npm run build --workspace frontend`

Expected: PASS

- [ ] **Step 3: Review diff for only intended token-browser changes**

Run: `rtk git diff -- backend/src/api/nodes.controller.ts backend/src/pqs/pqs-summary.service.ts backend/test/api/nodes.controller.spec.ts backend/test/pqs/pqs-summary.service.spec.ts frontend/src/lib/api.ts frontend/src/lib/api.test.ts frontend/src/components/TokenTransfersBrowser.vue frontend/src/views/TokensView.vue frontend/src/views/TokenDetailView.vue frontend/src/views/TokensView.test.ts frontend/src/views/TokenDetailView.test.ts frontend/src/styles.css`

Expected: only token transfer browser and token-scoped paging changes
