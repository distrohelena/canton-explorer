# Canton Coin Price History View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a native Canton Coin (`CC`) daily price-history view backed by unauthenticated OKX and Bybit public candle APIs, with available source coverage and failure provenance visible in the UI.

**Architecture:** Add a small backend market module with provider adapters, UTC normalization, bounded pagination/retry behavior, and a `/api/market/canton-coin/history` endpoint. Add typed frontend API/state helpers and a dedicated Vue route that renders source series plus an overlap median using the existing SVG/chart styling; WCC and ledger/protocol valuation data remain out of scope.

**Tech Stack:** NestJS, TypeScript, native `fetch`, Vue 3 `<script setup>`, Vue Router, Vitest, Jest, Testing Library, existing CSS/SVG chart tokens.

---

## Files and responsibilities

Backend files:

- Create `backend/src/market/canton-coin.types.ts` for normalized candles, provider status, asset metadata, and API response types.
- Create `backend/src/market/canton-coin.provider.ts` for the provider interface and shared HTTP/normalization contracts.
- Create `backend/src/market/okx-canton-coin.provider.ts` for paginated OKX `CC-USDT` UTC-daily candle retrieval and payload parsing.
- Create `backend/src/market/bybit-canton-coin.provider.ts` for paginated Bybit spot `CCUSDT` UTC-daily kline retrieval and payload parsing.
- Create `backend/src/market/canton-coin-price.service.ts` for independent provider execution, status aggregation, normalization, and response construction.
- Create `backend/src/api/market.controller.ts` for `GET /api/market/canton-coin/history` query validation and service delegation.
- Modify `backend/src/app.module.ts` to register the market controller and service/providers.
- Create `backend/test/market/canton-coin-providers.spec.ts` for provider parsing, pagination, current-day exclusion, and retry/progress guards.
- Create `backend/test/market/canton-coin-price.service.spec.ts` for aggregation and `dataStatus` semantics.
- Create `backend/test/api/market.controller.spec.ts` for the endpoint contract and invalid interval behavior.

Frontend files:

- Create `frontend/src/types/market.ts` for the API response types used by the view.
- Create `frontend/src/lib/canton-coin-history.ts` for pure range filtering, line-point geometry, and same-quote median helpers.
- Modify `frontend/src/lib/api.ts` to add `fetchCantonCoinHistory()`.
- Create `frontend/src/views/CantonCoinView.vue` for loading/error/empty/partial states, controls, chart, and venue coverage cards.
- Create `frontend/src/views/CantonCoinView.test.ts` for route-view behavior and the main UI states.
- Modify `frontend/src/router.ts` to register `/canton-coin`.
- Modify `frontend/src/App.vue` to add the Canton Coin link under Assets and keep the Assets section active on the new route.
- Modify `frontend/src/styles.css` for the page layout, multi-series chart, source cards, and responsive behavior using existing variables.
- Create `frontend/src/lib/canton-coin-history.test.ts` for range and median helper behavior.

---

### Task 1: Define the backend market contract and write failing provider tests

**Files:**
- Create: `backend/src/market/canton-coin.types.ts`
- Create: `backend/src/market/canton-coin.provider.ts`
- Create: `backend/test/market/canton-coin-providers.spec.ts`

- [ ] **Step 1: Define the normalized candle and response types**

Define `CantonCoinCandle` with ISO UTC `timestamp`, numeric `open`, `high`, `low`, `close`, and `volumeQuote`. Define `CantonCoinProviderResult` with provider id/label/pair/quote, `status: 'ok' | 'empty' | 'error'`, nullable coverage bounds, candles, and optional user-safe message. Define `CantonCoinHistoryResponse` with `asset.canonicalId = 'canton-network'`, `interval: '1D'`, `dataStatus: 'ready' | 'partial' | 'empty' | 'error'`, and `venues`.

- [ ] **Step 2: Define the provider interface and shared request shape**

Use a small interface such as:

```ts
export interface CantonCoinPriceProvider {
  readonly id: string;
  readonly label: string;
  readonly pair: string;
  readonly quote: string;
  fetchHistory(now: Date): Promise<CantonCoinProviderResult>;
}
```

Keep HTTP implementation details out of the service so tests can inject fake providers.

- [ ] **Step 3: Write failing OKX parsing and pagination tests**

Mock `global.fetch` with OKX response pages containing newest-first `[ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm]` rows. Assert the adapter maps `volCcyQuote` to `volumeQuote`, requests the UTC daily bar variant, follows the older-page cursor, sorts oldest-first, and deduplicates repeated timestamps.

- [ ] **Step 4: Write failing Bybit parsing and pagination tests**

