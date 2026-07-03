# Global Package Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global `/packages/:packageId` page backed by `GET /api/packages/:packageId`, with package metadata, decode status, seen-on-nodes information, and decoded module/template/data-type lists.

**Architecture:** Extend the existing global package cache and LF registry to expose a package-detail read path, then surface that through the existing `/api` controller. On the frontend, add a global package route and a detail page that reuses the current explorer detail-page visual language, while linking package ids from contract and update pages.

**Tech Stack:** NestJS, SQLite via `node:sqlite`, Vue 3, Vue Router, Vitest, Testing Library Vue

---

### Task 1: Add Backend Package Detail Domain Types

**Files:**
- Modify: `backend/src/domain/node.types.ts`
- Test: `backend/test/api/nodes.controller.spec.ts`

- [ ] **Step 1: Write the failing type-driven/API fixture test**

Add a controller-spec fixture/assertion that expects a package-detail response shape containing:
- `packageId`
- `name`
- `version`
- `uploadedAt`
- `packageSize`
- `status`
- `seenOnNodes`
- `moduleCount`
- `templateCount`
- `dataTypeCount`
- `modules`
- `templates`
- `dataTypes`

- [ ] **Step 2: Run the targeted controller test to verify the missing shape fails**

Run: `rtk npm test -- --runTestsByPath test/api/nodes.controller.spec.ts`

Expected: FAIL because the package response type/fixture is not yet defined.

- [ ] **Step 3: Add backend response interfaces**

In `backend/src/domain/node.types.ts`, add:
- `PackageSeenOnNode`
- `PackageTemplateSummary`
- `PackageDataTypeSummary`
- `PackageDetailResponse`

Keep names flat and frontend-friendly.

- [ ] **Step 4: Re-run the targeted controller test**

Run: `rtk npm test -- --runTestsByPath test/api/nodes.controller.spec.ts`

Expected: still FAIL, but now on missing controller/service implementation rather than missing types.

- [ ] **Step 5: Commit**

```bash
git add backend/src/domain/node.types.ts backend/test/api/nodes.controller.spec.ts
git commit -m "feat: add package detail response types"
```

### Task 2: Extend Package Cache Queries

**Files:**
- Modify: `backend/src/packages/package-cache.service.ts`
- Modify: `backend/test/packages/package-cache.service.spec.ts`

- [ ] **Step 1: Write failing cache-service tests**

Add tests for:
- fetching metadata for a single package id
- listing node presence rows for a package id
- returning an empty list for unseen package ids

- [ ] **Step 2: Run the package cache tests to verify they fail**

Run: `rtk npm test -- --runTestsByPath test/packages/package-cache.service.spec.ts`

Expected: FAIL because the new query methods do not exist.

- [ ] **Step 3: Implement minimal cache query methods**

In `backend/src/packages/package-cache.service.ts`, add:
- `getPackageMetadata(packageId: string)`
- `listNodesForPackage(packageId: string)`

Return data derived from existing `packages` and `node_packages` tables only. Do not add new schema.

- [ ] **Step 4: Re-run the package cache tests**

Run: `rtk npm test -- --runTestsByPath test/packages/package-cache.service.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/packages/package-cache.service.ts backend/test/packages/package-cache.service.spec.ts
git commit -m "feat: expose cached package metadata and presence queries"
```

### Task 3: Add Package-Level Registry Inspection

**Files:**
- Modify: `backend/src/packages/package-registry.service.ts`
- Modify: `backend/src/packages/daml-decoder.types.ts`
- Modify: `backend/test/packages/package-registry.service.spec.ts`

- [ ] **Step 1: Write failing registry tests**

Add tests for:
- returning decoded package structure for a valid cached package
- returning `missing_package` for uncached ids
- returning `invalid_package` for undecodable package blobs

- [ ] **Step 2: Run the registry tests to verify they fail**

Run: `rtk npm test -- --runTestsByPath test/packages/package-registry.service.spec.ts`

