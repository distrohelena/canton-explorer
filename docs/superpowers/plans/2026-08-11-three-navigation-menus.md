# Three Navigation Menus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single Explore dropdown with Ledger, Network, and System menus while preserving all existing routes, selected-page labels, hover/click behavior, keyboard accessibility, and responsive layout.

**Architecture:** Add a focused navigation definition module that owns menu links and ordered route classification. Refactor the app shell to render three menu controls from those definitions and track one open menu ID, keeping focus and route-closing behavior in the shell. Update the shared header CSS for three flexible desktop controls, an intentional 721–960px two-line layout, and a stacked <=720px layout.

**Tech Stack:** Vue 3 `<script setup>`, Vue Router, TypeScript, Vitest, Testing Library, CSS, Playwright browser checks.

---

## File map

- Create: `frontend/src/lib/navigation.ts` — canonical menu definitions, direct links, route ownership matchers, and display-title resolver.
- Create: `frontend/src/lib/navigation.test.ts` — resolver and menu-definition tests.
- Modify: `frontend/src/App.vue` — render three menus, manage one open menu ID, keyboard/focus behavior, and active trigger labels.
- Modify: `frontend/src/App.test.ts` — shell integration tests for menu contents, route labels, open/close behavior, accessibility, and route preservation.
- Modify: `frontend/src/styles.css` — rename/generalize the existing Explore selectors and add the three-menu desktop/intermediate/mobile layout rules.
- Modify: `frontend/src/styles.test.js` — static assertions for the new menu selectors, label ellipsis, and responsive rules.
- Reference: `docs/superpowers/specs/2026-08-11-three-navigation-menus-design.md` — already committed design specification; use it as the source of truth.

Do not modify the unrelated existing `backend/package.json` version change.

## Task 1: Add the canonical navigation model

**Files:**

- Create: `frontend/src/lib/navigation.ts`
- Test: `frontend/src/lib/navigation.test.ts`

- [ ] **Step 1: Write failing navigation-model tests**

Cover these behaviors:

```ts
expect(navigationMenus.map((menu) => menu.id)).toEqual(['ledger', 'network', 'system']);
expect(navigationMenus.find((menu) => menu.id === 'ledger')?.links).toEqual([
  { label: 'Home', to: '/' },
  { label: 'Updates', to: '/updates' },
  { label: 'Contracts', to: '/contracts' },
  { label: 'Tokens', to: '/tokens' },
  { label: 'Canton Coin', to: '/canton-coin' },
]);
expect(resolveNavigationContext('/nodes/participant-1/updates/42')).toEqual({
  menuId: 'ledger',
  title: 'Updates',
});
expect(resolveNavigationContext('/nodes/participant-1/contracts/00abc')).toEqual({
  menuId: 'ledger',
  title: 'Contracts',
});
expect(resolveNavigationContext('/nodes/participant-1')).toEqual({
  menuId: 'network',
  title: 'Nodes',
});
expect(resolveNavigationContext('/packages/by-name/com.example')).toEqual({
  menuId: 'ledger',
  title: 'Contracts',
});
expect(resolveNavigationContext('/search')).toEqual({
  menuId: 'ledger',
  title: 'Search',
});
```

