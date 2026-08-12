# Home Dashboard Charts and Metrics Design

## Goal

Extend the Home page with an overview section above Latest Updates and Latest Trades. The overview contains two half-width charts in one row and a full-width metrics block below them.

## User-visible behavior

The Home page order will be:

1. A shared chart row:
   - Transactions over time across all configured nodes.
   - Canton Coin price over time.
2. A full-width metrics block:
   - Latest Canton Coin price.
   - Active Parties during the rolling last 24 hours.
3. The existing Latest Updates and Latest Trades tables.

Both charts expose the ranges `24h`, `7d`, and `31d`. The selected range is local to each chart.

The transaction chart aggregates the existing per-node activity buckets by timestamp, summing activity across nodes. It uses the existing activity sampling resolution.

The Canton Coin chart uses the existing daily market candles only. The `24h` view therefore shows the newest available daily point; it does not imply intraday market data. The `7d` and `31d` views filter the available daily candles to their respective windows.

The Latest Canton Coin price is derived from the newest valid daily close. When multiple venues have valid closes for the same quote and day, their median is displayed. If more than one quote is available, USD/USDT is preferred when present; otherwise the result uses a deterministic quote selection and displays that quote beside the value.

The Active Parties metric counts unique party IDs appearing in updates during the rolling 24-hour window, deduplicated across all configured nodes. It is not the current PQS active-party inventory.

## Architecture and data flow

Add a focused `HomeDashboardOverview` component above the existing table sections. It owns the chart range controls, combines chart data, and renders independent chart and metric states without changing the existing Updates or Trades browsers.

Add pure frontend helpers for:

- summing activity samples across nodes and filtering them to `24h`, `7d`, and `31d`;
- selecting the latest valid Canton Coin daily price and same-quote median;
- preparing chart points and axis labels.

Reuse `fetchActivityHistory` for transaction data and `fetchCantonCoinHistory('1D')` for price data. Extend activity-history support from 30 to 31 days, including cache retention, while preserving the existing Nodes page options of 1, 7, and 30 days.

Add a backend recent-party aggregation endpoint, `GET /api/parties/activity?hours=24`, backed by `PqsSummaryService`. Each configured node is queried for party witnesses in updates whose record time falls inside the rolling window; successful node results are unioned by party ID. The response includes the count, window bounds, and an `ok`/`partial`/`error` status so the UI can distinguish complete data from a degraded or unavailable metric.

## Error and loading behavior

The transaction chart, price chart, latest-price metric, and Active Parties metric load independently. Each panel has its own loading, empty, and error state. A market failure affects the price chart and latest-price metric only; a recent-party failure affects only the Active Parties metric. Existing Home table loading and error behavior remains unchanged.

## Testing

- Add pure helper tests for all-node activity aggregation, range filtering, 31-day boundaries, latest-price selection, same-quote medians, and empty/invalid data.
- Extend Home page tests to verify the new layout, labels, default ranges, independent API calls, and existing table placement.
- Add backend tests for the recent-party query, cross-node deduplication, rolling-window bounds, partial node failures, and controller parsing.
- Add cache tests covering 31-day activity retention and requests.
- Run the complete frontend/backend test suites and production build before committing the implementation.

## Scope boundaries

This change does not add intraday market data, alter the existing market-history endpoint interval, redesign Latest Updates or Latest Trades, or change the existing Nodes activity chart controls.