Expected: FAIL because there is no package-level inspection method.

- [ ] **Step 3: Add minimal decoded package summary support**

In `backend/src/packages/daml-decoder.types.ts`, add a package-summary type that exposes:
- package id/name/version
- decoded module names
- decoded template summaries
- decoded data type summaries

In `backend/src/packages/package-registry.service.ts`, add a method like:
- `inspectPackage(packageId: string): Promise<PackageRegistryResult<...>>`

This should reuse the existing in-memory resolved package cache and flatten:
- `modules`
- `templates`
- `dataTypes`

- [ ] **Step 4: Re-run the registry tests**

Run: `rtk npm test -- --runTestsByPath test/packages/package-registry.service.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/packages/daml-decoder.types.ts backend/src/packages/package-registry.service.ts backend/test/packages/package-registry.service.spec.ts
git commit -m "feat: add package registry inspection"
```

### Task 4: Add Backend Package Detail Fetch Path

**Files:**
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Write failing summary-service tests**

Add tests for:
- decoded package detail response
- invalid package detail response with metadata but empty decoded lists
- package detail response includes `seenOnNodes`
- unknown package id throws `Package not found`

- [ ] **Step 2: Run the summary-service tests to verify they fail**

Run: `rtk npm test -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts`

Expected: FAIL because `fetchPackageDetail` does not exist.

- [ ] **Step 3: Implement `fetchPackageDetail`**

In `backend/src/pqs/pqs-summary.service.ts`:
- fetch single-package metadata from `PackageCacheService`
- fetch node presence rows from `PackageCacheService`
- inspect decoded structure from `PackageRegistryService`
- build a `PackageDetailResponse`
- sort `modules`, `templates`, and `dataTypes` deterministically
- return `status: 'invalid_package'` with empty decoded lists when decode fails
- throw `Package not found` only if the package is absent from cache

- [ ] **Step 4: Re-run the summary-service tests**

Run: `rtk npm test -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/pqs/pqs-summary.service.ts backend/test/pqs/pqs-summary.service.spec.ts
git commit -m "feat: build package detail responses"
```

### Task 5: Add Backend API Endpoint

**Files:**
- Modify: `backend/src/api/nodes.controller.ts`
- Modify: `backend/test/api/nodes.controller.spec.ts`

- [ ] **Step 1: Extend the controller test with failing package endpoint cases**

Add tests for:
- `GET /api/packages/:packageId` happy path via controller method
- `404` translation for unknown package id

- [ ] **Step 2: Run the controller tests to verify they fail**

Run: `rtk npm test -- --runTestsByPath test/api/nodes.controller.spec.ts`

Expected: FAIL because the controller method is missing.

- [ ] **Step 3: Implement the controller method**

In `backend/src/api/nodes.controller.ts`, add:
- `@Get('/packages/:packageId')`

Map:
- successful fetch -> `200`
- `Package not found` -> `NotFoundException`

- [ ] **Step 4: Re-run the controller tests**

Run: `rtk npm test -- --runTestsByPath test/api/nodes.controller.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/api/nodes.controller.ts backend/test/api/nodes.controller.spec.ts
git commit -m "feat: expose package detail api route"
```

### Task 6: Add Frontend Package API Types and Client

**Files:**
- Create: `frontend/src/types/packages.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/api.test.ts`

- [ ] **Step 1: Write failing frontend API tests**

Add tests for:
- fetching `/packages/:packageId`
- typed package-detail fixture shape

- [ ] **Step 2: Run the frontend API tests to verify they fail**

Run: `rtk npm test -- --run api.test.ts`

Expected: FAIL because no package API client/type exists.

- [ ] **Step 3: Add minimal frontend package types and fetcher**

Create `frontend/src/types/packages.ts` with the response interfaces mirroring the backend.

In `frontend/src/lib/api.ts`, add:
- `fetchPackageDetail(packageId: string)`

- [ ] **Step 4: Re-run the frontend API tests**

