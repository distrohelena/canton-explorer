# Daily Traffic Purchase Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist each node's latest traffic purchase in Explorer SQLite for one UTC day so update-cost estimates do not repeatedly scan PQS traffic history.

**Architecture:** `PackageCacheService` owns a new small SQLite table and typed read/write methods for a purchase-or-no-result value keyed by node and UTC day. `PqsSummaryService.latestTrafficPurchase` consults that persistent cache and coalesces concurrent daily misses before falling back to its current PQS lookup. The Traffic Purchases history endpoints remain untouched.

**Tech Stack:** NestJS, TypeScript, Node `node:sqlite` (`DatabaseSync`), Jest.

## Global Constraints

- Store cache rows in the existing SQLite database configured by `PACKAGE_CACHE_DB_PATH`.
- Cache scope is only the latest purchase used for `estimatedTrafficUsd`; do not cache Traffic Purchases history endpoints.
- Cache key is `(node_id, cache_day)`, where `cache_day` is the current UTC `YYYY-MM-DD` date.
- Persist a no-purchase result; never persist a PQS refresh failure.
- Preserve API response shapes and return a null estimate when PQS cannot provide a purchase.
- Preserve the user-owned uncommitted `backend/package.json` change.

---

## File Structure

- `backend/src/packages/package-cache.service.ts` — SQLite schema plus typed persistence methods for a node/day traffic-purchase snapshot.
- `backend/test/packages/package-cache.service.spec.ts` — persistence and restart tests for purchase and no-result rows.
- `backend/src/pqs/pqs-summary.service.ts` — daily lookup, in-flight miss coalescing, and fallback behaviour used by every update-estimate caller.
- `backend/test/pqs/pqs-summary.service.spec.ts` — same-day reuse, UTC rollover, failed refresh, and concurrent request tests.

### Task 1: Persist daily node traffic-purchase snapshots

**Files:**
- Modify: `backend/src/packages/package-cache.service.ts:15-55, 460-492`
- Test: `backend/test/packages/package-cache.service.spec.ts`

**Interfaces:**
- Produces: `CachedNodeTrafficPurchase`, `PackageCacheService.getNodeTrafficPurchase(nodeId: string, cacheDay: string): CachedNodeTrafficPurchase | null`, and `PackageCacheService.storeNodeTrafficPurchase(snapshot: CachedNodeTrafficPurchase): void`.
- Consumes: `NodeTrafficPurchase` from `backend/src/domain/node.types.ts` as the persisted purchase shape.

- [ ] **Step 1: Write failing SQLite persistence tests**

Add imports for `NodeTrafficPurchase` and define a fixed fixture:

```ts
const trafficPurchase: NodeTrafficPurchase = {
  updateId: 'purchase-1',
  eventOffset: '42',
  recordTime: '2026-08-14T10:00:00.000Z',
  purchasedTraffic: '1000',
  amuletPaid: '5',
};
```

Add one test that stores `{ nodeId: 'participant-1', cacheDay: '2026-08-14', purchase: trafficPurchase, cachedAt: '2026-08-14T12:00:00.000Z' }`, closes the service, opens a new `PackageCacheService` against the same temporary path, and expects the complete typed snapshot back. Add a second test that stores the same key shape with `purchase: null` and expects `purchase` to remain null after reopening the database.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm run test --workspace backend -- package-cache.service.spec.ts`

Expected: TypeScript/Jest failure because `getNodeTrafficPurchase` and `storeNodeTrafficPurchase` do not exist.

- [ ] **Step 3: Add the SQLite row type, public cache API, and schema**

In `package-cache.service.ts`, import `NodeTrafficPurchase` as a type and define:

```ts
export interface CachedNodeTrafficPurchase {
  nodeId: string;
  cacheDay: string;
  purchase: NodeTrafficPurchase | null;
  cachedAt: string;
}
```

Add `node_traffic_purchase_cache` to `initializeSchema()`:

```sql
create table if not exists node_traffic_purchase_cache (
  node_id text not null,
  cache_day text not null,
  update_id text,
  event_offset text,
  record_time text,
  purchased_traffic text,
  amulet_paid text,
  cached_at text not null,
  primary key (node_id, cache_day)
);
```

Implement `getNodeTrafficPurchase` with a parameterized `select` by node/day. Return `null` for no row; otherwise return a `CachedNodeTrafficPurchase`, treating `update_id is null` as `purchase: null`. Implement `storeNodeTrafficPurchase` with `insert ... on conflict(node_id, cache_day) do update`, writing all purchase fields as null when `snapshot.purchase` is null. Bind every value with `DatabaseSync.prepare(...).get/run(...)`; do not interpolate node IDs or values into SQL.

- [ ] **Step 4: Run focused tests to verify persistence works**

Run: `npm run test --workspace backend -- package-cache.service.spec.ts`

Expected: PASS, including the new reopen/persistence and cached-no-result tests.

- [ ] **Step 5: Commit the isolated cache-store change**

```bash
git add backend/src/packages/package-cache.service.ts backend/test/packages/package-cache.service.spec.ts
git commit -m "feat: persist daily traffic purchase cache"
```

### Task 2: Use the daily SQLite cache for traffic estimates

**Files:**
- Modify: `backend/src/pqs/pqs-summary.service.ts:2700-2730, 3078-3090`
- Test: `backend/test/pqs/pqs-summary.service.spec.ts:12012-12055`

**Interfaces:**
- Consumes: `PackageCacheService.getNodeTrafficPurchase` and `PackageCacheService.storeNodeTrafficPurchase` from Task 1.
- Produces: `latestTrafficPurchase(node: NodeConfig): Promise<NodeTrafficPurchase | null>` that reads the daily persistent cache before invoking `fetchTrafficPurchases`.

- [ ] **Step 1: Write failing behaviour tests for daily cache reuse and rollover**

In `pqs-summary.service.spec.ts`, use Jest fake timers with a fixed UTC time, instantiate a temporary `PackageCacheService`, and pass it as the third constructor dependency:

```ts
const service = new PqsSummaryService(
  { getRawExecutor: async () => ({ query: jest.fn() }) } as never,
  undefined,
  cacheService,
);
```

Attach a `trafficCostEstimateService` as existing tests do, and spy on `fetchTrafficPurchases` to resolve one purchase. Call `fetchRecentUpdates` twice for the same node/day and assert `fetchTrafficPurchases` is called once. Advance the system time to the next UTC date, call it again, and assert the spy is called twice and the cache returns the second purchase.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm run test --workspace backend -- pqs-summary.service.spec.ts -t "daily traffic purchase"`

