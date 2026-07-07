# Token Detail Page Design

## Goal

Add a token detail page that opens when a user clicks a token from the Tokens page.

The first version should show:

- token overview metadata
- latest 25 transfers for that token
- top 25 holders for that token

## Scope

Included:

- clickable token cards in `Known Tokens`
- clickable token cells in `Latest Transfers`
- new `/tokens/:tokenId` route
- backend token detail lookup by `tokenId`
- backend token holder lookup by `tokenId`
- token-specific latest-transfer feed

Excluded:

- token issuance history
- mint / burn summaries
- token search inside the token page
- cross-token comparisons
- balance accuracy guarantees beyond observed holding contracts

## Current Context

The explorer already has:

- a top-level `/tokens` page
- a token transfer detail page at `/tokens/transfers/:updateId`
- PQS-backed token discovery
- merged transfer caching
- reusable browser-style sections for overview and tabular lists

The recent backend change added initial CIP56 token support by recognizing:

- `Splice.Api.Token.HoldingV1:Holding`
- `Splice.Api.Token.TransferInstructionV1:Transfer`

That makes a token detail page feasible now without inventing new token heuristics.

## Recommended Approach

### Option 1: Real backend-backed token detail page

Add dedicated token detail endpoints and render a focused page from backend data.

Pros:

- holder data is based on actual observed holding rows
- route is stable and shareable
- transfer list stays consistent with existing backend merge logic
- avoids frontend guesswork

Cons:

- requires a small extension to the token service layer

### Option 2: Frontend-derived token page

Build the page only from `/api/tokens` and `/api/tokens/transfers`.

Pros:

- less backend work

Cons:

- cannot provide trustworthy holder data
- would require inference from transfers
- page would look complete while being inaccurate

## Recommendation

Implement option 1.

The user explicitly wants top holders, so the page needs a backend-backed holder read rather than a frontend approximation.

## User Experience

### Navigation

The following elements should navigate to the token page:

- token cards in `Known Tokens`
- token name / id cell in `Latest Transfers`

Route:

- `/tokens/:tokenId`

### Page Layout

The page should match the existing explorer pattern:

1. `Overview`
2. `Top Holders`
3. `Latest Transfers`

The center width and section styling should follow the current token/update/detail pages instead of introducing a new visual treatment.

### Overview

Show:

- token name
- token id
- symbol
- source pill

If the token is unknown, return a backend `404` and show the existing request-failed behavior on the frontend.

### Top Holders

Show up to 25 holder rows, sorted by observed amount descending.

Each row should include:

- holder party
- observed amount
- optionally observing nodes if the same holder is seen on multiple nodes

Holder parties should be clickable and navigate to `/parties/:partyId`.

### Latest Transfers

Show the latest 25 transfers for that token only.

Reuse the same row structure already used on `/tokens`:

- nodes
- token
- amount
- from
- to
- record time

The list should stay clickable and open `/tokens/transfers/:updateId`.

## Backend Design

### Token Detail Model

Extend the backend token domain with a token-detail shape such as:

```ts
interface TokenDetailResponse {
  token: TokenSummary;
  transfers: TokenTransferSummary[];
}
```

This endpoint should reuse the existing discovered-token cache plus filtered merged transfers.

### Token Holders Model

Add a dedicated holder response:

```ts
interface TokenHolderSummary {
  partyId: string;
  amount: string | null;
  nodes: Array<{
    nodeId: string;
    label: string;
  }>;
}

interface TokenHoldersResponse {
  tokenId: string;
  holders: TokenHolderSummary[];
}
```

### Holder Extraction Rules

For this slice, holder data should only come from observed holding-style contract rows.

For the currently supported CIP56 shape:

- template id: `Splice.Api.Token.HoldingV1:Holding`
- holder field: `owner`
- amount field: `amount`
- token identity field path: `instrumentId.id`

If a token has transfer support but no holding support, the token detail page may show:

- overview
- transfers
- empty holders state

That is acceptable and more honest than inferred balances.

### API Endpoints

Add:

- `GET /api/tokens/:tokenId`
- `GET /api/tokens/:tokenId/holders`

Behavior:

- token ids are URL-decoded and matched against normalized token ids
- unknown token ids return `404`
- transfers are filtered from the existing merged transfer observations
- holders are merged globally across nodes and deduped by party id

### Caching

Reuse the in-memory token cache strategy.

Add per-node observed holder rows if needed, rather than recomputing from PQS on every request.

The page only needs the latest/observed state, not durable history.

## Frontend Design

### Route

Add:

- `/tokens/:tokenId`

### Component

Create a dedicated `TokenDetailView.vue`.

Responsibilities:

- fetch token detail
- fetch top holders
- render overview
- render filtered latest transfers
- route token-transfer clicks and party clicks consistently

### Interaction Rules

- token card click on `/tokens` goes to `/tokens/:tokenId`
- token cell click in global transfers goes to `/tokens/:tokenId`
- party click in holders goes to `/parties/:partyId`
- transfer row click goes to `/tokens/transfers/:updateId`

## Error Handling

- unknown token id: backend `404`
- holders unavailable because no holdings observed: show a normal empty state, not an error
- partial decode failures: skip bad rows rather than inventing holder balances

## Testing

Backend coverage should include:

- token detail lookup by token id
- holder extraction from holding rows
- dedupe of the same holder across nodes
- unknown token `404`

Frontend coverage should include:

- token card navigation
- token cell navigation from transfer rows
- token detail overview rendering
- top holders rendering and party links
- token-filtered transfer list rendering

## Implementation Direction

This should be implemented as a small extension of the current Tokens feature, not a separate token subsystem.

The key rule is:

- real token detail data is allowed
- inferred balances are not
