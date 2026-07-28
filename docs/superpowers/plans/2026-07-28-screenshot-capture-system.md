# Live Screenshot Capture System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Playwright CLI that discovers live Canton Explorer records, captures every configured application route at custom resolutions, and produces default plus Advanced Filter/Search PNGs and reports.

**Architecture:** Keep the application unchanged and add a native ESM screenshot tool under `scripts/`. Separate configuration/CLI parsing, live API discovery, scoped browser actions, and capture/report orchestration so each boundary can be tested independently. The runner rewrites frontend `/api` requests to the configured API base, uses fresh browser contexts per capture, and cleans up debugger sessions created during replay screenshots.

**Tech Stack:** Node.js native ESM, Playwright Chromium, Node `node:test`, existing Vue/Vite frontend, existing NestJS API.

---

## Files and responsibilities

- Modify: `package.json` — add the pinned `playwright` dev dependency plus `screenshots` and `test:screenshots` scripts.
- Modify: `package-lock.json` — lock the new dependency.
- Create: `scripts/screenshot-config.mjs` — default viewport/route/state configuration, config loading/merging, and validation.
- Create: `scripts/screenshot-cli-options.mjs` — parse and normalize CLI arguments and exit-mode options.
- Create: `scripts/screenshot-discovery.mjs` — normalize API URLs, fetch live records, build the manifest/context, and resolve dynamic routes.
- Create: `scripts/screenshot-actions.mjs` — resolve scoped accessible locators and execute filter/search state actions.
- Create: `scripts/screenshot-runner.mjs` — Playwright request rewriting, readiness, route/state capture, retry/failure semantics, report persistence, and debugger cleanup.
- Create: `scripts/capture-screenshots.mjs` — executable entry point that loads config, checks services/browser availability, runs capture, prints summary, and sets the documented exit code.
- Create: `scripts/screenshot-config.test.mjs` — config, viewport, route/state, and CLI normalization tests.
- Create: `scripts/screenshot-discovery.test.mjs` — API client and live-route discovery fixture tests.
- Create: `scripts/screenshot-actions.test.mjs` — scoped filter action browser tests.
- Create: `scripts/screenshot-runner.test.mjs` — API rewrite, readiness, report, retry, isolation, cleanup, and exit-matrix tests.
- Modify: `README.md` — setup, one-time Chromium installation, command examples, custom resolution/route selection, Advanced Filter/Search captures, output/report behavior, and README embedding guidance.

Generated: `screenshots/` is the default local output directory and remains available for users to commit selected README assets; do not add it to `.gitignore`.

All implementation work must preserve the unrelated existing changes currently present on `main`. Every commit in this plan must stage only screenshot-system files.

## Task 1: Add the screenshot tool dependency and test entry points

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Add the Playwright dependency and scripts.**

Add a pinned `playwright` development dependency to the root package. Add:

```json
"screenshots": "node scripts/capture-screenshots.mjs",
"test:screenshots": "node --test scripts/*.test.mjs"
```

Do not change the existing backend/frontend test scripts.

- [ ] **Step 2: Install and lock dependencies.**

Run:

```bash
npm install
```

Expected: `package-lock.json` records Playwright and the existing workspace dependency graph remains installable.

- [ ] **Step 3: Verify the baseline command surfaces.**

Run:

```bash
npm run screenshots -- --help
npm run test:screenshots
```

Expected: the help command may fail until the CLI exists; record that expected red state before implementing the CLI. The test command reports no test files until the planned tests are created.

- [ ] **Step 4: Commit the dependency wiring.**

```bash
git add package.json package-lock.json
git commit -m "build: add screenshot capture tooling"
```

## Task 2: Implement configuration and CLI option normalization

**Files:**
- Create: `scripts/screenshot-config.mjs`
- Create: `scripts/screenshot-cli-options.mjs`
- Test: `scripts/screenshot-config.test.mjs`

Use `@superpowers:test-driven-development`: write each failing test, run it, implement the smallest behavior, then rerun the focused test.

