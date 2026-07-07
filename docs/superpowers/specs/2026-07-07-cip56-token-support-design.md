# CIP56 Token Support Design

## Goal

Extend the existing Tokens feature beyond Canton Coin so the explorer can surface observed CIP56 tokens from PQS activity.

This slice is intentionally limited to:

- CIP56 tokens only
- tokens that have actually been observed in PQS-backed activity
- token discovery from observed `Create` events
- transfer history only when we can explicitly derive token movements

It does not attempt generic token inference across arbitrary DARs.

## Requirements Confirmed

- token family: `CIP56` only
- discovery rule: a token should appear in `Known Tokens` as soon as an observed `Create` is found
- transfer rule: a token may appear in `Known Tokens` even when no movement rows are derivable yet
- no speculative tokens from installed packages alone
- no generic “guessing” from decoded fields

## Current State

The current token backend is hard-coded to Canton Coin:

- `fetchTokens()` returns a static single-token list
- `tokenTransferRowsQuery()` only queries Canton Coin-specific templates
- transfer normalization is implemented by `extractCantonCoinMovement()`
- token caches store only normalized Canton Coin movements

That means the current pipeline is not extensible enough for CIP56 support without introducing a registry layer.

## Recommended Approach

### Option 1: Registry-driven CIP56 support

Add an explicit registry of known CIP56 token contracts and movement contracts.

Pros:

- low false-positive risk
- preserves the user’s “CIP56 only” constraint
- easy to test incrementally
- keeps token logic explainable

Cons:

- requires explicit onboarding of each supported CIP56 token pattern

### Option 2: Generic token inference from decoded contracts

Infer tokens from decoded DAR metadata and field names.

Pros:

- broader detection on paper

Cons:

- noisy and error-prone
- violates the “CIP56 only” scope
- couples the explorer to heuristics instead of stable rules

## Recommendation

Implement option 1.

The backend should move from a single Canton Coin special-case to a small registry-driven model where Canton Coin becomes one registry entry and future CIP56 tokens are added the same way.

## User Experience

### Known Tokens

`Known Tokens` should list observed CIP56 tokens only.

A token is included when:

- an observed PQS row matches a configured CIP56 token identity template
- the token’s metadata can be normalized into the explorer token shape

If no transfers are derivable yet, the token still appears here.

Displayed metadata stays minimal:

- token name
- token id
- optional symbol
- source badge (`PQS`)

No token detail page is required in this slice.

### Latest Transfers

`Latest Transfers` continues to show only movements we can explicitly derive.

Observed creates without movement extraction:

- should not generate fake transfer rows
- should not block the token from appearing in `Known Tokens`

The existing merged-transfer UX remains:

- global deduped feed
- one row per logical transfer
- transfer detail page keyed by `updateId`

## Backend Design

### 1. Introduce a CIP56 token registry

Add a registry structure in the backend that describes supported CIP56 token patterns.

Suggested shape:

```ts
interface Cip56TokenDefinition {
  tokenFamily: 'cip56';
  tokenKey: string;
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

Notes:

- `identityTemplates` are used for discovery into `Known Tokens`
- `transferTemplates` are used for movement extraction
- Canton Coin becomes one `Cip56TokenDefinition`

### 2. Split token discovery from token movement extraction

The current implementation conflates “known token” and “known transfer”.

The new model should maintain two related caches:

- observed tokens by node
- observed token transfers by node

That allows a token to be listed in `Known Tokens` after a create, even if no transfer exists yet.

### 3. Add observed-token discovery query

Introduce a query for recent token identity rows that can inspect `Create`-side contract instances for all configured CIP56 identity templates.

Responsibilities:

- search PQS for contracts whose template id matches any configured `identityTemplates`
- decode contract instance data
- normalize token metadata using the matched registry entry
- dedupe identical token identities across nodes

This query is distinct from the transfer-history query.

### 4. Generalize transfer-history query

Replace the current Canton Coin-only transfer template filter with a registry-derived template set.

Responsibilities:

- collect all configured `transferTemplates`
- fetch matching rows from PQS
- decode each row
- route decoding through the matching registry extractor
- normalize into the existing transfer observation model

This keeps the merged-transfer UX unchanged while broadening token coverage.

### 5. Keep the merged transfer pipeline

The global transfer behavior should remain:

- cache per-node observations
- merge into logical transfers globally
- dedupe by normalized transfer identity
- paginate the merged feed
- resolve transfer detail by `updateId`

The existing merged-transfer path is correct and should be reused rather than redesigned.

### 6. Cache model

Keep the current in-memory cache strategy.

Add:

- `observedTokensByNode`
- possibly a merged `knownTokens` cache if it simplifies the top-level endpoint

TTL can remain aligned with the current token-transfer cache cadence.

No persistent storage is needed in this slice.

## API Design

### `GET /api/tokens`

No route shape change.

Behavior change:

- return all observed CIP56 tokens, not just Canton Coin

### `GET /api/tokens/transfers`

No route shape change.

Behavior change:

- return merged transfers for all supported CIP56 token movement templates

### `GET /api/tokens/transfers/:updateId`

No route shape change.

Behavior change:

- allow detail lookup for any supported token transfer, not only Canton Coin-derived rows

## Frontend Impact

Minimal changes are needed if the backend response contracts stay stable.

### Tokens page

The existing `Known Tokens` cards already support a token list and can remain as-is.

The existing `Latest Transfers` table already renders generic transfer rows and should not need a redesign.

### Transfer detail page

The current page is already token-generic enough:

- token id
- amount
- sender / receiver
- update id
- record time
- observing nodes

No new route structure is required.

## Incremental Implementation Plan

### Phase 1: Registry foundation

- introduce CIP56 token definition registry
- migrate Canton Coin onto the registry
- keep behavior unchanged

### Phase 2: Observed token discovery

- add identity-template query
- populate `GET /api/tokens` from observed CIP56 creates
- dedupe token summaries globally

### Phase 3: Multi-token transfer extraction

- generalize transfer template query to all configured CIP56 transfer templates
- route rows through registry extractors
- keep merged transfer feed behavior unchanged

### Phase 4: Tests and fixtures

Add coverage for:

- observed token create yields `Known Tokens` entry
- observed token create without transfer yields no movement rows
- multiple CIP56 token definitions can coexist
- merged transfers remain deduped across nodes
- transfer detail works for non-Canton CIP56 tokens

## Testing Strategy

Backend tests should be the primary safety net.

Add or update tests in:

- `backend/test/pqs/pqs-summary.service.spec.ts`
- `backend/test/api/nodes.controller.spec.ts`

Frontend tests should verify:

- multiple `Known Tokens` entries render correctly
- transfer feed remains generic across token names / ids
- token transfer detail page still renders with non-Canton token metadata

Likely files:

- `frontend/src/views/TokensView.test.ts`
- `frontend/src/views/TokenTransferDetailView.test.ts`
- `frontend/src/lib/api.test.ts`

## Non-Goals

This slice does not include:

- balance computation
- holder pages
- token filtering
- token search
- mint / burn analytics
- generic token inference
- automatic discovery of arbitrary unknown CIP56 templates

## Open Dependency

This design assumes we know which contract templates constitute:

- CIP56 token identity contracts
- CIP56 transfer or movement contracts

If the SDK/backend team has not yet cataloged those templates, the next step before implementation is to enumerate the concrete CIP56 template ids and the decoded field paths for:

- token id
- display name
- symbol
- amount
- sender
- receiver

That catalog is the only missing input needed to implement this safely.
