# Home Dashboard Charts and Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add all-node transactions and Canton Coin price charts plus Latest CC Price and rolling-24-hour Active Parties metrics above the existing Home tables.

**Architecture:** Keep the existing Updates and Trades browsers unchanged. Extend the backend only where the current data contracts cannot satisfy the Home overview: 31-day activity retention and a rolling recent-party aggregate. Add pure frontend transformations in a small helper module and a focused `HomeDashboardOverview` component that independently loads and renders the charts and metric panels.

**Tech Stack:** NestJS/TypeScript backend, Vue 3 `<script setup>`, Vue Testing Library/Vitest, Jest, SVG/CSS charts, existing PQS and market-provider data sources.

## Global Constraints

- Use chart ranges exactly `24h`, `7d`, and `31d`.
- Use daily Canton Coin candles only; do not add intraday market data.
- The `24h` Canton Coin view displays the newest available daily point.
- Active Parties means unique party IDs appearing in updates during the rolling last 24 hours, deduplicated across all configured nodes.
- Keep the existing Nodes page range controls at `1`, `7`, and `30` days.
- Keep Latest Updates and Latest Trades behavior and placement below the new overview.
- Preserve the unrelated working-tree modification in `backend/package.json`.
- Use `rtk` for repository commands and commit each completed task on `main`.

---

## File map

**Backend**

- Modify `backend/src/cache/node-cache.service.ts`: support 31-day activity windows and retention.
- Modify `backend/src/domain/node.types.ts`: define the recent Active Parties response contract.
- Modify `backend/src/pqs/pqs-summary.service.ts`: query and aggregate recent party witnesses across nodes.
- Modify `backend/src/api/nodes.controller.ts`: expose `GET /api/parties/activity?hours=24`.
- Test `backend/test/cache/node-cache.service.spec.ts`, `backend/test/pqs/pqs-summary.service.spec.ts`, and `backend/test/api/nodes.controller.spec.ts`.

**Frontend data and UI**

- Modify `frontend/src/types/active-parties.ts`: add `RecentActivePartiesResponse`.
- Modify `frontend/src/lib/api.ts`: add `fetchRecentActiveParties(hours = 24)`.
- Create `frontend/src/lib/home-dashboard.ts`: pure range, activity aggregation, daily price, and SVG-point helpers.
- Create `frontend/src/lib/home-dashboard.test.ts`: helper tests.
- Create `frontend/src/components/HomeDashboardOverview.vue`: overview charts, metric panels, range controls, and independent states.
- Create `frontend/src/components/HomeDashboardOverview.test.ts`: component behavior tests.
- Modify `frontend/src/views/HomeView.vue`: render the overview before the existing table grid.
- Modify `frontend/src/views/HomeView.test.ts`: mock the overview data and verify layout/ordering without weakening existing table assertions.
- Modify `frontend/src/styles.css`: style the two-column chart row, full-width metric row, daily chart axes/empty states, and responsive stacking using existing theme variables.

---

## Task 1: Extend activity history to 31 days

**Files:**

- Modify: `backend/src/cache/node-cache.service.ts`
- Test: `backend/test/cache/node-cache.service.spec.ts`

**Interfaces:**

- Preserve `NodeCacheService.listActivityHistory(requestedDays?: number): NodeActivityHistoryResponse`.
- Normalize supported windows to `1 | 7 | 30 | 31`.
- Set retention to `31 * 24 * 60 * 60 * 1000` and keep `windowMinutes` equal to `windowDays * 1440`.

- [ ] **Step 1: Add failing cache tests.** Add a test that seeds samples older than 30 days but inside 31 days and asserts `listActivityHistory(31)` returns them with `windowMinutes: 44640`. Add a second assertion that a sample older than 31 days is pruned.

```ts
it('supports the 31-day activity window and retention boundary', () => {
  const cache = new NodeCacheService();
  cache.seedActivityHistory({
    nodeId: 'participant-1',
    label: 'Participant 1',
    status: 'healthy',
    latestActiveContractCount: 4,
    lastObservedUpdateCount: 4,
    samples: [
      { timestamp: '2026-06-01T12:44:00.000Z', activityValue: 3, activeContractCount: 4, latestOffset: '0' },
      { timestamp: '2026-06-02T12:45:00.000Z', activityValue: 2, activeContractCount: 4, latestOffset: '1' },
    ],
  });

  expect(cache.listActivityHistory(31).windowMinutes).toBe(44640);
  expect(cache.listActivityHistory(31).nodes[0]?.samples).toHaveLength(1);
  expect(cache.listActivityHistory(31).nodes[0]?.samples[0]?.timestamp).toBe(
    '2026-06-02T12:45:00.000Z',
  );
});
```