Expected: FAIL because the current implementation invokes `fetchTrafficPurchases` for every `fetchRecentUpdates` call.

- [ ] **Step 3: Implement the UTC-day cache read and successful refresh write**

Add a module helper that derives the UTC cache key without locale-specific time handling:

```ts
function utcCacheDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
```

Add a private map:

```ts
private readonly latestTrafficPurchaseRefreshes = new Map<
  string,
  Promise<NodeTrafficPurchase | null>
>();
```

In `latestTrafficPurchase`, retain the existing early return when no traffic-estimate service is configured. If `packageCacheService` is absent, use the current direct `fetchTrafficPurchases(node, { limit: 1 })` fallback so isolated service tests and nonstandard wiring remain compatible. Otherwise:

1. Compute `cacheDay` and read `getNodeTrafficPurchase(node.id, cacheDay)`.
2. Return its `purchase` immediately when a row exists.
3. Use `${node.id}:${cacheDay}` as an in-flight key. Return an existing promise if one is present.
4. Create a refresh promise that calls the existing `fetchTrafficPurchases(node, { limit: 1 })`, stores `{ nodeId, cacheDay, purchase: response.purchases[0] ?? null, cachedAt: new Date().toISOString() }`, and returns the stored purchase.
5. Catch PQS errors inside that promise and return null without storing a row. In `finally`, delete the in-flight key only when it still maps to the completed promise.

Keep `fetchTrafficPurchases` itself unchanged: the Traffic Purchases endpoints must continue to query PQS live.

- [ ] **Step 4: Run focused tests to verify same-day reuse and rollover**

Run: `npm run test --workspace backend -- pqs-summary.service.spec.ts -t "daily traffic purchase"`

Expected: PASS. The same UTC day uses one PQS lookup, while the next UTC day refreshes once.

- [ ] **Step 5: Commit the cache integration**

```bash
git add backend/src/pqs/pqs-summary.service.ts backend/test/pqs/pqs-summary.service.spec.ts
git commit -m "feat: cache daily traffic purchases"
```

### Task 3: Cover no-result, failure, and concurrent misses

**Files:**
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`

**Interfaces:**
- Consumes: Task 2's `latestTrafficPurchase` cache protocol.
- Produces: regression coverage that ensures missing or failing traffic data never blocks Latest Updates and cannot poison the daily SQLite cache.

- [ ] **Step 1: Write failing no-result, failure, and concurrency tests**

Add these three tests around the new daily-cache tests:

```ts
it('persists a same-day no-purchase result', async () => {
  fetchTrafficPurchases.mockResolvedValueOnce({ ...emptyResponse, purchases: [] });
  await service.fetchRecentUpdates(node);
  await service.fetchRecentUpdates(node);
  expect(fetchTrafficPurchases).toHaveBeenCalledTimes(1);
});

