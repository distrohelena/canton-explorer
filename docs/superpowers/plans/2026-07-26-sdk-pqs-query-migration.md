# SDK PQS Query Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pin Canton Explorer to the published SDK 0.1.17 and route all PQS reads through SDK `CantonManager.query`, preferring typed delegates while retaining only parameterized read-only analytical SQL.

**Architecture:** Add a node-scoped SDK manager factory that owns a PQS manager for every node and a separate real gRPC manager for `pqs_with_grpc` nodes. Migrate the existing summary service incrementally: delegate-friendly relation reads use the SDK model API; custom union/token/traffic analytics call `$queryRaw` through the same manager and a fixed schema-qualified relation mapper. Preserve every current API response shape.

**Tech Stack:** NestJS 11, TypeScript 5.7, Jest 30, `@distrohelena/canton-typescript-sdk` 0.1.17.

---

## File structure

- `backend/src/pqs/pqs-manager.factory.ts` — cached SDK manager construction, SDK raw-query compatibility adapter, and shutdown lifecycle.
- `backend/src/pqs/sdk-pqs-api.typecheck.ts` — build-included compile guard for the 0.1.17 public PQS API.
- `backend/src/debugger/debugger.service.ts`, `backend/src/grpc/grpc-client.factory.ts`, `backend/src/grpc/grpc-operations.service.ts`, `backend/src/namespaces/namespace-fingerprint.service.ts`, and `backend/src/packages/package-registry.service.ts` — existing SDK consumers that must use real public SDK types after shim removal.
- `backend/scripts/generate-daml-source-map.mjs` — runtime DAML-LF SDK consumer to smoke-test against the published package.
- `backend/src/pqs/pqs-schema.ts` — fixed, validated relation names for the few raw analytical queries.
- `backend/src/pqs/pqs-summary.service.ts` — delegate-first PQS reads and SDK `$queryRaw` adapter.
- `backend/src/packages/pqs-package.service.ts` — typed package delegate.
- `backend/src/grpc/grpc-client.factory.ts` — share SDK option construction with the manager factory, preserving auth behavior.
- `backend/src/app.module.ts` — register the manager factory in place of the direct-pool factory.
- `backend/test/pqs/pqs-manager.factory.spec.ts` — factory cache/lifecycle and node-mode coverage.
- `backend/test/pqs/pqs-summary.service.spec.ts` — typed delegate and raw-query parameter assertions.
- `backend/test/packages/pqs-package.service.spec.ts` — package delegate mapping.
- `backend/package.json`, `package-lock.json` — exact published SDK 0.1.17 dependency; remove direct `pg` type/runtime dependency if no other import remains.
- `package.json`, `backend/scripts/link-local-sdk.mjs`, `backend/src/types/canton-typescript-sdk.d.ts` — remove local-link scripts and ambient SDK `any` declarations.

### Task 1: Pin the compiled SDK public API

**Files:**
- Modify: `package.json`
- Modify: `backend/package.json`
- Modify: `package-lock.json`
- Delete: `backend/scripts/link-local-sdk.mjs`
- Delete: `backend/src/types/canton-typescript-sdk.d.ts`
- Create: `backend/src/pqs/sdk-pqs-api.typecheck.ts`

- [ ] **Step 1: Write a dependency expectation test or compile fixture**

Create `backend/src/pqs/sdk-pqs-api.typecheck.ts`, which is included by `tsconfig.build.json`, and imports `CantonManager`, `QuerySource`, a relation `include`, `groupBy`, and `JsonProjection` from the package root. It must use type-level assignments only; it must not contact PostgreSQL or introduce application startup behavior. This file is the compile guard that would fail if the installed public package lacks the 0.1.17 PQS API.

- [ ] **Step 2: Run the fixture/type check and verify the current dependency fails or lacks the 0.1.17 surface**

Run: `npm ls @distrohelena/canton-typescript-sdk --workspace backend && npm run build --workspace backend`

Expected: the current installation is a local symlink or the type guard cannot use the public installed API, establishing the pre-migration baseline.

- [ ] **Step 3: Update dependency metadata**

Remove root and backend `sdk:local` scripts, remove the root `postinstall` local-link hook, and delete `backend/scripts/link-local-sdk.mjs`. Change the backend SDK dependency to the exact version `0.1.17`; do not use a caret range. Remove `backend/src/types/canton-typescript-sdk.d.ts` so TypeScript consumes the package's real declarations. Regenerate the root lockfile with `npm install` so `package-lock.json` records a registry package rather than a `link:`/symlink resolution. Remove `pg` and `@types/pg` only after Task 6 proves no direct import remains.

- [ ] **Step 4: Capture the real-type compatibility baseline**

Run: `npm ls @distrohelena/canton-typescript-sdk --workspace backend && npm run build --workspace backend`

