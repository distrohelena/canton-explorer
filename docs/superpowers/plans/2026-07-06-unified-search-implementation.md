# Unified Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a submit-only global search flow that routes the shared titlebar input to `/search?q=...` and shows grouped exact/prefix matches for updates, contracts, parties, package IDs, and package names.

**Architecture:** The backend adds a single `/api/search` endpoint in `NodesController` backed by a new orchestrating `PqsSummaryService.search(...)` method that aggregates PQS-backed updates/contracts/parties and cache-backed packages into grouped result sections with explicit partial-failure metadata. The frontend keeps the titlebar dumb, adds a `SearchResultsView` route that reads the query from the URL, calls one API helper, and renders grouped linked rows using the same visual language as existing updates/contracts/package pages.

**Tech Stack:** NestJS, TypeScript, PostgreSQL/PQS SQL, Vue 3, Vue Router, Vitest, Jest

---

## File Structure

**Backend**

- Modify: `backend/src/api/nodes.controller.ts`
  Adds `GET /search` and query normalization at the controller boundary.
- Modify: `backend/src/domain/node.types.ts`
  Defines backend search response types shared across controller/service tests.
- Modify: `backend/src/pqs/pqs-summary.service.ts`
  Implements `search(...)` plus focused helpers for updates, contracts, parties, and packages.
- Test: `backend/test/api/nodes.controller.spec.ts`
  Covers controller query parsing and endpoint wiring.
- Test: `backend/test/pqs/pqs-summary.service.spec.ts`
  Covers grouped results, normalization, ordering, dedupe, and partial failure behavior.

**Frontend**

- Modify: `frontend/src/App.vue`
  Replaces direct party navigation with trimmed `/search?q=...` routing and keeps the shared input synchronized with search-page URLs.
- Modify: `frontend/src/App.test.ts`
  Covers titlebar submission, whitespace behavior, and route synchronization.
- Modify: `frontend/src/router.ts`
  Registers the `/search` route.
- Create: `frontend/src/views/SearchResultsView.vue`
  Owns query-string driven loading, grouped rendering, and search-page states.
- Create: `frontend/src/views/SearchResultsView.test.ts`
  Covers loading, idle, empty, grouped rows, partial warnings, and link destinations.
- Modify: `frontend/src/lib/api.ts`
  Adds `fetchSearchResults(...)`.
- Modify: `frontend/src/lib/api.test.ts`
  Covers `/api/search?q=...` request building and response parsing.
- Create: `frontend/src/types/search.ts`
  Declares frontend search result payload types.
- Modify: `frontend/src/styles.css`
  Adds search-page layout and group styling that matches the existing production-oriented design.

**Deliberate non-changes**

- Do not add live autocomplete.
- Do not add fuzzy matching.
- Do not reuse `UpdatesBrowser.vue` for the search page; it owns pagination/filter behavior that search does not use.
- Do not add gRPC fallback to search.

### Task 1: Add the backend and frontend search API contract

