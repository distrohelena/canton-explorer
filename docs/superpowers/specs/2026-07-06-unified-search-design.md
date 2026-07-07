# Unified Search Design

## Summary

Add a submit-only global search flow that routes to `/search?q=...` and returns grouped exact/prefix matches for all entities that already have destination pages.

Initial searchable entities:

- Parties
- Updates
- Event offsets
- Contracts
- Package IDs
- Package names

The first version always opens a results page. It does not auto-redirect on a single match, does not do fuzzy matching, and does not depend on gRPC.

## Goals

- Make the existing titlebar search box functional.
- Let operators paste a known identifier or prefix and navigate to the right page from grouped results.
- Keep matching rules predictable for long identifiers.
- Reuse existing destination pages instead of inventing search-only detail pages.

## Non-Goals

- Live autocomplete
- Fuzzy or substring search
- Full-text indexing
- Ranking beyond exact matches before prefix matches within a group
- gRPC-backed search

## User Experience

### Entry point

The existing titlebar search box remains the single entry point.

Behavior:

- User types a query.
- Search runs only on explicit submit.
- Submit navigates to `/search?q=<trimmed query>`.
- Empty or whitespace-only query does not issue a request.
- The titlebar input may keep the user's typed whitespace locally, but the routed query string and backend request always use the trimmed value.

Current app note:

- The titlebar currently routes search submits directly to `/parties/:partyId`.
- This behavior must be replaced by the unified `/search?q=...` flow.

### Results page

Create a dedicated `SearchResultsView` at `/search`.

The page shows:

- The submitted query
- A grouped result layout
- A per-group result count
- A clean empty state if no matches exist

Direct-load behavior:

- `/search` with no `q` parameter renders an idle empty state and does not request backend data.
- `/search?q=` or `/search?q=%20...` behaves the same after trimming: idle empty state and no backend request.
- `/search?q=<value>` restores the trimmed query into the page state and drives the fetch.

Group order:

1. Updates
2. Contracts
3. Parties
4. Packages

Packages should visually distinguish:

- Package ID matches
- Package name matches

Updates should show minimal metadata already familiar from existing update lists:

- Node
- Event offset
- Record time
- Parties if available

Contracts should show:

- Node
- Contract ID
- Template ID if available

Parties should show:

- Party ID
- Minimal node context if useful

Packages should show:

- Package ID or package name
- Version if available

Each row links to the existing destination page for that entity.

## Matching Rules

Search uses exact and prefix matching only.

### Query normalization

- Trim leading and trailing whitespace.
- Preserve case-sensitive semantics by default.
- Keep matching logic explicit per entity instead of applying one generic normalization everywhere.
- Use the trimmed query for both routing and backend lookup.

### Parties

Match exact or prefix against normalized party IDs shown by the app.

The search layer should also tolerate party values that still include raw transport prefixes if they appear in stored data.

Rules:

- Query `p|Alice` must match the normalized party ID `Alice`.
- Query `Alice` must also match stored raw forms like `p|Alice`.
- Returned `partyId` values in search results are always normalized display values.
- Party links always use the normalized app route form: `/parties/:partyId`.

### Updates

Treat update search as matching either:

- Event offset
- Update ID

Exact and prefix matches are both valid.

Results are returned in a single `updates` group.

### Contracts

Match exact or prefix against contract IDs.

### Packages

Support both:

- Package ID exact/prefix
- Package name exact/prefix

Package results should retain enough metadata for disambiguation, especially version.

Package search is limited to packages already resolved in `PackageCacheService`, because those are the only package pages guaranteed to exist.

## Backend Design

### Endpoint

Add:

- `GET /search?q=...`

Likely in the existing `NodesController`, since that controller already exposes the entity-oriented read API surface.

### Response shape

Return grouped results instead of a flat mixed list.

Proposed shape:

```ts
interface SearchResultGroup<T> {
  items: T[];
  displayedCount: number;
  truncated: boolean;
  status: 'ok' | 'partial' | 'failed';
  warnings: string[];
}

interface SearchResultsResponse {
  query: string;
  updates: SearchResultGroup<SearchUpdateResult>;
  contracts: SearchResultGroup<SearchContractResult>;
  parties: SearchResultGroup<SearchPartyResult>;
  packages: {
    packageIds: SearchResultGroup<SearchPackageIdResult>;
    packageNames: SearchResultGroup<SearchPackageNameResult>;
  };
}
```

Representative result shapes:

```ts
interface SearchUpdateResult {
  nodeId: string;
  label: string;
  eventOffset: string;
  updateId: string;
  recordTime: string | null;
  parties: string[];
}

interface SearchContractResult {
  nodeId: string;
  label: string;
  contractId: string;
  templateId: string | null;
  createdRecordTime: string | null;
}

interface SearchPartyResult {
  partyId: string;
  nodeIds: string[];
}

interface SearchPackageIdResult {
  packageId: string;
  name: string | null;
  version: string | null;
}

interface SearchPackageNameResult {
  name: string;
  packages: Array<{
    packageId: string;
    version: string | null;
  }>;
}
```

### Service structure

Add one orchestrating method to `PqsSummaryService`:

- `search(query: string): Promise<SearchResultsResponse>`

Keep matching logic split into focused helpers:

- `searchUpdates`
- `searchContracts`
- `searchParties`
- `searchPackages`