Expected: npm reports installed version `0.1.17` without a local `->` symlink. Record any build failures caused by replacing the ambient module declarations; Task 2 resolves them against the published public API.

### Task 2: Adapt all SDK consumers to published declarations

**Files:**
- Modify as required: `backend/src/debugger/debugger.service.ts`
- Modify as required: `backend/src/grpc/grpc-client.factory.ts`
- Modify as required: `backend/src/grpc/grpc-operations.service.ts`
- Modify as required: `backend/src/namespaces/namespace-fingerprint.service.ts`
- Modify as required: `backend/src/packages/package-registry.service.ts`
- Modify as required: `backend/scripts/generate-daml-source-map.mjs`
- Test: `backend/src/debugger/debugger.service.spec.ts`
- Test: `backend/test/grpc/grpc-client.factory.spec.ts`
- Test: `backend/test/grpc/grpc-operations.service.spec.ts`
- Test: `backend/test/packages/package-registry.service.spec.ts`

- [ ] **Step 1: Write failing type and behavior tests for affected consumers**

For each compile error exposed in Task 1, add or update the closest existing unit test to express the real public SDK boundary: debugger/replay construction, gRPC client construction, package-registry DAML-LF loading, and namespace fingerprint hashing. Keep module loading dynamic where the current service requires it, but type it as `typeof import(...)` rather than `any`.

- [ ] **Step 2: Run focused suites and the backend build to verify the real-type baseline**

Run:

```bash
npm test --workspace backend -- debugger.service.spec.ts grpc-client.factory.spec.ts grpc-operations.service.spec.ts package-registry.service.spec.ts
npm run build --workspace backend
```

Expected: FAIL only on incompatibilities introduced by removal of the ambient declarations; capture each API mismatch before changing production code.

- [ ] **Step 3: Adapt consumers minimally to SDK 0.1.17**

Replace copied weak SDK shapes and ambient assumptions with exported request/response/client types where available. Preserve the existing dynamic-import and runtime behavior. Do not add a replacement `declare module`, `any` cast, or local facade that hides an incompatibility; adjust the consumer to the published API instead.

- [ ] **Step 4: Run focused consumer regressions and published-package smoke test**

Run:

```bash
npm test --workspace backend -- debugger.service.spec.ts grpc-client.factory.spec.ts grpc-operations.service.spec.ts package-registry.service.spec.ts
npm run dar:source-map --workspace backend -- --help
npm run build --workspace backend
```

Expected: PASS; dynamic DAML-LF imports resolve from the registry-installed SDK.

- [ ] **Step 5: Commit the published-SDK boundary**

```bash
git add package.json backend/package.json package-lock.json backend/src/pqs/sdk-pqs-api.typecheck.ts backend/scripts/link-local-sdk.mjs backend/src/types/canton-typescript-sdk.d.ts backend/src/debugger/debugger.service.ts backend/src/grpc/grpc-client.factory.ts backend/src/grpc/grpc-operations.service.ts backend/src/namespaces/namespace-fingerprint.service.ts backend/src/packages/package-registry.service.ts backend/scripts/generate-daml-source-map.mjs backend/test
git commit -m "chore: pin published Canton SDK 0.1.17"
```

### Task 3: Add SDK manager ownership and disposal

**Files:**
- Create: `backend/src/pqs/pqs-manager.factory.ts`
- Create: `backend/test/pqs/pqs-manager.factory.spec.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/grpc/grpc-client.factory.ts`
- Delete: `backend/src/pqs/pqs-client.factory.ts`
- Delete: `backend/test/pqs/pqs-client.factory.spec.ts`

- [ ] **Step 1: Write failing factory tests**

Mock the SDK module and configure one `pqs_only` and one `pqs_with_grpc` node. Assert:

```ts
expect(factory.getPqsQuery(node)).toBe(factory.getPqsQuery(node));
expect(CantonManager).toHaveBeenCalledWith(expect.objectContaining({
  querySource: QuerySource.pqs,
  pqs: { connectionString: 'postgres://...', schema: 'public' },
}));
await factory.onModuleDestroy();
expect(disposeAsync).toHaveBeenCalledTimes(expectedManagers);
```

For a gRPC-capable node, assert the operational manager gets the real endpoints/auth and the PQS manager gets the endpoint-less gRPC shell. For `pqs_only`, assert no real gRPC manager is created. Also assert a missing PQS environment variable throws the existing safe error.

- [ ] **Step 2: Run the focused factory suite**

Run: `npm test --workspace backend -- pqs-manager.factory.spec.ts`

Expected: FAIL because `PqsManagerFactory` does not exist.

- [ ] **Step 3: Implement the manager factory**

