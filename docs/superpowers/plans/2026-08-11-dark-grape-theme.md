# Dark Grape Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recolor the dark Canton Explorer interface with a coherent aubergine/plum/grape palette inspired by the supplied reference while preserving the current light-mode appearance.

**Architecture:** Keep the existing shared theme-token architecture. Replace the dark root token values with the approved map, and route the existing hard-coded editor/debugger surfaces through aliases declared only in the dark root and used with current-value fallbacks so the light theme does not change.

**Tech Stack:** Vue 3, CSS custom properties, Vitest, npm workspaces.

---

## File map

- Modify: `frontend/src/styles.css` — dark theme token values, dark-only editor/debugger aliases, and fallback-based declarations for the currently hard-coded editor/debugger colors and shadows.
- Modify: `frontend/src/styles.test.js` — focused assertions for the complete dark map, light-mode preservation, and replacement of targeted raw declarations.
- Create: `docs/superpowers/plans/2026-08-11-dark-grape-theme.md` — this implementation plan.

### Task 1: Add failing stylesheet assertions

**Files:**
- Modify: `frontend/src/styles.test.js`

- [ ] **Step 1: Extract the light and dark root blocks in the focused stylesheet test**

Use the existing `readFileSync` pattern. Match `:root { ... }` and `:root[data-theme="dark"] { ... }` separately so assertions cannot accidentally pass against the other theme.

- [ ] **Step 2: Assert the complete approved dark token map**

Assert these exact declarations in the dark block:

```js
const darkTokens = {
  '--text-900': '#f7f0ff',
  '--text-800': '#e9ddf6',
  '--text-700': '#d0c0e0',
  '--text-600': '#b5a1c8',
  '--text-500': '#9b87ae',
  '--muted-text': '#a491b9',
  '--surface-0': '#160f20',
  '--surface-2': '#382342',
  '--surface-page': '#1d1428',
  '--surface-card': '#2a1b37',
  '--surface-muted': '#24162f',
  '--line-soft': '#4b315d',
  '--line-strong': '#674276',
  '--accent-600': '#a978f2',
  '--blue-500': '#c09aff',
  '--blue-600': '#a978f2',
  '--blue-700': '#eddfff',
  '--blue-50': '#3a234d',
  '--shadow-soft': '0 16px 28px rgba(7, 2, 15, 0.35)',
  '--nav-active-border': '#795099',
  '--nav-active-bg': '#3b2450',
  '--nav-active-text': '#f7f0ff',
  '--panel-border': '#5f3c70',
  '--panel-gradient-start': '#2a1b37',
  '--panel-gradient-end': '#2a1b37',
  '--chart-gradient-start': '#24162f',
  '--chart-gradient-end': '#24162f',
  '--chart-guide': 'rgba(192, 154, 255, 0.16)',
  '--chart-line': '#c09aff',
  '--panel-divider': '#4b315d',
  '--filter-active-border': '#8a5ab1',
  '--filter-active-bg': '#452956',
  '--filter-chip-border': '#68447c',
  '--filter-chip-bg': '#33203f',
  '--back-button-border': '#6c467f',
  '--back-button-bg': '#33203f',
  '--back-button-shadow': '0 12px 22px rgba(45, 14, 64, 0.28)',
};

for (const [name, value] of Object.entries(darkTokens)) {
  expect(darkRoot).toContain(`${name}: ${value};`);
}
```

Also assert the existing semantic dark values remain unchanged for `--green-600`, `--amber-600`, `--red-600`, `--danger-600`, `--error-border`, and all six status background/border tokens.

- [ ] **Step 3: Assert dark-only aliases and fallback declarations**

Assert the dark block contains the approved grape values for every alias in the spec, including `--editor-surface`, `--editor-tab-surface`, `--editor-divider`, all editor/debugger surface/accent aliases, `--metadata-surface`, `--metadata-text`, `--explore-divider`, `--editor-workspace-shadow`, and `--editor-control-shadow`.

Assert representative declarations use the exact fallback form, including:

