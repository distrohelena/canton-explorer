# PQS Activity Bucket Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the home-page activity graph metric with in-memory `15 minute` PQS update-count buckets for the last `30` days, while keeping the existing `1 / 7 / 30` day selector and API shape usable by the current frontend.

**Architecture:** Extend the PQS summary path to expose a cumulative update count from `participant.lapi_update_meta`, then let `NodePollerService` feed that cumulative value into `NodeCacheService`. The cache becomes responsible for turning successive cumulative totals into `15 minute` per-node buckets, merging multiple polls into the same bucket, pruning buckets older than `30` days, and slicing those buckets for the existing activity-history endpoint.

**Tech Stack:** NestJS, TypeScript, Jest, Vue 3, Vitest

---

## File Map

- Modify: `backend/src/domain/node.types.ts`
  - Extend `LedgerSummary` with the cumulative PQS update count needed by the poller/cache path.
- Modify: `backend/src/pqs/pqs-summary.service.ts`
  - Extend the summary queries and normalization so each node summary includes a cumulative update count from `participant.lapi_update_meta`.
- Modify: `backend/src/cache/node-cache.service.ts`
  - Replace raw per-poll storage semantics with `15 minute` bucket aggregation and last-seen cumulative-count tracking.
- Modify: `backend/src/orchestrator/node-poller.service.ts`
  - Stop deriving graph activity from contract-count deltas and instead hand the cumulative update count to the cache layer.
- Modify: `backend/src/api/nodes.controller.ts`
  - Only if needed to keep typing aligned; route shape should remain the same.
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`
  - Add summary-query tests for cumulative update-count extraction and fallback behavior.
- Modify: `backend/test/orchestrator/node-poller.service.spec.ts`
  - Add poller tests for baseline initialization and bucket delta handoff.
- Modify: `backend/test/api/nodes.controller.spec.ts`
  - Update activity-history expectations so returned samples represent bucketed event counts.
- Modify: `backend/test/cache/node-cache.service.spec.ts`
  - Add focused cache tests for `15 minute` bucketing, merging, slicing, pruning, and counter regression.
- Modify: `frontend/src/types/activity.ts`
  - Only if the backend response shape needs a naming or comment adjustment.
- Modify: `frontend/src/views/HomeActivityView.test.ts`
  - Confirm the current graph view still behaves correctly with bucketed activity samples.
- Modify: `frontend/src/lib/api.test.ts`
  - Only if response fixtures need updating.

## Task 1: Add Cumulative PQS Update Counts to Ledger Summaries

**Files:**
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`
- Modify: `backend/src/domain/node.types.ts`
- Modify: `backend/src/pqs/pqs-summary.service.ts`

- [ ] **Step 1: Write the failing PQS summary tests**

Add tests that expect `fetchSummary()` to return a cumulative update count:
- from the primary `active()`-based path when the query is extended
- from the participant-table fallback path using `participant.lapi_update_meta`

Use expectations like:

```ts
expect(summary.totalUpdateCount).toBe(1442);
expect(query).toHaveBeenNthCalledWith(
  2,
  expect.stringContaining('from participant.lapi_update_meta'),
);
```

- [ ] **Step 2: Run the focused PQS summary test**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts`

Expected: FAIL because `LedgerSummary` and `fetchSummary()` do not yet expose cumulative update counts.

- [ ] **Step 3: Implement the minimal summary-type and query changes**

Update:
- `backend/src/domain/node.types.ts` to add `totalUpdateCount: number`
- `backend/src/pqs/pqs-summary.service.ts` summary row typing, SQL, normalization, and default-summary values

Implementation target:
- primary query returns `count(*)` from `participant.lapi_update_meta` alongside current fields
- fallback query returns the same field from `participant.lapi_update_meta`
- normalization uses `Number(row.total_update_count ?? 0)`

- [ ] **Step 4: Re-run the focused PQS summary test**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/domain/node.types.ts backend/src/pqs/pqs-summary.service.ts backend/test/pqs/pqs-summary.service.spec.ts
git commit -m "feat: expose cumulative pqs update counts"
```

## Task 2: Convert the Cache to 15 Minute Event Buckets

**Files:**
- Modify: `backend/test/cache/node-cache.service.spec.ts`
- Modify: `backend/src/cache/node-cache.service.ts`

- [ ] **Step 1: Write the failing cache tests**

Add focused tests for:
- baseline initialization records zero activity when no previous cumulative total exists
- two polls in the same `15 minute` window merge into one bucket with summed `activityValue`
- crossing a `15 minute` boundary creates a second bucket
- the last `1`, `7`, and `30` day slices return the expected buckets
- old buckets are pruned after `30` days
- cumulative-count regression resets the baseline and never emits negative activity

Use explicit timestamps such as:

```ts
'2026-07-02T12:03:00.000Z'
'2026-07-02T12:11:00.000Z'
'2026-07-02T12:16:00.000Z'
```

- [ ] **Step 2: Run the focused cache test**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/cache/node-cache.service.spec.ts`

Expected: FAIL because the cache still stores per-poll raw samples and has no cumulative-count baseline logic.

- [ ] **Step 3: Implement the minimal bucketed cache model**

Update `backend/src/cache/node-cache.service.ts` to:
- track `lastObservedUpdateCount` per node
- floor timestamps to `15 minute` UTC boundaries
- compute `delta = max(currentTotal - previousTotal, 0)` after baseline rules
- merge deltas into the current bucket when multiple polls land in the same interval
- retain the latest `activeContractCount` and `latestOffset` in each bucket
- prune buckets older than `30` days
- keep `listActivityHistory(days)` slicing semantics intact

Suggested implementation seam:

```ts
interface StoredActivitySeries {
  nodeId: string;
  label: string;
  status: NodeStatus;
  latestActiveContractCount: number;
  lastObservedUpdateCount: number | null;
  samples: NodeActivitySample[];
}
```

- [ ] **Step 4: Re-run the focused cache test**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/cache/node-cache.service.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/cache/node-cache.service.ts backend/test/cache/node-cache.service.spec.ts
git commit -m "feat: bucket pqs activity in memory"
```

