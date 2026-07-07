# CIP56 Token Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing Tokens feature from the current Canton Coin-only implementation into a registry-driven CIP56 token pipeline that discovers observed tokens from PQS `Create` activity and shows merged transfer history for supported movement templates.
**Architecture:** Keep the existing PQS-backed global token pages and transfer-detail route, but replace hard-coded Canton Coin logic in `PqsSummaryService` with a small CIP56 token registry plus separate caches for observed token identities and observed transfer rows. Frontend contracts stay stable so the Tokens UI remains mostly generic.
**Tech Stack:** NestJS, TypeScript, Jest, Vue 3, Vue Router, Vitest

---

## File Structure

**Backend**

- Modify: `backend/src/domain/node.types.ts`
  - Extend token response contracts only if needed for additional CIP56 metadata while keeping current frontend compatibility.
- Modify: `backend/src/pqs/pqs-summary.service.ts`
  - Replace the Canton Coin-only token discovery and transfer extraction path with registry-driven CIP56 discovery.
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`
  - Add focused coverage for multi-token discovery, transfer extraction, dedupe, and empty-transfer-but-known-token behavior.
- Modify: `backend/test/api/nodes.controller.spec.ts`
  - Add or update endpoint tests only if backend response shapes or query handling change.

**Frontend**

- Modify: `frontend/src/types/tokens.ts`
  - Keep the API contracts aligned with backend token responses.
- Modify: `frontend/src/lib/api.ts`
  - Keep client functions stable unless response shapes need minor updates.
- Modify: `frontend/src/lib/api.test.ts`
  - Add regression coverage if any token response fields change.
- Modify: `frontend/src/views/TokensView.vue`
  - Verify the page correctly renders multiple discovered CIP56 tokens and transfer rows.
- Modify: `frontend/src/views/TokensView.test.ts`
  - Add UI tests for multi-token rendering and empty-transfer states.
- Modify: `frontend/src/views/TokenTransferDetailView.vue`
  - Verify generic transfer detail rendering still works for non-Canton-Coin tokens.
- Modify: `frontend/src/views/TokenTransferDetailView.test.ts`
  - Add regression tests if transfer detail semantics change.

## Task 1: Document the current Canton Coin-only seams with failing tests

**Files:**
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Add failing tests that expose the current hard-coded limitation**

Add service tests covering:

- a known token discovered from an observed `Create` that is not Canton Coin
- a token appearing in `Known Tokens` even when it has no recognizable transfer rows
- transfer extraction for more than one configured token family entry
- dedupe of the same logical transfer across multiple nodes without losing all observing nodes

Use existing decoded-value test helpers where available instead of inventing a second fixture style.

- [ ] **Step 2: Run the targeted backend service tests to confirm failure**

Run:

```bash
rtk npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts
```

Expected:

- FAIL because `fetchTokens()` is still static and `normalizeTokenTransferRow()` still always emits Canton Coin metadata.

- [ ] **Step 3: Commit the test-only checkpoint**

```bash
rtk git add backend/test/pqs/pqs-summary.service.spec.ts
rtk git commit -m "test: cover cip56 token discovery scenarios"
```

## Task 2: Introduce a backend CIP56 token registry

**Files:**
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Add explicit registry types near the existing token helpers**

Introduce private explorer-owned types in `backend/src/pqs/pqs-summary.service.ts`, for example:

```ts
interface Cip56TokenDefinition {
  tokenKey: string;
  tokenFamily: 'cip56';
  identityTemplates: string[];
  transferTemplates: string[];
  extractIdentity: (
    templateId: string | null,
    decoded: NodeDecodeState<NodeDecodedDamlValue> | null,
  ) => TokenSummary | null;
  extractTransfer: (
    templateId: string | null,
    decoded: NodeDecodeState<NodeDecodedDamlValue> | null,
  ) => {
    tokenId: string;
    tokenName: string;
    amount: string | null;
    sender: string | null;
    receiver: string | null;
  } | null;
}
```

Keep the types private to the service unless another file immediately needs them.

- [ ] **Step 2: Move Canton Coin into the registry**

Replace the current constants-only handling:

- `CANTON_COIN_TOKEN_ID`
- `CANTON_COIN_TOKEN_NAME`
- `CANTON_COIN_TRANSFER_TEMPLATE_ID`
- `CANTON_COIN_AMULET_TEMPLATE_ID`
- `extractCantonCoinMovement()`

with one registry entry that provides:

- Canton Coin identity templates
- Canton Coin movement templates
- Canton Coin metadata normalization
- Canton Coin transfer extraction

Do not remove the constants if they still make the registry entry clearer; remove only duplicated behavior.

- [ ] **Step 3: Add placeholder structure for additional CIP56 tokens**

Define the next supported CIP56 entries in the registry even if some initially only support identity extraction. Each entry must declare:

- exact template ids
- exact decoded-field paths
- whether transfer extraction is supported yet

Do not add heuristic template matching.

- [ ] **Step 4: Re-run the targeted backend tests**

Run:

```bash
rtk npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts
```

Expected:

- still FAIL until discovery and caching are migrated in the next task, but failures should now point at missing query/plumbing rather than missing token definitions.

- [ ] **Step 5: Commit the registry foundation**

```bash
rtk git add backend/src/pqs/pqs-summary.service.ts backend/test/pqs/pqs-summary.service.spec.ts
rtk git commit -m "refactor: add cip56 token registry foundation"
```

## Task 3: Split known-token discovery from transfer discovery

**Files:**
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Add separate in-memory caches for discovered tokens and transfers**

Keep the current in-memory approach and add a second cache alongside `tokenTransfersByNode`:

- `observedTokensByNode`
- retain or rename `tokenTransfersByNode` if it improves clarity

Use the same TTL family already used for token refresh so this remains operationally simple.

- [ ] **Step 2: Add a PQS query for token identity creates**

Implement a new query helper in `backend/src/pqs/pqs-summary.service.ts` that fetches recent rows matching all configured `identityTemplates`.

Requirements:

- use exact configured template ids only
- inspect create-side contract data
- include package id, template id, update id, record time, and node label data needed for normalization
- keep the query narrow enough to support cache refreshes

- [ ] **Step 3: Add token identity normalization**

Create a helper such as `normalizeObservedTokenRow()` that:

- resolves the matching registry entry by template id
- decodes contract data through the existing decoder path
- returns `TokenSummary | null`
- skips rows that decode unsuccessfully or do not satisfy the token definition

Do not emit fake fallback tokens from partial data.

- [ ] **Step 4: Add per-node token discovery loading**

Implement a helper such as:

```ts
private async loadCachedObservedTokens(node: NodeConfig): Promise<TokenSummary[]>
```

The helper should:

- use the new cache when fresh
- refresh from PQS when stale
- dedupe duplicate observations within a node

- [ ] **Step 5: Migrate `fetchTokens()` to discovered tokens**

Replace the static implementation of `fetchTokens(_nodes)` so it:

- loads observed tokens from each configured node
- merges them globally by token identity
- sorts them deterministically
- returns an empty list when nothing has been observed

The returned shape should stay `TokensResponse`.

- [ ] **Step 6: Run backend token tests again**

Run:

```bash
rtk npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts
```

Expected:

- PASS for known-token discovery scenarios
- transfer-specific failures may remain until Task 4 is complete

- [ ] **Step 7: Commit discovery support**

```bash
rtk git add backend/src/pqs/pqs-summary.service.ts backend/test/pqs/pqs-summary.service.spec.ts
rtk git commit -m "feat: discover observed cip56 tokens from pqs"
```

## Task 4: Generalize the transfer pipeline for all supported CIP56 movement templates

**Files:**
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Replace the Canton Coin-only transfer query filter**

Refactor `tokenTransferRowsQuery(limit)` so it no longer hard-codes:

- `CANTON_COIN_TRANSFER_TEMPLATE_ID`
- `CANTON_COIN_AMULET_TEMPLATE_ID`

Instead, derive the template set from all registry `transferTemplates`.

Preserve the existing ordering and pagination assumptions so the current `before` / `after` cursor logic still works.

- [ ] **Step 2: Replace `normalizeTokenTransferRow()` hard-coding**

Update `normalizeTokenTransferRow()` so it:

- resolves the matching registry entry by template id
- decodes contract data once
- calls the registry entry’s `extractTransfer()`
- emits the specific token id and token name from the matched entry rather than always Canton Coin

Rows with unsupported or undecodable movement data must return `null`.

- [ ] **Step 3: Keep merged transfer dedupe stable**

Re-check `buildTokenTransferDedupKey()` and `mergeTokenTransfers()` so the dedupe key still works correctly when multiple token ids now share the same update id.

The merged result must continue to keep:

- observing nodes
- event offsets per observing node
- globally newest-first ordering

- [ ] **Step 4: Validate transfer detail behavior**

Confirm `fetchTokenTransferDetail()` works unchanged once the merged transfer list contains more than one token family.

If needed, tighten the lookup tests so detail fetches remain keyed by normalized `updateId`.

- [ ] **Step 5: Run the targeted backend tests**

Run:

```bash
rtk npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts
```

Expected:

- PASS for discovery and transfer normalization scenarios

- [ ] **Step 6: Commit multi-token transfer support**

```bash
rtk git add backend/src/pqs/pqs-summary.service.ts backend/test/pqs/pqs-summary.service.spec.ts
rtk git commit -m "feat: support cip56 token transfer extraction"
```

## Task 5: Confirm controller and API contract stability

**Files:**
- Modify: `backend/test/api/nodes.controller.spec.ts`
- Modify: `backend/src/domain/node.types.ts`
- Modify: `frontend/src/types/tokens.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/api.test.ts`

- [ ] **Step 1: Audit whether API shapes need extension**

Check whether the existing shapes are still sufficient:

- `TokenSummary`
- `TokenTransferSummary`
- `TokenTransferObservedNode`

If extra metadata is truly needed for supported CIP56 tokens, add it to both backend and frontend type definitions. Otherwise, leave the contracts unchanged.

- [ ] **Step 2: Add or update controller tests only if behavior changed**

If query parsing or return shapes changed, update `backend/test/api/nodes.controller.spec.ts` and re-run:

```bash
rtk npm test --workspace backend -- --runTestsByPath test/api/nodes.controller.spec.ts
```

Expected:

- PASS

- [ ] **Step 3: Add or update frontend API-client tests**

Update `frontend/src/lib/api.test.ts` for any response-contract changes, then run:

```bash
rtk npm test --workspace frontend -- --runTestsByPath src/lib/api.test.ts
```

Expected:

- PASS

- [ ] **Step 4: Commit API contract alignment**

```bash
rtk git add backend/test/api/nodes.controller.spec.ts backend/src/domain/node.types.ts frontend/src/types/tokens.ts frontend/src/lib/api.ts frontend/src/lib/api.test.ts
rtk git commit -m "test: align token api contracts for cip56 support"
```

## Task 6: Verify the frontend Tokens pages with multi-token data

**Files:**
- Modify: `frontend/src/views/TokensView.vue`
- Modify: `frontend/src/views/TokensView.test.ts`
- Modify: `frontend/src/views/TokenTransferDetailView.vue`
- Modify: `frontend/src/views/TokenTransferDetailView.test.ts`

- [ ] **Step 1: Add failing frontend tests for multi-token rendering**

Add tests covering:

- multiple `Known Tokens` cards
- a token that appears in `Known Tokens` with no transfer rows
- transfer rows for non-Canton-Coin tokens
- transfer detail rendering for supported CIP56 transfers

- [ ] **Step 2: Run the targeted frontend view tests to confirm failure or drift**

Run:

```bash
rtk npm test --workspace frontend -- --runTestsByPath src/views/TokensView.test.ts src/views/TokenTransferDetailView.test.ts
```

Expected:

- FAIL if the views still contain Canton Coin-specific assumptions
- PASS if the views are already generic enough, in which case keep the tests as regression coverage

- [ ] **Step 3: Make only the minimal frontend adjustments needed**

Potential adjustments:

- empty-state text if tokens exist but no transfers exist
- card/list copy that should avoid implying only Canton Coin
- sorting or formatting regressions with longer token names or symbols

Do not redesign the page in this slice.

- [ ] **Step 4: Re-run the targeted frontend tests**

Run:

```bash
rtk npm test --workspace frontend -- --runTestsByPath src/views/TokensView.test.ts src/views/TokenTransferDetailView.test.ts
```

Expected:

- PASS

- [ ] **Step 5: Commit frontend token generalization**

```bash
rtk git add frontend/src/views/TokensView.vue frontend/src/views/TokensView.test.ts frontend/src/views/TokenTransferDetailView.vue frontend/src/views/TokenTransferDetailView.test.ts
rtk git commit -m "feat: render cip56 tokens in explorer views"
```

## Task 7: End-to-end verification

**Files:**
- No planned source edits

- [ ] **Step 1: Run backend tests for touched areas**

```bash
rtk npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts test/api/nodes.controller.spec.ts
```

Expected:

- PASS

- [ ] **Step 2: Run frontend tests for touched areas**

```bash
rtk npm test --workspace frontend -- --runTestsByPath src/lib/api.test.ts src/views/TokensView.test.ts src/views/TokenTransferDetailView.test.ts
```

Expected:

- PASS

- [ ] **Step 3: Run project builds**

```bash
rtk npm run build --workspace backend
rtk npm run build --workspace frontend
```

Expected:

- PASS

- [ ] **Step 4: Manually verify in the browser**

Check:

- `/tokens` lists all observed CIP56 tokens
- a token discovered only from `Create` appears in `Known Tokens`
- `Latest Transfers` still paginates and sorts globally
- clicking a transfer still opens `/tokens/transfers/:updateId`
- detail pages show the correct token id, token name, amount, sender, receiver, and observing nodes

- [ ] **Step 5: Create the final implementation commit**

```bash
rtk git status --short
rtk git add backend/src/domain/node.types.ts backend/src/pqs/pqs-summary.service.ts backend/test/pqs/pqs-summary.service.spec.ts backend/test/api/nodes.controller.spec.ts frontend/src/types/tokens.ts frontend/src/lib/api.ts frontend/src/lib/api.test.ts frontend/src/views/TokensView.vue frontend/src/views/TokensView.test.ts frontend/src/views/TokenTransferDetailView.vue frontend/src/views/TokenTransferDetailView.test.ts
rtk git commit -m "feat: add cip56 token discovery and transfers"
```

## Task 8: Post-implementation follow-up

**Files:**
- Optional: `docs/superpowers/specs/2026-07-07-cip56-token-support-design.md`
- Optional: `docs/superpowers/plans/2026-07-07-cip56-token-support.md`

- [ ] **Step 1: Record any unsupported CIP56 templates encountered during implementation**

If implementation reveals a token whose identity can be discovered but whose transfer extraction remains unsupported, add a short note to the spec or a follow-up doc with:

- template id
- why extraction was not implemented
- what decoder fields were missing

- [ ] **Step 2: Record execution notes for the next worker**

Before handing off, update this plan by checking completed boxes and note any remaining gaps directly in the relevant task section.
