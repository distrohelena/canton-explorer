# Canton Coin Chart Y-Axis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a readable zero-based vertical price scale to the Canton Coin SVG chart.

**Architecture:** Keep chart math in `frontend/src/lib/canton-coin-history.ts` and keep rendering/layout in `CantonCoinView.vue` and `styles.css`. The visible domain will be zero to the highest finite non-negative close; five ticks will drive both SVG labels and guides, while series coordinates use a left/top/bottom plot rectangle inside the existing viewBox.

**Tech Stack:** Vue 3, TypeScript, SVG, Vitest, Testing Library Vue, Prettier.

---

### Task 1: Add tested chart-axis math

**Files:**
- Modify: `frontend/src/lib/canton-coin-history.ts`
- Test: `frontend/src/lib/canton-coin-history.test.ts`

- [x] **Step 1: Write failing tests for zero-based ticks and geometry**

  Add tests covering five descending tick values for a positive maximum, one
  zero baseline tick when the maximum is zero, and `linePoints` mapping into a
  plot rectangle with a left/top offset. Test that tick values and their
  normalized positions map to the same Y coordinates used by the plot. Add
  invalid/negative-only input coverage and preserve existing one-point and
  constant-series expectations.

- [x] **Step 2: Run the focused helper tests and verify failure**

  Run: `npm run test --workspace frontend -- --run canton-coin-history.test.ts`

  Expected: FAIL because the tick helper and plot-geometry support do not yet
  exist.

- [x] **Step 3: Implement the minimal axis helpers**

  Add a typed tick representation and a helper that returns five values at
  100%, 75%, 50%, 25%, and 0% of a finite non-negative maximum, or one zero
  tick for a zero maximum. Extend `linePoints` with an optional plot rectangle
  while retaining the existing default behavior. When a zero-based domain has a
  zero maximum, map points to the plot baseline rather than the old centered
  constant-series fallback. Share one deterministic tick-to-Y mapping helper
  between labels, guides, and point geometry.

- [x] **Step 4: Run the helper tests and verify they pass**

  Run: `npm run test --workspace frontend -- --run canton-coin-history.test.ts`

  Expected: PASS.

### Task 2: Render the Y-axis in the Canton Coin view

**Files:**
- Modify: `frontend/src/views/CantonCoinView.vue`
- Modify: `frontend/src/styles.css`
- Test: `frontend/src/views/CantonCoinView.test.ts`

- [x] **Step 1: Write failing view assertions**

  Assert that the rendered chart exposes five zero-based axis tick values for
  the existing positive fixture, that the baseline is present, and that the
  chart still renders the existing series and range controls. Add view cases
  for a zero-only range, a range containing only invalid/negative closes, and
  mixed quote venues; verify the zero-only baseline and the expected empty
  state, and verify that shared-quote labels include the quote while mixed
  labels remain numeric.

- [x] **Step 2: Run the focused view test and verify the new assertions fail**

  Run: `npm run test --workspace frontend -- --run CantonCoinView.test.ts`

  Expected: FAIL because the SVG has no Y-axis labels or tick metadata.

- [x] **Step 3: Implement the SVG axis and plot geometry**

  Define the approved 72px left gutter, 8px right gutter, and 12px vertical
  gutters. Compute the display domain from finite non-negative visible closes;
  make `hasChartData` agree with that validity rule. Render the axis labels and
  horizontal guides from one tick collection, including the zero baseline and
  the maximum. Pass the plot rectangle to venue and median point generation.
  Include the shared quote only when all visible chart series use one quote;
  otherwise keep labels numeric.

- [x] **Step 4: Add axis styling**

  Style SVG tick text and guides using the existing muted text and guide colors;
  keep labels readable when the chart scales down responsively.

- [x] **Step 5: Run the focused view test and verify it passes**

  Run: `npm run test --workspace frontend -- --run CantonCoinView.test.ts`

  Expected: PASS.

### Task 3: Verify the integrated frontend change

**Files:**
- Verify: `frontend/src/lib/canton-coin-history.ts`
- Verify: `frontend/src/lib/canton-coin-history.test.ts`
- Verify: `frontend/src/views/CantonCoinView.vue`
- Verify: `frontend/src/views/CantonCoinView.test.ts`
- Verify: `frontend/src/styles.css`

- [x] **Step 1: Run formatting and whitespace checks**

  Run: `npx prettier --check frontend/src/lib/canton-coin-history.ts frontend/src/lib/canton-coin-history.test.ts frontend/src/views/CantonCoinView.vue frontend/src/views/CantonCoinView.test.ts`

  Expected: all checked files use Prettier style.

  Run: `npx prettier --check frontend/src/styles.css`

  Expected: report any existing repository-wide CSS formatting differences;
  do not reformat unrelated CSS as part of this focused change.

  Run: `git diff --check -- frontend/src/lib/canton-coin-history.ts frontend/src/lib/canton-coin-history.test.ts frontend/src/views/CantonCoinView.vue frontend/src/views/CantonCoinView.test.ts frontend/src/styles.css`

  Expected: no whitespace errors.

- [x] **Step 2: Run the complete frontend test suite**

  Run: `npm run test --workspace frontend`

  Expected: all frontend test files pass.

- [x] **Step 3: Build the frontend**

  Run: `npm run build --workspace frontend`

  Expected: `vue-tsc` and Vite complete successfully; existing chunk-size
  warnings are acceptable if the command exits successfully.