## Task 3: Feed Cumulative Totals Through the Poller

**Files:**
- Modify: `backend/test/orchestrator/node-poller.service.spec.ts`
- Modify: `backend/src/orchestrator/node-poller.service.ts`

- [ ] **Step 1: Write the failing poller test**

Add a test that performs successive `refreshNode()` calls with increasing `totalUpdateCount` values and expects the cache-backed activity history to reflect:
- zero on the first successful poll
- accumulated update deltas on later polls
- no dependency on `activeContractCount` changing

Example summary sequence:

```ts
mockResolvedValueOnce({
  activeContractCount: 12,
  latestOffset: '10',
  latestEventAt: '2026-07-01T11:59:00.000Z',
  totalUpdateCount: 100,
})
.mockResolvedValueOnce({
  activeContractCount: 12,
  latestOffset: '11',
  latestEventAt: '2026-07-01T12:00:00.000Z',
  totalUpdateCount: 107,
});
```

- [ ] **Step 2: Run the focused poller test**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/orchestrator/node-poller.service.spec.ts`

Expected: FAIL because `NodePollerService` still computes chart activity from active-contract deltas.

- [ ] **Step 3: Implement the minimal poller change**

Update `backend/src/orchestrator/node-poller.service.ts` so `recordActivitySample()` receives:
- `activityValue` derived by the cache from cumulative totals, not by the poller
- `totalUpdateCount` as an input field

If needed, remove or simplify `computeActivityValue()` so the cache owns delta math.

- [ ] **Step 4: Re-run the focused poller test**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/orchestrator/node-poller.service.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/orchestrator/node-poller.service.ts backend/test/orchestrator/node-poller.service.spec.ts
git commit -m "feat: drive activity buckets from cumulative updates"
```

## Task 4: Lock the API and View Behavior Around Bucketed Samples

**Files:**
- Modify: `backend/test/api/nodes.controller.spec.ts`
- Modify: `frontend/src/views/HomeActivityView.test.ts`
- Modify: `frontend/src/lib/api.test.ts`
- Modify: `frontend/src/types/activity.ts`
- Modify: `frontend/src/views/HomeActivityView.vue`

- [ ] **Step 1: Write or update the failing boundary tests**

Update:
- controller expectations so bucketed `activityValue` samples are returned for `days=1|7|30`
- home activity tests so the chart still renders bucket samples and the `Last 1 day / 7 days / 30 days` copy remains correct

If no production frontend change is needed, the failing test should still prove that the current view handles the bucketed response fixtures.

- [ ] **Step 2: Run the focused controller and frontend tests**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/api/nodes.controller.spec.ts`

Run: `rtk npm test --workspace frontend -- src/lib/api.test.ts src/views/HomeActivityView.test.ts`

Expected: FAIL only where fixtures or response-shape assumptions still reflect contract-count deltas.

- [ ] **Step 3: Make the minimal compatibility changes**

Update only what is required to keep the boundary stable:
- controller expectations and fixtures
- frontend response fixtures or type comments
- view copy only if the existing labels are now misleading

Avoid unnecessary UI redesign here.

- [ ] **Step 4: Re-run the focused controller and frontend tests**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/api/nodes.controller.spec.ts`

Run: `rtk npm test --workspace frontend -- src/lib/api.test.ts src/views/HomeActivityView.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/test/api/nodes.controller.spec.ts frontend/src/lib/api.test.ts frontend/src/types/activity.ts frontend/src/views/HomeActivityView.test.ts frontend/src/views/HomeActivityView.vue
git commit -m "test: align activity graph boundaries with event buckets"
```

## Task 5: Full Verification

**Files:**
- Verify: `backend/src/domain/node.types.ts`
- Verify: `backend/src/pqs/pqs-summary.service.ts`
- Verify: `backend/src/cache/node-cache.service.ts`
- Verify: `backend/src/orchestrator/node-poller.service.ts`
- Verify: `backend/test/pqs/pqs-summary.service.spec.ts`
- Verify: `backend/test/cache/node-cache.service.spec.ts`
- Verify: `backend/test/orchestrator/node-poller.service.spec.ts`
- Verify: `backend/test/api/nodes.controller.spec.ts`
- Verify: `frontend/src/lib/api.test.ts`
- Verify: `frontend/src/views/HomeActivityView.test.ts`
- Verify: `frontend/src/views/HomeActivityView.vue`
- Verify: `frontend/src/types/activity.ts`

- [ ] **Step 1: Run the touched backend tests**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts test/cache/node-cache.service.spec.ts test/orchestrator/node-poller.service.spec.ts test/api/nodes.controller.spec.ts`

Expected: PASS

- [ ] **Step 2: Run the touched frontend tests**

Run: `rtk npm test --workspace frontend -- src/lib/api.test.ts src/App.test.ts src/views/HomeActivityView.test.ts`

Expected: PASS

- [ ] **Step 3: Run the backend build**

Run: `rtk npm run build --workspace backend`

Expected: PASS

- [ ] **Step 4: Run the frontend build**

Run: `rtk npm run build --workspace frontend`

Expected: PASS

- [ ] **Step 5: Inspect final git state**

Run: `rtk git status --short`

Expected: only intended files changed, plus the unrelated pre-existing worktree changes already present in this repository
