# Token Query Performance Design

## Goal

Make the Tokens page responsive on large testnet ledgers by returning PQS-derived and cached token data without waiting for a complete gRPC HoldingV2 active-contract scan, while retaining gRPC-only token discovery after a background refresh.

## Current bottleneck

On a cold token cache, `PqsSummaryService.fetchTokens` waits for three operations per configured node: PQS token discovery, a gRPC HoldingV2 scan, and a builtin-token PQS check. The gRPC scan enumerates every local party and pages every active HoldingV2 contract. The Tokens page concurrently loads the transfer browser, which performs another PQS discovery path. A 30,000+ transaction testnet can therefore block the first token render on a complete ledger scan.

## Design

### Cache state and refresh ownership

Replace the token cache's single timestamp/value entry with a per-node state that distinguishes:

- the latest PQS-derived token set;
- the latest successful gRPC enrichment set;
- the merged response cache;
- the currently running refresh promise, if any.

All callers for the same node share an in-flight refresh promise. A request never starts a second HoldingV2 scan while one is already running.

### Read path

`fetchTokens` loads each node independently and returns as soon as PQS discovery and the builtin-token check have completed. It merges those fresh PQS values with the last successful gRPC enrichment, if one exists. It starts a gRPC enrichment refresh in the background for `pqs_with_grpc` nodes whose enrichment is missing or stale. Background failures preserve the last known enrichment and do not fail the token-list response.

The first cold response may not include gRPC-only HoldingV2 tokens. The API exposes a `refreshing` flag so the UI can revalidate once while enrichment is pending. If PQS returns no usable token data for a node, the request may await the gRPC result as the fallback rather than returning an empty result.

### API and frontend behavior

Extend `TokensResponse` with `refreshing: boolean`. The `/tokens` endpoint retains the existing paging and filters. The Tokens view performs one delayed revalidation only while `refreshing` is true; it keeps its current rows visible during that revalidation. It does not retry indefinitely.

### SQL measurement and tuning

Add a read-only benchmark helper that emits the token-discovery SQL and records timing boundaries for PQS query, payload decoding, and gRPC enrichment. Run `EXPLAIN (ANALYZE, BUFFERS)` against the local PQS before changing SQL/indexes.

The SQL rewrite is conditional on the actual plan and schema types. The expected changes are to filter using template component columns instead of a concatenated expression and to avoid sorting `event_offset::numeric` over historical rows when an indexed ordering is available. No database indexes are created automatically: deployment-owned PQS databases require a separately reviewed migration/operational command.

## Error and freshness rules

- A successful PQS response is sufficient for `/tokens`; a concurrent gRPC timeout does not delay or fail it.
- A gRPC-only fallback is awaited only when PQS produced no usable data for that node.
- Background refresh failures retain prior gRPC enrichment and are logged/timed for diagnosis.
- Request coalescing applies per node and source, not across unrelated token-holder or transfer caches.

## Tests

- Verify a cold PQS result returns before a deliberately pending gRPC scan.
- Verify a later request receives gRPC-enriched tokens and clears `refreshing`.
- Verify concurrent requests trigger one gRPC scan per node.
- Verify PQS failure uses gRPC as an awaited fallback.
- Verify the Tokens view schedules at most one refresh revalidation and leaves its existing table rendered.

## Non-goals

- Changing token transfer or token holder refresh behavior in this change.
- Adding indexes to a client-owned PQS database without first reviewing the local query plan.
- Changing token pagination, filters, or token source precedence.
