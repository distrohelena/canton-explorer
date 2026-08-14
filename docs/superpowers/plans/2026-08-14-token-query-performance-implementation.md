# Token Query Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Return Tokens-page data promptly from PQS/cache data, coalesce expensive HoldingV2 gRPC scans, and use local PQS plans to guide safe SQL tuning.

**Architecture:** Split the per-node token cache into fast PQS discovery and slower gRPC enrichment. `/tokens` returns PQS plus cached enrichment immediately, then one shared background scan refreshes gRPC data. The frontend performs one delayed revalidation while enrichment is pending.

**Tech Stack:** NestJS, TypeScript, Vue 3, Jest, Vitest, PostgreSQL/PQS.

## Global Constraints

- Preserve token pagination, filters, and PQS-over-gRPC duplicate precedence.
- Never block a successful PQS token response on gRPC enrichment.
- Await gRPC only when that node has no usable PQS result.
- Coalesce gRPC scans per node; do not change transfer or holder caches.
- Do not create PQS indexes automatically; only tune SQL after `EXPLAIN (ANALYZE, BUFFERS)` evidence.

---

### Task 1: Fast token cache with a shared gRPC enrichment refresh

**Files:**
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Modify: `backend/src/domain/node.types.ts`
- Test: `backend/test/pqs/pqs-summary.service.spec.ts`

**Interfaces:** `TokensResponse` gains `refreshing: boolean`; `fetchTokens` keeps its current parameters.

- [ ] **Step 1: Write failing backend tests**

Add deferred-promise tests proving a PQS token response resolves while `fetchHoldingV2Tokens` remains pending, concurrent `fetchTokens` calls invoke it once per node, and PQS-empty nodes await gRPC fallback.

- [ ] **Step 2: Verify RED**

Run `npm test --workspace backend -- pqs-summary.service.spec.ts`. Expected: fail because `loadCachedObservedTokens` awaits `Promise.all` with gRPC.

- [ ] **Step 3: Implement cache split**

Store PQS tokens, last successful gRPC tokens, their timestamps, and an in-flight gRPC promise by node ID. Return `mergePqsFirst(pqsTokens, cachedGrpcTokens)` immediately and set `refreshing` when a stale enrichment refresh starts. On PQS-empty, await the shared gRPC promise. Clear the promise on settlement and retain old enrichment on failure.

- [ ] **Step 4: Verify GREEN and commit**

Run the focused backend test, then commit `perf: serve tokens before grpc enrichment`.

### Task 2: One-shot Tokens-page revalidation

**Files:**
- Modify: `frontend/src/types/tokens.ts`
- Modify: `frontend/src/views/TokensView.vue`
- Test: `frontend/src/views/TokensView.test.ts`
- Modify test fixtures in `frontend/src/lib/api.test.ts` if required.

**Interfaces:** Consume `TokensResponse.refreshing` and schedule one 1-second revalidation; clear the timer on route change and unmount.

- [ ] **Step 1: Write failing frontend tests**

Mock an initial `{ refreshing: true }` token result followed by `{ refreshing: false }`. Assert the initial rows render, one reload occurs after the timer, and the existing rows remain visible. Assert non-refreshing responses do not schedule reloads.

- [ ] **Step 2: Verify RED**

Run `npm test --workspace frontend -- TokensView.test.ts`. Expected: fail because there is no refresh state or timer.

- [ ] **Step 3: Implement and verify GREEN**

Add the type field and a single reload timer/guard in `TokensView`; run the focused test and commit `perf: refresh token enrichment in background`.

### Task 3: Measure and tune the live PQS query

**Files:**
- Create: `docs/performance/token-query-baseline.md`
- Modify only if supported by measurement: `backend/src/pqs/pqs-summary.service.ts`
- Test: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Record a read-only baseline**

Run the configured local PQS query through `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`. Record execution time, rows, sort method, and scan/index nodes without credentials.

- [ ] **Step 2: Make one evidence-backed query-shape change**

If the plan exposes a sequential scan or wide numeric sort, write a failing query-generation assertion and replace concatenated template filtering with `module_name`/`entity_name` predicates; change ordering only if the measured column type/index supports it. No automatic index creation.

- [ ] **Step 3: Verify and commit**

Run the focused backend test and repeat `EXPLAIN`; record before/after results and commit `perf: tune token discovery query`.

### Task 4: Full verification

- [ ] Run `npm test --workspace backend`.
- [ ] Run `npm test --workspace frontend`.
- [ ] Run both workspace builds and `git diff --check`.