Also cover `/`, `/updates`, `/contracts`, `/tokens` and token transfer details, `/canton-coin`, `/nodes`, `/parties` and party details, `/traffic`, `/debugger`, `/settings`, `/tx/*`, `/packages/:packageId`, `/packages/by-name/:packageName`, `/namespaces/:namespaceId`, and an unknown path. Unknown paths should return `{ menuId: null, title: 'Explore' }`.

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
rtk npm run test --workspace frontend -- src/lib/navigation.test.ts --run
```

Expected: FAIL because `navigation.ts` and its exported definitions/resolver do not exist yet.

- [ ] **Step 3: Implement the minimal navigation model**

Export:

```ts
export type NavigationMenuId = 'ledger' | 'network' | 'system';
export interface NavigationLink { label: string; to: string }
export interface NavigationMenu { id: NavigationMenuId; label: string; links: NavigationLink[] }
export interface NavigationContext { menuId: NavigationMenuId | null; title: string }
export const navigationMenus: readonly NavigationMenu[];
export function resolveNavigationContext(path: string): NavigationContext;
```

Use ordered predicates evaluated from most specific to least specific. Classify node-linked update and contract details before generic node details; classify token details before other ledger fallbacks. Map package/namespace details to Contracts, legacy transactions to Updates, and search to Ledger/Search. Keep direct menu links limited to the three approved sections.

- [ ] **Step 4: Run the focused test and verify it passes**

Run the same command. Expected: the navigation test file passes.

- [ ] **Step 5: Commit the navigation model**

```bash
rtk git add frontend/src/lib/navigation.ts frontend/src/lib/navigation.test.ts
rtk git commit -m "feat: add canonical navigation menu model"
```

## Task 2: Refactor the app shell to render three menus

**Files:**

- Modify: `frontend/src/App.vue`
- Test: `frontend/src/App.test.ts`

- [ ] **Step 1: Add failing shell tests**

Replace the single Explore-menu assumptions with tests that verify:

- Home renders three buttons: `Home`, `Network`, and `System`.
- Ledger contains Home, Updates, Contracts, Tokens, and Canton Coin; Network contains Nodes, Parties, and Traffic Purchases; System contains Debugger and Settings.
- Each menu has a unique trigger ID, matching `aria-controls` and `aria-expanded`, and a `nav` with the exact accessible name `Ledger navigation`, `Network navigation`, or `System navigation`.
- Clicking Ledger then Network leaves only Network open.
- Pointer enter/leave opens and closes the specific menu.
- Clicking outside closes the currently open menu.
- Escape closes the menu and restores focus to its trigger.
- Route changes close an open menu.
- `/traffic` labels the Network trigger `Traffic Purchases`; `/tokens/:tokenId` labels Ledger `Tokens`; `/nodes/:id/contracts/:contractId` labels Ledger `Contracts`; `/search` labels Ledger `Search`; unknown routes fall back to section labels.
- Existing route links, search behavior, branding behavior, debugger shell, and theme tests continue to pass.

Use exact link-set assertions for each `nav`, and add `renderAt` coverage for
`/canton-coin`, `/packages/pkg-1`, `/namespaces/ns-1`, `/tx/update-1`, and
the node-linked update/contract detail routes. These routes must resolve to
the exact section/title combinations from the navigation model.

Add explicit keyboard assertions: focus alone does not open a menu; Enter and
Space on a trigger open it; Tab from an opened trigger enters its links;
Shift+Tab from the first link returns to the trigger; Tab from the last link
continues to the next trigger; focusout to an external element closes the
menu; Escape closes and restores focus. Verify each `nav` uses
`aria-label="{section} navigation"`, and each trigger exposes matching
`aria-controls` and `aria-expanded` values.

Use the existing `renderAt` test helper and Testing Library queries; do not test implementation-only refs.

- [ ] **Step 2: Run the focused shell tests and verify they fail**

Run:

```bash
rtk npm run test --workspace frontend -- src/App.test.ts --run
```

Expected: FAIL because the shell still renders one Explore control and uses the old label logic.

- [ ] **Step 3: Implement shared menu state and active labels**

In `App.vue`:

1. Import `navigationMenus`, `NavigationMenuId`, and `resolveNavigationContext`.
2. Replace `exploreMenuOpen` with `openNavigationMenu = ref<NavigationMenuId | null>(null)`.
3. Derive the active context from `route.path`; use the context title only for its owning menu, otherwise use that menu's section label.
4. Render the three controls with `v-for="menu in navigationMenus"` in Ledger, Network, System order. Keep the menu wrapper around both trigger and dropdown so pointer transitions do not create a gap.
5. Use unique IDs such as `app-navigation-trigger-ledger` and `app-navigation-menu-ledger`; connect the trigger and dropdown with `aria-controls` and `aria-expanded`, and give the dropdown `aria-label="Ledger navigation"` (or the corresponding section label).
6. Keep direct links as `RouterLink`s from the canonical menu definitions, closing the open menu on activation.
7. Render the trigger label as `<span class="app-navigation__button-label" :title="displayLabel(menu)">{{ displayLabel(menu) }}</span>` so CSS can ellipsize it while the full text remains in the DOM and in the button's accessible name/title.
8. Bind `@pointerenter="openNavigationMenu(menu.id)"` and `@pointerleave="closeNavigationMenu"` on the wrapper, `@click="toggleNavigationMenu(menu.id)"` and `@keydown.esc.prevent.stop="handleNavigationEscape(menu.id)"` on the trigger, `@keydown.esc.prevent.stop="handleNavigationEscape(menu.id)"` on the dropdown, and `@focusout="handleNavigationFocusout($event, menu.id)"` on the wrapper.

- [ ] **Step 4: Implement open/close and keyboard focus behavior**

Add small shell functions:

- `openNavigationMenu(menuId)` sets the open ID.
- `toggleNavigationMenu(menuId)` toggles only that ID.
- `closeNavigationMenu()` clears the ID.
- `handleNavigationEscape(menuId)` clears the ID and focuses that menu's trigger.
- `handleNavigationFocusout(event, menuId)` closes only when `relatedTarget` is outside the trigger/menu wrapper.

Keep the existing document outside-click handler and route watcher, updating them to the new wrapper class/state. Use a trigger ref map or callback refs only to restore focus after Escape. Native buttons provide Enter/Space activation; do not add custom key handling for those keys.

- [ ] **Step 5: Run the focused shell tests and verify they pass**

Run the same `App.test.ts` command. Expected: all shell tests pass.

- [ ] **Step 6: Commit the shell behavior**

```bash
rtk git add frontend/src/App.vue frontend/src/App.test.ts
rtk git commit -m "feat: split header navigation into three menus"
```

## Task 3: Update the header styling and responsive layout

**Files:**

- Modify: `frontend/src/styles.css`
- Test: `frontend/src/styles.test.js`

- [ ] **Step 1: Add failing CSS contract assertions**

Migrate the existing `.app-explore*` assertions in `styles.test.js` to the new
`.app-navigation*` selectors, then require:

- `.app-navigation` and its trigger/menu/link selectors.
- A trigger label rule with `white-space: nowrap`, `overflow: hidden`, and `text-overflow: ellipsis`.
- Desktop trigger sizing with `min-width: 110px` and `max-width: 160px`.
- The 721–960px wrapping media query and the <=720px stacked media query.
- Mobile dropdown width bounded by `calc(100vw - 36px)`.
- Focus-visible rules for the new trigger/link selectors.

Run:

```bash
rtk npm run test --workspace frontend -- src/styles.test.js --run
```

Expected: FAIL because the new selectors and responsive rules do not exist.

- [ ] **Step 2: Implement the CSS refactor**

Rename the existing `.app-explore*` rules to the generic `.app-navigation*` names and preserve the current purple/dark theme behavior, active-link styling, animations, focus outlines, and no-gap hover wrapper.

Add:

- Desktop `.app-navigation` uses `flex: 1 1 110px`, `min-width: 110px`, and `max-width: 160px`.
- `.app-navigation__button-label` single-line ellipsis behavior; the button/title retains the full active label such as Traffic Purchases.
- Dropdowns at least 190px wide, anchored to the owning trigger.
- `@media (min-width: 721px) and (max-width: 960px)` with `flex-wrap: wrap`, each menu using `flex: 0 1 calc((100% - 24px) / 3)` to account for the existing 12px gap on line one, and search/theme explicitly ordered onto line two with search `flex: 1 1 calc(100% - 54px)` and theme `flex: 0 0 42px`.
- Existing `@media (max-width: 720px)` rules updated so each menu trigger spans the toolbar and each dropdown is left-aligned and bounded by `calc(100vw - 36px)`.

Keep the app search and theme controls usable in all three layouts.

- [ ] **Step 3: Run the focused style test and verify it passes**

Run the same `styles.test.js` command. Expected: all style assertions pass, including migrated assertions that no longer reference `.app-explore*` selectors.

- [ ] **Step 4: Commit the header styling**

```bash
rtk git add frontend/src/styles.css frontend/src/styles.test.js
rtk git commit -m "style: support three responsive navigation menus"
```

## Task 4: Verify browser layout and complete regression coverage

**Files:**

- Modify: `frontend/src/App.test.ts` only if browser findings require test clarification.
- No new production files.

- [ ] **Step 1: Run the full frontend test suite**

```bash
rtk npm run test --workspace frontend -- --run
```

Expected: all frontend test files and tests pass.

- [ ] **Step 2: Run the live browser layout check**

With the local app at `http://localhost:46000/`, use Playwright at 1200px, 800px, and 600px viewports. For each viewport verify:

