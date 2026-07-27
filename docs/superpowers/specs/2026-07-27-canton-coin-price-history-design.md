# Canton Coin Price History View Design

## Goal

Add a Canton Explorer view for the native Canton Coin (`CC`) that displays the complete daily market-price history available from multiple public exchange APIs without requiring API keys. The view must report each provider's actual coverage and keep native CC separate from Wrapped Canton Coin (WCC).

## Context and constraints

The supplied `docs/Deep Research - Canton Coin.md` identifies native CC as the `canton-network` asset and distinguishes it from WCC. Native CC is a market-traded asset without an EVM contract, so the view must not use WCC contract data, Canton ledger events, or protocol-internal Amulet valuation as a traded-price substitute.

The first implementation should use public, unauthenticated exchange candle endpoints. OKX and Bybit are the initial providers because their market-data endpoints support public historical candles. The Bybit API may not expose the entire lifetime of a market; the view must show the resulting coverage rather than imply that an unavailable older period was reconstructed. A future provider can be added through the same adapter boundary when a native CC market is available. The UI should show the source venue and quote pair, since these are venue observations rather than a guaranteed official canonical price.

## User experience

Add a `Canton Coin` item under the Assets section of the existing Explore menu and expose it at `/canton-coin`.

The page contains:

- A heading identifying `Canton Coin (CC)` as the native Canton Network token.
- A daily close-price chart with one series per successful venue.
- An optional cross-venue median series for timestamps where at least two venues overlap. This is a comparison aid, not a replacement for the source series.
- Range controls for `All`, `1 year`, `90 days`, and `30 days`. The initial API request remains daily and full-history; range controls filter the returned points in the view.
- A source summary showing each venue, pair, number of candles, earliest candle, latest candle, and any provider error.
- Loading, partial-success, empty, and retry states.
- Explicit native/wrapped copy: `Native CC · WCC is excluded`.

Chart values use the source quote currency (`USDT` for the initial CC-USDT markets) and must not be relabeled as USD without a separate FX conversion source.

## Architecture

### Backend market-history service

Create a focused market-history service with provider adapters:

- `OkxCantonCoinProvider`: calls OKX public historical candles for `CC-USDT` and paginates until the provider has no older results.
- `BybitCantonCoinProvider`: calls Bybit public spot klines for `CCUSDT` and paginates using the oldest returned timestamp.
- A provider interface returns normalized daily OHLCV candles and provider metadata.

The service runs providers independently with `Promise.allSettled`, deduplicates candles by UTC day, sorts ascending, and returns successful sources alongside per-source failures. Each request has a bounded timeout and one bounded retry for transient rate-limit/server failures. Pagination must stop if the provider returns no rows, reaches the oldest available row, or fails to move the cursor backward. No source is silently used to fill another source's missing dates.

### API contract

Add `GET /api/market/canton-coin/history` with an optional `interval=1D` query parameter. The first version accepts daily history only and returns:

```json
{
  "asset": {
    "name": "Canton Coin",
    "symbol": "CC",
    "canonicalId": "canton-network",
    "network": "Canton Network",
    "kind": "native"
  },
  "interval": "1D",
  "dataStatus": "ready",
  "venues": [
    {
      "id": "okx",
      "label": "OKX",
      "pair": "CC-USDT",
      "quote": "USDT",
      "status": "ok",
      "coverageStart": "2026-01-01T00:00:00.000Z",
      "coverageEnd": "2026-06-30T00:00:00.000Z",
      "candles": [
        {
          "timestamp": "2026-01-01T00:00:00.000Z",
          "open": 0.1,
          "high": 0.11,
          "low": 0.09,
          "close": 0.105,
          "volumeQuote": 1000
        }
      ]
    }
  ]
}
```

Failed providers use the same venue entry with `status: "error"`, `coverageStart: null`, `coverageEnd: null`, `candles: []`, and a user-safe `message`. Providers that respond successfully with no usable candles use `status: "empty"` and the same empty coverage/candle fields. `dataStatus` is `ready` when at least one source has candles and all sources succeeded, `partial` when at least one source has candles and another source is empty or failed, `empty` when every source succeeded but returned no candles, and `error` when no source has candles and at least one source failed (including a mixture of empty and failed providers). The controller returns this diagnostic response with HTTP 200; malformed query parameters remain HTTP 400.

### Frontend data flow

Add a typed API function and a dedicated composable or view-local state for loading, response, retry, and selected range. Build chart geometry with SVG/CSS using the existing chart design tokens; do not add a chart dependency for this view. Render the median only from aligned UTC-day timestamps with two or more valid close values from venues using the same quote currency.

## Failure and data-quality behavior

- Provider HTTP failures, malformed payloads, rate limits, and unavailable symbols are isolated to that provider.
- Invalid numeric values and duplicate timestamps are discarded during normalization.
- Providers must request UTC-anchored daily candles: OKX uses its UTC daily bar variant and Bybit uses its daily kline interval, whose returned day starts are treated as UTC. Provider timestamps are converted to UTC and floored to the UTC day boundary before deduplication and sorting. The currently open UTC day is discarded because its daily candle is not final; only closed daily candles are shown.
- Candles are sorted oldest-to-newest regardless of provider response order.
- The view displays the actual pair and quote currency for each source.
- Missing dates remain gaps; the view does not forward-fill or splice venue data.
- The `volumeQuote` field is normalized to the provider's quote currency: OKX `volCcyQuote` and Bybit `turnover` are mapped without converting USDT to USD.
- The page identifies the series as exchange market data and does not imply that it is Canton protocol valuation.

## Testing

Backend tests must cover:

- OKX candle parsing and pagination.
- Bybit kline parsing and pagination.
- Pagination progress guards, timeout/retry behavior, and current-day exclusion.
- Deduplication and ascending timestamp normalization.
- Partial provider failure, empty providers, and all-provider failure behavior.
- Controller response shape and native asset identity.

Frontend tests must cover:

- The route and Assets navigation entry.
- Loading, retry, empty, and partial-source states.
- Native CC labeling and WCC exclusion copy.
- UTC range filtering and median calculation only for overlapping venue timestamps with the same quote currency.
- Rendering source metadata and quote currency.

Verification should include focused backend and frontend tests, both workspace builds, and `git diff --check`.

## Out of scope

- Wrapped Canton Coin, EVM contract, DEX, Dune, GeckoTerminal, or explorer history.
- CoinGecko, CoinMarketCap, Kaiko, Temple, Bybit CSV archive backfills, or other credentialed/aggregator providers.
- Intraday intervals, live WebSocket updates, persistent historical storage, or a benchmark-quality canonical price feed.
- Automatic conversion from USDT to USD.
