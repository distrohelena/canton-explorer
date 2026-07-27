# SDK PQS Query Migration Design

## Goal

Upgrade Canton Explorer to `@distrohelena/canton-typescript-sdk` 0.1.17 and
make the SDK's PQS query API the sole database-access boundary. Preserve the
Explorer's REST and UI contracts.

## Scope

This work will:

- declare the Explorer dependency on SDK `^0.1.17` and refresh the lockfile;
- create and dispose SDK `CantonManager` instances per configured node;
- replace direct `pg` pool access with typed delegates, relation includes,
  filters, JSON projections, and groups wherever the SDK represents the query;
- use the SDK's read-only `$queryRaw` only for Explorer-specific analytical
  queries; and
- test manager lifecycle, query mapping, and parameter binding.

This work will not change the public Explorer endpoints, views, node
configuration format, or add a general-purpose query console.

## Manager Ownership

Explorer will introduce an SDK-manager factory keyed by node ID. It owns all
created managers and disposes them during Nest application shutdown.

For a `pqs_only` node, the factory creates one PQS manager:

```ts
new CantonManager({
  grpc: new CantonClientOptions({ transportKind: TransportKind.grpc }),
  querySource: QuerySource.pqs,
  pqs: { connectionString, schema },
});
```

The endpoint-less gRPC client is not used; it satisfies the manager's current
constructor contract. For a `pqs_with_grpc` node, the factory keeps a manager
with the configured gRPC endpoints for existing participant calls and creates
a separate PQS manager for database reads. The two managers must both be
disposed.

Connection strings continue to be read from the configured environment
variable. The SDK schema profile validates the configured schema during query
initialization, so Explorer will surface that safe error rather than perform
its own schema probing.

## Query Routing

The service layer receives an SDK `QueryClient`, never a `pg.Pool`.

Use typed delegates for standard relation access:

- packages and package metadata;
- contract list, detail, search, active-state, party/witness, template, and
  lifecycle filters;
- transactions, events, exercises, and their profiled relation includes;
- grouped counts and SDK-supported hour/day/week/month buckets; and
- JSON field filters, projections, and profiled JSON groups.

Keep `$queryRaw` for operations whose result is an Explorer-specific
projection rather than a PQS relation result:

- arbitrary-minute activity buckets, including the existing 15-minute mode;
- union-based update and party projections;
- traffic-purchase extraction; and
- token balances, holders, and transfer classification.

Every raw operation uses SQL positional placeholders and a separate values
array. SQL placeholders cannot represent relation identifiers, so raw-query
builders may obtain names only from one shared Explorer helper that validates
the configured schema with the SDK profile's identifier rules and quotes one
of the fixed eight PQS relation names. It must not accept a caller-provided
relation name or any user-controlled identifier. The SDK schema profile
controls identifiers for typed delegates; the shared helper provides the same
fixed mapping only for the retained raw analytics. Raw SQL remains read-only
and must work with the SDK's single-statement policy.

## Compatibility and Errors

The Explorer continues to normalize SDK rows to its existing domain response
types. SDK `PqsQueryError`, schema-profile errors, and capability errors are
translated through the current node-error handling so connection details and
bound values are never exposed.

`pqs_only` behavior stays explicit: PQS-derived data remains available while
gRPC-dependent operations retain their existing unavailable/not-configured
behavior.

## Testing

- Factory tests cover manager reuse, endpoint-less PQS construction, and
  disposal for both node modes.
- Service tests prove representative delegate queries use the expected
  filters, include trees, grouping, and row normalization.
- Raw-query tests prove parameter arrays are passed separately from SQL and
  preserve current Explorer results for activity, update/party, traffic, and
  token paths.
- Existing backend unit tests and TypeScript build validate API compatibility.

## Acceptance Criteria

- Explorer compiles against the SDK 0.1.17 compiled public API.
- No Explorer service directly imports or constructs `pg.Pool`.
- Typed PQS reads use SDK delegates whenever their result maps directly to a
  profiled SDK relation or relation graph.
- Remaining raw reads are read-only, parameterized, and limited to the four
  analytical categories named above; their only interpolated SQL fragments are
  fixed relation names emitted by the validated schema-qualification helper.
- Existing REST/UI behavior and `pqs_only` support are preserved.
