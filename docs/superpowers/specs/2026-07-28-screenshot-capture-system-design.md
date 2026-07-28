# Live Application Screenshot Capture System Design

**Date:** 2026-07-28  
**Status:** Approved for implementation

## Goal

Provide a repeatable local command that captures the running Canton Explorer frontend in custom viewport resolutions, using the currently running backend/localnet, and produces README-ready PNGs for every meaningful application route. The capture set must adapt to the changing records produced by each localnet startup and include expanded Advanced Filter/Search states that demonstrate the application's query controls.

## Context

The repository contains a Vue 3/Vite frontend and a NestJS backend. The frontend normally runs at `http://localhost:46000` and resolves its development API to `http://localhost:4600/api`. There is no existing browser automation or screenshot runner.

The localnet is not stable across restarts. Update IDs, event offsets, contract IDs, party IDs, package IDs, token IDs, and debugger-replay inputs must therefore be discovered from the live API immediately before capture. Hard-coded examples would become stale and would make the README capture workflow unreliable.

## Chosen Approach

Add a small Playwright-based Node CLI under `scripts/`. The CLI will:

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

Browser installation will be documented separately:

```bash
npx playwright install chromium
```

The command is intentionally attached to the already-running services. It will not start or stop the backend or frontend.

## Configuration

The default configuration will live in `scripts/screenshot-config.mjs` and will be overridable by `--config`.

### Viewports

Configuration will define named viewport presets containing width, height, and optional device scale factor. At least one README-oriented wide preset will be provided, while the CLI will allow selecting or adding arbitrary `WxH` dimensions.

Images will be written using a deterministic layout:

```text
screenshots/
  <viewport-name>/
    <route-name>.png
    <route-name>--filters.png
  manifest.json
  report.json
```

The exact default names may be adjusted during implementation to match repository conventions, but names must be filesystem-safe and stable across localnet restarts.

### Routes and states

Each route entry has a stable name, a URL or discovery key, a required/optional flag, a readiness rule, and zero or more interaction states. A state may:

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

Filter values will be drawn from the same live responses where possible. For example, a discovered party can populate Party ID filters, a discovered template can populate Template ID filters, and discovered node IDs can populate global node checkboxes. If no suitable live value exists, the expanded state will still open the panel without inventing a value.

## Advanced Filter/Search screenshot states

The capture matrix will include an additional state for pages that expose Advanced Filter or Advanced Search controls. The state runner will use accessible names and labels already present in the application, such as:

- `Advanced Filter` on updates/contracts/token-transfer browsers;
- `Advanced Search` on Traffic Purchases;
- `Advanced Filter Parameters` as the expanded panel landmark.

For each eligible route, the state runner will:

1. Navigate to the unfiltered route.
2. Open the advanced panel if it is not already expanded.
3. Populate representative live values where the route supports them.
4. Wait for the panel and any resulting table state to settle.
5. Capture a separate `--filters` image without changing the default-state image.

The runner will not rely on private Vue state or CSS classes. If a control is absent on a route, the state is skipped and recorded rather than failing the entire run, unless the state is explicitly marked required.

## Readiness and capture behavior

Each route will have a readiness strategy:

- wait for the initial document load;
- wait for a configured accessible heading/panel/table or route-specific selector;
- wait for loading indicators to settle where practical;
- apply a small configurable settle delay for charts, Monaco, and CSS transitions;
- capture with Playwright `fullPage: true` at the configured viewport.

The default theme will be the current application default. Theme-specific capture can be added as a config state later without changing discovery.

The route runner will isolate each capture in a fresh browser context so local storage, URL filters, and debugger state do not leak between images. It will close each context after its route/state matrix completes.

## Output and reporting

The command will produce:

- PNG images with deterministic route/state/viewport names;
- `manifest.json` containing the discovered records and resolved URLs used for the run;
- `report.json` containing captured, skipped, and failed entries, including error messages and elapsed time.

The README will show the generated asset directory and provide a short example of embedding a captured image. Generated PNGs may be committed as README assets; reports remain useful for local diagnostics and need not be embedded.

## Error handling

- A frontend or API connectivity failure stops immediately with the relevant URL and startup command.
- A required static route navigation or readiness failure stops the run and reports the route/state/viewport.
- An unavailable dynamic record is skipped with a precise discovery reason.
- A dynamic navigation failure is recorded; it becomes fatal under `--strict`.
- A failed filter interaction is recorded against its state and does not corrupt the default capture.
- Unexpected browser shutdown or screenshot write errors stop the active run and preserve the partial report.
- Debugger session cleanup is best-effort and is reported if it fails.

## Testing and verification

The implementation will include unit tests for:

- live-response-to-route-manifest selection;
- empty collections and dynamic skip reasons;
- URL/path/query escaping;
- deterministic filename and state expansion;
- viewport and CLI option normalization;
- filter-state action selection.

Tests will use fixture response objects and injected fetch functions, not the user's live localnet. Verification will include the existing repository test/build/lint commands, a CLI help/config check, and a real smoke capture against the running frontend/backend when available.

## Non-goals

- Starting, stopping, or provisioning Canton localnet services;
- modifying application UI components solely to make screenshots possible;
- generating synthetic ledger records;
- visual diff testing or pixel-baseline approval workflows;
- uploading images to GitHub or editing external repositories;
- capturing arbitrary authenticated/private browser sessions.

## Acceptance criteria

1. A developer can run one documented command against already-running local services and receive PNGs without editing IDs by hand.
2. Custom viewport dimensions can be selected from the command line or config.
3. The route manifest adapts when localnet update/contract/party/package/token IDs change.
4. Static pages are captured and dynamic pages are captured when live data makes them possible.
5. At least one additional screenshot per eligible browser page shows its Advanced Filter/Search panel expanded, with live representative values when available.
6. The run writes a useful manifest/report and clear diagnostics for unavailable pages.
7. The README explains setup, browser installation, command usage, custom resolutions, route overrides, and image output.
