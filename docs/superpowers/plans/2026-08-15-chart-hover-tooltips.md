# Chart Hover Tooltips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show an exact value tooltip and a circle on the selected point when users hover any SVG line chart.

**Architecture:** A reusable Vue composable will convert pointer coordinates into SVG plot coordinates and select the nearest timestamp from a chart-provided point set. Each existing chart retains its own data shaping, paths, formatting, and SVG rendering while consuming the composable's selected timestamp and tooltip position.

**Tech Stack:** Vue 3 Composition API, TypeScript, SVG, Vitest, Testing Library.

## Global Constraints

- Apply to the two Home dashboard charts, every node activity history chart, and the Canton Coin price chart.
- Pointer movement selects the nearest plotted timestamp; pointer leave clears tooltip and markers.
- Tooltips are constrained to the containing chart shell and include formatted timestamp plus exact formatted values.
- Single-series charts render one selected-point circle; the Canton Coin chart renders a circle for every series with a value at the selected day and lists all those values.
- Keep existing SVG chart rendering, chart data/loading behavior, and descriptive SVG labels intact.
- Do not add a charting dependency or stage the pre-existing `backend/package.json` edit.

---

## File Structure

- `frontend/src/composables/useSvgChartHover.ts` — shared pointer-to-SVG conversion, nearest timestamp selection, tooltip coordinates, and leave reset.
- `frontend/src/composables/useSvgChartHover.test.ts` — unit coverage for coordinate conversion, nearest-point choice, clamping, and reset.
- `frontend/src/components/HomeDashboardOverview.vue` — build hoverable points for its activity and price lines and render local tooltip/marker overlays.
- `frontend/src/components/HomeDashboardOverview.test.ts` — verify each dashboard chart's tooltip and marker behavior.
- `frontend/src/views/HomeActivityView.vue` — build per-node hoverable activity points without changing links or time-range loading.
- `frontend/src/views/HomeActivityView.test.ts` — verify a node chart's exact hover value and leave reset.
- `frontend/src/views/CantonCoinView.vue` — collect venue/median points by UTC day and render multi-series tooltip rows and markers.
- `frontend/src/views/CantonCoinView.test.ts` — verify multi-series values, markers only for present data, and leave reset.
- `frontend/src/styles.css` — chart-shell tooltip and selected-marker presentation shared by class names, plus chart-specific series marker colors.

### Task 1: Create shared SVG hover selection

**Files:**
- Create: `frontend/src/composables/useSvgChartHover.ts`
- Test: `frontend/src/composables/useSvgChartHover.test.ts`

**Interfaces:**
- Produces:

  ```ts
  export type SvgChartHoverPoint = {
    timestamp: string;
    x: number;
    y: number;
  };

  export function useSvgChartHover(options: {
    points: () => SvgChartHoverPoint[];
    viewBox: { width: number; height: number };
  }): {
    activeTimestamp: Readonly<Ref<string | null>>;
    tooltip: Readonly<Ref<{ left: number; top: number } | null>>;
    onPointerMove(event: PointerEvent): void;
    onPointerLeave(): void;
  };
  ```

- Consumes: chart points whose `x` positions are in their SVG viewBox coordinate system and ordered by timestamp.

- [ ] **Step 1: Write failing composable tests**

  Add tests that supply a stub SVG rectangle and three points at x positions 20, 100, and 180. Dispatch pointer events near x=105 and assert the second timestamp is active. Assert tooltip percentages stay inside a 4–96% horizontal and vertical range, then call `onPointerLeave` and expect both state values to be null:

  ```ts
  hover.onPointerMove(new PointerEvent('pointermove', { clientX: 105, clientY: 20 }));
  expect(hover.activeTimestamp.value).toBe('2026-08-02T00:00:00.000Z');
  expect(hover.tooltip.value).toEqual({ left: 96, top: 4 });

  hover.onPointerLeave();
  expect(hover.activeTimestamp.value).toBeNull();
  expect(hover.tooltip.value).toBeNull();
  ```

- [ ] **Step 2: Run the composable test to verify it fails**

  Run: `npm test -- --run frontend/src/composables/useSvgChartHover.test.ts`

  Expected: FAIL because the composable does not yet exist.