```js
expect(styles).toContain('background: var(--editor-surface, #252845);');
expect(styles).toContain('background: var(--editor-tab-surface, #1a1f37);');
expect(styles).toContain('background: var(--editor-summary-surface, #14182c);');
expect(styles).toContain('box-shadow: var(--editor-workspace-shadow, 0 18px 44px rgba(9, 11, 22, 0.22));');
expect(styles).toContain('box-shadow: var(--editor-control-shadow, 0 14px 32px rgba(8, 10, 20, 0.34));');
```

Check each targeted debugger/editor selector block uses an alias rather than a direct color declaration. Keep the fixed exchange-series colors and semantic status colors out of this assertion.

- [ ] **Step 4: Assert light-mode values are unchanged**

Assert the light root still contains the existing values for its surface, line, accent, blue, chart, navigation, panel, filter, back-button, shadow, and status token groups. At minimum, explicitly assert:

```js
expect(lightRoot).toContain('--surface-page: #f6f8fb;');
expect(lightRoot).toContain('--surface-card: #ffffff;');
expect(lightRoot).toContain('--blue-600: #1f6feb;');
expect(lightRoot).toContain('--chart-gradient-start: #f6f8fb;');
expect(lightRoot).toContain('--chart-gradient-end: #f6f8fb;');
```

- [ ] **Step 5: Run the focused test and verify it fails for the old palette**

Run:

```bash
rtk npm run test --workspace frontend -- src/styles.test.js --run
```

Expected: FAIL because the dark root still contains the previous blue-violet values.

### Task 2: Implement the approved dark grape palette

**Files:**
- Modify: `frontend/src/styles.css:427-476` and the existing editor/debugger declarations that contain the targeted raw colors.

- [ ] **Step 1: Replace the dark root theme values**

Update the dark block with the exact token map from Task 1. Preserve the existing dark semantic green, amber, red, danger, error, and status values.

- [ ] **Step 2: Add the dark-only editor/debugger aliases**

Declare each alias from the spec in `:root[data-theme="dark"]`. Use the exact grape values and shadow values from the spec; do not add aliases to the light root.

- [ ] **Step 3: Replace targeted raw editor/debugger declarations with fallback aliases**

Use `var(--alias, current-literal)` so the light mode retains the current appearance. Cover the Monaco/editor surface, debugger workspace/editor tabs/summary/columns/headers/signals/status/control panel/tree/event list/code blocks, both debugger shadows, update metadata, and Explore divider. Leave exchange-series colors and semantic amber/success colors unchanged.

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```bash
rtk npm run test --workspace frontend -- src/styles.test.js --run
```

Expected: PASS.

### Task 3: Full verification and commit

**Files:**
- Modify: `frontend/src/styles.css`
- Modify: `frontend/src/styles.test.js`

- [ ] **Step 1: Run the complete workspace test suite**

Run:

```bash
rtk npm test
```

Expected: backend and frontend suites pass. The known NodePoller gRPC refresh warning may appear while its suite remains green.

- [ ] **Step 2: Check formatting and inspect the diff**

Run:

```bash
rtk git diff --check
rtk git diff -- frontend/src/styles.css frontend/src/styles.test.js
```

Confirm the diff only changes dark theme values, fallback-based dark-only recoloring, and focused tests.

- [ ] **Step 3: Remove only generated test SQLite sidecars if present**

If the full test run created them, remove these exact untracked files:

```bash
rtk rm -f backend/test/fixtures/daml/package-cache.sqlite-shm backend/test/fixtures/daml/package-cache.sqlite-wal
```

- [ ] **Step 4: Commit the implementation**

```bash
rtk git add frontend/src/styles.css frontend/src/styles.test.js
rtk git commit -m "style: apply dark grape theme"
```

- [ ] **Step 5: Verify the committed worktree**

Run:

```bash
rtk git status --short --branch
rtk git log -1 --oneline
```

Expected: clean worktree on `main`, with the new theme commit at `HEAD`.
