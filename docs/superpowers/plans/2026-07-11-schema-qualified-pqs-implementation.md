# Schema-Qualified PQS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-node PQS schema configuration, remove `participant.*` SQL support, and make `canton-explorer` read the `__...` PQS schema family explicitly.

**Architecture:** Introduce a small schema-qualification helper, then migrate the backend query surface from `participant.*` to explicit schema-qualified `__contracts` / `__events` / `__transactions` / `__packages` queries in controlled slices. Keep gRPC support intact for blob-dependent package detail, but make the PQS-backed read path authoritative for the deployments we actually run.

**Tech Stack:** NestJS, TypeScript, PostgreSQL (`pg`), Jest, Vue 3, Vitest

---

## File Map

- Modify: `backend/src/config/node-config.schema.ts`
  - add optional `pqs.schema` with `public` default and identifier validation
- Modify: `backend/config/nodes.example.json`
  - document the new per-node schema field
- Modify: `README.md`
  - document per-node schema configuration and package-detail behavior
- Create: `backend/src/pqs/pqs-schema.ts`
  - schema validation and quoted relation helper
- Create: `backend/test/pqs/pqs-schema.spec.ts`
  - focused helper and validation tests
- Modify: `backend/src/pqs/pqs-summary.service.ts`
  - replace `participant.*` SQL builders with schema-qualified `__...` builders
- Modify: `backend/src/packages/pqs-package.service.ts`
  - replace package SQL with `__packages` metadata-only queries
- Modify: `backend/src/packages/package-cache.service.ts`
  - persist package presence metadata even when no blob row exists
- Modify: `backend/src/packages/package-sync.service.ts`
  - preserve gRPC precedence for package blobs and make `pqs_only` behavior explicit
- Modify: `backend/src/domain/node.types.ts`
  - add `PackageDetailResponse.status = 'not_available'`
- Modify: `frontend/src/types/packages.ts`
  - mirror the new package-detail status variant
- Modify: `frontend/src/views/PackageDetailView.vue`
  - render the new not-available package-detail state cleanly
- Modify: `frontend/src/views/PackageDetailView.test.ts`
  - cover the new frontend package-detail state
- Modify: `backend/test/config/node-config.spec.ts`
  - cover schema parsing and validation
- Modify: `backend/test/packages/package-sync.service.spec.ts`
  - cover mixed-node package-detail precedence and `pqs_only` unavailable behavior
- Modify: `backend/test/packages/package-cache.service.spec.ts`
  - cover metadata-only package presence behavior if a focused cache spec is needed
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`
  - replace `participant.*`-oriented expectations with schema-qualified `__...` expectations

### Task 1: Add Config And Response-Contract Groundwork

**Files:**
- Modify: `backend/src/config/node-config.schema.ts`
- Modify: `backend/test/config/node-config.spec.ts`
- Modify: `backend/src/domain/node.types.ts`
- Modify: `frontend/src/types/packages.ts`
- Modify: `backend/config/nodes.example.json`
- Modify: `README.md`

- [ ] **Step 1: Write failing config and package-status tests**

Add or extend tests so they expect:

- omitted `pqs.schema` parses as `public`
- explicit `pqs.schema: "scribe"` parses successfully
- invalid schema names such as `""`, `"public.schema"`, and `"public;drop"` fail validation
- package response types accept `status: 'not_available'`

- [ ] **Step 2: Run targeted tests to verify red**

Run:

```bash
rtk npm test -- backend/test/config/node-config.spec.ts
```

Expected: FAIL on missing `pqs.schema` support and/or missing `not_available` status handling.

- [ ] **Step 3: Implement minimal config and type changes**

Add the optional schema field:

```ts
pqs: z.object({
  connectionUriEnv: z.string().min(1),
  schema: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/).default('public'),
})
```

Update backend/frontend package-detail status unions to include `not_available`.

- [ ] **Step 4: Re-run targeted tests to verify green**

Run:

```bash
rtk npm test -- backend/test/config/node-config.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Update user-facing config examples**