- [ ] **Step 2: Run the focused test and verify the new test fails.**

Run: `rtk npm test -- --runInBand test/cache/node-cache.service.spec.ts -t "31-day activity"` from `backend`.

Expected: FAIL because the current cache normalizes `31` to the default one-day window and prunes after 30 days.

- [ ] **Step 3: Implement the minimal cache change.** Update the supported-window literal, `normalizeWindowDays` return type and membership check, `sliceSamplesForWindow` parameter type, and retention constant. Do not change the existing `HomeActivityView` options.

- [ ] **Step 4: Run the focused cache suite.**

Run: `rtk npm test -- --runInBand test/cache/node-cache.service.spec.ts` from `backend`.

Expected: all cache tests pass, including the new 31-day boundary test.

- [ ] **Step 5: Commit the task.**

```bash
rtk git add backend/src/cache/node-cache.service.ts backend/test/cache/node-cache.service.spec.ts
rtk git commit -m "feat: retain 31 days of activity history"
```

---

## Task 2: Add the rolling recent Active Parties backend aggregate

**Files:**

- Modify: `backend/src/domain/node.types.ts`
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Modify: `backend/src/api/nodes.controller.ts`
- Test: `backend/test/pqs/pqs-summary.service.spec.ts`
- Test: `backend/test/api/nodes.controller.spec.ts`

**Interfaces:**

```ts
export interface RecentActivePartiesResponse {
  count: number;
  windowStart: string;
  windowEnd: string;
  status: 'ok' | 'partial' | 'error';
  error: string | null;
}

fetchRecentActiveParties(nodes: NodeConfig[], hours = 24, now = new Date()): Promise<RecentActivePartiesResponse>
```

- The controller parses a positive integer `hours`, defaults invalid/missing values to `24`, and calls `fetchRecentActiveParties(this.configService.list(), parsedHours)`.
- Each node query returns distinct party witnesses from contract create/archive and exercise records whose transaction effective time is at or after `windowStart` and at or before `windowEnd`.
- Successful node results are unioned by normalized party ID. All nodes succeeding produces `ok`; a mix of success and failure produces `partial`; no node succeeds produces `error` with `count: 0`.

- [ ] **Step 1: Add failing service tests.** In `backend/test/pqs/pqs-summary.service.spec.ts`, mock two node executors and assert that the service builds a rolling-window query, deduplicates a party returned by both nodes, returns the expected count and ISO bounds, and reports `partial` when one executor rejects.

```ts
it('counts unique parties observed in the rolling window across nodes', async () => {
  const now = new Date('2026-08-12T12:00:00.000Z');
  const result = await service.fetchRecentActiveParties(nodes, 24, now);

  expect(result).toMatchObject({
    count: 3,
    windowStart: '2026-08-11T12:00:00.000Z',
    windowEnd: '2026-08-12T12:00:00.000Z',
    status: 'ok',
    error: null,
  });
  expect(executor.query).toHaveBeenCalledWith(expect.stringContaining('effective_at'));
  expect(executor.query).toHaveBeenCalledWith(expect.stringContaining('2026-08-11T12:00:00.000Z'));
});
```

- [ ] **Step 2: Run the focused service test and verify it fails.**

Run: `rtk npm test -- --runInBand test/pqs/pqs-summary.service.spec.ts -t "unique parties observed"` from `backend`.

Expected: FAIL because the method and response type do not yet exist.

- [ ] **Step 3: Implement the service query and aggregation.** Add a private `pqsRecentActivePartiesQuery(node, windowStart)` beside `pqsRecentUpdatePartiesQuery`, using the same three witness sources: contract creates, contract archives, and exercises. Add `fetchRecentActiveParties` that computes UTC ISO bounds, runs node queries with `Promise.allSettled`, normalizes returned arrays using the existing party normalization, and builds the status/error response.

- [ ] **Step 4: Add the controller test before wiring the route.** Assert `GET /parties/activity` delegates with `24`, `GET /parties/activity?hours=12` delegates with `12`, and invalid values delegate with `24`. Follow the existing `NodesController` unit-test construction style.

- [ ] **Step 5: Run the controller test and verify it fails.**

Run: `rtk npm test -- --runInBand test/api/nodes.controller.spec.ts -t "parties activity"` from `backend`.

Expected: FAIL because the route is not present.

- [ ] **Step 6: Add the route.** Add `@Get('/parties/activity')` before `@Get('/parties/:partyId')`, parse the query, and return the service result. Keep the existing `/parties` current-inventory endpoint unchanged.

