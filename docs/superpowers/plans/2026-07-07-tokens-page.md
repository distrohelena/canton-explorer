# Tokens Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a top-level `Tokens` page that lists discovered tokens, starting with `Canton Coin`, and shows a cached merged feed of the latest 25 token transfers across all connected nodes.

**Architecture:** Extend the backend with a narrow PQS-backed `Canton Coin` discovery and transfer-normalization pipeline, backed by an in-memory cache and exposed through two global `/api/tokens` endpoints. Add a frontend `/tokens` route and page that reuses the explorer’s existing top-level shell and browser-style list patterns to show `Known Tokens` and `Latest Transfers`.

**Tech Stack:** NestJS, TypeScript, Jest, Vue 3, Vue Router, Vitest

---

## File Structure

**Backend**

- Modify: `backend/src/domain/node.types.ts`
  - Add explorer-owned token list and transfer response types for the first slice.
- Modify: `backend/src/api/nodes.controller.ts`
  - Add global `/api/tokens` and `/api/tokens/transfers` endpoints.
- Modify: `backend/src/pqs/pqs-summary.service.ts`
  - Add `Canton Coin` discovery, transfer normalization, merged pagination, and cache-facing helpers.
- Modify: `backend/test/api/nodes.controller.spec.ts`
  - Add controller tests for the new token endpoints.
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`
  - Add service tests for transfer normalization, ordering, and cursor pagination.

**Frontend**

- Create: `frontend/src/types/tokens.ts`
  - Add token summary and token transfer API shapes.
- Modify: `frontend/src/lib/api.ts`
  - Add `fetchTokens()` and `fetchLatestTokenTransfers()`.
- Modify: `frontend/src/lib/api.test.ts`
  - Add API client tests for the new endpoints.
- Modify: `frontend/src/router.ts`
  - Register `/tokens`.
- Modify: `frontend/src/App.vue`
  - Add the `Tokens` nav item.
- Modify: `frontend/src/App.test.ts`
  - Add shell test coverage for the new nav route.
- Create: `frontend/src/views/TokensView.vue`
  - Implement the page container, known-token section, and latest-transfer section.
- Create: `frontend/src/views/TokensView.test.ts`
  - Add page tests for loading, rendering, and pagination.
- Modify: `frontend/src/styles.css`
  - Add page-specific styling that matches current production explorer patterns.

## Task 1: Add backend token response contracts and controller endpoints

**Files:**
- Modify: `backend/src/domain/node.types.ts`
- Modify: `backend/src/api/nodes.controller.ts`
- Test: `backend/test/api/nodes.controller.spec.ts`

- [ ] **Step 1: Write the failing controller tests**

Add tests in `backend/test/api/nodes.controller.spec.ts` for:

- `GET /api/tokens`
- `GET /api/tokens/transfers`

The tests should assert delegation to `PqsSummaryService` and pass-through of:

- default `limit = 25`
- `before`
- `after`

- [ ] **Step 2: Run the controller tests to verify failure**

Run:

```bash
rtk npm test --workspace backend -- --runTestsByPath test/api/nodes.controller.spec.ts
```

Expected:

- FAIL because the controller does not expose the new token endpoints yet

- [ ] **Step 3: Add minimal backend response types**

Add types to `backend/src/domain/node.types.ts`:

```ts
export interface TokenSummary {
  tokenId: string;
  name: string;
  symbol: string | null;
  source: 'pqs';
}

export interface TokensResponse {
  tokens: TokenSummary[];
}

export interface TokenTransferSummary {
  nodeId: string;
  label: string;
  tokenId: string;
  tokenName: string;
  amount: string | null;
  sender: string | null;
  receiver: string | null;
  eventOffset: string;
  updateId: string;
  recordTime: string | null;
}

