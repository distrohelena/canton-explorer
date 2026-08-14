# PQS index installer final-audit corrective patch

Date: 2026-08-14

Implementation commit: `776bf1d fix: complete PQS index installer audit`

## Delivered corrections

1. The installer now validates the supported PQS schema shape before it creates
   `canton_explorer_index_migrations`. An empty or unsupported schema throws
   before any persistent Explorer write.
2. Existing Explorer indexes are compared against the complete expected shape:
   target schema/table, access method, uniqueness, key and included expressions,
   operator classes, sort options, and predicate. A valid mismatch is a conflict.
3. `indexes apply` never drops an index. `indexes repair` is the only path that
   can run `DROP INDEX CONCURRENTLY`, and only for an invalid expected Explorer
   index. Help, README, Docker help coverage, and integration coverage document
   this distinction.
4. Active-contract pagination uses `(created_at_ix, create_event_pk)` as a
   stable keyset and returns an `acs1.` compound cursor. Numeric offset cursors
   remain accepted for existing callers. The regression test covers three
   contracts from one transaction crossing a page boundary.
5. `indexes inspect` validates the schema, reports the read-only latest PQS
   Flyway version, actual index definitions and sizes, relation partition/count
   size summaries, and one bounded `EXPLAIN (FORMAT JSON)` query. Local-only
   plan evidence is recorded in `docs/performance/pqs-index-installer-local-plan.md`;
   it explicitly makes no client-testnet latency claim.
6. PostgreSQL integration readiness now requires both Docker health and a real
   host SQL `select 1` query. Timeout diagnostics include container state and
   recent logs, avoiding the transient `pg_isready` success during PostgreSQL
   image initialization.

PQS configuration and PQS Flyway history were not modified.

## Verification evidence

| Command | Result |
| --- | --- |
| Focused backend index/pagination suites | 4 suites, 155 tests passed |
| `npm run build --workspace backend` | passed |
| Full backend test run | 36 suites, 430 tests passed |
| Frontend test run | 55 files, 445 tests passed |
| `npm run build:package` | passed |
| `npm run pack:dry-run` | passed |
| `node --test scripts/pqs-index-installer.test.mjs` | 2 tests passed |
| `node --test scripts/pqs-index-installer.test.mjs scripts/docker-compose.test.mjs scripts/docker-image.test.mjs` | 8 tests passed, 0 failed, duration 150835 ms |
| `git diff --check` | passed (no output, exit 0) |

The combined Docker run included production-image validation, Compose command
documentation validation, readiness validation, conflict/no-write validation,
invalid-index apply rejection, explicit repair, idempotency, and before/after
plan evidence (`Seq Scan` before and `Index Only Scan` after).

## Source self-review

Reviewed the staged implementation against all six audit requirements. The
schema validation is invoked before `migrationTableSql`; the only runtime
`dropIndexSql` invocation is guarded by the repair mode; valid full-definition
mismatches stop both apply and repair; and the compound cursor keys are selected,
ordered, encoded, decoded, and tested together.
