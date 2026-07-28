# Live Application Screenshot Capture System Design

**Date:** 2026-07-28  
**Status:** Approved for implementation

## Goal

Provide a repeatable local command that captures the running Canton Explorer frontend in custom viewport resolutions, using the currently running backend/localnet, and produces README-ready PNGs for every meaningful application route. The capture set must adapt to the changing records produced by each localnet startup and include expanded Advanced Filter/Search states that demonstrate the application's query controls.

## Context

The repository contains a Vue 3/Vite frontend and a NestJS backend. The frontend normally runs at `http://localhost:46000` and resolves its development API to `http://localhost:4600/api`. There is no existing browser automation or screenshot runner.

The localnet is not stable across restarts. Update IDs, event offsets, contract IDs, party IDs, package IDs, token IDs, and debugger-replay inputs must therefore be discovered from the live API immediately before capture. Hard-coded examples would become stale and would make the README capture workflow unreliable.

## Chosen Approach

Add a small Playwright-based Node CLI under `scripts/`, implemented as native ESM `.mjs` files so it can run directly with the repository's Node runtime. The root package will own the Playwright development dependency and the CLI script. The CLI will:

1. Validate that the configured frontend and API are reachable.
2. Query live API endpoints and build a route manifest containing static routes and available dynamic routes.
3. Expand configured screenshot states, including default and filter-expanded variants.
4. Open each route in Chromium at each configured viewport.
5. Wait for route readiness, capture a full-page PNG, and write a machine-readable capture report.
6. Clean up temporary debugger sessions created by opening the debugger route when possible.

Playwright is preferred over Puppeteer because it has a mature viewport/navigation API, explicit browser lifecycle management, and good support for the Monaco-backed debugger surface. A direct DevTools Protocol wrapper would be less reproducible because it requires a separately launched browser with remote debugging enabled.

## User-facing command

The root package will expose:

```bash
npm run screenshots
```

The command will support options equivalent to:

```text
--base-url <url>       Frontend URL (default: http://localhost:46000)
--api-url <url>        API base URL (default: http://localhost:4600/api)
--output <directory>   Image/report directory (default: screenshots)
--config <path>        Optional configuration module
--route <name>         Capture only a named route/state (repeatable)
--viewport <WxH>       Capture only a configured/custom viewport (repeatable)
--strict               Fail if any discovered dynamic route is unavailable
--headed               Show Chromium while capturing
```

The root `package.json` will add `playwright` as a pinned development dependency and a `screenshots` script that runs `node scripts/capture-screenshots.mjs`. The lockfile will be updated with that dependency. The command exits `0` when all required entries capture successfully and any dynamic skips are allowed, `1` for capture/discovery failures or `--strict` dynamic skips, and `2` for invalid CLI/configuration input.

Browser installation will be documented separately:

```bash
npx playwright install chromium
```

The first-run documentation will call this a one-time prerequisite, and the CLI will detect a missing Chromium executable and exit `1` with that exact install command. After the prerequisite, the capture itself remains one command and never downloads browsers implicitly.

The command is intentionally attached to the already-running services. It will not start or stop the backend or frontend.

The browser's API requests will honor `--api-url` even when the already-built frontend has a different `VITE_API_BASE_URL`. Before navigation, the runner will install a Playwright route handler. API base normalization removes trailing slashes and ensures the target ends in exactly `/api` (a host-only value receives the suffix; an existing `/api/` is reduced to `/api`). A frontend request is rewritten when its pathname is `/api` or starts `/api/`, whether the URL is relative or absolute. The suffix after `/api` and the original query string are appended to the normalized target without double-prefixing. Method, headers, and body are preserved, so GET, POST, and DELETE debugger calls all use the override. Discovery and cleanup use the same normalized target directly. This supports both relative packaged builds and the development build's absolute localhost API URL and will be tested with both forms.

## Configuration

The default configuration will live in `scripts/screenshot-config.mjs`. A `--config` path is resolved relative to the current working directory, loaded as an ESM module, and must provide a default export containing the same top-level shape. The supplied config is merged over defaults: scalar keys replace defaults, `viewports` and `routes` replace the corresponding arrays, and `discovery` is shallow-merged. Unknown top-level keys are rejected. CLI `--route`, `--viewport`, and `--output` filters/values apply after config loading.