Run: `rtk npm test -- --run api.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/packages.ts frontend/src/lib/api.ts frontend/src/lib/api.test.ts
git commit -m "feat: add frontend package detail api client"
```

### Task 7: Add Global Package Route and Page

**Files:**
- Modify: `frontend/src/router.ts`
- Create: `frontend/src/views/PackageDetailView.vue`
- Create: `frontend/src/views/PackageDetailView.test.ts`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Write failing package-page view tests**

Add tests for:
- loading state
- decoded package summary render
- seen-on-nodes render
- invalid package state render
- module/template/data type lists

- [ ] **Step 2: Run the package-page tests to verify they fail**

Run: `rtk npm test -- --run PackageDetailView.test.ts`

Expected: FAIL because the route/view do not exist.

- [ ] **Step 3: Implement the route and view**

In `frontend/src/router.ts`, add:
- `/packages/:packageId`

Create `frontend/src/views/PackageDetailView.vue`:
- use `fetchPackageDetail`
- reuse existing detail-page shell/back button structure
- summary section
- seen-on-nodes section
- modules/templates/data types sections
- clear empty-state text for `invalid_package`

In `frontend/src/styles.css`, add only the package-detail-specific selectors needed; reuse current detail-page utility classes where possible.

- [ ] **Step 4: Re-run the package-page tests**

Run: `rtk npm test -- --run PackageDetailView.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/router.ts frontend/src/views/PackageDetailView.vue frontend/src/views/PackageDetailView.test.ts frontend/src/styles.css
git commit -m "feat: add global package detail page"
```

### Task 8: Link Package IDs from Existing Detail Pages

**Files:**
- Modify: `frontend/src/views/ContractDetailView.vue`
- Modify: `frontend/src/views/ContractDetailView.test.ts`
- Modify: `frontend/src/views/UpdateDetailView.vue`
- Modify: `frontend/src/views/UpdateDetailView.test.ts`

- [ ] **Step 1: Write failing view tests for package links**

Add assertions that:
- contract detail package id links to `/packages/:packageId`
- update detail package ids link to `/packages/:packageId` wherever package ids are shown

- [ ] **Step 2: Run the targeted detail-view tests to verify they fail**

Run: `rtk npm test -- --run ContractDetailView.test.ts UpdateDetailView.test.ts`

Expected: FAIL because package ids are still plain text.

- [ ] **Step 3: Implement minimal package links**

Update:
- `frontend/src/views/ContractDetailView.vue`
- `frontend/src/views/UpdateDetailView.vue`

Only package ids should change to global package links; keep all existing node/update/contract navigation intact.

- [ ] **Step 4: Re-run the targeted detail-view tests**

Run: `rtk npm test -- --run ContractDetailView.test.ts UpdateDetailView.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/ContractDetailView.vue frontend/src/views/ContractDetailView.test.ts frontend/src/views/UpdateDetailView.vue frontend/src/views/UpdateDetailView.test.ts
git commit -m "feat: link package ids to package detail page"
```

### Task 9: Final Verification

**Files:**
- Modify: none unless fixes are required

- [ ] **Step 1: Run backend targeted verification**

Run: `rtk npm test -- --runTestsByPath test/api/nodes.controller.spec.ts test/packages/package-cache.service.spec.ts test/packages/package-registry.service.spec.ts test/pqs/pqs-summary.service.spec.ts`

Expected: PASS

- [ ] **Step 2: Run frontend targeted verification**

Run: `rtk npm test -- --run api.test.ts ContractDetailView.test.ts UpdateDetailView.test.ts PackageDetailView.test.ts`

Expected: PASS

- [ ] **Step 3: Run backend build**

Run: `rtk npm run build`
Workdir: `backend`

Expected: PASS

- [ ] **Step 4: Run frontend build**

Run: `rtk npm run build`
Workdir: `frontend`

Expected: PASS

- [ ] **Step 5: Commit final fixups if needed**

```bash
git add backend frontend
git commit -m "feat: complete global package detail flow"
```

