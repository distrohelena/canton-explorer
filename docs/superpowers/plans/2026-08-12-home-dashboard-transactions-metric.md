# Home Dashboard Transactions Metric Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Network Metrics Transactions card showing cumulative transactions and latest-hour TPS from one healthy representative node.

**Architecture:** Reuse the existing ledger summary count already stored in `NodeCacheService` and expose it on each activity-history series. The frontend selects the first healthy series with a finite cumulative total, sums its activity deltas from the latest hour, divides by 3,600, and renders both values in the existing metric grid. No unique-update-ID query or new endpoint is added.

**Tech Stack:** NestJS, TypeScript, Vue 3 `<script setup>`, Vitest, Jest, Testing Library for Vue, CSS Grid.

## Global Constraints

- Do not run a cross-node unique update-ID query.
- Do not sum cumulative totals across nodes.
- Use one healthy representative node with a finite `totalUpdateCount`.
- Compute latest-hour TPS as activity deltas from the hour ending at `generatedAt`, divided by 3,600.
- Preserve the existing range controls, chart behavior, loading states, and active-parties/price metric behavior.
- Keep the existing two Network Metrics cards and add the Transactions card to the same grid.

---

### Task 1: Expose cumulative update totals in activity history

**Files:**
- Modify: `backend/src/domain/node.types.ts:36-49`
- Modify: `backend/src/cache/node-cache.service.ts:120-146`
- Test: `backend/src/cache/node-cache.service.spec.ts`

**Interfaces:**
- Consumes: `NodeSnapshot.ledgerSummary.totalUpdateCount` and `StoredActivitySeries.lastObservedUpdateCount`.
- Produces: `NodeActivitySeries.totalUpdateCount?: number | null` in the existing `/api/nodes/activity-history` payload.

- [ ] **Step 1: Add the failing cache regression test**

Add `totalUpdateCount` to the seeded-series assertion:

```ts
it('exposes the cumulative update count with activity history', () => {
  const cache = new NodeCacheService();

  cache.seedActivityHistory({
    nodeId: 'node-1',
    label: 'Node 1',
    status: 'healthy',
    latestActiveContractCount: 12,
    lastObservedUpdateCount: 40,
    samples: [],
  });

  expect(cache.listActivityHistory(1).nodes[0]?.totalUpdateCount).toBe(40);
});
```

- [ ] **Step 2: Run the backend regression test to verify it fails**

Run:

```bash
npm run test --workspace backend -- node/cache/node-cache.service.spec.ts
```

Expected: the new assertion fails because activity-history series do not yet expose `totalUpdateCount`.

- [ ] **Step 3: Add the optional series field and populate it**

Extend `NodeActivitySeries` with `totalUpdateCount?: number | null`. In `listActivityHistory`, populate it from the snapshot first and the cached last observed count second:

```ts
totalUpdateCount:
  snapshot?.ledgerSummary.totalUpdateCount
  ?? series?.lastObservedUpdateCount
  ?? null,
```

- [ ] **Step 4: Run the backend regression test to verify it passes**

Run the focused command from Step 2. Expected: the cache test passes.

- [ ] **Step 5: Commit the backend payload change**

```bash
git add backend/src/domain/node.types.ts backend/src/cache/node-cache.service.ts backend/src/cache/node-cache.service.spec.ts
git commit -m "feat: expose update totals in activity history"
```

### Task 2: Add the Transactions metric card and calculations

**Files:**
- Modify: `frontend/src/types/activity.ts:8-16`
- Modify: `frontend/src/components/HomeDashboardOverview.vue:34-215,369-395`
- Modify: `frontend/src/components/HomeDashboardOverview.test.ts:20-135`
- Modify: `frontend/src/styles.css:2939-2943`

**Interfaces:**
- Consumes: `ActivitySeries.totalUpdateCount` and `ActivitySeries.samples` from Task 1.
- Produces: representative-node transaction total and latest-hour TPS in a third `home-dashboard-overview__metric-panel`.

- [ ] **Step 1: Add failing Overview assertions**