- No menu trigger or dropdown exceeds the viewport bounds.
- The 800px toolbar has three menu controls on the first line and search/theme on the second.
- The 600px toolbar stacks the three controls and keeps dropdowns within the viewport.
- `/traffic` exposes the full accessible name `Traffic Purchases`, even if its visible label is ellipsized.
- `/canton-coin` exposes the full `Canton Coin` label.
- At 1200px each trigger is between 110px and 160px wide, each open dropdown is at least 190px wide and anchored to its trigger, and the search/theme controls remain on the desktop line.
- At 800px the three triggers are on the first line and search/theme are on the second line.
- Hovering and clicking each menu opens the correct dropdown; clicking a link navigates and closes it.

Start the frontend for this check with:

```bash
rtk npm run dev --workspace frontend -- --host 127.0.0.1
```

The Vite config supplies port 46000. Install the browser runtime if needed:

```bash
rtk npx playwright install chromium
```

Run the check with this executable inline Playwright script; it must throw on
any failed assertion rather than only logging measurements:

```bash
rtk node --input-type=module <<'EOF'
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
for (const [width, mode] of [[1200, 'desktop'], [800, 'intermediate'], [600, 'mobile']]) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('http://localhost:46000/', { waitUntil: 'networkidle' });
  const metrics = await page.evaluate(() => {
    const menus = [...document.querySelectorAll('.app-navigation')].map((element) => element.getBoundingClientRect());
    const search = document.querySelector('.app-search-form')?.getBoundingClientRect();
    const theme = document.querySelector('.app-theme-toggle')?.getBoundingClientRect();
    return { menus, search, theme, overflow: document.documentElement.scrollWidth > window.innerWidth };
  });
  assert.equal(metrics.menus.length, 3);
  assert.equal(metrics.overflow, false);
  assert.ok(metrics.menus.every((rect) => rect.left >= 0 && rect.right <= width));
  if (mode === 'desktop') {
    assert.ok(metrics.menus.every((rect) => rect.width >= 110 && rect.width <= 160));
    assert.ok(metrics.search && metrics.theme && Math.abs(metrics.search.top - metrics.menus[0].top) < 2 && Math.abs(metrics.theme.top - metrics.menus[0].top) < 2);
  } else if (mode === 'intermediate') {
    assert.ok(metrics.search && metrics.theme && metrics.search.top > metrics.menus[0].bottom - 2 && metrics.theme.top > metrics.menus[0].bottom - 2);
  } else {
    assert.ok(metrics.menus[1].top > metrics.menus[0].top && metrics.menus[2].top > metrics.menus[1].top);
  }
}

await page.goto('http://localhost:46000/traffic', { waitUntil: 'networkidle' });
assert.equal(await page.getByRole('button', { name: 'Traffic Purchases' }).count(), 1);
await page.goto('http://localhost:46000/', { waitUntil: 'networkidle' });
const ledger = page.locator('.app-navigation').first();
await ledger.hover();
const dropdown = page.locator('#app-navigation-menu-ledger');
const dropdownRect = await dropdown.boundingBox();
const ledgerRect = await ledger.boundingBox();
assert.ok(dropdownRect && ledgerRect && dropdownRect.width >= 190 && dropdownRect.x + dropdownRect.width <= 1200 && dropdownRect.y >= ledgerRect.y + ledgerRect.height - 1);
await dropdown.getByRole('link', { name: 'Updates' }).click();
assert.equal(new URL(page.url()).pathname, '/updates');
await browser.close();
EOF
```

