# Tokens Page Design

## Goal

Add a top-level `Tokens` page that lists discovered tokens, starting with `Canton Coin`, and shows the latest 25 token transfers across all connected nodes.

## Scope

This first slice is intentionally narrow.

Included:

- a new `Tokens` navigation item in the shared header
- a new `/tokens` route
- backend discovery of `Canton Coin`
- backend caching of normalized `Canton Coin` transfer history
- a merged latest-25 transfer feed across nodes
- a frontend page with:
  - a `Known Tokens` section
  - a `Latest Transfers` section

Excluded:

- a generic multi-token registry abstraction
- token balances or per-holder balances
- token detail pages
- token search
- token issuance / mint / burn summaries
- gRPC-specific token reads
- persistent cache storage beyond process lifetime

## Why This Slice

The user wants a concrete operator-facing `Tokens` page now, not a speculative asset framework.

The repo already has:

- PQS-backed cached activity history
- merged global update and contract feeds
- decoded Splice/Amulet knowledge in update and contract detail logic
- reusable browser-style frontend patterns

That makes `Canton Coin` a good first token because it can use the existing PQS and decoded-template infrastructure without inventing rules for arbitrary token contracts before we know the data shape.

## User Experience

### Navigation

- add `Tokens` to the shared top header after `Contracts`
- route path: `/tokens`

### Page Layout

The page follows the existing business-style explorer layout:

1. `Known Tokens`
2. `Latest Transfers`

The first version should feel like the other top-level pages and reuse existing list-browser patterns instead of introducing a one-off visual system.

### Known Tokens

This section is a simple list or compact cards.

Initially it contains only:

- `Canton Coin`

Each token entry should show only minimal metadata in this slice:

- token name
- canonical token id or template identifier
- source indicator of `PQS`

No token detail route is required yet.

### Latest Transfers

Show the latest 25 transfers across all nodes, globally sorted newest first.

Each row should include:

- node label
- token name
- amount
- sender
- receiver
- record time
- link target back to the originating update detail page

The first page does not need advanced filtering unless the implementation naturally reuses an existing browser component with a small amount of shared filter infrastructure.

## Recommended Backend Approach

### Option 1: Dedicated `Canton Coin` pipeline

Pros:

- smallest safe implementation
- data rules stay explicit
- easier to test
- avoids pretending all token contracts look the same

Cons:

- not yet generic

### Option 2: Generic token registry now

Pros:

- more extensible on paper

Cons:

- speculative
- likely to encode incorrect assumptions
- slower to ship

Recommendation:

- implement a dedicated `Canton Coin` pipeline first

## Data Source Strategy

Use PQS-backed data only.

The explorer should detect `Canton Coin` transfers from known decoded Splice/Amulet update/event patterns already recognized in the backend. The exact transfer-identification rules belong in a focused normalization layer, not spread across controllers or frontend code.

The source of truth should be update/event records, not active contracts, because the page is about transfer history.

## Backend Architecture

### 1. Token discovery and transfer normalization

Add a token-focused service that can:

- identify known token definitions
- normalize matching transfer events into explorer-owned transfer records

For this slice, the normalization rules only need to recognize `Canton Coin`.

Suggested normalized shape:

```ts
interface TokenSummary {
  tokenId: string;
  name: string;
  symbol: string | null;
  source: 'pqs';
}

interface TokenTransferSummary {
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
```

Notes:

- `amount` stays stringly typed in the API because token quantities may not fit safe JS integer assumptions
- `sender` and `receiver` may be null if a transfer-like event is only partially decodable
- `eventOffset` is the primary route identity, consistent with the rest of the explorer

### 2. In-memory cache

Add a dedicated in-memory token cache in the backend.

Responsibilities:

- keep the discovered token list
- keep recent normalized transfer records per node
- keep a merged global transfer feed
- refresh on a fixed interval using the existing polling/caching model

This cache should behave like the existing operator-focused activity caches:

- cheap to serve from memory
- okay to rebuild after backend restart

No sqlite or durable persistence is required in this slice.

### 3. Polling model

Use a periodic refresh cadence, aligned with the existing backend cache patterns.

Recommended behavior:

- refresh token transfer caches during the normal node polling cycle or from a dedicated token cache refresher invoked by that cycle
- keep only a bounded recent window needed to serve the page efficiently

The initial UI only needs:

- current discovered tokens
- latest 25 transfers

So the cache does not need full historical replay in this first slice.

### 4. API endpoints

Add two endpoints:

`GET /api/tokens`

Returns:

```ts
interface TokensResponse {
  tokens: TokenSummary[];
}
```

`GET /api/tokens/transfers?limit=25&before=<cursor>&after=<cursor>`

Returns:

```ts
interface TokenTransfersResponse {
  limit: number;
  nextBefore: string | null;
  nextAfter: string | null;
  transfers: TokenTransferSummary[];
}
```

Pagination should use opaque keyset cursors like the existing global updates/contracts feeds.

## Transfer Identification Rules

The token pipeline should not scrape arbitrary decoded payloads heuristically.

Instead, it should use explicit rules for `Canton Coin`, based on:

- known template ids
- known transfer-related choices or create/exercise event shapes
- decoded argument/result fields when available

If a transfer candidate cannot be confidently normalized, it should be skipped rather than emitting misleading token history.

That keeps the first version trustworthy.

## Frontend Architecture

### Route and Navigation

- add `Tokens` to the shared top header
- add `/tokens` to `router.ts`

### Page Component

Create a dedicated `TokensView.vue`.

It should load:

- token list from `/tokens`
- transfer feed from `/tokens/transfers`

The page should reuse the same operational styling language as `ContractsView`, `PartiesView`, and the home-page browsers.

### Known Tokens section

Render the discovered tokens at the top in a compact block.

For the first version, the section should not imply unsupported complexity:

- no filters
- no token detail links
- no balance widgets

### Latest Transfers section

Use a reusable browser-style table, either by:

- introducing a focused `TokenTransfersBrowser` component, or
- extracting a thin shared pagination/header pattern from existing browsers if that can be done cleanly

Recommended row columns:

- `Node`
- `Token`
- `Amount`
- `From`
- `To`
- `Record Time`

Each row should navigate to the originating update detail page:

`/nodes/:nodeId/updates/:eventOffset?from=tokens`

## Error Handling

### Backend

- if one node fails PQS token normalization, do not fail the entire tokens page
- degrade that node’s contribution and continue serving the rest
- surface warnings in logs similarly to the existing poll/cache patterns

### Frontend

- show a standard loading state
- show a standard request failure state if the top-level fetch fails
- show an empty-state message when no tokens or transfers are currently discoverable

## Testing Strategy

### Backend

Add tests for:

- `Canton Coin` discovery
- transfer normalization from known decoded/update shapes
- cache refresh behavior
- global transfer ordering and pagination cursors
- controller responses for `/tokens` and `/tokens/transfers`

### Frontend

Add tests for:

- top-nav `Tokens` link presence
- `/tokens` route rendering
- token list rendering with `Canton Coin`
- latest-transfer table rendering
- row link behavior to update detail
- pagination controls for the transfer feed

## Future Extension Path

Once `Canton Coin` is stable, the next step can generalize the token discovery layer into a proper registry.

That later phase can add:

- more token definitions
- token detail pages
- holder or balance views
- advanced filters by token or party

This slice should preserve that path by keeping:

- explorer-owned token response types
- a dedicated normalization boundary
- a dedicated cache boundary

But it should not attempt to build the generic version yet.
