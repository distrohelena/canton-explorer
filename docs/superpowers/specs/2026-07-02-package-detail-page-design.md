# Package Detail Page Design

## Goal

Add a global package page at `/packages/:packageId` so operators can inspect a cached DAML package directly by package id, without going through a node-specific route.

## Scope

This page should answer three questions:

1. What package is this?
2. Has the backend cached and decoded it successfully?
3. Which modules, templates, data types, and nodes are associated with it?

The page should stay consistent with the existing explorer style: compact summary blocks, minimal operator-facing text, and list-first presentation.

## Route Model

- Frontend route: `/packages/:packageId`
- Backend API route: `GET /api/packages/:packageId`

This is intentionally global rather than node-scoped because package ids are ledger-global identifiers and the package cache is already global.

## Backend Design

### Data source

Use the existing package cache and registry infrastructure:

- `PackageCacheService`
  - already stores package metadata and the raw archive blob
  - already records node presence in `node_packages`
- `PackageRegistryService`
  - already loads and decodes cached LF packages
  - already exposes template and data type resolution internals

### New response shape

Add a package detail response type that includes:

- `packageId: string`
- `name: string | null`
- `version: string | null`
- `uploadedAt: string | null`
- `packageSize: number | null`
- `status: 'decoded' | 'invalid_package' | 'missing_package'`
- `seenOnNodes: Array<{ nodeId: string; packageName: string | null; packageVersion: string | null; seenAt: string }>`
- `moduleCount: number`
- `templateCount: number`
- `dataTypeCount: number`
- `modules: string[]`
- `templates: Array<{ templateId: string; moduleName: string; entityName: string }>`
- `dataTypes: Array<{ typeId: string; moduleName: string; entityName: string }>`

For `invalid_package` and `missing_package`, the metadata and `seenOnNodes` list should still be returned when available, but decoded structure lists should be empty.

### Service changes

Add a package-detail fetch path in the backend that:

1. Looks up cached package metadata by package id.
2. Looks up node presence rows for that package id.
3. Attempts to decode the package through `PackageRegistryService`.
4. Builds a flat, frontend-friendly response:
   - sorted module names
   - sorted template ids
   - sorted data type ids
   - explicit counts

### Cache service additions

Extend `PackageCacheService` with:

- a way to fetch metadata for a single package id without the blob if desired
- a way to list node presence rows for a package id

This should reuse the existing SQLite cache rather than introducing a new store.

### Registry additions

Expose a package-level read method from `PackageRegistryService` so callers can ask for:

- decoded package metadata
- all modules
- all templates
- all data types

This should not re-decode more than necessary for the same package id; it should reuse the current in-memory package cache.

### Controller

Add:

- `GET /api/packages/:packageId`

Behavior:

- return `404` only when the package is completely unknown to the cache
- return `200` with `status: 'invalid_package'` if the package exists in cache but LF decoding fails

This keeps the page useful even when a package is cached but not decodable.

## Frontend Design

### New route

Add a global package page route:

- `/packages/:packageId`

### New view

Create `PackageDetailView.vue`.

Structure:

1. Header
   - title like `Package`
   - main heading using package name when available, otherwise the package id
2. Summary section
   - Package ID
   - Package Name
   - Version
   - Uploaded At
   - Size
   - Decode Status
3. Seen On Nodes section
   - small list/table of node id and seen time
4. Modules section
   - simple list of module names
5. Templates section
   - simple list of template ids
6. Data Types section
   - simple list of type ids

If decode status is `invalid_package`, keep the summary and node-presence sections visible and show a clear empty-state message for the decoded structure sections.

### Linking behavior

Make package ids clickable from:

- `ContractDetailView`
- `UpdateDetailView`

Links should target `/packages/:packageId`.

Do not change the existing node-scoped contract/update navigation.

### UI behavior

Keep the page visually aligned with the current contract/update detail pages:

- same back control style
- same summary card treatment
- same compact uppercase labels
- same two-column/paired summary behavior where useful

The page should feel operational and minimal, not like a documentation browser.

## Error Handling

### Backend

- unknown package id: `404`
- cached but invalid LF payload: `200` with `status: 'invalid_package'`

### Frontend

- `404`: show a not-found style message
- request failure: show the existing inline error pattern
- missing decoded structure: show explicit empty-state text, not blank sections

## Testing

### Backend tests

Add/extend tests for:

- package detail response for a decoded package
- package detail response for an invalid package
- package detail response includes node presence rows
- controller returns `404` for unknown package id

### Frontend tests

Add tests for:

- package page renders summary metadata
- package page renders modules/templates/data types
- package page renders node presence
- package page shows invalid-package empty state
- package id links from contract/update pages route to `/packages/:packageId`

## Recommended Implementation Order

1. Add backend domain types for package detail response.
2. Extend package cache queries for single-package metadata and node presence.
3. Add package-level decode/read support in `PackageRegistryService`.
4. Add package detail fetch method in the backend summary/package layer.
5. Add `GET /api/packages/:packageId`.
6. Add frontend API client and types.
7. Add router entry and `PackageDetailView`.
8. Link package ids from contract/update detail pages.
9. Add focused backend and frontend tests.

