# PQS Index Installer Design

## Goal

Make Canton Explorer fast on large client PQS databases without modifying PQS
configuration or its Flyway migration history. Ship the same opt-in index
installer in the npm package and Docker image.

The target case is a single Explorer user querying a PQS database with a long
transaction history and many contract-template partitions. Read latency, not
request coalescing, is the problem being addressed.

## Distribution and interface

The packaged command gains an `indexes` subcommand:

```
canton-explorer indexes inspect [--config <path>] [--node <id>]
canton-explorer indexes apply [--config <path>] [--node <id>] [--dry-run]
```

It uses the existing node configuration and environment-variable resolution,
therefore it targets exactly the PQS databases Explorer uses. `inspect` is the
default, is read-only, and reports the PQS version/schema shape, contract
partitions, installed Explorer indexes, and the proposed changes. `apply`
requires explicit operator action. `--node` allows a staged deployment to one
participant before applying the same migration set to every configured PQS
database. A node without a PQS connection is reported and skipped.

The Docker image exposes the same entrypoint. The supplied Compose file adds a
one-shot `canton-explorer-indexes` service using the Explorer image, the same
configuration, and the same environment file as `canton-explorer`. It is not
started by `docker compose up`; operators run it deliberately with
`docker compose run --rm canton-explorer-indexes apply`.

## Ownership and safety

The installer creates `canton_explorer_index_migrations`, its own version table
in the PQS database. It never writes to `flyway_schema_history`, changes PQS
pipeline filters, or alters PQS-owned tables/functions.

Each migration is idempotent and records a version only after every required
index has been created or verified. The installer discovers contract
partitions from PostgreSQL catalog tables on each run, so it also indexes
partitions created after an earlier run. It takes a PostgreSQL advisory lock
per database, preventing two installer invocations from competing.

Indexes on populated client databases are created per physical partition with
`CREATE INDEX CONCURRENTLY`. This avoids blocking PQS reads/writes for the
duration of an index build. Because PostgreSQL forbids concurrent index
creation inside a transaction, each index build is issued independently. A
failed or interrupted run leaves no migration recorded and is safe to rerun.

The connection role needs `SELECT` for inspection and table ownership or the
required `CREATE` privileges for application. Explorer's normal read-only
runtime connection remains unchanged.

## Initial performance package

The first migration set addresses query shapes that become linear as history
and partitions grow:

1. A GIN index on `witnesses` for every `__contracts` partition, and on
   `__exercises` where applicable. This serves party/namespace filters.
2. A partial, per-partition B-tree index over active contract creation order
   (`created_at_ix` where `archived_at_ix is null`). This serves the active
   contracts page without scanning archived history.
3. A B-tree prefix-search index for transaction identifiers where the PQS
   schema uses a text transaction ID. This is only installed when catalog
   inspection confirms that it matches the query operator/type.

The installer does **not** add speculative payload indexes. PQS's
`create_index_for_contract` helper remains appropriate for client-specific
JSONB fields, but Explorer's generic pages need standard PostgreSQL indexes on
the PQS event tables.

## Query changes shipped with the installer

Indexes are only useful when Explorer can use them. The accompanying Explorer
query work will:

- compare numeric transaction offsets as numeric values, never through
  `offset::text`;
- resolve requested template identifiers to `tpe_pk` values before querying,
  retaining PQS partition pruning;
- page active contracts by the monotonic create transaction index, then join
  the small result page to transactions for display fields;
- turn party-filtered updates into indexed event candidates joined to
  transactions, instead of correlated scans over all transactions; and
- keep keyset pagination and bounded page sizes. It will not introduce
  `OFFSET` pagination.

If a catalog check finds an unsupported PQS schema, the installer fails before
making changes and explains the missing assumption.

## Observability and verification

Before and after application, the installer reports index definitions, table
and partition counts, index sizes, and the result of representative
`EXPLAIN (FORMAT JSON)` checks. It does not collect ledger payloads or write
query logs containing them.

Explorer continues logging elapsed PQS query times. Documentation will give
operators a short procedure to apply indexes to one node, compare the page
timings, then roll out to the remaining node databases. Dropping an Explorer
index is a separately explicit command; `apply` never removes an index.

## Testing

- Unit tests cover CLI parsing, node selection, SQL generation, unsupported
  schema checks, and idempotent migration bookkeeping.
- PostgreSQL integration tests create representative partitioned PQS-shaped
  tables, verify every partition receives its required index, and verify a
  rerun makes no changes.
- Query tests assert that the revised SQL uses numeric offset predicates,
  static template PK lists, and keyset predicates.
- Packaging tests verify the command is included in `npm pack` and the Docker
  image/Compose service can invoke `indexes inspect` without starting HTTP.

## Non-goals

- Changing PQS configuration, filters, or PQS Flyway migrations.
- Automatically applying indexes during Explorer startup.
- Creating indexes for arbitrary client payload fields.
- Guaranteeing a fixed latency without considering client hardware, PQS
  ingestion rate, and PostgreSQL tuning.