Add `"schema": "public"` to the example node config and a short README note explaining when to set `scribe`, `public`, or another PQS schema.

- [ ] **Step 6: Commit**

```bash
rtk git add backend/src/config/node-config.schema.ts backend/test/config/node-config.spec.ts backend/src/domain/node.types.ts frontend/src/types/packages.ts backend/config/nodes.example.json README.md
rtk git commit -m "feat: add per-node PQS schema config"
```

### Task 2: Introduce The PQS Schema Helper

**Files:**
- Create: `backend/src/pqs/pqs-schema.ts`
- Create: `backend/test/pqs/pqs-schema.spec.ts`

- [ ] **Step 1: Write failing helper tests**

Cover:

- `"public"."__contracts"` qualification
- `"scribe"."__packages"` qualification
- rejection of invalid relation/schema names when invoked directly

- [ ] **Step 2: Run helper tests to verify red**

Run:

```bash
rtk npm test -- backend/test/pqs/pqs-schema.spec.ts
```

Expected: FAIL because the helper file does not exist yet.

- [ ] **Step 3: Implement the smallest helper surface**

Create a focused helper such as:

```ts
export function pqsSchema(node: NodeConfig): string
export function qualifyPqsRelation(node: NodeConfig, relation: string): string
```

Rules:

- schema comes from `node.pqs.schema ?? 'public'`
- both schema and relation are quoted as identifiers
- relation names accepted here are only the canonical `__...` set

- [ ] **Step 4: Re-run helper tests to verify green**

Run:

```bash
rtk npm test -- backend/test/pqs/pqs-schema.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add backend/src/pqs/pqs-schema.ts backend/test/pqs/pqs-schema.spec.ts
rtk git commit -m "feat: add PQS schema qualification helper"
```

### Task 3: Rework Package Metadata And Global Package Detail

**Files:**
- Modify: `backend/src/packages/pqs-package.service.ts`
- Modify: `backend/src/packages/package-cache.service.ts`
- Modify: `backend/src/packages/package-sync.service.ts`
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Modify: `backend/test/packages/package-sync.service.spec.ts`
- Modify: `backend/test/packages/package-cache.service.spec.ts`
- Modify: `frontend/src/views/PackageDetailView.vue`
- Modify: `frontend/src/views/PackageDetailView.test.ts`

- [ ] **Step 1: Write failing package-behavior tests**

Add tests for:

- `PqsPackageService.fetchPackageRefs(...)` reading metadata from schema-qualified `__packages`
- `PackageCacheService` exposing metadata for packages that exist only in `node_packages`
- global package detail using a gRPC-capable node when any seen node can supply bytes
- global package detail returning `status: 'not_available'` when all seen nodes are `pqs_only`
- frontend rendering for `not_available`

- [ ] **Step 2: Run targeted package tests to verify red**

Run:

```bash
rtk npm test -- backend/test/packages/package-cache.service.spec.ts
rtk npm test -- backend/test/packages/package-sync.service.spec.ts
rtk npm test -- frontend/src/views/PackageDetailView.test.ts
```

Expected: FAIL because the current code expects `participant.par_daml_packages`, stores metadata only on blob-backed `packages` rows, or only knows `missing_package` / `invalid_package`.

- [ ] **Step 3: Implement metadata-only PQS package reads**

Switch `PqsPackageService` from:

```sql
from participant.par_daml_packages
```

to schema-qualified `__packages` reads using only:

- `id`
- `name`
- `version`

Do not attempt to synthesize missing blob metadata like package bytes, size, or uploaded time from PQS.

- [ ] **Step 4: Persist metadata-only package presence**

Update `PackageCacheService` so package metadata queries can fall back to `node_packages` when a blob-backed `packages` row is missing.

Minimum behavior:

- `getPackageMetadata(packageId)` falls back to `node_packages`
- `listPackages()` includes metadata-only packages
- `listPackagesByName(packageName)` includes metadata-only packages