- [ ] **Step 7: Run the focused backend tests.**

Run: `rtk npm test -- --runInBand test/pqs/pqs-summary.service.spec.ts test/api/nodes.controller.spec.ts` from `backend`.

Expected: all selected service and controller tests pass.

- [ ] **Step 8: Commit the task.**

```bash
rtk git add backend/src/domain/node.types.ts backend/src/pqs/pqs-summary.service.ts backend/src/api/nodes.controller.ts backend/test/pqs/pqs-summary.service.spec.ts backend/test/api/nodes.controller.spec.ts
rtk git commit -m "feat: expose rolling active party count"
```

---

## Task 3: Add frontend dashboard data contracts and pure transformations

**Files:**

- Modify: `frontend/src/types/active-parties.ts`
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/home-dashboard.ts`
- Test: `frontend/src/lib/home-dashboard.test.ts`

**Interfaces:**

```ts
export type HomeDashboardRange = '24h' | '7d' | '31d';

export interface HomeActivityPoint {
  timestamp: string;
  activityValue: number;
}

export interface LatestCantonCoinPrice {
  close: number;
  quote: string;
  timestamp: string;
}

export function rangeDays(range: HomeDashboardRange): 1 | 7 | 31;
export function aggregateActivity(
  history: ActivityHistoryResponse,
  range: HomeDashboardRange,
): HomeActivityPoint[];
export function latestCantonCoinPrice(
  venues: CantonCoinVenue[],
): LatestCantonCoinPrice | null;
export function filterDailyPricePoints(
  venues: CantonCoinVenue[],
  range: HomeDashboardRange,
  now?: Date,
): CantonCoinMedianPoint[];
export function svgLinePoints(
  points: Array<{ timestamp: string; value: number }>,
  startMs: number,
  endMs: number,
  width: number,
  height: number,
): string;
```

- `aggregateActivity` sums values for the same 15-minute bucket across nodes, keeps valid timestamps only, fills no synthetic buckets, and filters from `generatedAt - rangeDays(range)` through `generatedAt`.
- `latestCantonCoinPrice` ignores non-`ok` venues and invalid/negative closes, finds the newest UTC day, groups by quote, prefers `USDT` then `USD`, and takes the median close in the selected quote group.
- `filterDailyPricePoints` returns daily median points for the selected range and the same quote-selection rule; for a single venue it retains that valid venue’s close rather than discarding the point.
- `svgLinePoints` returns an empty string for no valid points and clamps timestamps/values to the chart bounds.
- `fetchRecentActiveParties(hours = 24)` calls `/parties/activity?hours=${hours}` and returns `RecentActivePartiesResponse`.

- [ ] **Step 1: Write failing helper tests.** Cover 24h/7d/31d boundaries, cross-node activity sums, invalid timestamps, latest same-quote median, single-venue fallback, quote preference, daily range filtering, and empty data.

- [ ] **Step 2: Run the focused helper suite and verify it fails.**

Run: `rtk npm test -- --run src/lib/home-dashboard.test.ts` from `frontend`.

Expected: FAIL because the helper module does not exist.

- [ ] **Step 3: Implement the pure helpers and API method.** Keep the functions deterministic by accepting `now` where date filtering needs a clock. Reuse `medianCloseByUtcDay` only where its multi-venue behavior matches the contract; do not alter the existing Canton Coin page behavior.

- [ ] **Step 4: Run the focused helper and API tests.**

Run: `rtk npm test -- --run src/lib/home-dashboard.test.ts src/lib/api.test.ts` from `frontend`.

Expected: all selected tests pass.

- [ ] **Step 5: Commit the task.**

```bash
rtk git add frontend/src/types/active-parties.ts frontend/src/lib/api.ts frontend/src/lib/home-dashboard.ts frontend/src/lib/home-dashboard.test.ts
rtk git commit -m "feat: add home dashboard data helpers"
```

---

## Task 4: Build the Home dashboard overview component

**Files:**

- Create: `frontend/src/components/HomeDashboardOverview.vue`
- Test: `frontend/src/components/HomeDashboardOverview.test.ts`
- Modify: `frontend/src/styles.css`

**Interfaces:**

- The component has no required props and calls:

```ts
fetchActivityHistory(rangeDays(transactionRange.value));
fetchCantonCoinHistory('1D');
fetchRecentActiveParties(24);
```

- It renders accessible headings `Transactions`, `Canton Coin Price`, `Latest Canton Coin Price`, and `Active Parties (24h)`.
- Each chart has a button group with `24h`, `7d`, and `31d`; the active button exposes `aria-pressed="true"`.
- Chart and metric requests have separate `loading`, `error`, and empty states. The market request feeds both the price chart and latest-price metric without a second request.

- [ ] **Step 1: Add failing component tests.** Mock the three API functions and assert the two chart panels are in the same overview row, the metrics are in a full-width block, the ranges render with `24h` selected, aggregated transaction values render from multiple nodes, the daily price point renders with its quote, and the Active Parties count renders. Add tests for independent market and party error states.

```ts
expect(screen.getByRole('heading', { name: 'Transactions' })).toBeInTheDocument();
expect(screen.getByRole('heading', { name: 'Canton Coin Price' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: '24h' })).toHaveAttribute('aria-pressed', 'true');
expect(screen.getByText('Latest Canton Coin Price')).toBeInTheDocument();
expect(screen.getByText('3 Active Parties')).toBeInTheDocument();
```

- [ ] **Step 2: Run the focused component suite and verify it fails.**

Run: `rtk npm test -- --run src/components/HomeDashboardOverview.test.ts` from `frontend`.

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the component.** Use one `overview__charts` grid with two equal columns and one `overview__metrics` full-width grid below it. Render simple inline SVG polylines with shared theme variables; include axis endpoints and an empty state for a 24h daily price range with no valid candle. Keep range changes local to their chart and reload only activity history when its range changes.

- [ ] **Step 4: Add responsive CSS.** Keep the two charts side by side at desktop widths and stack them at the existing mobile breakpoint. Use `var(--surface-card)`, `var(--panel-border)`, `var(--chart-gradient-start)`, `var(--chart-line)`, and related theme variables so light/dark purple styling remains consistent.

- [ ] **Step 5: Run the focused component suite.**

Run: `rtk npm test -- --run src/components/HomeDashboardOverview.test.ts` from `frontend`.

Expected: all component tests pass.

- [ ] **Step 6: Commit the task.**

```bash
rtk git add frontend/src/components/HomeDashboardOverview.vue frontend/src/components/HomeDashboardOverview.test.ts frontend/src/styles.css
rtk git commit -m "feat: add home dashboard overview panels"
```

---

## Task 5: Place the overview above the existing Home tables

**Files:**

- Modify: `frontend/src/views/HomeView.vue`
- Modify: `frontend/src/views/HomeView.test.ts`

**Interfaces:**

- Import `HomeDashboardOverview` and render it as the first child of `.home-dashboard` or an enclosing Home page layout.
- The existing Latest Updates and Latest Trades sections remain the same components and retain their current table aria labels, six-row previews, and View all rows.

- [ ] **Step 1: Extend the Home test with the intended order.** Mock the overview APIs in the existing `HomeView.test.ts`, render the page, and assert the overview container appears before the `Latest Updates` heading and the two existing tables still have eight rows.

- [ ] **Step 2: Run the Home test and verify it fails.**

Run: `rtk npm test -- --run src/views/HomeView.test.ts` from `frontend`.

Expected: FAIL because `HomeView` does not render `HomeDashboardOverview` yet.

- [ ] **Step 3: Add the component to `HomeView.vue`.** Place `<HomeDashboardOverview />` before the existing two table sections and do not move or alter their props.

- [ ] **Step 4: Run the focused Home tests.**

Run: `rtk npm test -- --run src/views/HomeView.test.ts src/components/HomeDashboardOverview.test.ts` from `frontend`.

Expected: all selected Home tests pass.

- [ ] **Step 5: Commit the integration.**

```bash
rtk git add frontend/src/views/HomeView.vue frontend/src/views/HomeView.test.ts
rtk git commit -m "feat: place dashboard overview above home feeds"
```

---

## Task 6: Full verification and handoff

**Files:**

- No new source files; verify all committed implementation changes.

- [ ] **Step 1: Run the complete backend suite.**

Run: `rtk npm test -- --runInBand` from `backend`.

Expected: zero failed tests.

- [ ] **Step 2: Run the complete frontend suite.**

Run: `rtk npm test -- --run` from `frontend`.

Expected: zero failed tests.

- [ ] **Step 3: Build both applications.**

Run: `rtk npm run build` from the repository root.

Expected: backend Nest build and frontend type-check/Vite build both exit successfully.

- [ ] **Step 4: Check the final diff and working tree.**

Run: `rtk git diff --check` and `rtk git status --short --branch`.

Expected: no whitespace errors; only the pre-existing `backend/package.json` modification remains outside the feature commits.

- [ ] **Step 5: Commit any only-if-needed verification corrections.** If verification reveals a source defect, add a focused regression test and implementation fix in a separate commit; otherwise do not create a no-op commit.
