# Token discovery PQS query measurements

Date: 2026-08-14

These measurements use the local `pqs-app-provider` database with 94
`__contracts` partitions and 146 transactions. They are read-only
`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` runs; no indexes or other DDL were
created.

## Baseline: current template-id expression

The original `tokenRowsQuery` joined `__contract_tpe` and filtered on the
computed template identifier:

```sql
case
  when contract_tpe_row.module_name is null
    or contract_tpe_row.entity_name is null then null
  else contract_tpe_row.module_name || ':' || contract_tpe_row.entity_name
end
```

The measured baseline planned in **15.203 ms** with **15,612 shared hit
blocks** during planning and executed in **1.263 ms**. It returned 142 rows
and used an in-memory `quicksort` of 169 kB. Its `Append` scanned all 94
contract partitions, because PostgreSQL could not turn the concatenated
template expression into static partition constraints.

## Comparison probes

Resolving the locally relevant exact type PKs first produced the literal list
`(12, 14, 43)` (there were no CIP-112 types locally). The same join/filter
shape with:

```sql
where contract_row.tpe_pk in (12, 14, 43)
```

planned only three partitions. It measured **2.608 ms** planning with **1,099
shared hit blocks**, **0.766 ms** execution, 142 rows, and an in-memory
`quicksort` of 169 kB.

Moving the PK lookup into a SQL subquery/InitPlan did not enable pruning: it
still scanned all 94 partitions, with **20.810 ms** planning and **1.432 ms**
execution. The PK list must therefore be literal in the emitted contract
query.

## Implemented query shape and fresh measurement

The service now resolves and caches relevant `__contract_tpe` PKs per node
using direct `module_name` / `entity_name` predicates. It also resolves
CIP-112 types with:

```sql
contract_tpe_row.module_name like '%.CIP112'
and contract_tpe_row.entity_name is not null
```

The subsequent token, holder, and transfer contract queries embed only
validated positive integer PKs in `contract_row.tpe_pk in (...)`. The joined
type table remains in the select list so API template IDs are unchanged.

A fresh read-only run after the change, using the emitted join/filter/order
shape and local literal PKs `(12, 14, 43)`, measured:

| Metric | Result |
| --- | --- |
| Planning time | 1.740 ms |
| Planning shared hit blocks | 1,117 |
| Execution time | 0.381 ms |
| Rows | 146 |
| Sort | `quicksort`, 173 kB memory |
| Contract partitions scanned | `__contracts_12`, `__contracts_14`, `__contracts_43` only |
| Execution shared hit blocks | 65 |

The small difference in row count and sort memory from the earlier probe is
from the fresh local run; the plan still demonstrates static pruning. This
database is intentionally tiny, so these timings are evidence for query shape
and planning work, not a throughput benchmark for a 30,000+ transaction
testnet. Production-like PQS data should be measured separately before adding
indexes or changing the offset ordering.