Keep `getPackage(packageId)` blob-backed only.

- [ ] **Step 5: Implement explicit global package-detail precedence**

In `PqsSummaryService.fetchPackageDetail(...)`:

- use package presence metadata from all nodes
- if any seen node is `pqs_with_grpc` and can supply bytes, use that node
- otherwise return a successful response with `status: 'not_available'`

The response should still include:

- `packageId`
- `name`
- `version`
- `seenOnNodes`

but decoded structure stays empty when unavailable.

- [ ] **Step 6: Update the package-detail view**

Render `Not Available` in the summary status and keep the existing “Decoded package structure is not available for this package.” empty-state copy for non-decoded statuses.

- [ ] **Step 7: Re-run package tests to verify green**

Run:

```bash
rtk npm test -- backend/test/packages/package-cache.service.spec.ts
rtk npm test -- backend/test/packages/package-sync.service.spec.ts
rtk npm test -- frontend/src/views/PackageDetailView.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
rtk git add backend/src/packages/pqs-package.service.ts backend/src/packages/package-cache.service.ts backend/src/packages/package-sync.service.ts backend/src/pqs/pqs-summary.service.ts backend/test/packages/package-cache.service.spec.ts backend/test/packages/package-sync.service.spec.ts frontend/src/views/PackageDetailView.vue frontend/src/views/PackageDetailView.test.ts
rtk git commit -m "feat: support schema-qualified PQS package metadata"
```

### Task 4: Replace Summary, Activity, Search, Contracts, And Parties SQL

**Files:**
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Write focused failing tests for the first `__...` query slice**

Add or rewrite tests so they expect schema-qualified SQL for:

- summary
- historical activity
- recent updates
- update search
- contracts list
- active parties
- contract search

Also add a non-default schema case:

- node with `pqs.schema = 'scribe'` emits `"scribe"."__transactions"` and friends

- [ ] **Step 2: Run the focused summary-service test subset to verify red**

Run:

```bash
rtk npm test -- backend/test/pqs/pqs-summary.service.spec.ts
```

Expected: FAIL on `participant.*` expectations or missing schema qualification.

- [ ] **Step 3: Implement the smallest query-builder replacement**

Replace:

- `participant.par_active_contracts`
- `participant.lapi_update_meta`
- any `participant.*` recent-updates query family
- any direct `participant.*` search/party summary usage

with `__...`-based builders using:

- `__contracts.archived_at_ix is null`
- `__transactions`
- `__watermark`
- `__contract_tpe`
- array unnesting from `__contracts.signatories`, `observers`, and `witnesses`

- [ ] **Step 4: Delete obsolete branching only after the new tests are green**

Remove methods whose only purpose was:

- `active()` fallback branching for participant layout
- choosing between legacy and normalized participant event relations

Keep `active()` only if it is still directly used and tested as an optional summary optimization, not as a required compatibility path.

- [ ] **Step 5: Re-run the focused summary-service subset**

Run:

```bash
rtk npm test -- backend/test/pqs/pqs-summary.service.spec.ts
```

Expected: PASS for the touched summary/activity/recent-updates/search/contracts/parties cases.

- [ ] **Step 6: Commit**

```bash
rtk git add backend/src/pqs/pqs-summary.service.ts backend/test/pqs/pqs-summary.service.spec.ts
rtk git commit -m "refactor: migrate core PQS queries to schema-qualified tables"
```

### Task 5: Replace Update Detail, Contract Detail, And Token SQL

**Files:**
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Write failing tests for detail and token behavior**

Cover:

- update detail now sourcing `meta` from `__transactions`
- create payloads reading from `__contracts.payload`
- exercise payloads reading from `__exercises.argument` and `__exercises.result`
- contract detail sourcing timestamps and package metadata from `__contracts`, `__transactions`, and `__packages`
- token holder and token transfer queries no longer containing `participant.*`