export interface TokenTransfersResponse {
  limit: number;
  nextBefore: string | null;
  nextAfter: string | null;
  transfers: TokenTransferSummary[];
}
```

- [ ] **Step 4: Add controller wiring**

Add two new handlers to `backend/src/api/nodes.controller.ts`:

- `GET /api/tokens`
- `GET /api/tokens/transfers`

The controller should only:

- parse the query params
- normalize `limit`
- delegate to `PqsSummaryService`

- [ ] **Step 5: Re-run the controller tests**

Run:

```bash
rtk npm test --workspace backend -- --runTestsByPath test/api/nodes.controller.spec.ts
```

Expected:

- PASS for the new controller tests

- [ ] **Step 6: Commit**

```bash
git add backend/src/domain/node.types.ts backend/src/api/nodes.controller.ts backend/test/api/nodes.controller.spec.ts
git commit -m "feat: add token controller endpoints"
```

## Task 2: Implement `Canton Coin` discovery and latest-transfer service logic

**Files:**
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Test: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Write the failing service tests**

Add targeted tests in `backend/test/pqs/pqs-summary.service.spec.ts` for:

- token list returns `Canton Coin`
- transfer normalization extracts:
  - node id / label
  - token name
  - amount
  - sender
  - receiver
  - event offset
  - update id
  - record time
- merged transfer list orders newest first across nodes
- transfer pagination returns opaque `before` / `after` cursors

Keep the tests narrow and based on known Splice/Amulet transfer shapes that the repo can already decode or identify.

- [ ] **Step 2: Run the targeted service tests to verify failure**

Run:

```bash
rtk npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts
```

Expected:

- FAIL because no token discovery/transfer API exists yet

- [ ] **Step 3: Add private normalization helpers**

In `backend/src/pqs/pqs-summary.service.ts`, add focused helpers for:

- identifying `Canton Coin`
- detecting `Canton Coin` transfer events from known template/choice combinations
- extracting normalized transfer fields

Do not build a generic registry yet.

- [ ] **Step 4: Add public token service methods**

Add methods such as:

```ts
async fetchTokens(nodes: NodeConfig[]): Promise<TokensResponse>
async fetchLatestTokenTransfers(
  nodes: NodeConfig[],
  limit?: number,
  options?: { before?: string; after?: string },
): Promise<TokenTransfersResponse>
```

Implementation rules:

- serve only `Canton Coin` in the token list
- merge across nodes like the global updates/contracts feeds
- use opaque keyset cursors
- skip unparseable candidates rather than inventing data

- [ ] **Step 5: Add or reuse in-memory cache boundaries**

Extend the backend summary/polling flow so token discovery and transfer history are cached in memory instead of recomputed per request.

Keep the first version bounded:

- enough retained data to serve the latest 25 transfers plus cursor navigation
- reset-safe after backend restart

Do not add sqlite or durable storage in this slice.

- [ ] **Step 6: Re-run the targeted service tests**

Run:

```bash
rtk npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts
```

Expected:

- PASS for the new token-service coverage

- [ ] **Step 7: Commit**

```bash
git add backend/src/pqs/pqs-summary.service.ts backend/test/pqs/pqs-summary.service.spec.ts
git commit -m "feat: add cached canton coin transfer feed"
```

## Task 3: Add frontend API bindings, route, and nav entry

**Files:**
- Create: `frontend/src/types/tokens.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/api.test.ts`
- Modify: `frontend/src/router.ts`
- Modify: `frontend/src/App.vue`
- Modify: `frontend/src/App.test.ts`

- [ ] **Step 1: Write the failing frontend API and shell tests**

Add tests for:

- `fetchTokens()`
- `fetchLatestTokenTransfers()`
- `Tokens` nav item in the shared shell
- `/tokens` route rendering

- [ ] **Step 2: Run the targeted frontend tests to verify failure**

Run:

```bash
rtk npm test --workspace frontend -- src/lib/api.test.ts src/App.test.ts
```

Expected:

- FAIL because the types, API functions, nav item, and route do not exist yet

- [ ] **Step 3: Add frontend token types**

Create `frontend/src/types/tokens.ts` with:

```ts
export interface TokenSummary {
  tokenId: string;
  name: string;
  symbol: string | null;
  source: 'pqs';
}

export interface TokensResponse {
  tokens: TokenSummary[];
}

