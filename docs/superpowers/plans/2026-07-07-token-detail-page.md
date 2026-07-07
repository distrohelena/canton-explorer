# Token Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a token detail page at `/tokens/:tokenId` that shows token overview metadata, top 25 holders, and latest 25 transfers, with token cards and token cells navigating into that page.

**Architecture:** Extend the existing token backend with token-specific detail and holder reads backed by the current in-memory observed-token and merged-transfer caches, plus a small observed-holder cache derived from holding contracts. Add a dedicated `TokenDetailView.vue` route that reuses the explorer’s existing section layout and transfer-list interaction patterns.

**Tech Stack:** NestJS, TypeScript, Jest, Vue 3, Vue Router, Vitest

---

## File Structure

**Backend**

- Modify: `backend/src/domain/node.types.ts`
  - Add token-detail and token-holder response contracts.
- Modify: `backend/src/api/nodes.controller.ts`
  - Add `/api/tokens/:tokenId` and `/api/tokens/:tokenId/holders`.
- Modify: `backend/src/pqs/pqs-summary.service.ts`
  - Add token detail lookup, top-holder extraction/merge, and token-filtered transfer reads.
- Modify: `backend/test/api/nodes.controller.spec.ts`
  - Add controller coverage for token detail and token holders.
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`
  - Add service coverage for token detail lookup, holder extraction, and unknown-token behavior.

**Frontend**

- Modify: `frontend/src/types/tokens.ts`
  - Add token detail and holder API shapes.
- Modify: `frontend/src/lib/api.ts`
  - Add `fetchTokenDetail()` and `fetchTokenHolders()`.
- Modify: `frontend/src/lib/api.test.ts`
  - Add client tests for the new endpoints.
- Modify: `frontend/src/router.ts`
  - Register `/tokens/:tokenId`.
- Modify: `frontend/src/views/TokensView.vue`
  - Make token cards and token cells navigate to the token page.
- Modify: `frontend/src/views/TokensView.test.ts`
  - Add navigation coverage for token click targets.
- Create: `frontend/src/views/TokenDetailView.vue`
  - Render overview, top holders, and filtered latest transfers.
- Create: `frontend/src/views/TokenDetailView.test.ts`
  - Add rendering and navigation coverage for the token page.

## Task 1: Add backend token detail and holder contracts with failing tests

**Files:**
- Modify: `backend/src/domain/node.types.ts`
- Modify: `backend/test/api/nodes.controller.spec.ts`
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Write the failing service tests for token detail and holders**

Add tests in `backend/test/pqs/pqs-summary.service.spec.ts` for:

- token detail lookup returns token metadata plus latest transfers for a matching `tokenId`
- top holders are extracted from `Splice.Api.Token.HoldingV1:Holding`
- identical holders observed on multiple nodes merge into one row with multiple observing nodes
- unknown `tokenId` throws a not-found style error

- [ ] **Step 2: Write the failing controller tests**

Add tests in `backend/test/api/nodes.controller.spec.ts` for:

- `GET /api/tokens/:tokenId`
- `GET /api/tokens/:tokenId/holders`

The tests should assert delegation into `PqsSummaryService`.

- [ ] **Step 3: Run the targeted backend tests to verify they fail**

Run:

```bash
rtk npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts test/api/nodes.controller.spec.ts
```

Expected:

- FAIL because the token detail and holder reads do not exist yet.

- [ ] **Step 4: Add the response types**

Add to `backend/src/domain/node.types.ts`:

```ts
export interface TokenDetailResponse {
  token: TokenSummary;
  transfers: TokenTransferSummary[];
}

export interface TokenHolderObservedNode {
  nodeId: string;
  label: string;
}

export interface TokenHolderSummary {
  partyId: string;
  amount: string | null;
  nodes: TokenHolderObservedNode[];
}

export interface TokenHoldersResponse {
  tokenId: string;
  holders: TokenHolderSummary[];
}
```

- [ ] **Step 5: Commit the test/contracts checkpoint**

```bash
rtk git add backend/src/domain/node.types.ts backend/test/api/nodes.controller.spec.ts backend/test/pqs/pqs-summary.service.spec.ts
rtk git commit -m "test: cover token detail page backend contracts"
```

## Task 2: Implement backend token detail and top-holder reads

**Files:**
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Add observed holder data structures**

In `backend/src/pqs/pqs-summary.service.ts`, add focused holder types and caches near the token cache area, for example:

```ts
interface NodeTokenHolderObservation {
  nodeId: string;
  label: string;
  tokenId: string;
  partyId: string;
  amount: string | null;
}

