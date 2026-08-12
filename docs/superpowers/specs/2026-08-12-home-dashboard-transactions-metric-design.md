# Home Dashboard Transactions Metric Design

## Goal

Add a Transactions block to the Home Dashboard Network Metrics row showing the cumulative transaction total and the latest-hour transactions-per-second rate without introducing a live unique-update-ID aggregation query.

## Product behavior

- The existing two Network Metrics cards remain unchanged.
- A third card titled `Transactions` is added to the same metric grid.
- The card shows:
  - `Total transactions`: the cumulative `totalUpdateCount` from one representative healthy node.
  - `TPS`: the sum of that node's activity deltas from the latest hour divided by 3,600 seconds.
- The TPS caption identifies the period as the last hour.
- If no healthy node has transaction telemetry, the card shows an unavailable state rather than combining potentially divergent or duplicated node totals.
- The metric follows the selected Overview range indirectly because every range reloads activity history; the total remains cumulative and TPS always uses the latest hour from the refreshed response.

## Data flow

1. The backend already reads each node's cumulative `totalUpdateCount` as part of its existing ledger summary query.
2. Extend the activity-history series payload with that existing value; no new SQL query is added.
3. The frontend chooses the first healthy activity series with a finite cumulative total. The backend already returns series in stable label order, so selection is deterministic.
4. The frontend sums representative-node activity samples whose timestamps fall within the hour ending at `generatedAt`.
5. TPS is `latest-hour activity delta / 3600` and is formatted to four decimal places when below one TPS, otherwise to two-to-four decimal places.

## API and type changes

- Add an optional `totalUpdateCount` field to backend and frontend activity-series types for compatibility with existing fixtures and consumers.
- Populate it from the node snapshot ledger summary, falling back to the cache's last observed update count when a snapshot is unavailable.
- Do not change the existing activity-history query, window semantics, or range controls.

## UI structure

The new card uses the existing `home-dashboard-overview__metric-panel` styles:

```text
Transactions
12,345
0.2500 TPS in the last hour
```

Loading, error, and unavailable states use the existing metric card conventions. No new wrapper or layout section is introduced.

## Testing

- Backend cache coverage verifies the activity-history payload exposes the cumulative total for a seeded series.
- Overview component coverage verifies the Transactions card renders the total and latest-hour TPS from a healthy representative node.
- Existing frontend tests and build remain green.
- No unique update-ID query or cross-node deduplication is introduced.

## Out of scope

- Exact global unique transaction counting across all nodes.
- Summing totals across nodes.
- New endpoints, database indexes, polling cadence changes, or changes to the activity chart.