Mock Bybit `{ retCode: 0, result: { list: [...] } }` pages. Assert the adapter maps `[startTime, open, high, low, close, volume, turnover]`, requests `category=spot`, `symbol=CCUSDT`, and `interval=D`, paginates with an older `end` timestamp, and stops when the cursor does not move backward.

- [ ] **Step 5: Write failing current-day and invalid-payload tests**

Use a fixed `now` and assert candles whose UTC day is still open are excluded. Assert malformed response shapes, non-2xx responses, and provider error payloads become provider errors. Assert rows with non-finite numeric values are discarded while valid rows from the same response remain usable.

- [ ] **Step 6: Run the provider tests and verify the expected red failure**

Run:

```bash
npm run test --workspace backend -- --runInBand test/market/canton-coin-providers.spec.ts
```

Expected: fail because the market types/providers do not yet exist.

---

### Task 2: Implement providers, aggregation service, and API

**Files:**
- Modify: `backend/src/market/canton-coin.provider.ts`
- Modify: `backend/src/market/okx-canton-coin.provider.ts`
- Modify: `backend/src/market/bybit-canton-coin.provider.ts`
- Create: `backend/src/market/canton-coin-price.service.ts`
- Create: `backend/src/api/market.controller.ts`
- Modify: `backend/src/app.module.ts`
- Create: `backend/test/market/canton-coin-price.service.spec.ts`
- Create: `backend/test/api/market.controller.spec.ts`

- [ ] **Step 1: Implement bounded public HTTP helpers**

Implement a shared `fetchJson` helper using `AbortSignal.timeout(10_000)`. Retry once after a short bounded delay only for HTTP 429/5xx or network errors. Do not log or expose raw provider response bodies. Treat non-2xx and provider-declared errors as safe provider messages.

- [ ] **Step 2: Implement OKX pagination**

Call the public OKX history-candles endpoint for `CC-USDT` using the UTC daily bar parameter and a page limit. Pass the prior page's oldest timestamp as the next older cursor, stop on an empty page or non-decreasing cursor, normalize rows, and remove the still-open UTC day.

- [ ] **Step 3: Implement Bybit pagination**

Call the public Bybit market kline endpoint with `category=spot`, `symbol=CCUSDT`, `interval=D`, and the maximum supported page size. Pass `end = oldestTimestamp - 1` for the next page, stop on empty/non-progressing pages, normalize rows, and remove the still-open UTC day.

- [ ] **Step 4: Write failing service tests for status and native identity**

Use fake providers to assert `ready`, `partial`, `empty`, and mixed empty/error `error` responses; assert the response includes `Canton Coin`, `CC`, `canton-network`, `native`, `Canton Network`, and no WCC/contract fields. Assert median calculation is not performed in the backend.

- [ ] **Step 5: Run service tests to verify the expected red failure**

Run:

```bash
npm run test --workspace backend -- --runInBand test/market/canton-coin-price.service.spec.ts
```

Expected: fail until the service exists.

- [ ] **Step 6: Implement service aggregation and `dataStatus`**

Run the injected providers with `Promise.allSettled`. For each result, normalize UTC day timestamps, discard invalid rows, deduplicate, sort, and calculate coverage. Set `dataStatus` to `ready` when at least one source has candles and all providers return `status: 'ok'`; set it to `partial` when at least one source has candles and another source is empty or failed; set it to `empty` when all providers are empty; and set it to `error` when no provider has candles and at least one provider failed.

- [ ] **Step 7: Write failing controller tests**

Test that `GET /api/market/canton-coin/history` delegates with `1D`, returns the typed response, rejects `interval=1h`, and does not require node/PQS configuration.

- [ ] **Step 8: Run controller tests to verify the expected red failure**

Run:

```bash
npm run test --workspace backend -- --runInBand test/api/market.controller.spec.ts
```

Expected: fail because the market controller does not yet exist.

- [ ] **Step 9: Implement the market controller**

Accept only `interval=1D` or an omitted interval. Return the service response for valid requests and throw a bad-request error for other intervals. Keep the endpoint independent of configured Canton nodes.

- [ ] **Step 10: Register the controller and providers**

Add `MarketController`, `CantonCoinPriceService`, `OkxCantonCoinProvider`, and `BybitCantonCoinProvider` to `backend/src/app.module.ts`. Use constructor injection so the service can be replaced by a test double.

- [ ] **Step 11: Run the complete focused backend market suite**

Run:

```bash
npm run test --workspace backend -- --runInBand test/market test/api/market.controller.spec.ts
```

Expected: all new backend tests pass.

---

### Task 3: Add typed frontend helpers and the Canton Coin view