export interface TokenTransferSummary {
  nodeId: string;
  label: string;
  tokenId: string;
  tokenName: string;
  amount: string | null;
  sender: string | null;
  receiver: string | null;
  eventOffset: string;
  updateId: string;
  recordTime: string | null;
}

export interface TokenTransfersResponse {
  limit: number;
  nextBefore: string | null;
  nextAfter: string | null;
  transfers: TokenTransferSummary[];
}
```

- [ ] **Step 4: Add frontend API bindings**

In `frontend/src/lib/api.ts`, add:

- `fetchTokens()`
- `fetchLatestTokenTransfers(limit = 25, options?)`

Keep the API shape aligned with global updates/contracts pagination.

- [ ] **Step 5: Add route and nav**

Update:

- `frontend/src/router.ts`
- `frontend/src/App.vue`
- `frontend/src/App.test.ts`

to include a `Tokens` header entry and the `/tokens` route.

- [ ] **Step 6: Re-run the targeted frontend tests**

Run:

```bash
rtk npm test --workspace frontend -- src/lib/api.test.ts src/App.test.ts
```

Expected:

- PASS for the API and shell coverage

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types/tokens.ts frontend/src/lib/api.ts frontend/src/lib/api.test.ts frontend/src/router.ts frontend/src/App.vue frontend/src/App.test.ts
git commit -m "feat: add tokens route and api bindings"
```

## Task 4: Build the `Tokens` page UI

**Files:**
- Create: `frontend/src/views/TokensView.vue`
- Create: `frontend/src/views/TokensView.test.ts`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Write the failing page tests**

Add `frontend/src/views/TokensView.test.ts` coverage for:

- loading state
- `Known Tokens` section renders `Canton Coin`
- `Latest Transfers` renders the latest 25 rows
- rows show:
  - node
  - token
  - amount
  - sender
  - receiver
  - record time
- clicking a row opens `/nodes/:nodeId/updates/:eventOffset?from=tokens`
- `Newer` / `Older` pagination works from API cursors

- [ ] **Step 2: Run the page tests to verify failure**

Run:

```bash
rtk npm test --workspace frontend -- src/views/TokensView.test.ts
```

Expected:

- FAIL because the page does not exist yet

- [ ] **Step 3: Implement the page**

Create `frontend/src/views/TokensView.vue` with:

- top-level dashboard header matching the existing top-level pages
- `Known Tokens` block
- `Latest Transfers` block
- shared loading/error handling

Keep the UI minimal and production-like:

- reuse browser-style section framing
- no fake analytics cards
- no unsupported balances

- [ ] **Step 4: Add styling**

Update `frontend/src/styles.css` with only the styles needed for:

- token list rows/cards
- transfer table rows
- spacing and responsive behavior

Follow the current explorer visual language instead of creating a separate theme.

- [ ] **Step 5: Re-run the page tests**

Run:

```bash
rtk npm test --workspace frontend -- src/views/TokensView.test.ts
```

Expected:

- PASS for the new page behavior

- [ ] **Step 6: Commit**

```bash
git add frontend/src/views/TokensView.vue frontend/src/views/TokensView.test.ts frontend/src/styles.css
git commit -m "feat: add tokens page"
```

## Task 5: Final verification

**Files:**
- No additional code changes required

- [ ] **Step 1: Run targeted backend tests**

```bash
rtk npm test --workspace backend -- --runTestsByPath test/api/nodes.controller.spec.ts test/pqs/pqs-summary.service.spec.ts
```

Expected:

- PASS

- [ ] **Step 2: Run targeted frontend tests**

```bash
rtk npm test --workspace frontend -- src/lib/api.test.ts src/App.test.ts src/views/TokensView.test.ts
```

Expected:

- PASS

- [ ] **Step 3: Run backend build**

```bash
rtk npm run build --workspace backend
```

Expected:

- PASS

- [ ] **Step 4: Run frontend build**

```bash
rtk npm run build --workspace frontend
```

Expected:

- PASS

- [ ] **Step 5: Commit verification-only cleanups if needed**

```bash
git status --short
```

Expected:

- no unexpected files