### Viewports

Configuration will define named viewport presets containing `name`, positive integer `width`, positive integer `height`, and optional positive `deviceScaleFactor`. At least one README-oriented wide preset will be provided. `--viewport WxH` creates a named one-off viewport (`custom-WxH`) and takes precedence over configured viewport selection; repeated flags produce repeated custom viewports in declaration order. Duplicate viewport names or dimensions are rejected.

Images will be written using a deterministic layout:

```text
screenshots/
  <viewport-name>/
    <route-name>.png
    <route-name>--filters.png
  manifest.json
  report.json
```

Route and state names are unique, lower-kebab-case identifiers defined by the config or discovery code. They are never derived from live IDs, so filenames remain stable across localnet restarts. A duplicate route/state/viewport combination is rejected instead of overwritten.

### Routes and states

Each route entry has a stable `name`, a URL or `discoveryKey`, a required/optional flag, a readiness rule, and zero or more interaction states. The concrete config shape is:

```js
{
  name: 'updates',
  path: '/',
  required: true,
  readiness: { heading: 'Updates', timeoutMs: 10000, settleMs: 300 },
  states: [
    { name: 'default', actions: [] },
    { name: 'filters', required: false, actions: [/* actions */] },
  ],
}
```

Supported action objects are `{ kind: 'click', role, name, controls? }`, `{ kind: 'fill', scope?, label, valueFrom }`, `{ kind: 'select', scope?, label, value }`, `{ kind: 'check', scope?, label, checked }`, and `{ kind: 'waitFor', selector }`. `scope` identifies an accessible region or an element by stable `id`; `controls` targets a button through its `aria-controls` value. For example, the Tokens page uses `controls: 'tokens-advanced-filter'` versus `controls: 'token-transfers-advanced-filter'`, and party detail uses `controls: 'party-updates-advanced-filter'` versus `controls: 'party-contracts-advanced-filter'`. `valueFrom` names a value in the live discovery context, such as `party`, `template`, `nodeId`, or `publicKey`. Unknown action kinds, missing required action fields, ambiguous unscoped controls, and unsupported `valueFrom` names are configuration errors.

A state may:

- click a visible control by accessible role/name;
- fill a visible input with a discovered value;
- select a combobox option;
- check/uncheck a visible checkbox;
- wait for a route-specific heading, table, or panel;
- add a short settle delay before capture.

The default route set covers all router pages:

- Updates and activity overview pages;
- node, party, contract, token, package, namespace, traffic, settings, and Canton Coin pages;
- update, contract, package, token-transfer, and package-family detail pages when live records exist;
- search results using a discovered party or update identifier;
- debugger replay using a discovered update identifier;
- the legacy transaction redirect route where it resolves to a live update detail page.

Dynamic routes are resolved at runtime and skipped with a reason when the corresponding collection is empty. Static routes are required. `--strict` promotes dynamic skips to failures.

## Live route discovery

The discovery module will use a small typed fetch client independent of frontend module imports. It will query the existing API contracts:

| API query | Routes/states derived |
| --- | --- |
| `/nodes` | Node list and one detail page per configured node, or a bounded representative set if configured |
| `/updates?limit=1` | Latest update detail, legacy transaction redirect, debugger replay, and search query |
| `/contracts?limit=1` | Contract detail |
| `/parties` | A party detail page and party-scoped routes |
| `/parties/fingerprints?limit=1` | Namespace detail when a fingerprint exists |
| `/tokens?limit=1` | Token detail |
| `/tokens/transfers?limit=1` | Token transfer detail |
| `/nodes/:id/packages` | Package family and package detail |
| `/templates` | Representative template filter values |
| `/traffic-purchases?limit=1` | Traffic filter values where available |

Discovery will prefer the first usable record from each response, preserve the node ID and event offset together for node-scoped URLs, URL-encode all dynamic path/query values, and deduplicate equivalent URLs.

Discovery is only a candidate source; the browser runner validates every dynamic candidate after navigation. Detail candidates must reach their expected final path and expose their configured heading or content landmark without an application error message. The legacy transaction candidate must finish on the expected node-scoped update detail path. The debugger candidate must produce a successful session response and expose the debugger workspace or catalog; a missing session, replay error, or error-state message makes the candidate skipped with the exact validation reason. Package-family, token, party, namespace, contract, update, and transfer candidates follow the same final-path/content rule. A candidate that fails validation is never captured under a misleading success filename.

