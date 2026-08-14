# Daily Traffic Purchase Cache Design

## Goal

Make Latest Updates independent of a full PQS traffic-purchase history scan on
normal requests. The Explorer needs only a daily traffic-price basis, not
minute-by-minute purchase data.

## Scope

This design applies only to the single latest traffic purchase used by
`PqsSummaryService` to calculate `estimatedTrafficUsd` on recent updates. The
Traffic Purchases history endpoints remain live PQS queries because they expose
filtered and paginated transaction history.

## Storage

Extend the existing Explorer SQLite database, configured by
`PACKAGE_CACHE_DB_PATH`, with `node_traffic_purchase_cache`.

Each row is keyed by:

- `node_id`
- `cache_day` — the UTC calendar date on which Explorer refreshed the value,
  in `YYYY-MM-DD` form.

The row stores the decoded `NodeTrafficPurchase` fields:

- update ID
- event offset
- record time
- purchased traffic
- amulet paid
- refresh timestamp

All purchase fields may be null. A fully-null purchase payload is a deliberate
cached result meaning that no purchase was found that day; it prevents an
otherwise-empty node from scanning PQS on every Latest Updates request.

## Read and Refresh Flow

1. `latestTrafficPurchase(node)` derives the current UTC day.
2. It reads the matching SQLite row. When found, it returns the cached purchase
   or cached no-result immediately.
3. On a cache miss, requests for the same node and day share one in-memory
   refresh promise.
4. The refresh performs the existing `fetchTrafficPurchases(node, { limit: 1 })`
   call, persists its first purchase (or an explicit no-result), and returns it.
5. A failed refresh is not written to SQLite. The caller receives `null`, which
   preserves the current behaviour of omitting a traffic estimate, and a later
   request may retry.

The database makes successful results survive process restart; the in-memory
promise only prevents duplicate work during a concurrent cold miss.

## Freshness and Semantics

- Cache validity is exactly the current UTC day. The first request after UTC
  midnight refreshes the value.
- A purchase that happens later on the same day is intentionally not used until
  the next UTC day. This is acceptable because the value is pricing metadata,
  not ledger state.
- Existing traffic-estimate calculations and response shapes remain unchanged.
- The cache is shared by all Explorer users because it lives on the server,
  rather than in individual browsers.

## Testing

Add focused tests that prove:

1. SQLite rows persist and deserialize both a purchase and a cached no-result.
2. A same-day request reuses the persisted row without invoking PQS.
3. A new UTC day refreshes and replaces the cached value.
4. Concurrent same-node cache misses issue one PQS request.
5. PQS failures are not persisted and yield a null estimate without failing the
   Latest Updates response.
6. The live Traffic Purchases history path continues to call PQS directly.

## Non-goals

- Caching or materializing the full Traffic Purchases history.
- Changing the public API.
- Adding PostgreSQL indexes for the broad traffic-history query as part of this
  change.
