# Task 3 report — tune token discovery query

Commit: `perf: tune token discovery query`

Files changed:

- `backend/src/pqs/pqs-summary.service.ts`
- `backend/test/pqs/pqs-summary.service.spec.ts`
- `docs/performance/token-query-baseline.md`

Implementation:

- Added a per-node, five-minute cache of validated positive integer template
  type PKs, resolved from `__contract_tpe` using exact module/entity predicates
  and the CIP-112 module suffix predicate.
- Token discovery, holder, and transfer queries now embed the resolved literal
  `contract_row.tpe_pk in (...)` values. They retain the type-table join for
  the API template identifier.
- An empty or malformed lookup stays safe with `where false`; no SQL values are
  interpolated unless they are validated numeric PKs.
- No indexes, DDL, frontend changes, or cache/holder/transfer semantic changes
  were made.

TDD and verification:

- Added the query-shape test first and observed it fail because the type-PK
  lookup was absent.
- `npm test --workspace backend -- pqs-summary.service.spec.ts` — 116 passed.
- `npm run build --workspace backend` — passed.
- `git diff --check` — passed.

Read-only PQS result:

- Fresh `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` against local
  `pqs-app-provider` with PKs `(12, 14, 43)` scanned only three of 94 contract
  partitions and measured 1.740 ms planning / 0.381 ms execution. Full
  baseline, comparison, and small-dataset caveat are in
  `docs/performance/token-query-baseline.md`.