- [ ] **Step 2: Run the detail/token summary-service subset to verify red**

Run:

```bash
rtk npm test -- backend/test/pqs/pqs-summary.service.spec.ts
```

Expected: FAIL because current detail/token builders still use `participant.lapi_*`, `participant.par_contracts`, and package-interning assumptions.

- [ ] **Step 3: Implement `__...` update-detail normalization**

Build detail queries around:

- `__transactions` for timeline and `meta`
- `__events.tx_ix`
- `__contracts.create_event_pk` / `archive_event_pk`
- `__exercises.exercise_event_pk`
- `__contract_tpe` / `__exercise_tpe`
- `__packages`

Set `NodeUpdateDetailResponse.meta` from the transaction row:

- `transaction_id`
- `effective_at`
- `ix`
- `offset`
- `workflow_id`
- `domain_id`
- `trace_context`
- `external_transaction_hash`
- `paid_traffic_cost`

- [ ] **Step 4: Implement `__...` contract and token queries**

Use PQS JSON directly:

- `__contracts.payload`
- `__exercises.argument`
- `__exercises.result`

Keep existing normalized API response shapes where the spec requires it.

- [ ] **Step 5: Re-run summary-service tests to verify green**

Run:

```bash
rtk npm test -- backend/test/pqs/pqs-summary.service.spec.ts
```

Expected: PASS for detail and token cases, with no remaining `participant.*` SQL expectations.

- [ ] **Step 6: Commit**

```bash
rtk git add backend/src/pqs/pqs-summary.service.ts backend/test/pqs/pqs-summary.service.spec.ts
rtk git commit -m "refactor: migrate PQS detail and token queries"
```

### Task 6: Add Regression Guards And Finish The Surface

**Files:**
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`
- Modify: `backend/test/packages/package-sync.service.spec.ts`
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Modify: `backend/src/packages/pqs-package.service.ts`
- Modify: `README.md`

- [ ] **Step 1: Write the final regression guard tests**

Add explicit assertions that generated PQS SQL for the supported features does not contain:

```text
participant.
```

Also add at least one end-to-end-ish summary-service case using `pqs.schema = 'scribe'`.

- [ ] **Step 2: Implement the missing-schema / missing-relation error contract**

Add a small query-boundary helper so schema-qualified PQS failures surface with:

- node id
- configured PQS schema
- query family or missing relation context

instead of leaking raw Postgres relation errors directly.

- [ ] **Step 3: Add one focused failure test for the error contract**

Simulate a missing schema or missing relation and assert that the surfaced backend error message is explicit and node-aware.

- [ ] **Step 4: Run the full targeted backend/frontend test set**

Run:

```bash
rtk npm test -- backend/test/config/node-config.spec.ts backend/test/pqs/pqs-schema.spec.ts backend/test/packages/package-sync.service.spec.ts backend/test/pqs/pqs-summary.service.spec.ts
rtk npm test -- frontend/src/views/PackageDetailView.test.ts
```

Expected: PASS.

- [ ] **Step 5: Do one repository-wide guard search before claiming completion**

Run:

```bash
rtk rg -n "participant\\." backend/src/pqs backend/src/packages backend/test/pqs backend/test/packages
```

Expected:

- no remaining supported-PQS query paths or tests rely on `participant.*`
- any remaining hits must be outside this feature scope and should be explained before continuing

- [ ] **Step 6: Update docs for the supported PQS model**

Document:

- `pqs.schema`
- supported PQS relation family
- package-detail limitations for `pqs_only`
- missing-schema/missing-relation error behavior

- [ ] **Step 7: Commit**

```bash
rtk git add backend/test/pqs/pqs-summary.service.spec.ts backend/test/packages/package-sync.service.spec.ts backend/src/pqs/pqs-summary.service.ts backend/src/packages/pqs-package.service.ts README.md
rtk git commit -m "test: add regression guards for schema-qualified PQS support"
```