it('does not persist a failed daily refresh', async () => {
  fetchTrafficPurchases.mockRejectedValueOnce(new Error('PQS unavailable'));
  await expect(service.fetchRecentUpdates(node)).resolves.toMatchObject({ updates: expect.any(Array) });
  await service.fetchRecentUpdates(node);
  expect(fetchTrafficPurchases).toHaveBeenCalledTimes(2);
});

it('coalesces concurrent same-node daily refreshes', async () => {
  let resolvePurchase!: (value: NodeTrafficPurchasesResponse) => void;
  fetchTrafficPurchases.mockReturnValueOnce(new Promise((resolve) => { resolvePurchase = resolve; }));
  const first = service.fetchRecentUpdates(node);
  const second = service.fetchRecentUpdates(node);
  expect(fetchTrafficPurchases).toHaveBeenCalledTimes(1);
  resolvePurchase({ ...responseWithPurchase });
  await expect(Promise.all([first, second])).resolves.toHaveLength(2);
});
```

Use complete `NodeTrafficPurchasesResponse` fixtures with `nodeId`, `label`, `limit`, `nextBefore`, `nextAfter`, and `purchases`; reuse the existing recent-update query mocks so every response has at least one update to estimate.

- [ ] **Step 2: Run the focused tests to verify their initial result**

Run: `npm run test --workspace backend -- pqs-summary.service.spec.ts -t "daily traffic purchase"`

Expected: The new assertions expose any missing null-row persistence, failure cleanup, or promise coalescing behaviour.

- [ ] **Step 3: Make only the minimal corrections needed for the three edge cases**

Ensure the Task 2 implementation has these exact invariants:

```ts
const purchase = response.purchases[0] ?? null;
this.packageCacheService?.storeNodeTrafficPurchase({
  nodeId: node.id,
  cacheDay,
  purchase,
  cachedAt: new Date().toISOString(),
});
return purchase;
```

```ts
try {
  return await refresh;
} catch {
  return null;
} finally {
  if (this.latestTrafficPurchaseRefreshes.get(cacheKey) === refresh) {
    this.latestTrafficPurchaseRefreshes.delete(cacheKey);
  }
}
```

Do not call `storeNodeTrafficPurchase` from the error path. Keep the no-result write in the successful response path.

- [ ] **Step 4: Run focused and full backend tests**

Run: `npm run test --workspace backend -- pqs-summary.service.spec.ts package-cache.service.spec.ts`

Expected: PASS for all selected test suites.

Then run: `npm run test --workspace backend`

Expected: PASS for the backend suite.

- [ ] **Step 5: Commit regression coverage and any minimal fix**

```bash
git add backend/src/pqs/pqs-summary.service.ts backend/test/pqs/pqs-summary.service.spec.ts
git commit -m "test: cover daily traffic purchase cache failures"
```

### Task 4: Verify application integration and preserve live history behaviour

**Files:**
- Verify: `backend/src/app.module.ts`
- Verify: `backend/src/api/nodes.controller.ts:442-477`
- Verify: `backend/src/pqs/pqs-summary.service.ts:2744-2820, 3078-3090`

**Interfaces:**
- Consumes: registered `PackageCacheService` and the unchanged public `fetchTrafficPurchases` method.
- Produces: confidence that production DI uses SQLite cache for estimates while the live history API is unchanged.

- [ ] **Step 1: Add a controller/service regression test for the live history path**

In the existing `fetchTrafficPurchases` tests, add or extend an assertion that directly calling `service.fetchTrafficPurchases(node, { limit: 1 })` invokes the raw PQS executor even after a same-day `latestTrafficPurchase` cache row exists. The expectation is deliberately on the raw query call rather than cache methods:

```ts
await service.fetchTrafficPurchases(node, { limit: 1 });
expect(query).toHaveBeenCalledWith(expect.stringContaining('AmuletRules_BuyMemberTraffic'));
```

- [ ] **Step 2: Run the regression test to verify live history bypasses the daily cache**

Run: `npm run test --workspace backend -- pqs-summary.service.spec.ts -t "traffic purchases"`

Expected: PASS and the raw PQS query is still observed.

- [ ] **Step 3: Verify production dependency injection requires no module wiring change**

Inspect `backend/src/app.module.ts` and confirm `PackageCacheService` remains registered before `PqsSummaryService` is instantiated. Do not add a second SQLite provider or a new environment variable: Task 1 extends the already-configured `PACKAGE_CACHE_DB_PATH` database.

- [ ] **Step 4: Run full project verification**

Run: `npm test`

Expected: PASS for backend and frontend test suites.

Run: `npm run build`

Expected: PASS for backend and frontend production builds.

- [ ] **Step 5: Commit final verification-only changes if any test required an assertion update**

```bash
git add backend/test/pqs/pqs-summary.service.spec.ts
git commit -m "test: preserve live traffic purchase history"
```