**Files:**
- Modify: `backend/src/domain/node.types.ts`
- Modify: `backend/src/api/nodes.controller.ts`
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/types/search.ts`
- Test: `backend/test/api/nodes.controller.spec.ts`
- Test: `frontend/src/lib/api.test.ts`

- [ ] **Step 1: Write the failing contract tests**

Add or extend tests so the backend controller and frontend API helper both expect:

```ts
{
  query: 'Alice',
  updates: {
    items: [],
    displayedCount: 0,
    truncated: false,
    status: 'ok',
    warnings: [],
  },
  contracts: {
    items: [],
    displayedCount: 0,
    truncated: false,
    status: 'ok',
    warnings: [],
  },
  parties: {
    items: [{ partyId: 'Alice', nodeIds: ['participant-1'] }],
    displayedCount: 1,
    truncated: false,
    status: 'ok',
    warnings: [],
  },
  packages: {
    packageIds: {
      items: [],
      displayedCount: 0,
      truncated: false,
      status: 'ok',
      warnings: [],
    },
    packageNames: {
      items: [],
      displayedCount: 0,
      truncated: false,
      status: 'ok',
      warnings: [],
    },
  },
}
```

Also assert:

- `fetchSearchResults(' Alice ')` requests `/api/search?q=Alice`
- whitespace-only input is not routed by `App.vue` and therefore never reaches `fetchSearchResults(...)`

- [ ] **Step 2: Run the targeted contract tests to verify they fail**

Run:

```bash
npm test --workspace backend -- nodes.controller.spec.ts --testNamePattern="search|/search"
npm test --workspace frontend -- api.test.ts
```

Expected: FAIL because neither the backend endpoint nor the frontend helper exists yet.

- [ ] **Step 3: Add the shared search payload types**

In `backend/src/domain/node.types.ts`, add:

- `SearchResultGroup<T>`
- `SearchResultsResponse`
- `SearchUpdateResult`
- `SearchContractResult`
- `SearchPartyResult`
- `SearchPackageIdResult`
- `SearchPackageNameResult`

In `frontend/src/types/search.ts`, mirror the response shape in frontend-native types.

Keep field names identical between backend and frontend:

- `displayedCount`
- `truncated`
- `status`
- `warnings`

- [ ] **Step 4: Add the controller endpoint and frontend API helper**

Update `backend/src/api/nodes.controller.ts` with:

```ts
@Get('/search')
search(@Query('q') query?: string) {
  return this.pqsSummaryService.search(query ?? '');
}
```

The service call should receive the raw controller input so trimming behavior is tested inside the service contract rather than hidden in the controller.

Update `frontend/src/lib/api.ts` with:

```ts
export function fetchSearchResults(query: string): Promise<SearchResultsResponse> {
  return fetchJson<SearchResultsResponse>(`/search?q=${encodeURIComponent(query.trim())}`);
}
```

- [ ] **Step 5: Run the targeted contract tests and make sure they pass**

Run:

```bash
npm test --workspace backend -- nodes.controller.spec.ts --testNamePattern="search|/search"
npm test --workspace frontend -- api.test.ts
```

Expected: PASS

### Task 2: Implement backend search aggregation, normalization, and failure semantics

**Files:**
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Modify: `backend/src/domain/node.types.ts`
- Test: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Write the failing service tests**

Add focused `PqsSummaryService` tests for:

- exact party match on normalized ID
- prefix party match on normalized ID
- `p|Alice` query matching normalized result `Alice`
- exact event offset match
- exact update ID match
- update result dedupe when the same row matches both event offset and update ID
- exact contract match
- exact package ID match
- exact package name match
- package search limited to cache-backed packages
- per-group truncation metadata
- per-group `status: 'partial'` when one node fails but others succeed
- per-group `status: 'failed'` when all nodes fail for a group
- empty trimmed query returning empty successful groups without PQS requests

Use explicit fixtures so ordering is asserted, not inferred.

- [ ] **Step 2: Run the targeted service tests to verify they fail**

Run:

```bash
npm test --workspace backend -- pqs-summary.service.spec.ts --testNamePattern="search"
```

Expected: FAIL because no unified search orchestration exists yet.

- [ ] **Step 3: Add the top-level `search(...)` method and empty-query fast path**

In `backend/src/pqs/pqs-summary.service.ts`, add:

```ts
async search(query: string): Promise<SearchResultsResponse>
```

Rules:

- trim the incoming query once
- if the trimmed query is empty, return all groups empty with `status: 'ok'`
- do not hit PQS or package cache for the empty-query case

- [ ] **Step 4: Implement focused per-entity helpers**

Create or extend focused helpers inside `PqsSummaryService`:

- `searchUpdates(...)`
- `searchContracts(...)`
- `searchParties(...)`
- `searchPackages(...)`

Implementation rules:

- updates search both `eventOffset` and `updateId`
- contracts search only `contractId`
- parties search normalized display IDs while tolerating stored `p|` forms
- package ID and package name searches are distinct groups
- package groups only emit cache-backed entries that resolve to existing pages

Prefer small helper methods for:

- trimming and query normalization
- party normalization
- group-shape creation
- warning formatting
- exact-vs-prefix ranking
- stable ordering

- [ ] **Step 5: Apply dedupe, ordering, and truncation consistently**

Implement the spec rules exactly:

- Updates dedupe by `(nodeId, eventOffset)`
- Contracts dedupe by `(nodeId, contractId)`
- Parties dedupe by normalized `partyId`
- Package ID matches dedupe by `packageId`
- Package name matches dedupe by package `name`

Ordering:

- exact matches before prefix matches in every group
- updates: record time descending, node label ascending, event offset descending
- contracts: created record time descending, node label ascending
- parties: normalized party ID ascending inside the same match bucket
- package IDs: package name ascending, version descending, package ID ascending
- package names: package name ascending

Apply per-group cap after dedupe and ordering.

- [ ] **Step 6: Implement node-level partial-failure handling**

When a PQS-backed group fans out across nodes:

- collect successful node results even if one node fails
- return `status: 'partial'` with node-labeled warnings when at least one node succeeds and one fails
- return `status: 'failed'` with empty `items` when all nodes fail for that group
- do not let one failed group abort the whole `/search` response

Package search can stay `ok` or `failed` at the group level because it is cache-backed rather than node-fanned.

- [ ] **Step 7: Run the targeted backend tests and make sure they pass**

Run:

```bash
npm test --workspace backend -- pqs-summary.service.spec.ts --testNamePattern="search"
npm test --workspace backend -- nodes.controller.spec.ts --testNamePattern="search|/search"
```

Expected: PASS

### Task 3: Route the shared titlebar search to `/search`

**Files:**
- Modify: `frontend/src/App.vue`
- Modify: `frontend/src/router.ts`
- Modify: `frontend/src/App.test.ts`

- [ ] **Step 1: Write the failing shell-routing tests**

Add tests that expect:

- submitting `Alice` from the shared titlebar on `/` navigates to `/search?q=Alice`
- submitting `' Alice '` routes to `/search?q=Alice`
- whitespace-only submit does nothing
- loading `/search?q=Alice` pre-populates the titlebar input with `Alice`
- changing routes away from `/search` does not leave stale search-page-only synchronization behind

- [ ] **Step 2: Run the targeted shell tests to verify they fail**

Run:

```bash
npm test --workspace frontend -- App.test.ts
```

Expected: FAIL because `App.vue` currently routes submits to `/parties/:partyId`.

- [ ] **Step 3: Register the search route**

In `frontend/src/router.ts`, add:

```ts
{ path: '/search', component: SearchResultsView }
```

Place it with the other top-level routes near `/`, `/nodes`, `/parties`, and `/contracts`.

- [ ] **Step 4: Replace direct party navigation in `App.vue`**

Update `submitSearch()` so it:

- trims `searchTerm.value`
- returns early on empty trimmed input
- pushes `{ path: '/search', query: { q: trimmed } }`

Also add route-aware synchronization so:

- entering `/search?q=Alice` sets the titlebar input to `Alice`
- `/search` with no `q` clears the shared input
- non-search routes do not unexpectedly rewrite the field during normal typing

Recommended implementation shape:

- use `useRoute()` alongside `useRouter()`
- add a narrow watcher that only syncs from the route when `route.path === '/search'`

- [ ] **Step 5: Run the targeted shell tests and make sure they pass**

Run:

```bash
npm test --workspace frontend -- App.test.ts
```

Expected: PASS

### Task 4: Build the search results page

**Files:**
- Create: `frontend/src/views/SearchResultsView.vue`
- Create: `frontend/src/views/SearchResultsView.test.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/types/search.ts`
- Modify: `frontend/src/styles.css`
- Reuse: `frontend/src/components/QuerySourcePill.vue`

- [ ] **Step 1: Write the failing search-page tests**

Add tests covering:

- direct `/search` load with no `q` renders an idle state and does not fetch
- `/search?q=Alice` shows a loading state, then grouped results
- grouped sections render in this order: Updates, Contracts, Parties, Packages
- package results distinguish `Package IDs` and `Package Names`
- update rows link to `/nodes/:nodeId/updates/:eventOffset`
- contract rows link to `/nodes/:nodeId/contracts/:contractId`
- party rows link to `/parties/:partyId`
- package ID rows link to `/packages/:packageId`
- package name rows link to `/packages/by-name/:packageName`
- group warnings render for `partial` and `failed` groups
- empty loaded results render a clean no-match state

- [ ] **Step 2: Run the targeted search-page tests to verify they fail**

Run:

```bash
npm test --workspace frontend -- SearchResultsView.test.ts
```

Expected: FAIL because the route and page do not exist yet.

- [ ] **Step 3: Implement `SearchResultsView.vue` with URL-driven loading**

The view should:

- read `q` from `useRoute()`
- trim it before fetch
- stay idle when the trimmed value is empty
- call `fetchSearchResults(trimmedQuery)` when non-empty
- render `loading`, `loaded`, `empty`, and `request error` states

Keep state local to the page:

- `results`
- `loading`
- `error`
- derived `trimmedQuery`

- [ ] **Step 4: Render grouped sections with existing visual language**

Render:

- `Updates`
- `Contracts`
- `Parties`
- `Packages`

For each group:

- show a heading and displayed count
- show truncated text when `truncated === true`
- show warnings when `status !== 'ok'`
- render rows as links using the existing card/list/table visual language already used elsewhere in the app

For packages, render two subsections:

- `Package IDs`
- `Package Names`

If helpful, create a tiny local render helper inside the view rather than introducing a new generic component too early.

- [ ] **Step 5: Add search-page styles without breaking existing layouts**

In `frontend/src/styles.css`, add styles for:

- the search results page container
- group headers
- warning text
- compact linked rows
- package subsection split

Match the established app direction:

- full-width top bar remains unchanged
- center content width should match the production-oriented pages
- keep typography aligned with the existing canton/etherscan-inspired look

- [ ] **Step 6: Run the targeted search-page tests and make sure they pass**

Run:

```bash
npm test --workspace frontend -- SearchResultsView.test.ts
```

Expected: PASS

### Task 5: Run cross-feature regression verification and commit in small slices

**Files:**
- Verify only: `backend/test/api/nodes.controller.spec.ts`
- Verify only: `backend/test/pqs/pqs-summary.service.spec.ts`
- Verify only: `frontend/src/App.test.ts`
- Verify only: `frontend/src/lib/api.test.ts`
- Verify only: `frontend/src/views/SearchResultsView.test.ts`

- [ ] **Step 1: Run the focused backend regression suite**

Run:

```bash
npm test --workspace backend -- nodes.controller.spec.ts
npm test --workspace backend -- pqs-summary.service.spec.ts
```

Expected: PASS

- [ ] **Step 2: Run the focused frontend regression suite**

Run:

```bash
npm test --workspace frontend -- App.test.ts
npm test --workspace frontend -- api.test.ts
npm test --workspace frontend -- SearchResultsView.test.ts
```

Expected: PASS

- [ ] **Step 3: Run build verification before final handoff**

Run:

```bash
npm run build --workspace backend
npm run build --workspace frontend
```

Expected: PASS

- [ ] **Step 4: Commit in small, reviewable slices**

Recommended commit sequence:

```bash
git add backend/src/domain/node.types.ts backend/src/api/nodes.controller.ts backend/src/pqs/pqs-summary.service.ts backend/test/api/nodes.controller.spec.ts backend/test/pqs/pqs-summary.service.spec.ts
git commit -m "feat: add backend unified search endpoint"

git add frontend/src/App.vue frontend/src/App.test.ts frontend/src/router.ts frontend/src/lib/api.ts frontend/src/lib/api.test.ts frontend/src/types/search.ts frontend/src/views/SearchResultsView.vue frontend/src/views/SearchResultsView.test.ts frontend/src/styles.css
git commit -m "feat: add unified search results page"
```

Do not bundle the backend and frontend changes into one large commit unless the work proves too interleaved to separate cleanly.