interface CachedNodeTokenHolders {
  cachedAt: number;
  holders: NodeTokenHolderObservation[];
}
```

- [ ] **Step 2: Add a holding-row query path**

Reuse the current token row query shape by adding holding-template support for:

- `Splice.Api.Token.HoldingV1:Holding`

The PQS query should fetch the fields already needed for decode:

- `template_id`
- `package_id`
- `contract_instance`
- `record_time`
- `event_offset`
- `update_id`

- [ ] **Step 3: Add holder normalization**

Implement the minimal helper(s) to extract:

- `tokenId` from `instrumentId.id`
- `partyId` from `owner`
- `amount` from `amount`

Skip rows that do not decode cleanly.

- [ ] **Step 4: Add per-node holder caching**

Implement a helper like:

```ts
private async loadCachedTokenHolders(node: NodeConfig): Promise<NodeTokenHolderObservation[]>
```

Use the same TTL family already used for token caches.

- [ ] **Step 5: Add public token detail and holder methods**

Add:

```ts
async fetchTokenDetail(nodes: NodeConfig[], tokenId: string): Promise<TokenDetailResponse>
async fetchTokenHolders(nodes: NodeConfig[], tokenId: string): Promise<TokenHoldersResponse>
```

Behavior:

- `fetchTokenDetail()`:
  - resolve token metadata from discovered tokens
  - filter merged token transfers to the matching `tokenId`
  - return latest 25 transfers, preserving current global token transfer ordering
- `fetchTokenHolders()`:
  - merge holder observations globally by `partyId`
  - merge observing nodes
  - sort by numeric amount descending, falling back deterministically when amount is absent
  - return top 25
- both methods:
  - normalize the incoming `tokenId`
  - throw a stable unknown-token error when the token is not observed

- [ ] **Step 6: Re-run the targeted backend tests**

Run:

```bash
rtk npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts test/api/nodes.controller.spec.ts
```

Expected:

- PASS

- [ ] **Step 7: Commit the backend implementation**

```bash
rtk git add backend/src/pqs/pqs-summary.service.ts backend/test/pqs/pqs-summary.service.spec.ts backend/test/api/nodes.controller.spec.ts
rtk git commit -m "feat: add token detail and holder reads"
```

## Task 3: Wire the backend controller endpoints

**Files:**
- Modify: `backend/src/api/nodes.controller.ts`
- Modify: `backend/test/api/nodes.controller.spec.ts`

- [ ] **Step 1: Add the controller handlers**

Add:

- `GET /api/tokens/:tokenId`
- `GET /api/tokens/:tokenId/holders`

Behavior:

- delegate to `PqsSummaryService`
- map the unknown-token service error to `NotFoundException`

- [ ] **Step 2: Run the controller tests**

Run:

```bash
rtk npm test --workspace backend -- --runTestsByPath test/api/nodes.controller.spec.ts
```

Expected:

- PASS

- [ ] **Step 3: Commit controller wiring**

```bash
rtk git add backend/src/api/nodes.controller.ts backend/test/api/nodes.controller.spec.ts
rtk git commit -m "feat: expose token detail api endpoints"
```

## Task 4: Add frontend API bindings and route coverage

**Files:**
- Modify: `frontend/src/types/tokens.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/api.test.ts`
- Modify: `frontend/src/router.ts`

- [ ] **Step 1: Write the failing frontend API tests**

Add tests in `frontend/src/lib/api.test.ts` for:

- `fetchTokenDetail(tokenId)`
- `fetchTokenHolders(tokenId)`

- [ ] **Step 2: Run the API tests to verify failure**

Run:

```bash
rtk npm test --workspace frontend -- src/lib/api.test.ts
```

Expected:

- FAIL because the new client functions do not exist yet.

- [ ] **Step 3: Add the frontend token detail/holder types**

Extend `frontend/src/types/tokens.ts` with:

- `TokenDetailResponse`
- `TokenHolderObservedNode`
- `TokenHolderSummary`
- `TokenHoldersResponse`

- [ ] **Step 4: Add API client functions**

In `frontend/src/lib/api.ts`, add:

```ts
export function fetchTokenDetail(tokenId: string): Promise<TokenDetailResponse>
export function fetchTokenHolders(tokenId: string): Promise<TokenHoldersResponse>
```

- [ ] **Step 5: Register the route**

In `frontend/src/router.ts`, add:

- `/tokens/:tokenId`

- [ ] **Step 6: Re-run the API tests**

Run:

```bash
rtk npm test --workspace frontend -- src/lib/api.test.ts
```

Expected:

- PASS

- [ ] **Step 7: Commit API and route plumbing**

```bash
rtk git add frontend/src/types/tokens.ts frontend/src/lib/api.ts frontend/src/lib/api.test.ts frontend/src/router.ts
rtk git commit -m "feat: add token detail api client and route"
```

## Task 5: Add token click-through from the global Tokens page

**Files:**
- Modify: `frontend/src/views/TokensView.vue`
- Modify: `frontend/src/views/TokensView.test.ts`

- [ ] **Step 1: Write the failing navigation tests**

Add tests for:

- clicking a known-token card navigates to `/tokens/:tokenId`
- clicking the token cell in a transfer row navigates to `/tokens/:tokenId`

- [ ] **Step 2: Run the tokens page tests to verify failure**

Run:

```bash
rtk npm test --workspace frontend -- src/views/TokensView.test.ts
```

Expected:

- FAIL because the token elements are not wired as links yet.

- [ ] **Step 3: Implement the minimal navigation changes**

In `frontend/src/views/TokensView.vue`:

- make each token card clickable
- make the token cell in transfer rows clickable
- preserve existing transfer-row click behavior for the rest of the row

- [ ] **Step 4: Re-run the tokens page tests**

Run:

```bash
rtk npm test --workspace frontend -- src/views/TokensView.test.ts
```

Expected:

- PASS

- [ ] **Step 5: Commit the click-through behavior**

```bash
rtk git add frontend/src/views/TokensView.vue frontend/src/views/TokensView.test.ts
rtk git commit -m "feat: add token page navigation from tokens browser"
```

## Task 6: Build the token detail page

**Files:**
- Create: `frontend/src/views/TokenDetailView.vue`
- Create: `frontend/src/views/TokenDetailView.test.ts`

- [ ] **Step 1: Write the failing token detail view tests**

Add tests covering:

- loading state
- overview rendering
- top holders rendering
- holder party links
- latest transfers rendering
- transfer row navigation to `/tokens/transfers/:updateId`
- back link to `/tokens`

- [ ] **Step 2: Run the token detail view tests to verify failure**

Run:

```bash
rtk npm test --workspace frontend -- src/views/TokenDetailView.test.ts
```

Expected:

- FAIL because the page does not exist yet.

- [ ] **Step 3: Implement the page**

Create `frontend/src/views/TokenDetailView.vue` with:

- token overview section
- top holders section
- filtered latest transfers section using the existing tokens-table styling patterns where possible

Keep the page visually aligned with existing detail pages instead of inventing a new layout.

- [ ] **Step 4: Re-run the token detail view tests**

Run:

```bash
rtk npm test --workspace frontend -- src/views/TokenDetailView.test.ts
```

Expected:

- PASS

- [ ] **Step 5: Commit the token detail page**

```bash
rtk git add frontend/src/views/TokenDetailView.vue frontend/src/views/TokenDetailView.test.ts
rtk git commit -m "feat: add token detail page"
```

## Task 7: Final verification

**Files:**
- No new source files planned

- [ ] **Step 1: Run touched backend tests**

```bash
rtk npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts test/api/nodes.controller.spec.ts test/packages/package-cache.service.spec.ts
```

Expected:

- PASS

- [ ] **Step 2: Run touched frontend tests**

```bash
rtk npm test --workspace frontend -- src/lib/api.test.ts src/views/TokensView.test.ts src/views/TokenDetailView.test.ts src/views/TokenTransferDetailView.test.ts
```

Expected:

- PASS

- [ ] **Step 3: Run backend build**

```bash
rtk npm run build --workspace backend
```

Expected:

- PASS

- [ ] **Step 4: Manual behavior check**

Verify:

- `/tokens` token cards open `/tokens/:tokenId`
- token cells in global transfers open `/tokens/:tokenId`
- `/tokens/:tokenId` shows overview, top holders, and filtered transfers
- holder party links open `/parties/:partyId`
- transfer rows open `/tokens/transfers/:updateId`

- [ ] **Step 5: Create the final implementation commit**

```bash
rtk git status --short
rtk git add backend/src/domain/node.types.ts backend/src/api/nodes.controller.ts backend/src/pqs/pqs-summary.service.ts backend/test/api/nodes.controller.spec.ts backend/test/pqs/pqs-summary.service.spec.ts frontend/src/types/tokens.ts frontend/src/lib/api.ts frontend/src/lib/api.test.ts frontend/src/router.ts frontend/src/views/TokensView.vue frontend/src/views/TokensView.test.ts frontend/src/views/TokenDetailView.vue frontend/src/views/TokenDetailView.test.ts
rtk git commit -m "feat: add token detail page"
```