Implement `OnModuleDestroy`, a `Map<string, { pqs: CantonManager; grpc?: CantonManager }>` cache, and methods such as `getPqsQuery(node)`, `getGrpcClient(node)`, and a temporary `getRawExecutor(node)`. The adapter returns `{ query(sql, values = []) }` and delegates to `getPqsQuery(node).$queryRaw(sql, values)`, wrapping the returned array as `{ rows }` so existing SQL call sites remain buildable during Tasks 3–5. Reuse the existing authentication/endpoint construction in `GrpcClientFactory` by extracting a shared SDK options builder or by making the manager factory the single owner and having `GrpcClientFactory` delegate to it. Do not construct a direct `pg.Pool`.

Use `new CantonClientOptions({ transportKind: TransportKind.grpc })` only for the PQS manager's unused gRPC shell. Put the actual connection string and configured schema in `pqs`.

- [ ] **Step 4: Wire Nest providers**

Replace `PqsClientFactory` in `AppModule` and all constructors with `PqsManagerFactory`. Mechanically replace existing `getClient(node)` calls with `getRawExecutor(node)` in `PqsSummaryService` and `PqsPackageService` before deleting the pool factory; later tasks replace those adapter calls with typed delegates or direct `$queryRaw`. Keep gRPC operational behavior unchanged by returning the real manager's `.grpc` client for gRPC-enabled nodes.

- [ ] **Step 5: Run factory and gRPC regression tests**

Run: `npm test --workspace backend -- pqs-manager.factory.spec.ts grpc-client.factory.spec.ts grpc-operations.service.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/pqs/pqs-manager.factory.ts backend/src/pqs/pqs-summary.service.ts backend/src/packages/pqs-package.service.ts backend/src/grpc/grpc-client.factory.ts backend/src/app.module.ts backend/src/pqs/pqs-client.factory.ts backend/test/pqs/pqs-manager.factory.spec.ts backend/test/pqs/pqs-client.factory.spec.ts
git commit -m "feat: manage SDK PQS clients per node"
```

### Task 4: Port direct package and contract reads to typed delegates

**Files:**
- Modify: `backend/src/packages/pqs-package.service.ts`
- Modify: `backend/test/packages/pqs-package.service.spec.ts`
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Add failing package-delegate tests**

Mock `getPqsQuery(node).packages.findMany`. Assert `fetchPackageRefs` requests:

```ts
{ select: { id: true, name: true, version: true }, orderBy: [{ id: 'asc' }] }
```

and maps the returned camel-case SDK rows to `CachedPackageRef` without SQL text.

- [ ] **Step 2: Run the package test**

Run: `npm test --workspace backend -- pqs-package.service.spec.ts`

Expected: FAIL because the service still expects `Pool.query`.

- [ ] **Step 3: Implement package delegate migration**

Replace `qualifyPqsRelation`/`client.query` in `PqsPackageService` with `getPqsQuery(node).packages.findMany`, retaining `fetchPackagesById`'s explicit empty behavior.

- [ ] **Step 4: Add failing contract delegate tests**

In `pqs-summary.service.spec.ts`, cover three representative mappings:

- active contracts: `contracts.findMany` with `active`, template, witness, offset cursor, multi-field `orderBy`, and `createdTransaction` include;
- contract detail: `contracts.findUnique` with `contractType`, `createdTransaction`, and `archivedTransaction` includes;
- contract search/party contracts: `contractId.ilike` or `witnesses.has`, plus lifecycle filters and result normalization.

Assert the old SQL-builder functions are not called for these paths.

- [ ] **Step 5: Run focused summary tests**

Run: `npm test --workspace backend -- pqs-summary.service.spec.ts -t "contracts|contract detail|package refs"`

Expected: FAIL because those paths still call `client.query`.

- [ ] **Step 6: Implement typed contract mappings**

Add small private methods in `PqsSummaryService` that create `ContractWhere` expressions from existing filters. Preserve the existing cursor response semantics (request `limit + 1`, detect continuation, reverse after-cursor results when needed). Use SDK `TemplateId` parts instead of reconstructing SQL template identifiers. Map included transactions and contract types into the current response DTOs.

- [ ] **Step 7: Run focused tests**