**Files:**
- Create: `frontend/src/types/market.ts`
- Create: `frontend/src/lib/canton-coin-history.ts`
- Create: `frontend/src/lib/canton-coin-history.test.ts`
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/views/CantonCoinView.vue`
- Create: `frontend/src/views/CantonCoinView.test.ts`

- [ ] **Step 1: Define frontend response types**

Mirror the backend contract in `frontend/src/types/market.ts` without duplicating provider-specific raw payload types. Keep `dataStatus`, venue status, coverage bounds, candle values, and `canonicalId` strongly typed.

- [ ] **Step 2: Write failing pure-helper tests**

Cover:

```ts
filterCantonCoinRange(candles, '30d', now)
medianCloseByUtcDay(venues)
linePoints(candles, width, height)
```

Assert range filtering uses UTC dates, median output requires at least two same-quote venue values on a day, invalid values are ignored, and line geometry is stable for one-point/constant-value series.

- [ ] **Step 3: Run helper tests and verify the expected red failure**

Run:

```bash
npm run test --workspace frontend -- --run canton-coin-history.test.ts
```

Expected: fail because the helper module is not implemented.

- [ ] **Step 4: Implement pure chart/data helpers**

Implement deterministic UTC range filtering for `all`, `1y`, `90d`, and `30d`; median close calculation keyed by exact ISO UTC day and quote; and SVG polyline point generation with finite-value guards and a small vertical padding for constant series.

- [ ] **Step 5: Add the typed API client function**

Import the market response type in `frontend/src/lib/api.ts` and add:

```ts
export function fetchCantonCoinHistory(interval = '1D'): Promise<CantonCoinHistoryResponse> {
  return fetchJson<CantonCoinHistoryResponse>(
    `/market/canton-coin/history?interval=${encodeURIComponent(interval)}`,
  );
}
```

- [ ] **Step 6: Write failing view tests for navigation and states**

Mock `fetchCantonCoinHistory`. Test that the view renders native CC/WCC exclusion copy, source labels and quote pairs, all/30-day controls, one line per successful venue, overlap median only when applicable, retry on request failure, empty state, and partial provider warnings. Test that the route can render without node data.

- [ ] **Step 7: Implement `CantonCoinView.vue`**

On mount, request full daily history once. Keep selected range local and derive filtered venue series and median from the response. Render a semantic heading, range buttons, SVG chart with accessible `role="img"`/label, chart legend, source coverage cards, and explicit loading/empty/error/partial messages. Use `button` controls and preserve the selected range when retrying.

- [ ] **Step 8: Run helper and view tests to verify green**

Run:

```bash
npm run test --workspace frontend -- --run canton-coin-history.test.ts CantonCoinView.test.ts
```

Expected: all new frontend tests pass.

---

### Task 4: Register navigation, style the page, and verify the workspace

**Files:**
- Modify: `frontend/src/router.ts`
- Modify: `frontend/src/App.vue`
- Modify: `frontend/src/styles.css`
- Modify: `frontend/src/views/CantonCoinView.test.ts`

- [ ] **Step 1: Register the route**

Import `CantonCoinView` and add `{ path: '/canton-coin', component: CantonCoinView }` before parameterized token routes. Add a route test assertion if the existing router test pattern permits; otherwise cover route rendering in the view test.

- [ ] **Step 2: Add the Assets navigation entry**

Add a `RouterLink` to `/canton-coin` under the existing Assets menu and update `exploreLabel` so `/canton-coin` displays `Assets`.

- [ ] **Step 3: Add responsive styles**

Add scoped page classes to `frontend/src/styles.css` (following the existing global stylesheet convention): page header, range control group, chart shell, chart guides, series legend, source cards, status badges, and mobile stacking. Reuse `--surface-card`, `--line-soft`, `--chart-*`, text, and status variables for light/dark themes.

- [ ] **Step 4: Run frontend tests and build**

Run:

```bash
npm run test --workspace frontend -- --run
npm run build --workspace frontend
```

Expected: all frontend tests pass and `vue-tsc`/Vite build exits 0.

- [ ] **Step 5: Run backend tests and build**

Run:

```bash
npm run test --workspace backend -- --runInBand
npm run build --workspace backend
```

Expected: backend tests pass and Nest build exits 0. If unrelated live Canton tests fail due unavailable services, record those failures separately from the focused market tests.

- [ ] **Step 6: Run full workspace verification**

Run:

```bash
npm test
npm run build
git diff --check
git status --short
```

Expected: new tests/builds pass, diff check is clean, and the final status clearly shows only the intended feature files plus the user's pre-existing changes (`backend/package.json` and research artifacts).

- [ ] **Step 7: Review the implementation against the spec**

Confirm each requirement: native `canton-network` identity, WCC exclusion, no API keys, OKX and Bybit multi-source history, actual provider coverage, UTC closed daily candles, no silent gap fill, typed partial/error states, same-quote median only, range controls, and source/quote labeling. Do not claim completion until the verification commands have fresh passing evidence.
