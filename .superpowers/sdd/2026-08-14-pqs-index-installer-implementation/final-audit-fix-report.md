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

## Final-audit round 2: total active-contract order

Implementation commit: `3998789 fix: complete active contract pagination order`

The active-contract keyset is now the total order
`(created_at_ix, create_event_pk, contract_id)`. New `acs1.` cursors include
`contractId`; both `before` and `after` predicates and both query orderings use
all three keys. A prior `acs1.` payload without `contractId` is treated as a
legacy numeric-offset cursor rather than assigning a guessed text sentinel.

The active-contract partial index and bounded inspect plan now cover the same
three-key order. The schema validation requires PQS `__contracts.contract_id`
to be `text` before managing that index.

Round-2 evidence:

| Command | Result |
| --- | --- |
| Initial new regression run | failed as expected: cursor lacked `contractId`, two-key index/order remained, and pre-total `acs1` did not use legacy fallback |
| `npm test --workspace backend -- pqs-summary.service.spec.ts pqs-index-sql.spec.ts pqs-index-installer.spec.ts` | 3 suites, 144 tests passed |
| `npm run build --workspace backend` | passed |
| `node --test scripts/pqs-index-installer.test.mjs` | 2 tests passed, 0 failed, duration 6197 ms |
| `git diff --check` | passed (no output, exit 0) |

The pagination regression puts `00z` and `00y` in the same
`(created_at_ix, create_event_pk)` pair with a page limit of one. It verifies
the older page receives `00y` after `00z` without a duplicate or skip, then
uses `after` to return to `00z` with the three-key greater-than predicate.

## Final-audit round 3: safe repair and bounded update candidates

Date: 2026-08-14

Commit subject: `fix: complete PQS installer final audit`

### Findings resolved

1. Index-definition mismatch now takes precedence over PostgreSQL validity and
   readiness flags. A same-name index whose complete expected definition does
   not match is always classified as `conflict`. Both `indexes apply` and
   `indexes repair` reject it before migration-table, create-index, drop-index,
   or migration-version DDL. Repair continues to drop only invalid indexes
   whose complete definition matches Explorer's expectation.
2. Party and template update filtering is now driven by an ordered, limited
   transaction candidate CTE. Every contract-create, contract-archive, and
   exercise probe is correlated to that transaction, repeats the selected
   event-index cursor bound, and has its own matching `ORDER BY` direction and
   top-N `LIMIT`. Correlating exact probes to the transaction page preserves OR
   and AND party semantics, including parties witnessed by different events in
   one update, and preserves the intersection of independently supplied party
   and template filters.
3. Explorer migration `004-update-event-order` adds descending B-tree indexes
   for `created_at_ix` and `archived_at_ix` on every physical contracts
   partition and `exercised_at_ix` on every physical exercises partition.
   Indexes use `CREATE INDEX CONCURRENTLY`; no PQS-owned schema object or Flyway
   history is changed.

### TDD evidence

- Safe-repair RED: the new installer regression failed 1/13 tests because an
  invalid mismatched index was reported as `Invalid ... requires explicit
  indexes repair` instead of a conflict. The test also guards both apply and
  repair against persistent DDL.
- Bounded-candidate RED: the focused three-suite run failed 8/148 tests. The
  generated SQL lacked materialized bounded candidates, branch cursor bounds,
  branch ordering/limits, exact AND probes, migration `004`, and six expected
  physical order indexes (7 statements were applied instead of 13).
- PostgreSQL RED: after the safe-conflict fixture was aligned with the first
  finding, the disposable PostgreSQL test reached the new assertion and failed
  because `canton_explorer_contracts_29_created_at_ix_order` did not exist.
- GREEN used the smallest behavior changes: one classification-precedence
  change, one new index migration, and replacement of the unbounded event CTEs
  with correlated bounded probes.

### Final verification

| Command | Result |
| --- | --- |
| `npm test --workspace backend -- --runInBand test/indexes/pqs-index-sql.spec.ts test/indexes/pqs-index-installer.spec.ts test/pqs/pqs-summary.service.spec.ts` | 3 suites, 148 tests passed |
| `npm test --workspace backend -- --runInBand` | 36 suites, 436 tests passed |
| `npm test --workspace frontend` | 55 files, 445 tests passed |
| `npm run build --workspace backend` | passed |
| `node --test scripts/pqs-index-installer.test.mjs` | 3 tests passed |
| `git diff --check` | passed (no output) |