Add `totalUpdateCount: 128` to the healthy fixture series and assert the new card renders the total and TPS. With the fixture’s one sample of `activityValue: 6` at `11:00` and `generatedAt: 12:00`, the latest-hour TPS is `6 / 3600 = 0.0017` when formatted to four decimals:

```ts
expect(screen.getByRole('heading', { name: 'Transactions' })).toBeInTheDocument();
expect(await screen.findByText('128')).toBeInTheDocument();
expect(screen.getByText('0.0017 TPS in the last hour')).toBeInTheDocument();
```

- [ ] **Step 2: Run the focused Overview test to verify it fails**

Run:

```bash
npm run test --workspace frontend -- src/components/HomeDashboardOverview.test.ts
```

Expected: the new Transactions assertions fail because no such card or calculations exist.

- [ ] **Step 3: Add representative-node and latest-hour computed values**

Implement these helpers/computed values in `HomeDashboardOverview.vue`:

```ts
const representativeActivitySeries = computed(() =>
  activity.value?.nodes.find(
    (node) => node.status === 'healthy'
      && typeof node.totalUpdateCount === 'number'
      && Number.isFinite(node.totalUpdateCount),
  ) ?? null,
);

const latestHourTps = computed(() => {
  const series = representativeActivitySeries.value;
  const generatedAt = Date.parse(activity.value?.generatedAt ?? '');
  if (!series || !Number.isFinite(generatedAt)) {
    return null;
  }

  const windowStart = generatedAt - 60 * 60 * 1000;
  const latestHourTransactions = series.samples.reduce((total, sample) => {
    const timestamp = Date.parse(sample.timestamp);
    return timestamp >= windowStart && timestamp <= generatedAt
      ? total + Math.max(sample.activityValue, 0)
      : total;
  }, 0);

  return latestHourTransactions / 3600;
});
```

Use a computed total from `representativeActivitySeries.value?.totalUpdateCount ?? null`, and format counts with `toLocaleString('en-US')`. Format TPS with four decimal places below one TPS and up to four decimal places otherwise.

- [ ] **Step 4: Render the Transactions card**

Add a third article after the existing Active Parties card. It must show `Loading…` while activity is loading, `—` for activity errors or unavailable representative data, the cumulative total when available, and the TPS caption when the latest-hour calculation is available.

- [ ] **Step 5: Put three metric cards on one desktop row**

Change `.home-dashboard-overview__metric-grid` to:

```css
grid-template-columns: repeat(3, minmax(0, 1fr));
```

Keep the existing mobile media rule that collapses it to one column.

- [ ] **Step 6: Run the focused Overview test to verify it passes**

Run the command from Step 2. Expected: all Overview tests pass, including the new total/TPS assertions and existing range behavior.

- [ ] **Step 7: Commit the frontend metric change**

```bash
git add frontend/src/types/activity.ts frontend/src/components/HomeDashboardOverview.vue frontend/src/components/HomeDashboardOverview.test.ts frontend/src/styles.css
git commit -m "feat: add dashboard transactions metric"
```

### Task 3: Complete verification

**Files:**
- Verify: `backend/src/domain/node.types.ts`
- Verify: `backend/src/cache/node-cache.service.ts`
- Verify: `frontend/src/types/activity.ts`
- Verify: `frontend/src/components/HomeDashboardOverview.vue`
- Verify: `frontend/src/components/HomeDashboardOverview.test.ts`
- Verify: `frontend/src/styles.css`

- [ ] **Step 1: Run the complete backend test suite**

Run:

```bash
rtk npm run test --workspace backend -- --runInBand
```

Expected: all backend Jest tests pass.

- [ ] **Step 2: Run the complete frontend test suite**

Run:

```bash
VITE_API_BASE_URL=http://localhost:4600/api rtk npm run test --workspace frontend
```

Expected: all frontend test files and tests pass.

- [ ] **Step 3: Build the frontend**

Run:

```bash
rtk npm run build --workspace frontend
```

Expected: Vue type-checking and the Vite production build pass.

- [ ] **Step 4: Review the final diff and status**

Run:

```bash
rtk git diff HEAD^ --check
rtk git status --short
rtk git show --stat --oneline HEAD
```

Expected: only the intended transaction metric files are in the implementation commit; the pre-existing `backend/package.json` change remains untouched.
