# PQS index installer local plan evidence

Captured on 2026-08-14 with the disposable PostgreSQL 14 fixture in
`scripts/pqs-index-installer.test.mjs`. This is query-plan evidence only. The
fixture is not a client testnet, does not model client hardware or concurrent
PQS ingestion, and must not be used as a client latency claim.

## Fixture

- `__contracts` is list-partitioned by `tpe_pk`.
- `__contracts_29` contains 20,000 active rows and is analyzed before inspect.
- `__contracts_17` contains two rows used to exercise interrupted concurrent
  index recovery.
- Inspect selects the largest estimated contract partition and runs exactly one
  bounded `EXPLAIN (FORMAT JSON)` without `ANALYZE`.

Representative query:

```sql
select create_event_pk
from public.__contracts_29
where archived_at_ix is null
  and created_at_ix is not null
  and create_event_pk is not null
order by created_at_ix desc, create_event_pk desc
limit 31;
```

## Before apply

The integration assertion observes this plan shape:

```text
Limit
  Sort (created_at_ix DESC, create_event_pk DESC)
    Seq Scan on __contracts_29
```

## After explicit repair/apply

The integration assertion observes this plan shape:

```text
Limit
  Index Only Scan using canton_explorer_contracts_29_active_created_ix
```

The installed partial index is:

```sql
create index concurrently
  canton_explorer_contracts_29_active_created_ix
on public.__contracts_29 (created_at_ix desc, create_event_pk desc)
where archived_at_ix is null;
```

Run the evidence check with:

```bash
npm run build --workspace backend
node --test scripts/pqs-index-installer.test.mjs
```

For a client rollout, run `indexes inspect` before and after applying to one
node and compare the reported plan plus Explorer's PQS elapsed-query logs.