The PostgreSQL integration creates 20,000 historical contracts/transactions,
executes the actual generated SQL for forward OR and backward AND pagination
with combined party/template filters, and verifies exact returned offsets and
parties. Its bounded representative plan names
`canton_explorer_contracts_29_created_at_ix_order`. The installer portion also
verifies both commands preserve an invalid mismatched index, installs 13
Explorer indexes across physical partitions, records four Explorer migration
versions, and remains idempotent.

The first full-backend attempt inside the restricted sandbox failed only
because existing Supertest suites could not bind an ephemeral local listener
(`listen EPERM`). The permitted rerun produced the 436/436 passing result above.
Expected Node experimental warnings and the existing mocked gRPC refresh log
were present; neither caused a test failure.

### Changed paths

- `backend/src/indexes/pqs-index-installer.ts`
- `backend/src/indexes/pqs-index-sql.ts`
- `backend/src/pqs/pqs-summary.service.ts`
- `backend/test/indexes/pqs-index-installer.spec.ts`
- `backend/test/indexes/pqs-index-sql.spec.ts`
- `backend/test/pqs/pqs-summary.service.spec.ts`
- `scripts/pqs-index-installer.test.mjs`
- `.superpowers/sdd/2026-08-14-pqs-index-installer-implementation/final-audit-fix-report.md`

### Concerns

- Migration `004` intentionally increases index count and therefore consumes
  additional disk and concurrent-build I/O on large PQS partitions. Application
  remains an explicit operator action and uses concurrent index creation.
- Exact highly selective AND/intersection filters may still inspect many
  transactions before finding a full page. They no longer enumerate all
  historical matching event rows up front; each event branch is cursor-bounded,
  index-backed, and top-N limited. The 20,000-row exactness regression completed
  successfully.

## Final-audit round 4: genuine event candidate bounds (P1 re-review)

Date: 2026-08-14

### Investigation and correction

The scoped re-review was correct: round 3's `filtered_update_ix` first scanned
`__transactions`, and every supposed event candidate branch included
`event_ix = tx.ix`. Its branch ordering and limit therefore only applied to the
already selected transaction rows; it was not a historical event-candidate
bound.

The replacement builds uncorrelated event candidates directly from
`__contracts` (create and archive) and `__exercises`. Every branch now applies
the event-index cursor window, its party/template/visibility match, `select
distinct ... as update_ix`, direction-specific event ordering, and the branch
top-N limit before any transaction join. Party filters produce an independent
candidate CTE per party and use `union` for OR or `intersect` for AND. Template
filters produce a separate candidate CTE; combined filters join those CTEs.
When template and/or `hideSplice` filters are present, their bounded candidate
set also seeds the party branches, preventing the selected visibility/template
window from being crowded out before the party intersection. `hideSplice` is
now selected through a bounded `visible_update_ix` CTE rather than an outer
per-transaction event lookup. The outer update query starts at the final
candidate CTE and then joins `__transactions` by ix.

The safe-repair change from round 3 remains intact and was not modified.

### TDD and integration evidence

- RED before production changes: `npm test --workspace backend -- --runInBand
  test/pqs/pqs-summary.service.spec.ts` failed 4 new assertions. The generated
  SQL had only `party_update_ix`, scanned transactions first, and still
  contained `contract_row.created_at_ix = tx.ix` (and the archive/exercise
  equivalents).
- The first PostgreSQL pass exposed an AND exactness case on the 20,000-row
  fixture: Alice's newest bulk rows initially hid the older Alice+Bob update.
  Template/visibility candidate seeding was added before the per-party
  intersection; the exact backward combined-filter assertion then returned the
  expected offset 1000 with both parties.
- The integration regression captures the actual filtered SQL issued by
  `fetchRecentUpdates`, verifies that it starts from `filtered_update_ix`, and
  rejects every former `event_ix = tx.ix` correlation. It runs `EXPLAIN
  (ANALYZE, FORMAT JSON)` against that exact SQL, asserts physical use of
  `canton_explorer_contracts_29_created_at_ix_order`, and asserts an event-index
  scan and a `Limit` node each produce no more than the three candidate rows.

### Round-4 verification

| Command | Result |
| --- | --- |
| New focused regression before implementation | RED: 1 suite, 4 failing new assertions (expected) |
| `npm test --workspace backend -- --runInBand test/pqs/pqs-summary.service.spec.ts` | 1 suite, 127 tests passed |
| `npm test --workspace backend -- --runInBand test/indexes/pqs-index-sql.spec.ts test/indexes/pqs-index-installer.spec.ts test/pqs/pqs-summary.service.spec.ts` | 3 suites, 148 tests passed |
| `npm run build --workspace backend` | passed |
| `node --test scripts/pqs-index-installer.test.mjs` | 3 tests passed; captured-query EXPLAIN/index/bounded-work regression passed |
| `npm test --workspace backend -- --runInBand` | 36 suites, 436 tests passed |
| `npm test --workspace frontend` | 55 files, 445 tests passed |

