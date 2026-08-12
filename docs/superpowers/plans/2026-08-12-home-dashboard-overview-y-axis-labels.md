# Home Dashboard Overview Y-Axis Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add readable zero-based Y-axis values to both Overview charts without changing their data or interaction behavior.

**Architecture:** Extract the chart scale calculation into one helper used by both the polyline and axis ticks. Render five SVG Y-axis labels at the top, 75%, 50%, 25%, and zero positions, with chart-specific formatting. Increase only the SVG’s left padding and add a label style.

**Tech Stack:** Vue 3, TypeScript, SVG, CSS, Vitest, Testing Library for Vue, Vite.

## Global Constraints

- Both chart scales always start at `0`.
- Both charts render five labels at 0%, 25%, 50%, 75%, and 100% of the zero-to-maximum scale.
- Transaction labels use rounded whole numbers.
- CC price labels use locale formatting with up to four decimal places.
- Existing API calls, chart ranges, line colors, date labels, loading/error states, and metric cards remain unchanged.

---

### Task 1: Add the failing Y-axis label regression test

**Files:**
- Modify: `frontend/src/components/HomeDashboardOverview.test.ts:82-100`

**Interfaces:**
- Consumes: the rendered chart SVGs exposed by `HomeDashboardOverview`.
- Produces: assertions that each populated chart exposes five zero-based Y-axis values.

- [ ] **Step 1: Add chart-axis assertions**

In the existing rendering test, after the data-driven chart content appears, query the two chart SVGs by their accessible names and assert their Y-axis labels:

```ts
const activityChart = screen.getByRole('img', { name: 'Transactions over time chart' });
const priceChart = screen.getByRole('img', { name: 'Canton Coin price over time chart' });

expect([...activityChart.querySelectorAll('.home-dashboard-overview__y-tick')].map((tick) => tick.textContent)).toEqual([
  '6', '5', '3', '2', '0',
]);
expect([...priceChart.querySelectorAll('.home-dashboard-overview__y-tick')].map((tick) => tick.textContent)).toEqual([
  '1.25', '0.9375', '0.625', '0.3125', '0',
]);
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
npm run test --workspace frontend -- src/components/HomeDashboardOverview.test.ts
```

Expected: the rendering test fails because the current chart SVGs do not contain `.home-dashboard-overview__y-tick` elements.

### Task 2: Implement shared zero-based Y-axis labels

**Files:**
- Modify: `frontend/src/components/HomeDashboardOverview.vue:18-160,200-300`
- Modify: `frontend/src/styles.css:2890-2925`

**Interfaces:**
- Consumes: activity and price point arrays already used by `chartPoints` and `dailyTicks`.
- Produces: `chartScale` and `chartYAxisTicks` helpers plus five rendered labels per populated chart.

- [ ] **Step 1: Add a shared chart scale helper**

Introduce a scale helper that returns `min: 0`, `max: Math.max(...values, 1)`, and `valueRange: max - min || 1`. Use it inside `chartPoints` so plotted Y coordinates retain the current zero-based behavior while no longer duplicating the scale formula.

- [ ] **Step 2: Add chart-specific Y-axis tick formatting**

Add a helper that maps five ratios `[0, 0.25, 0.5, 0.75, 1]` into top-to-bottom SVG positions and values from `max` down to `0`. Format activity values with `Math.round(value).toLocaleString('en-US')`; format price values with `toLocaleString('en-US', { maximumFractionDigits: 4 })`.

- [ ] **Step 3: Make room for labels**

Increase `chartPadding.left` from `18` to `44`. Keep the existing chart width/height, right/top/bottom padding, chart guides, and date tick behavior unchanged.

- [ ] **Step 4: Render the labels in both chart SVGs**

Add five `<text>` elements with class `home-dashboard-overview__y-tick`, `text-anchor="end"`, `dominant-baseline="middle"`, and `x="chartPadding.left - 6"` before each chart’s polyline. Pass `activityPoints` with the activity formatter and `pricePoints` with the price formatter.

- [ ] **Step 5: Style the labels**

Add a muted, small-font `.home-dashboard-overview__y-tick` rule alongside the existing date tick rule.

- [ ] **Step 6: Run the focused test to verify it passes**

Run:

```bash
npm run test --workspace frontend -- src/components/HomeDashboardOverview.test.ts
```

Expected: both chart label assertions and all existing component tests pass.

- [ ] **Step 7: Commit the implementation**

```bash
git add frontend/src/components/HomeDashboardOverview.vue frontend/src/components/HomeDashboardOverview.test.ts frontend/src/styles.css
git commit -m "feat: add overview chart y-axis labels"
```

### Task 3: Verify the complete frontend

**Files:**
- Verify: `frontend/src/components/HomeDashboardOverview.vue`
- Verify: `frontend/src/components/HomeDashboardOverview.test.ts`
- Verify: `frontend/src/styles.css`

**Interfaces:**
- Consumes: the completed shared scale and SVG labels from Task 2.
- Produces: verified frontend tests/build and a clean implementation diff.

- [ ] **Step 1: Run the complete frontend test suite**

Run:

```bash
VITE_API_BASE_URL=http://localhost:4600/api npm run test --workspace frontend
```

Expected: all frontend test files and tests pass.

- [ ] **Step 2: Build the frontend**

Run:

```bash
npm run build --workspace frontend
```

Expected: Vue type-checking and the Vite production build complete successfully.

- [ ] **Step 3: Review the final diff**

Run:

```bash
git diff HEAD^ --check
git status --short
git show --stat --oneline HEAD
```

Expected: only the intended Overview component, test, and stylesheet changes are in the implementation commit; the pre-existing `backend/package.json` change remains untouched.