This keeps the cross-entity entry point simple while avoiding one oversized query method.

### Data sources

- Updates: PQS
- Contracts: PQS
- Parties: existing PQS-backed active-party view or equivalent search query
- Packages: `PackageCacheService`

No gRPC fallback in v1.

Package groups must only emit cache-backed matches that can resolve to existing package detail or package-family pages.

### Result limits

Use per-group caps rather than one global cap.

Recommended initial cap:

- 25 results per group

If a group is truncated, include enough information for the frontend to show that only the first page is displayed.

Search dedupes within each group before truncation:

- Updates dedupe by `(nodeId, eventOffset)`
- Contracts dedupe by `(nodeId, contractId)`
- Parties dedupe by normalized `partyId`
- Package ID matches dedupe by `packageId`
- Package name matches dedupe by normalized package `name`

### Failure handling

Search should degrade by group where possible.

If one group query fails:

- Log it
- Return other successful groups
- Return the failed group with `status: 'failed'`, empty `items`, and at least one warning message

For PQS-backed groups that aggregate across multiple nodes:

- A single node failure must not discard successful matches from other nodes.
- If at least one node succeeds and at least one node fails, return the successful merged items with `status: 'partial'` and warnings that identify the failing node labels.
- If all contributing nodes fail for that group, return `status: 'failed'`.

Only reject the whole request for fundamentally invalid input or unrecoverable shared failures.

## Query Strategy

### Updates

Search needs to support both event offsets and update IDs.

Implementation approach:

- Match exact or prefix on normalized event offset
- Match exact or prefix on normalized update ID
- Reuse the same result-linking shape already used by update lists so routing remains correct
- Dedupe results that match both event offset and update ID, then order exact matches before prefix matches
- Within the same match bucket, order by record time descending, then node label ascending, then event offset descending where available

### Contracts

Search exact or prefix on contract ID and return node context with minimal metadata.

Order exact matches before prefix matches, then created record time descending, then node label ascending.

### Parties

Search exact or prefix on party ID.

Because party detail pages already exist globally, result rows can link directly to `/parties/:partyId`.

Order exact matches before prefix matches, then normalized `partyId` ascending.

### Packages

Run two distinct searches:

- package ID
- package name

Package name matches should link to the existing package family page.

Package ID matches should link to the package detail page.

Order exact matches before prefix matches.

Secondary ordering:

- Package ID matches: package name ascending when present, then version descending, then package ID ascending
- Package name matches: package name ascending

## Frontend Design

### Route

Add:

- `/search`

The route reads `q` from the URL query string.

### Search bar behavior

The global search component should:

- Submit to `/search?q=...`
- Preserve the current query when already on the search page
- Not issue network requests itself
- Avoid adding a `q` route update for whitespace-only submits

Implementation note:

- Replace the current direct party-navigation submit handler in `App.vue`.

This keeps the titlebar simple and moves all loading/error/result behavior into the page component.

### Search results page

Create a view that:

- Reads `q`
- Fetches results from the backend
- Renders grouped sections
- Reuses existing visual patterns for linked rows

States:

- idle empty query
- loading
- loaded with matches
- loaded with no matches
- loaded with partial group failures
- request error

Per-group rendering should distinguish:

- no matches
- truncated results
- partial failure warnings
- full group failure warnings

### Reuse opportunities

The results page should reuse existing display primitives where it is cheap to do so, but should not force a full table component into a search result if the component expects pagination/filter state that search does not use.

Use the same visual language, not necessarily the same component tree.

## Routing Rules

Result link destinations:

- Party match → `/parties/:partyId`
- Update match → `/nodes/:nodeId/updates/:eventOffset`
- Contract match → `/nodes/:nodeId/contracts/:contractId`
- Package ID match → `/packages/:packageId`
- Package name match → `/packages/by-name/:packageName`

This keeps search as a thin discovery layer on top of existing destination pages.

## Testing Strategy

### Backend

Add coverage for:

- exact update match
- prefix update match
- exact update-id plus event-offset double-match dedupe
- exact contract match
- prefix contract match
- exact party match
- prefix party match
- `p|`-prefixed party query normalization
- exact package ID match
- prefix package ID match
- exact package name match
- prefix package name match
- package search limited to cache-resolved entries
- grouped response shape
- partial failure behavior
- direct-load empty-query behavior
- ordering rules within result groups

### Frontend

Add coverage for:

- search submit navigates to `/search?q=...`
- whitespace-only submit does not navigate
- query is restored from the URL on the search page
- direct `/search` load shows idle state without fetching
- loading state
- empty state
- grouped result rendering
- per-group warning rendering
- link destinations per result type
- backend error state

## Tradeoffs

### Why grouped results instead of direct navigation

The user explicitly wants all searches to land on a results page. This also handles ambiguous prefixes cleanly and avoids fragile heuristics.

### Why exact/prefix only

Identifiers in this app are long and structured. Exact/prefix search is predictable, cheap to implement, and less error-prone than fuzzy matching.

### Why a single backend endpoint

One backend endpoint centralizes search semantics, avoids frontend type guessing, and gives us one place to extend later if additional entities become searchable.

## Future Extensions

Possible later additions after v1:

- live suggestions
- relevance ranking
- fuzzy matching for names only
- filtering results by entity type
- pagination within result groups
- gRPC-backed search sources