### Round-4 changed paths

- `backend/src/pqs/pqs-summary.service.ts`
- `backend/test/pqs/pqs-summary.service.spec.ts`
- `scripts/pqs-index-installer.test.mjs`
- `.superpowers/sdd/2026-08-14-pqs-index-installer-implementation/final-audit-fix-report.md`

## Final-audit round 5: progressive exact update candidates

Date: 2026-08-14

### Root cause and repair

The round-4 fixed candidate cap was not exact for intersections. If a bounded
party/template stream contained newer Alice-only updates, an older update shared
by Alice and Bob could be absent before the `intersect`, even though it was a
valid result for the requested page.

`fetchRecentUpdates` now coordinates progressive internal candidate batches.
Every create/archive/exercise branch remains directly event-backed, cursor
bounded, direction ordered, distinct by update ix, and top-N limited. Each
branch also issues a bounded one-row overflow probe at its candidate boundary.
The generated candidate CTE exposes whether any branch has another candidate;
the service doubles only the internal candidate batch and reruns until it has a
complete `limit + 1` page or every branch reports exhaustion. This is an
internal multi-query detail: no public API/configuration behavior changed.

The overflow probes use the same event-ordering access path and distinct update
ix semantics as the candidate branches. This prevents multiple event rows in
one update from falsely reporting an additional update candidate. The outer
transaction selection continues to begin at the materialized candidate set.
Safe-repair/index-installation code remains untouched.

### TDD and plan evidence

- RED: the PostgreSQL fixture now has three newer Alice-only `Main:Asset`
  updates and one older Alice+Bob update at shared ix 100. With `limit: 2`, the
  old fixed-cap SQL returned no result for backward pagination before 130004.
- GREEN: both `after: 999` and `before: 130004` return the older offset 1000
  exactly once with parties Alice and Bob. Each direction records two generated
  candidate SQL batches (`limit 3`, then `limit 6`).
- The generated-SQL integration captures the real filtered query, rejects the
  former transaction correlation, verifies all nine party/template
  create/archive/exercise candidate branches and all nine overflow probes, and
  runs `EXPLAIN (ANALYZE, FORMAT JSON)`. The plan uses
  `canton_explorer_contracts_29_created_at_ix_order`, contains at least nine
  bounded `Limit` nodes, and every such node returns at most the three-row batch.

### Round-5 verification

| Command | Result |
| --- | --- |
| New PostgreSQL counterexample before implementation | RED: backward AND returned `[]` instead of offset 1000 |
| `npm test --workspace backend -- --runInBand test/pqs/pqs-summary.service.spec.ts` | 1 suite, 127 tests passed |
| `npm test --workspace backend -- --runInBand test/indexes/pqs-index-sql.spec.ts test/indexes/pqs-index-installer.spec.ts test/pqs/pqs-summary.service.spec.ts` | 3 suites, 148 tests passed |
| `npm run build --workspace backend` | passed |
| `node --test scripts/pqs-index-installer.test.mjs` | 3 tests passed; exact two-direction batching and all-branch EXPLAIN checks passed |
| `npm test --workspace backend -- --runInBand` | 36 suites, 436 tests passed |

### Round-5 changed paths

- `backend/src/pqs/pqs-summary.service.ts`
- `backend/test/pqs/pqs-summary.service.spec.ts`
- `scripts/pqs-index-installer.test.mjs`
- `.superpowers/sdd/2026-08-14-pqs-index-installer-implementation/final-audit-fix-report.md`

## Final-audit round 6: exact frontier completeness

Date: 2026-08-14

### Root cause and repair

The round-5 stop condition was still unsafe because it returned as soon as an
intersection produced `limit + 1` transactions. A different physical event
branch could already supply those older matches while a create/archive/exercise
branch still had a first-unseen match that outranked the returned page boundary.

Every distinct, cursor-windowed physical create/archive/exercise candidate
branch now exposes its first unseen `update_ix` after the current candidate
limit. `candidate_progress` combines the template, visible, and party branch
frontiers, including the template/visible candidate sources that constrain the
party branches, and selects the largest frontier for descending pages or the
smallest frontier for ascending pages. The final transaction query returns both
`tx.ix` and that aggregate frontier while retaining the transaction-offset
cursor predicate at the final join.

