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
- Submit navigates to `/search?q=<raw query>`.
- Empty or whitespace-only query does not issue a request.

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

### Parties

Match exact or prefix against normalized party IDs shown by the app.

The search layer should also tolerate party values that still include raw transport prefixes if they appear in stored data.

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

## Backend Design

### Endpoint

Add:

- `GET /search?q=...`

Likely in the existing `NodesController`, since that controller already exposes the entity-oriented read API surface.

### Response shape

Return grouped results instead of a flat mixed list.

Proposed shape:

```ts
interface SearchResultsResponse {
  query: string;
  updates: SearchUpdateResult[];
  contracts: SearchContractResult[];
  parties: SearchPartyResult[];
  packages: {
    packageIds: SearchPackageIdResult[];
    packageNames: SearchPackageNameResult[];
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

### Result limits

Use per-group caps rather than one global cap.

Recommended initial cap:

- 25 results per group

If a group is truncated, include enough information for the frontend to show that only the first page is displayed.

### Failure handling

Search should degrade by group where possible.

If one group query fails:

- Log it
- Return other successful groups
- Include an empty group rather than failing the whole search request

Only reject the whole request for fundamentally invalid input or unrecoverable shared failures.

## Query Strategy

### Updates

Search needs to support both event offsets and update IDs.

Implementation approach:

- Match exact or prefix on normalized event offset
- Match exact or prefix on normalized update ID
- Reuse the same result-linking shape already used by update lists so routing remains correct

### Contracts

Search exact or prefix on contract ID and return node context with minimal metadata.

### Parties

Search exact or prefix on party ID.

Because party detail pages already exist globally, result rows can link directly to `/parties/:partyId`.

### Packages

Run two distinct searches:

- package ID
- package name

Package name matches should link to the existing package family page.

Package ID matches should link to the package detail page.

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

- loading
- loaded with matches
- loaded with no matches
- request error

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
- exact contract match
- prefix contract match
- exact party match
- prefix party match
- exact package ID match
- prefix package ID match
- exact package name match
- prefix package name match
- grouped response shape
- partial failure behavior

### Frontend

Add coverage for:

- search submit navigates to `/search?q=...`
- query is restored from the URL on the search page
- loading state
- empty state
- grouped result rendering
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