Filter values will be drawn from the same live responses where possible. For example, a discovered party can populate Party ID filters, a discovered template can populate Template ID filters, and discovered node IDs can populate global node checkboxes. If no suitable live value exists, the expanded state will still open the panel without inventing a value.

## Advanced Filter/Search screenshot states

The default capture matrix will include an additional optional `filters` state for every eligible page below. The state runner will use accessible names and labels already present in the application, such as:

- `Advanced Filter` on global Updates (`/`), global Contracts (`/contracts`), Party detail's Updates and Contracts browsers, Token detail's Transfers browser, the Tokens page's Known Tokens and Latest Transfers browsers, and the Parties page's Namespaces mode;
- `Advanced Search` on Traffic Purchases (`/traffic`);
- `Advanced Filter Parameters` or `Advanced Search Parameters` as the expanded panel landmark.

For each eligible route, the state runner will:

1. Navigate to the unfiltered route in a fresh browser context.
2. For `/parties`, select the `Namespaces` mode before opening its namespace filter; otherwise, open the route's `Advanced Filter` or `Advanced Search` button if it is not already expanded.
3. Populate representative live values where the route supports them: a party and template on update/contract browsers, a token name/issuer or movement type on token browsers, live node checkboxes on global contracts/traffic, and the discovered public key on namespace search where available.
4. Wait for the panel and any resulting table state to settle.
5. Capture a separate `--filters` image without changing the default-state image.

The exact default eligible route/state identifiers are: `updates--filters`, `contracts--filters`, `parties--filters`, `party-detail-updates--filters`, `party-detail-contracts--filters`, `tokens-known--filters`, `tokens-transfers--filters`, `token-detail-transfers--filters`, and `traffic--filters`. Each identifier maps to one scoped panel. A state is marked optional when its live data or mode is unavailable. The Parties action first clicks the `Namespaces` mode button, then clicks the button whose `aria-controls` is `namespace-advanced-filter`.

The runner will not rely on private Vue state or CSS classes. If a control is absent on a route, the state is skipped and recorded rather than failing the entire run, unless the state is explicitly marked required.

## Readiness and capture behavior

Each route will have a readiness strategy:

- wait for `domcontentloaded`;
- wait for the configured accessible heading or selector, with a default timeout of 10,000 ms;
- wait for visible loading text/role-status indicators matching `/^Loading/i` to disappear, with the same timeout;
- apply the configured settle delay, defaulting to 300 ms for charts, Monaco, and CSS transitions;
- capture with Playwright `fullPage: true` at the configured viewport.

Navigation/readiness gets one retry after 250 ms for transient browser errors. A second failure follows the required/optional rules below; timeouts are never silently ignored.

The default theme will be the current application default. Theme-specific capture can be added as a config state later without changing discovery.

The route runner will isolate each capture in a fresh browser context so local storage, URL filters, and debugger state do not leak between images. It will close each context after the route/state capture. For debugger routes, it listens for every successful `POST /api/debugger/sessions` response and records every returned session ID before readiness or navigation can finish. A `finally` cleanup step sends `DELETE /api/debugger/sessions/:sessionId` through the normalized API URL for every recorded ID, including IDs recorded before a later navigation failure. Cleanup failures are reported but do not replace the original capture result.

## Output and reporting

The command will produce:

- PNG images with deterministic route/state/viewport names;
- `manifest.json` containing the discovered records and resolved URLs used for the run;
- `report.json` containing captured, skipped, and failed entries, including error messages and elapsed time.

The report schema is:

```json
{
  "generatedAt": "ISO-8601",
  "status": "passed",
  "exitCode": 0,
  "baseUrl": "http://localhost:46000",
  "apiUrl": "http://localhost:4600/api",
  "cleanup": [],
  "entries": [
    {
      "route": "updates",
      "state": "filters",
      "viewport": "readme-wide",
      "url": "http://localhost:46000/?...",
      "status": "captured",
      "output": "readme-wide/updates--filters.png",
      "durationMs": 1234
    }
  ]
}
```