- [ ] **Step 3: Implement the minimal composable**

  Convert the event's client coordinates using `event.currentTarget` as an `SVGSVGElement` and its `getBoundingClientRect()`. Convert x into viewBox coordinates, choose the point with the smallest absolute `x` difference, and convert client offsets into clamped tooltip percentages:

  ```ts
  const svgX = ((event.clientX - bounds.left) / bounds.width) * options.viewBox.width;
  const selected = options.points().reduce((closest, point) =>
    Math.abs(point.x - svgX) < Math.abs(closest.x - svgX) ? point : closest,
  );
  activeTimestamp.value = selected.timestamp;
  tooltip.value = {
    left: clamp(((event.clientX - bounds.left) / bounds.width) * 100, 4, 96),
    top: clamp(((event.clientY - bounds.top) / bounds.height) * 100, 4, 96),
  };
  ```

  Guard zero-size bounds and empty points by calling `onPointerLeave`.

- [ ] **Step 4: Run the composable test to verify it passes**

  Run: `npm test -- --run frontend/src/composables/useSvgChartHover.test.ts`

  Expected: PASS with nearest-point, clamping, empty-data, and leave-reset cases.

- [ ] **Step 5: Commit the shared interaction primitive**

  ```bash
  git add frontend/src/composables/useSvgChartHover.ts frontend/src/composables/useSvgChartHover.test.ts
  git commit -m "feat: add SVG chart hover selection"
  ```

### Task 2: Add hover feedback to Home dashboard and activity charts

**Files:**
- Modify: `frontend/src/components/HomeDashboardOverview.vue:21-405`
- Modify: `frontend/src/components/HomeDashboardOverview.test.ts`
- Modify: `frontend/src/views/HomeActivityView.vue:169-451`
- Modify: `frontend/src/views/HomeActivityView.test.ts`
- Modify: `frontend/src/styles.css:2880-2920,3186-3235`

**Interfaces:**
- Consumes: `useSvgChartHover` from Task 1 and local computed point arrays shaped as `{ timestamp, x, y }`.
- Produces: dashboard and per-node activity tooltip/marker state local to each chart; no API or route change.

- [ ] **Step 1: Write failing dashboard and activity interaction tests**

  Stub `getBoundingClientRect` on the chart SVG with a 520×180 dashboard box and a 320×96 activity box. Dispatch `pointermove`, then require tooltip text and exactly one selected marker in the relevant chart:

  ```ts
  await fireEvent.pointerMove(activityChart, { clientX: 260, clientY: 60 });
  expect(screen.getByText('Transactions: 6')).toBeInTheDocument();
  expect(activityChart.querySelectorAll('[data-chart-hover-marker]')).toHaveLength(1);

  await fireEvent.pointerLeave(activityChart);
  expect(screen.queryByText('Transactions: 6')).not.toBeInTheDocument();
  ```

  Add equivalent assertions for `CC price` and a node activity sample, including their formatted timestamps.

- [ ] **Step 2: Run chart-view tests to verify they fail**

  Run: `npm test -- --run frontend/src/components/HomeDashboardOverview.test.ts frontend/src/views/HomeActivityView.test.ts`

  Expected: FAIL because the charts do not expose pointer handlers, tooltip text, or marker circles.

- [ ] **Step 3: Implement dashboard point data and overlays**

  Refactor the existing dashboard coordinate calculation into a helper returning points with `timestamp`, `value`, `x`, and `y`; keep `chartPoints` derived from it. Instantiate a separate hover composable for activity and price. Attach pointer handlers to each SVG and render the matching active point:

  ```vue
  <circle
    v-if="activeActivityPoint"
    data-chart-hover-marker
    class="chart-hover-marker"
    :cx="activeActivityPoint.x"
    :cy="activeActivityPoint.y"
    r="4"
  />
  <div v-if="activityHover.tooltip && activeActivityPoint" class="chart-hover-tooltip" :style="tooltipStyle(activityHover.tooltip)">
    <strong>{{ formatDashboardTimestamp(activeActivityPoint.timestamp) }}</strong>
    <span>Transactions: {{ activeActivityPoint.value.toLocaleString() }}</span>
  </div>
  ```

  Render the tooltip as a sibling inside the existing chart shell, not inside SVG, so it can follow the pointer without SVG text layout constraints.

- [ ] **Step 4: Implement per-node activity point data and overlays**

  Introduce an activity-point helper that reuses `displaySamples`, `chartDomain`, and the existing y-scale calculation. Each node chart gets its own hover composable keyed to its series, and pointer events stop propagation so hovering does not navigate its enclosing `RouterLink`.

  Render a circle at the active `x`/`y` and a tooltip containing local-time timestamp and exact `activityValue`.