- [ ] **Step 1: Write failing tests for default config and viewport parsing.**

Test that the default config includes the documented README viewport and route/state identifiers, that `1440x900` parses to positive numeric dimensions, that `--viewport 1280x720 --viewport 1920x1080` preserves order, and that malformed/zero/duplicate dimensions are rejected.

- [ ] **Step 2: Run the focused test to verify it fails.**

Run:

```bash
node --test scripts/screenshot-config.test.mjs
```

Expected: FAIL because the config and parser modules do not exist.

- [ ] **Step 3: Implement defaults and option parsing.**

Export a default config with stable route/state IDs:

```text
updates
contracts
parties
nodes
tokens
canton-coin
traffic
settings
search
node-detail-01, node-detail-02, ... (discovered per node in API/config order)
update-detail (discovered)
contract-detail (discovered)
party-detail (discovered)
namespace-detail (discovered)
package-family (discovered)
package-detail (discovered)
token-detail (discovered)
token-transfer-detail (discovered)
debugger (discovered from updateId)
legacy-update-redirect (discovered)
```

Define the exact scoped filter state matrix from the approved spec, with one state per panel: `updates--filters` (`home-updates-advanced-filter`), `contracts--filters` (`contracts-advanced-filter`), `parties--filters` (`namespace-advanced-filter` after selecting the `Namespaces` mode), `party-detail-updates--filters` (`party-updates-advanced-filter`), `party-detail-contracts--filters` (`party-contracts-advanced-filter`), `tokens-known--filters` (`tokens-advanced-filter`), `tokens-transfers--filters` (`token-transfers-advanced-filter`), `token-detail-transfers--filters` (the token detail transfers browser's default `token-transfers-advanced-filter`), and `traffic--filters` (`traffic-purchases-advanced-search`). Composite route/state names are validated as unique, and `/debugger` is not a static required route: only `/debugger?updateId=<discovered update>` is added when an update candidate exists.

Implement config loading as a default-export ESM module resolved relative to the current working directory. Merge scalar keys, shallow-merge `discovery`, replace `viewports`/`routes` arrays, reject unknown top-level keys, validate lower-kebab-case IDs, reject duplicate route/state/viewport combinations, and apply CLI route/viewport/output filters after loading.

- [ ] **Step 4: Run the focused tests to verify they pass.**

Run:

```bash
node --test scripts/screenshot-config.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Add tests for CLI modes, config merge, validation, and exit intent.**

Test defaults for `--base-url`, `--api-url`, `--output`, `--strict`, `--headed`, repeated `--route`, `--help`, invalid flags, and the documented exit-mode constants `0`, `1`, and `2`. Add assertions for custom ESM config loading, scalar/discovery merge, array replacement, unknown top-level keys, duplicate route/state/viewport combinations, invalid action kinds/missing fields, stable output slugs, the complete filter-state matrix above, and CLI route/viewport selection.

- [ ] **Step 6: Run the new tests to verify the new tests fail.**

Run:

```bash
node --test scripts/screenshot-config.test.mjs
```

Expected: FAIL only for the new CLI-option assertions.

- [ ] **Step 7: Implement CLI option normalization and config validation.**

Return a normalized object with parsed values, make `--viewport WxH` produce `custom-WxH`, preserve repeated filters, and make `--help` a non-error display mode. Implement the approved module loading/merge rules and validation before any browser/API work.

- [ ] **Step 8: Run all config/CLI tests.**

Run:

```bash
node --test scripts/screenshot-config.test.mjs
```

Expected: PASS.

- [ ] **Step 9: Commit configuration behavior.**

```bash
git add scripts/screenshot-config.mjs scripts/screenshot-cli-options.mjs scripts/screenshot-config.test.mjs
git commit -m "feat: define screenshot routes and capture options"
```

## Task 3: Build live API discovery and manifest generation

**Files:**
- Create: `scripts/screenshot-discovery.mjs`
- Test: `scripts/screenshot-discovery.test.mjs`

- [ ] **Step 1: Write failing tests for API URL normalization and rewriting.**

Cover host-only, `/api`, and `/api/` targets; relative `/api/nodes?limit=1`; absolute `http://localhost:4600/api/updates?limit=1`; preservation of query strings and request methods; and no double `/api/api` prefix.

- [ ] **Step 2: Run the focused test to verify it fails.**

Run:

```bash
node --test scripts/screenshot-discovery.test.mjs
```

Expected: FAIL because the discovery module does not exist.

- [ ] **Step 3: Implement normalized API helpers.**

Export `normalizeApiBaseUrl`, `apiUrlForPath`, and a request helper accepting injected `fetch`. Ensure discovery uses the normalized API base and does not depend on frontend imports or Vite environment variables.

- [ ] **Step 4: Run the focused API tests.**

Run:

```bash
node --test scripts/screenshot-discovery.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Write failing fixture tests for live route discovery.**

Provide fixture responses for nodes, updates, contracts, active parties, namespace fingerprints, tokens, transfers, templates, packages, and `/traffic-purchases?limit=1`. Assert that discovery creates URL-encoded routes for each available record, keeps update `nodeId` and `eventOffset` together, derives traffic node/filter context, uses a discovered value for search/debugger, deduplicates URLs, and records precise skips for empty collections. Assert specifically that no bare required `/debugger` route is emitted and that the dynamic debugger candidate requires an update ID.

- [ ] **Step 6: Run the discovery fixture tests to verify they fail.**

Run:

```bash
node --test scripts/screenshot-discovery.test.mjs
```

Expected: FAIL for manifest construction.

- [ ] **Step 7: Implement the discovery manifest.**

Query the approved endpoints with the smallest useful limits. Add static routes, one node-detail route for every live node named by deterministic ordinal (`node-detail-01`, `node-detail-02`, ...) in API/config order, and optional dynamic candidates for update/redirect/debugger, contract, party, namespace, token, transfer, package family, package detail, and search results. The debugger candidate is only `/debugger?updateId=<discovered updateId>` and is optional when no update exists. The search candidate is `/search?q=<discovered party or update ID>`, named `search-results`, and validates the `Search Results` heading plus at least one result group or an explicit no-results state. Attach a `source`, `required`, expected final path, readiness landmark, and skip reason to each route. Use `encodeURIComponent` for dynamic path/query segments.

- [ ] **Step 8: Run discovery tests and inspect the manifest shape.**

Run:

```bash
node --test scripts/screenshot-discovery.test.mjs
```

Expected: PASS with deterministic route/state names and live IDs stored only in the manifest/context, not filenames.

- [ ] **Step 9: Commit live discovery.**

```bash
git add scripts/screenshot-discovery.mjs scripts/screenshot-discovery.test.mjs
git commit -m "feat: discover screenshot routes from live API data"
```

## Task 4: Implement scoped Advanced Filter/Search actions

**Files:**
- Create: `scripts/screenshot-actions.mjs`
- Test: `scripts/screenshot-actions.test.mjs`

- [ ] **Step 1: Write failing browser tests for scoped controls.**

Launch a minimal Playwright page containing two buttons with different `aria-controls` values, a labeled input/select/checkbox, and an expanded-panel landmark. Assert that actions target the requested panel, fill/choose live values, and reject an ambiguous unscoped button.

- [ ] **Step 2: Run the focused browser test to verify it fails.**

Run:

```bash
node --test scripts/screenshot-actions.test.mjs
```

Expected: FAIL because the action module does not exist. If Chromium is not installed, first run `npx playwright install chromium` as documented.

- [ ] **Step 3: Implement locator scoping and action execution.**

Implement `resolveActionLocator` with this precedence: stable `id`/`controls` scope, explicit accessible region scope, then unambiguous page-level role/name. Allow field lookup by accessible label, placeholder, or explicit selector because several application filter inputs expose placeholders rather than label associations. Implement `click`, `fill`, `select`, `check`, and `waitFor` actions. Resolve `valueFrom` values from the discovery context and return structured optional-skip errors for missing controls/values.

- [ ] **Step 4: Run the focused browser tests.**

Run:

```bash
node --test scripts/screenshot-actions.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Add coverage for the real application state matrix and applied actions.**

Assert the default config action definitions use the exact composite IDs and correct controls for: `updates--filters`, `contracts--filters`, `parties--filters`, `party-detail-updates--filters`, `party-detail-contracts--filters`, `tokens-known--filters`, `tokens-transfers--filters`, `token-detail-transfers--filters`, and `traffic--filters`. The action sequences must perform the real UI operations: open the panel; fill Party/Template or token/issuer fields and click the corresponding `Add ... filter` buttons; select movement type and click `Add movement type filter`; select Namespaces, fill Public Key/other fields, and click `Search Namespaces`; fill Traffic date/amount fields, select node checkboxes, and click `Apply filters`. Use placeholders (`Party ID`, `Template ID`, `Name`, `Issuer`, `From Party ID`, `To Party ID`, `Minimum date`, etc.) or stable selectors where accessible labels are not exposed.

- [ ] **Step 6: Run the action and config tests.**

Run:

```bash
node --test scripts/screenshot-config.test.mjs scripts/screenshot-actions.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit filter-state actions.**

```bash
git add scripts/screenshot-actions.mjs scripts/screenshot-actions.test.mjs scripts/screenshot-config.mjs scripts/screenshot-config.test.mjs
git commit -m "feat: capture scoped filter and search states"
```

## Task 5: Implement the Playwright capture runner and report lifecycle

**Files:**
- Create: `scripts/screenshot-runner.mjs`
- Test: `scripts/screenshot-runner.test.mjs`

Use `@superpowers:test-driven-development` and keep the runner dependent on injected browser/page/fetch factories where practical.

- [ ] **Step 1: Write failing tests for request rewriting and readiness.**

Use a local in-process HTTP fixture serving a minimal HTML page and API endpoints. Assert that relative `/api`, absolute `/api`, and exact `/api` pathname requests are rewritten to a custom API target with host-only, `/api`, and `/api/` target variants normalized without double prefixes; query, method, body, and headers are preserved. Also assert route headings are awaited, loading indicators are awaited away, and one retry occurs after a transient failure.

- [ ] **Step 2: Run the focused runner test to verify it fails.**

Run:

```bash
node --test scripts/screenshot-runner.test.mjs
```

Expected: FAIL because the runner does not exist.

- [ ] **Step 3: Implement capture context and request routing.**

Create a fresh browser context per route/state/viewport capture, set viewport and device scale factor, register the `/api` rewrite before navigation, and preserve request method/headers/body. Keep the normalized API client available for debugger cleanup.

- [ ] **Step 4: Implement readiness, validation, and screenshot output.**

Navigate with `domcontentloaded`, wait for configured headings/selectors, wait for `/^Loading/i` indicators to disappear, apply the configured settle delay, validate expected final paths/content/error states, and call `page.screenshot({ path, fullPage: true })`. Use one retry after 250 ms.

- [ ] **Step 5: Add failing tests for state isolation and debugger cleanup.**

Assert each capture gets a fresh context and that a successful debugger-session POST followed by a forced readiness/navigation failure still triggers DELETE for every created session through the overridden API URL. Verify POST and DELETE headers/body are preserved by the rewrite layer.

- [ ] **Step 6: Implement state execution and cleanup.**

Run default capture and each configured scoped filter state independently. Listen for successful debugger POST responses before readiness completes, collect every session ID, delete them in `finally`, and append cleanup outcomes to the report.

- [ ] **Step 7: Add failing tests for report persistence and exit semantics.**

Assert atomic report writes after each entry, stable output filenames, manifest/report fields, partial report preservation, and the full truth table for optional/required entries under normal and strict modes.

- [ ] **Step 8: Implement report and exit result construction.**

Write `manifest.json` once discovery completes. Write `report.json` after each capture/skip/failure and cleanup attempt through a temporary file plus rename. Return `0`, `1`, or `2` exactly as specified.

- [ ] **Step 9: Run all runner tests.**

Run:

```bash
node --test scripts/screenshot-runner.test.mjs
```

Expected: PASS.

- [ ] **Step 10: Commit the runner.**

```bash
git add scripts/screenshot-runner.mjs scripts/screenshot-runner.test.mjs
git commit -m "feat: capture live routes with Playwright"
```

## Task 6: Wire the executable CLI and default route matrix

**Files:**
- Create: `scripts/capture-screenshots.mjs`
- Modify: `scripts/screenshot-config.mjs`
- Test: `scripts/screenshot-config.test.mjs`, `scripts/screenshot-runner.test.mjs`

- [ ] **Step 1: Write failing CLI integration tests.**

Run the CLI against a local fixture with `--help`, custom `--viewport`, `--route`, `--output`, and `--strict`. Assert it prints a concise summary, writes manifest/report/images to the requested directory, and returns the documented exit code.

- [ ] **Step 2: Run the CLI tests to verify they fail.**

Run:

```bash
node --test scripts/screenshot-runner.test.mjs scripts/screenshot-config.test.mjs
```

Expected: FAIL because the executable entry point does not exist.

- [ ] **Step 3: Implement the executable entry point.**

Load options/config, validate Chromium availability, check frontend/API reachability, discover the route manifest, filter routes/viewports, invoke the runner, print captured/skipped/failed counts and report path, and set `process.exitCode` without swallowing errors.

- [ ] **Step 4: Verify the CLI fixture tests pass.**

Run:

```bash
node --test scripts/screenshot-config.test.mjs scripts/screenshot-discovery.test.mjs scripts/screenshot-actions.test.mjs scripts/screenshot-runner.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit the executable CLI.**

```bash
git add scripts/capture-screenshots.mjs scripts/screenshot-config.mjs scripts/screenshot-config.test.mjs scripts/screenshot-runner.test.mjs
git commit -m "feat: add screenshot capture CLI"
```

## Task 7: Document README usage and verify the complete feature

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add README documentation.**

Document:

```bash
npx playwright install chromium
npm run screenshots
npm run screenshots -- --viewport 1440x900 --output ./screenshots/readme
npm run screenshots -- --route tokens-known--filters --headed
```

Explain that backend/frontend must already be running, how to override `--base-url`/`--api-url`, how live IDs are discovered, how default/filter images are named, how optional dynamic skips work, how `--strict` changes the exit code, and how to embed a committed PNG in the README.

- [ ] **Step 2: Run the screenshot unit/integration suite.**

Run:

```bash
npm run test:screenshots
```

Expected: PASS.

- [ ] **Step 3: Run existing repository verification.**

Run:

```bash
npm test
npm run lint --workspace backend -- --no-fix
npm run build
rtk git diff --check
```

Expected: all commands pass. Do not modify or stage unrelated pre-existing changes if they fail or appear in status.

- [ ] **Step 4: Run a real smoke capture against the currently running services.**

Run:

```bash
npm run screenshots -- --viewport 1440x900 --output ./screenshots/smoke
```

Expected: static pages capture, available dynamic routes resolve using current localnet records, unavailable records are reported as skipped, and `screenshots/smoke/report.json` contains the final result. Inspect at least one default image and one scoped filter image, then remove only temporary smoke output if it is not intended as a README asset.

- [ ] **Step 5: Review final status and commit documentation.**

Run:

```bash
rtk git status --short
git add README.md
git commit -m "docs: document live screenshot capture"
```

Only screenshot-system files and the README may be part of this commit; preserve all unrelated user changes.

## Final handoff

Before claiming completion, use `@superpowers:verification-before-completion` to confirm the commands above actually passed and report the exact smoke output path, captured/skipped/failed counts, and any environment prerequisites. Then use `@superpowers:finishing-a-development-branch` for the final integration choice, while keeping the requested branch as `main` unless the user directs otherwise.