Entries may instead have `status: "skipped"` with `reason`, or `status: "failed"` with `error`. `cleanup` contains `{ sessionId, status: 'deleted'|'failed', error? }` entries. Top-level `status` is `passed`, `failed`, or `interrupted`; `exitCode` follows the rules below. The runner writes the report after every entry and cleanup attempt using a temporary file plus rename, so an interrupted run preserves all completed results.

`manifest.json` contains `{ generatedAt, apiUrl, context: { nodeId?, updateId?, eventOffset?, contractId?, party?, namespaceId?, tokenId?, transferUpdateId?, packageId?, packageName?, template?, publicKey? }, routes: [{ name, url, required, source }] }`. The manifest stores live IDs for diagnosis, while output filenames continue to use stable route/state names.

The README will show the generated asset directory and provide a short example of embedding a captured image. Generated PNGs may be committed as README assets; reports remain useful for local diagnostics and need not be embedded.

## Error handling

- A frontend or API connectivity failure stops immediately with the relevant URL and startup command.
- A required route/state navigation or readiness failure stops the run and reports the route/state/viewport.
- An unavailable dynamic record is skipped with a precise discovery reason.
- An optional filter state with a missing eligible control/value is recorded as skipped; a required filter state failure is fatal.
- An optional dynamic navigation failure is recorded; it becomes fatal under `--strict`.
- A failed filter interaction is recorded against its state and does not corrupt the default capture.
- Unexpected browser shutdown or screenshot write errors stop the active run and preserve the partial report.
- Debugger session cleanup is best-effort and is reported if it fails.

The outcome truth table is:

| Condition | Entry status | Non-strict exit | `--strict` exit |
| --- | --- | ---: | ---: |
| Required route/state captured | captured | 0 | 0 |
| Optional dynamic route has no live record | skipped | 0 | 1 |
| Optional filter state has no eligible control/value | skipped | 0 | 1 |
| Optional route fails after retry | failed | 0 | 1 |
| Required route/state fails after retry | failed | 1 | 1 |
| Invalid CLI/config/browser missing/connectivity failure | no entry or failed | 1/2 as applicable | 1/2 as applicable |

The CLI uses exit `2` only for invalid arguments/configuration or a missing browser installation; service connectivity and capture failures use exit `1`.

## Testing and verification

The implementation will include unit tests for:

- live-response-to-route-manifest selection;
- empty collections and dynamic skip reasons;
- URL/path/query escaping;
- deterministic filename and state expansion;
- viewport and CLI option normalization;
- filter-state action selection;
- API request rewriting for relative and absolute frontend API URLs.

Deterministic integration tests will also cover the CLI's browser orchestration against a local in-process HTTP fixture serving a minimal frontend/API pair: route discovery, custom API URL rewriting for relative/absolute requests and trailing-slash/API-prefix variants, context isolation, scoped multi-panel filter action execution, report persistence, and the full optional/required/strict exit matrix. A separate Playwright fixture test will force navigation failure after a successful debugger-session POST and verify that every created session is deleted. The real localnet capture remains a smoke test, not a prerequisite for unit/integration test execution.

Tests will use fixture response objects and injected fetch functions, not the user's live localnet. Verification will include the existing repository test/build/lint commands, a CLI help/config check, and a real smoke capture against the running frontend/backend when available.

## Non-goals

- Starting, stopping, or provisioning Canton localnet services;
- modifying application UI components solely to make screenshots possible;
- generating synthetic ledger records;
- visual diff testing or pixel-baseline approval workflows;
- uploading images to GitHub or editing external repositories;
- capturing arbitrary authenticated/private browser sessions.

## Acceptance criteria

1. After the one-time Chromium prerequisite, a developer can run one documented command against already-running local services and receive PNGs without editing IDs by hand.
2. Custom viewport dimensions can be selected from the command line or config.
3. The route manifest adapts when localnet update/contract/party/package/token IDs change.
4. Static pages are captured and dynamic pages are captured when live data makes them possible.
5. At least one additional screenshot per eligible browser page shows its Advanced Filter/Search panel expanded, with live representative values when available.
6. The run writes a useful manifest/report and clear diagnostics for unavailable pages.
7. The README explains setup, browser installation, command usage, custom resolutions, route overrides, and image output.
