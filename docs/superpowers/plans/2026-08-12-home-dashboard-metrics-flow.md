# Home Dashboard Metrics Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the extra Network Metrics wrapper so the title and two metric cards render as normal page-flow siblings.

**Architecture:** Keep `HomeDashboardOverview` as the semantic overview section, but make the Network Metrics heading and metric grid direct children of it. Preserve the existing two-column metric grid and individual card styling; remove only the outer metrics wrapper element and its visual styles.

**Tech Stack:** Vue 3, TypeScript, CSS, Vitest, Testing Library for Vue, Vite.

## Global Constraints

- Keep the “Network metrics” and “Current snapshot” copy unchanged.
- Keep the two metric cards and their data-loading/error behavior unchanged.
- Keep two columns on wide screens and one column on narrow screens.
- Do not add an outer border, background, padding, radius, or shadow around the metrics.

---

### Task 1: Remove the Network Metrics wrapper

**Files:**
- Modify: `frontend/src/components/HomeDashboardOverview.test.ts:52-72`
- Modify: `frontend/src/components/HomeDashboardOverview.vue:306-339`
- Modify: `frontend/src/styles.css:2865-2880`

**Interfaces:**
- Consumes: the existing `HomeDashboardOverview` template and its `home-dashboard-overview__metric-grid` / `home-dashboard-overview__metric-panel` classes.
- Produces: a heading block and metric grid as direct siblings of the overview root, with no `.home-dashboard-overview__metrics` element.

- [ ] **Step 1: Add the failing regression assertion**

In the existing rendering test, capture the render result and assert that the removed wrapper is absent while retaining the existing content assertions:

```ts
const { container } = render(HomeDashboardOverview);

expect(container.querySelector('.home-dashboard-overview__metrics')).toBeNull();
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
npm run test --workspace frontend -- src/components/HomeDashboardOverview.test.ts
```

Expected: the test fails because the current template still renders `.home-dashboard-overview__metrics`.

- [ ] **Step 3: Remove the wrapper from the template**

Replace the nested metrics section with its two existing children as direct siblings of the root overview section:

```vue
<div class="home-dashboard-overview__metrics-heading">
  ...existing heading...
</div>
<div class="home-dashboard-overview__metric-grid">
  ...existing two metric panels...
</div>
```

Do not change the metric content, loading states, error states, or API calls.

- [ ] **Step 4: Remove only the obsolete wrapper styles**

Remove `.home-dashboard-overview__metrics` from the shared chart-panel padding/border selector and delete its `display: flex`, `flex-direction`, and `gap` rule. Keep the chart panel styles and all metric-panel styles unchanged.

- [ ] **Step 5: Run the focused test to verify it passes**

Run:

```bash
npm run test --workspace frontend -- src/components/HomeDashboardOverview.test.ts
```

Expected: the focused test file passes with the wrapper absent and all existing data assertions still green.

- [ ] **Step 6: Commit the implementation**

```bash
git add frontend/src/components/HomeDashboardOverview.vue frontend/src/components/HomeDashboardOverview.test.ts frontend/src/styles.css
git commit -m "fix: flatten home dashboard metrics"
```

### Task 2: Verify the dashboard change

**Files:**
- Test: `frontend/src/components/HomeDashboardOverview.test.ts`
- Verify: `frontend/src/components/HomeDashboardOverview.vue`
- Verify: `frontend/src/styles.css`

**Interfaces:**
- Consumes: the flattened metrics layout from Task 1.
- Produces: verified frontend behavior and a clean final diff.

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

Expected: TypeScript checking and Vite production build complete successfully.

- [ ] **Step 3: Review the final diff**

Run:

```bash
git diff HEAD^ --check
git status --short
git show --stat --oneline HEAD
```

Expected: only the intended component, test, and stylesheet changes are in the implementation commit; pre-existing unrelated local changes remain untouched.