Run: `npm test --workspace backend -- pqs-package.service.spec.ts pqs-summary.service.spec.ts -t "contracts|contract detail|package refs"`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/src/packages/pqs-package.service.ts backend/src/pqs/pqs-summary.service.ts backend/test/packages/pqs-package.service.spec.ts backend/test/pqs/pqs-summary.service.spec.ts
git commit -m "feat: use typed SDK PQS contract queries"
```

### Task 5: Port standard transaction, event, exercise, and aggregate reads

**Files:**
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Write failing delegate tests for standard relation reads**

Add focused tests that mock `transactions`, `events`, and `exercises` delegates and verify:

- summary uses `contracts.count({ where: { active: true } })`, `watermark.findUnique`, and transaction aggregates/ordered reads;
- update detail uses `transactions.findUnique` and its `events`, `createdContracts`, `archivedContracts`, and `exercises` include graph;
- supported activity granularity uses `transactions.groupBy` or the delegated relation group API;
- decoded event and update response shapes stay unchanged.

- [ ] **Step 2: Run the focused tests**

Run: `npm test --workspace backend -- pqs-summary.service.spec.ts -t "summary|update detail|activity"`

Expected: FAIL on the current raw-SQL paths.

- [ ] **Step 3: Implement the delegate paths**

Extract row-to-domain mappers so both typed and raw result paths use the same normalization. Use typed includes for event/exercise traversal and typed groups only for SDK-supported buckets (`hour`, `day`, `week`, `month`). Continue using existing decoding services after mapping raw SDK JSON values.

- [ ] **Step 4: Run focused tests**

Run: `npm test --workspace backend -- pqs-summary.service.spec.ts -t "summary|update detail|activity"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/pqs/pqs-summary.service.ts backend/test/pqs/pqs-summary.service.spec.ts
git commit -m "feat: use SDK PQS relation delegates"
```

### Task 6: Move retained analytics to safe SDK raw queries

**Files:**
- Modify: `backend/src/pqs/pqs-schema.ts`
- Modify: `backend/test/pqs/pqs-schema.spec.ts`
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Write failing raw-query safety tests**

Add tests for the activity, recent-update/party, traffic, token, and CIP-112 paths. Mock `$queryRaw` and assert each call receives a single read-only SQL string with `$1`, `$2`, etc., plus a separate values array; assert no user filter or cursor appears in SQL text. Retain tests that reject unknown raw relation names.

- [ ] **Step 2: Run the raw-query safety tests**

Run: `npm test --workspace backend -- pqs-schema.spec.ts pqs-summary.service.spec.ts -t "raw|traffic|token|party|activity"`

Expected: FAIL because builders interpolate literals/cursors and call `Pool.query`.

- [ ] **Step 3: Implement a narrow raw-query adapter**

Keep `pqsSchema`/`qualifyPqsRelation`, but make its relation argument a closed exported union of the eight static relation names. It may emit only validated quoted identifiers. Convert each retained SQL builder to return `{ sql, values }`; values must include dates, IDs, parties, templates, limits, offsets, and token filters. Call `getPqsQuery(node).$queryRaw<Row>(sql, values)`.

Do not use `$queryRaw` for operations migrated in Tasks 3–4. Keep the four permitted categories only: arbitrary-minute buckets, union-based update/party views, traffic purchases, and token views/transfers.

- [ ] **Step 4: Run raw-query and feature regressions**

Run: `npm test --workspace backend -- pqs-schema.spec.ts pqs-summary.service.spec.ts -t "traffic|token|party|activity|recent updates"`

Expected: PASS; test spies show SDK `$queryRaw`, parameter arrays, and no direct pool call.

- [ ] **Step 5: Commit**

```bash
git add backend/src/pqs/pqs-schema.ts backend/src/pqs/pqs-summary.service.ts backend/test/pqs/pqs-schema.spec.ts backend/test/pqs/pqs-summary.service.spec.ts
git commit -m "refactor: route PQS analytics through SDK raw queries"
```

### Task 7: Remove the direct PostgreSQL boundary and verify the migration

**Files:**
- Modify: `backend/package.json`
- Modify: `package-lock.json`
- Modify: `backend/README.md` if it documents direct Explorer PostgreSQL pooling
- Modify: relevant tests from Tasks 2–5

- [ ] **Step 1: Write a boundary regression check**

Add a focused static test or repository check that fails if `backend/src` imports `pg` or references `new Pool`. Allow the SDK package to retain its own PostgreSQL implementation.

- [ ] **Step 2: Run the boundary check**

Run: `rtk rg -n "from 'pg'|from \"pg\"|new Pool" backend/src`

Expected: initially identifies any remaining direct-pool code.

- [ ] **Step 3: Remove direct dependency and obsolete code**

After the check is clean, remove Explorer's `pg` and `@types/pg` dependencies if no non-PQS code uses them. Remove obsolete raw row/pool adapter types, but keep the fixed relation helper for the retained raw analytics.

- [ ] **Step 4: Run full backend verification**

Run:

```bash
npm run build --workspace backend
npm test --workspace backend -- --runInBand
npm run lint --workspace backend
```

Expected: all pass. If an unrelated existing failure appears, record it separately and do not weaken tests.

- [ ] **Step 5: Review the final diff and commit**

Run:

```bash
git diff --check
git status --short
```

Confirm only the planned SDK/PQS files are staged; do not stage the user’s debugger edits.

```bash
git add backend/package.json package-lock.json backend/src backend/test backend/README.md
git commit -m "refactor: complete SDK PQS query migration"
```