`queryRecentUpdateMetaRows` doubles the internal candidate batch when fewer than
`limit + 1` updates are present and a frontier remains. For a full lookahead
result, it compares the frontier with the actual `limit`-row page boundary and
retries only when the frontier can still outrank that boundary. Equality and a
frontier behind the boundary are complete. No arbitrary maximum batch was
introduced.

The safe-repair implementation, index definitions, npm command behavior,
Docker/Compose behavior, and public API remain unchanged.

### TDD evidence

- RED unit SQL evidence:
  `npm test --workspace backend -- --runInBand test/pqs/pqs-summary.service.spec.ts`
  failed the forward and backward generated-query cases because the old SQL had
  only boolean `has_more` metadata, not the required `min(update_ix)` /
  `max(update_ix)` frontier and transaction ix metadata.
- RED PostgreSQL evidence: `node --test scripts/pqs-index-installer.test.mjs`
  reported 2 passed and 2 failed. The combined frontier regression showed both
  unsafe pages in one assertion:
  - ascending actual `141002, 141001`; required `141001, 140004`;
  - descending actual `129003, 129002`; required `130000, 129003`.
- GREEN: both direction-specific `limit: 2` queries issue candidate batches 3
  then 6, return the frontier-crossing shared `Main:Asset` update exactly once,
  and preserve the correct second update.

### Generated-query and EXPLAIN evidence

The existing 20,000-row PostgreSQL fixture remains in place. It now asserts all
nine party/template create/archive/exercise candidate branches have `LIMIT 3`,
all nine first-unseen probes have `OFFSET 3 LIMIT 1`, and the query emits the
directional frontier plus transaction ix metadata. The actual generated query
is still run with `EXPLAIN (ANALYZE, FORMAT JSON)`.

The test does not require PostgreSQL to choose a universal plan. For this
integration fixture it verifies that the Explorer-owned physical event-order
index is exercised by both a complete three-row candidate traversal and the
four-row traversal needed to expose the first unseen row, while every planned
candidate/frontier `Limit` remains bounded.

### Round-6 verification

| Command | Result |
| --- | --- |
| `npm test --workspace backend -- --runInBand test/pqs/pqs-summary.service.spec.ts` | 1 suite, 127 tests passed |
| `npm test --workspace backend -- --runInBand test/indexes/pqs-index-sql.spec.ts test/indexes/pqs-index-installer.spec.ts test/pqs/pqs-summary.service.spec.ts` | 3 suites, 148 tests passed |
| `npm run build --workspace backend` | passed |
| `node --test scripts/pqs-index-installer.test.mjs` | 4 tests passed; both-direction frontier regression and 20k-row generated-query EXPLAIN passed |
| `npm test --workspace backend -- --runInBand` | 36 suites, 436 tests passed |
| `npm test --workspace frontend` | 55 files, 445 tests passed |
| Independent uncommitted-diff review | no actionable correctness findings |

The first sandboxed full-backend attempt was blocked when Supertest tried to
bind `0.0.0.0` (`listen EPERM`). The unchanged command passed when rerun with
the required local-listener permission; this was an environment restriction,
not a test failure.

### Round-6 changed paths

- `backend/src/pqs/pqs-summary.service.ts`
- `backend/test/pqs/pqs-summary.service.spec.ts`
- `scripts/pqs-index-installer.test.mjs`
- `.superpowers/sdd/2026-08-14-pqs-index-installer-implementation/final-audit-fix-report.md`

## Final-audit round 7: frontier evidence hardening

Date: 2026-08-14

### Scoped coverage repair

This round changes only test coverage, the PostgreSQL test fixture, and this
report. Production code, index definitions, npm behavior, and Docker behavior
are unchanged.

The focused service regression generates a descending compound query with
party AND (`Alice`, `Bob`), `Main:Asset`, and `hideSplice`. It requires four
candidate/frontier sources for every create/archive/exercise physical branch:
template, visible, Alice, and Bob. In particular, it requires all four
`OFFSET 3 LIMIT 1` first-unseen probes, so removing visible-frontier
aggregation removes one probe per branch and fails the test.

The end-to-end PostgreSQL regression adds three hidden `Splice.Hidden:*`
events, then three newer visible `Other:Bulk` creates, then the shared
`Main:Asset` create at ix 70000 as the visible-create branch's first unseen
row. The page also has three older shared `Main:Asset` archives. For
`before: 170007`, `limit: 2`, party AND, template, and `hideSplice`, the first
candidate batch is deliberately capable of returning the older shared updates;
only the visible frontier at 70000 outranks that page boundary. The service
therefore retries from candidate limit 3 to 6 and returns offsets `170000`,
`169003`, without exposing hidden Splice updates.