- [ ] **Step 5: Add scoped tooltip and marker styles**

  Add reusable classes with absolute positioning, `pointer-events: none`, high contrast background/border, and safe z-index. Give dashboard and activity chart shells `position: relative`; use the existing line color for marker stroke, a surface fill, and a visible radius.

- [ ] **Step 6: Run the affected frontend tests to verify they pass**

  Run: `npm test -- --run frontend/src/composables/useSvgChartHover.test.ts frontend/src/components/HomeDashboardOverview.test.ts frontend/src/views/HomeActivityView.test.ts`

  Expected: PASS with exact values, marker circles, and pointer-leave clearing verified.

- [ ] **Step 7: Commit dashboard and activity hover behavior**

  ```bash
  git add frontend/src/components/HomeDashboardOverview.vue frontend/src/components/HomeDashboardOverview.test.ts frontend/src/views/HomeActivityView.vue frontend/src/views/HomeActivityView.test.ts frontend/src/styles.css
  git commit -m "feat: show hover values on dashboard charts"
  ```

### Task 3: Add multi-series Canton Coin chart feedback

**Files:**
- Modify: `frontend/src/views/CantonCoinView.vue:1-306`
- Modify: `frontend/src/views/CantonCoinView.test.ts`
- Modify: `frontend/src/styles.css:157-210`

**Interfaces:**
- Consumes: `useSvgChartHover` and shared timestamp selection from Task 1.
- Produces: one tooltip whose rows have `{ label: string; quote: string; close: number; x: number; y: number; className: string }` for all selected-day venue and median values.

- [ ] **Step 1: Write failing multi-series chart tests**

  In the existing history fixture, hover the first date and assert exact rows for OKX, Bybit, and Cross-venue median plus three markers. Hover the second date and assert only OKX and the median appear because Bybit has no candle, then assert leave removes the tooltip and all markers:

  ```ts
  await fireEvent.pointerMove(chart, { clientX: 74, clientY: 80 });
  expect(screen.getByText('OKX: 0.105 USDT')).toBeInTheDocument();
  expect(screen.getByText('Bybit: 0.11 USDT')).toBeInTheDocument();
  expect(chart.querySelectorAll('[data-chart-hover-marker]')).toHaveLength(3);
  ```

- [ ] **Step 2: Run the Canton Coin view test to verify it fails**

  Run: `npm test -- --run frontend/src/views/CantonCoinView.test.ts`

  Expected: FAIL because no chart hover state, rows, or markers are rendered.

- [ ] **Step 3: Implement shared-day series points and tooltip rows**

  Reuse the `linePoints` scale inputs to derive coordinate-bearing points for each venue and the median. Build the hover composable's anchor point set from the union of all available timestamps. When a timestamp is active, build rows from series whose candle timestamp matches exactly:

  ```ts
  const activePriceRows = computed(() => {
    const timestamp = priceHover.activeTimestamp.value;
    return timestamp === null ? [] : chartSeries.value.flatMap((series) => {
      const point = series.points.find((candidate) => candidate.timestamp === timestamp);
      return point ? [{ ...point, label: series.label, quote: series.quote, className: series.className }] : [];
    });
  });
  ```

  Attach SVG pointer handlers, render one marker circle per row with the series line class, and render the tooltip's date followed by formatted rows. Keep the existing legend and range buttons unchanged.

- [ ] **Step 4: Style series-specific marker circles**

  Reuse the existing OKX, Bybit, and median colors for `.chart-hover-marker--okx`, `.chart-hover-marker--bybit`, and `.chart-hover-marker--median`; retain a surface fill so markers remain visible over a line.

- [ ] **Step 5: Run all chart-focused frontend tests to verify they pass**

  Run: `npm test -- --run frontend/src/composables/useSvgChartHover.test.ts frontend/src/components/HomeDashboardOverview.test.ts frontend/src/views/HomeActivityView.test.ts frontend/src/views/CantonCoinView.test.ts`

  Expected: PASS, including multi-series missing-data behavior.

- [ ] **Step 6: Run full validation and restore any generated fixture**

  Run: `npm test && npm run build`

  Expected: all backend/frontend tests and production build pass. If `backend/test/fixtures/daml/package-cache.sqlite` changes from the test run, restore it before staging.

- [ ] **Step 7: Commit the Canton Coin integration**

  ```bash
  git add frontend/src/views/CantonCoinView.vue frontend/src/views/CantonCoinView.test.ts frontend/src/styles.css
  git commit -m "feat: show exact values on coin chart hover"
  ```