Repeat the same check at 800px and 600px, adding assertions for the line
positions and trigger/dropdown bounds described above.

- [ ] **Step 3: Run the frontend production build**

```bash
rtk npm run build --workspace frontend
```

Expected: `vue-tsc` and Vite complete successfully.

- [ ] **Step 4: Run repository whitespace checks**

```bash
rtk git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 5: Commit any final test-only adjustments**

```bash
rtk git add frontend/src/App.test.ts frontend/src/styles.test.js
rtk git commit -m "test: verify three navigation menus"
```

Only create this final commit if the previous commits require test-only adjustments; do not create an empty commit.

## Plan documentation commit

- [ ] **Step 6: Commit this implementation plan after review approval**

```bash
rtk git add docs/superpowers/plans/2026-08-11-three-navigation-menus.md
rtk git commit -m "docs: plan three navigation menus"
```

- [ ] **Step 7: Confirm repository state**

```bash
rtk git status --short
rtk git log -4 --oneline
```

Expected: the plan and spec are tracked commits, all three-menu implementation commits are present, and only the pre-existing unrelated `backend/package.json` modification remains uncommitted.

## Execution notes

- Follow `@superpowers:test-driven-development` for each production behavior: write the failing test, run it red, implement the smallest change, and rerun it green.
- Follow `@superpowers:verification-before-completion` before claiming completion.
- Use `apply_patch` for edits and prefix shell commands with `rtk`.
- Keep all commits on `main`, as requested.