The 20,000-row generated-query EXPLAIN fixture now includes a duplicate
`Other:Bulk` event row at update ix 1001. It collects every scan of the
Explorer physical created-at order index, preserves scans with `Actual Loops`
greater than one, and confirms each scan has a generated `Limit` ancestor.
For every scan it bounds loops, rows examined per loop, total rows examined,
`Rows Removed by Filter`, and `Rows Removed by Index Recheck` by the candidate
batch, first-unseen row, and the deliberate duplicate. It separately confirms
the direct single-pass candidate/frontier order traversals while retaining the
repeated scans in the same accounting. This asserts bounded work without
prescribing unrelated PostgreSQL planner choices.

### RED/GREEN evidence

- RED focused SQL mutation: temporarily deleting
  `frontierQueries.push(visibleCandidates.frontierSql)` made the service test
  observe three first-unseen probes instead of the required four.
- RED end-to-end mutation: rebuilding with that same temporary deletion made
  the compound PostgreSQL page return `169003, 169002` instead of the required
  `170000, 169003`.
- GREEN: after restoring the existing aggregation, the focused service test,
  complete backend suite, and all five PostgreSQL integration tests passed.

### Round-7 verification

| Command | Result |
| --- | --- |
| Focused mutation service test | RED: expected 4 probes, received 3 after deleting visible aggregation |
| Targeted mutation integration test | RED: actual offsets `169003, 169002`; required `170000, 169003` |
| `npm run build --workspace backend` | passed after restoration |
| `npm test --workspace backend -- --runInBand` | 36 suites, 437 tests passed |
| `node --test scripts/pqs-index-installer.test.mjs` | 5 tests passed; compound visible frontier and generated-query EXPLAIN checks passed |

### Round-7 changed paths

- `backend/test/pqs/pqs-summary.service.spec.ts`
- `scripts/pqs-index-installer.test.mjs`
- `.superpowers/sdd/2026-08-14-pqs-index-installer-implementation/final-audit-fix-report.md`

## Final-audit round 8: planner-neutral frontier evidence

Date: 2026-08-14

### Re-review correction

This round changes tests and this report only. Production source, npm behavior,
Docker behavior, and the hide-Splice mutation regression are unchanged.

The prior EXPLAIN assertion treated any `Limit` ancestor as evidence that a
physical event-order scan was locally bounded. A deliberate RED ancestry
diagnostic showed every observed scan started beneath the root page `Limit`
(for example, `Limit > Unique > Merge Append > ...`), so that predicate could
pass even if it learned nothing about the branch's local candidate window.
The ancestry check and plan-node-count assertions were removed.

Generated SQL now directly proves every physical branch shape. For each
create/archive/exercise column, the tests require every candidate branch to be
a local `SELECT DISTINCT ... ORDER BY ... LIMIT 3` and every overflow probe to
be a local `SELECT DISTINCT ... ORDER BY ... OFFSET 3 LIMIT 1`. The compound
party/template/hide-Splice service regression requires all four sources
(template, visible, Alice, Bob) to have that local shape, preserving the
visible-frontier deletion mutation coverage.

The actual generated-query `EXPLAIN (ANALYZE, FORMAT JSON)` still identifies
every observed Explorer event-order index scan. For each such scan it accepts
one or many loops and zero or nonzero filter/recheck removals, validates all
reported metrics are finite and non-negative, and bounds total examined work
as `Actual Loops * (Actual Rows + Rows Removed by Filter + Rows Removed by
Index Recheck)`. The explicit fixture bound remains 15 physical rows: a
three-row candidate batch times its candidate/first-unseen/duplicate window of
five rows. No assertion requires a repeated loop, a filter removal, or a
specific number of plan `Limit` nodes.

### Round-8 verification

| Command | Result |
| --- | --- |
| Temporary ancestry diagnostic | RED: every observed order scan inherited the root page `Limit`, proving the prior ancestry assertion was vacuous |
| `npm test --workspace backend -- --runInBand test/pqs/pqs-summary.service.spec.ts -t "keeps visible frontiers in compound party/template/hide-splice candidate progress"` | 1 focused test passed |
| `node --test scripts/pqs-index-installer.test.mjs` | 5 tests passed; planner-neutral observed-scan accounting and hide-Splice page regression passed |
| `npm test --workspace backend -- --runInBand` | 36 suites, 437 tests passed |

### Round-8 changed paths

- `backend/test/pqs/pqs-summary.service.spec.ts`
- `scripts/pqs-index-installer.test.mjs`
- `.superpowers/sdd/2026-08-14-pqs-index-installer-implementation/final-audit-fix-report.md`
