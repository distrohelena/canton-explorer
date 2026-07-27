# Traffic Cost USD Estimate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a nullable, backend-calculated estimated USD traffic cost on recent update rows and update details using each node's latest traffic purchase and the CC market price for that purchase's UTC day.

**Architecture:** Add a focused backend estimator that caches the multi-venue Canton Coin history, selects the same-quote USDT daily median, and performs exact scaled-integer arithmetic. `PqsSummaryService` supplies update-level `paid_traffic_cost` and the latest decoded traffic purchase, then attaches the resulting `estimatedTrafficUsd` to node, global, party, namespace, and detail responses. The frontend renders the always-present nullable field in the existing updates table, namespace list, and update summary; search-result rows remain unchanged.

**Tech Stack:** NestJS, TypeScript, PostgreSQL/PQS SQL, `BigInt` scaled decimals, Vue 3, Vitest, Jest.

---

## File Map

- Create `backend/src/traffic/traffic-cost-estimate.service.ts` for cached market history, same-quote median selection, exact arithmetic, and failure-to-`null` behavior.
- Create `backend/test/traffic/traffic-cost-estimate.service.spec.ts` for calculator, median, cache, and invalid-input tests.
- Modify `backend/src/app.module.ts` to register the estimator.
- Modify `backend/src/domain/node.types.ts` to expose nullable list/detail estimate fields.
- Modify `backend/src/pqs/pqs-summary.service.ts` to select text `paid_traffic_cost`, calculate estimates for recent/detail paths, and preserve them through global/party/namespace responses.
- Modify `backend/test/pqs/pqs-summary.service.spec.ts` and, where useful, `backend/test/api/nodes.controller.spec.ts` for query and response integration coverage.
- Modify `frontend/src/types/updates.ts` and `frontend/src/types/namespaces.ts` for the always-present nullable API fields.
- Modify `frontend/src/components/UpdatesBrowser.vue`, `frontend/src/views/UpdateDetailView.vue`, `frontend/src/views/NamespaceDetailView.vue`, and `frontend/src/styles.css` for rendering and responsive layout.
- Modify `frontend/src/views/UpdateDetailView.test.ts` and `frontend/src/views/NamespaceDetailView.test.ts`; add `frontend/src/components/UpdatesBrowser.test.ts` if the existing component has no direct test file.

## Backend

### Task 1: Add the failing estimator tests

**Files:**
- Create: `backend/test/traffic/traffic-cost-estimate.service.spec.ts`

- [ ] **Step 1: Write the failing unit tests.** Cover:
  - two eligible USDT venue closes on the purchase UTC day produce their median;
  - a third close makes the median calculation deterministic for odd counts;
  - a non-USDT venue is ignored;
  - fewer than two eligible closes, missing day data, non-positive inputs, malformed decimals, and non-finite prices return `null`;
  - a known calculation returns a two-decimal USD string with half-up cent rounding;
  - `paid_traffic_cost` and `purchasedTraffic` are treated as the same byte-equivalent traffic-unit scale;
  - one history fetch is reused within the cache lifetime, while a failed refresh uses still-valid cached history and an expired cache returns `null`.

- [ ] **Step 2: Run the focused test file and verify it fails for the missing service/behavior.**

Run: `npm run test --workspace backend -- --runInBand test/traffic/traffic-cost-estimate.service.spec.ts`

Expected: FAIL because the estimator module and implementation do not exist yet.

### Task 2: Implement the estimator and register it

**Files:**
- Create: `backend/src/traffic/traffic-cost-estimate.service.ts`
- Modify: `backend/src/app.module.ts`
- Test: `backend/test/traffic/traffic-cost-estimate.service.spec.ts`

- [ ] **Step 1: Implement market-day lookup.** Inject `CantonCoinPriceService`, cache a successful history for a short fixed TTL, and use a still-valid cached response when refresh fails. Filter candles to quote `USDT`, group by the purchase record's UTC `YYYY-MM-DD`, require at least two venue closes, compute the median, reject invalid/non-positive values, and quantize the numeric median with `toFixed(8)` before parsing it as an exact decimal.

- [ ] **Step 2: Implement exact USD arithmetic.** Parse `paidTrafficCost` and `purchasedTraffic` as non-negative/positive integer `BigInt`s, parse `amuletPaid` and the eight-decimal price as scaled decimal integers, calculate `paidTrafficCost * amuletPaid / purchasedTraffic * dailyPrice`, round to cents using half-up integer division, and return a stable two-decimal string or `null`.

- [ ] **Step 3: Add the service to `AppModule.providers`.** Keep the service independent of `PqsSummaryService`; it should accept the latest purchase and raw paid traffic cost as inputs so the existing purchase-decoding path remains the source of node data.

- [ ] **Step 4: Run the focused test file and verify it passes.**

Run: `npm run test --workspace backend -- --runInBand test/traffic/traffic-cost-estimate.service.spec.ts`

Expected: PASS.

### Task 3: Expose estimates from PQS update responses

**Files:**
- Modify: `backend/src/domain/node.types.ts`
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`
- Modify: `backend/test/api/nodes.controller.spec.ts` if response-contract assertions need updating

- [ ] **Step 1: Write failing integration assertions.** Add expectations that recent-update and single-update SQL select `tx.paid_traffic_cost::text`, that a node recent update gets `estimatedTrafficUsd`, that global merge preserves it, and that detail returns it as a top-level field. Add a test that estimator/purchase failures leave the update response present with `estimatedTrafficUsd: null`.

- [ ] **Step 2: Add nullable response fields.** Add `estimatedTrafficUsd: string | null` to `NodeRecentUpdate`, `PartyRecentUpdate`, and `NodeUpdateDetailResponse`; `GlobalRecentUpdate` inherits it, and `NamespaceDetailResponse.recentUpdates` carries it through `PartyRecentUpdate`.

- [ ] **Step 3: Thread raw paid traffic cost through query rows.** Extend internal update row types and both recent/single query projections with `tx.paid_traffic_cost::text`; keep the raw field internal, do not add it to the public list/detail fields, and leave unrelated existing `meta` behavior unchanged.

- [ ] **Step 4: Attach estimates in `fetchRecentUpdates`.** Fetch the latest overall traffic purchase once per node with the existing descending `fetchTrafficPurchases` path, call the estimator for each returned update using its `paid_traffic_cost`, and map missing or failed inputs to `null` without dropping rows.

- [ ] **Step 5: Preserve estimates through aggregation.** Copy `estimatedTrafficUsd` while merging global updates and while building party and namespace recent-update responses, including the `PartyRecentUpdate`/`NamespaceDetailResponse` type path. Do not recalculate per merge or for search-result rows.

- [ ] **Step 6: Cover the direct party-detail path.** Extend `pqsPartyRecentUpdatesQuery` with `tx.paid_traffic_cost::text`, fetch the same latest-overall node purchase, calculate each row through the estimator, and return `estimatedTrafficUsd: null` on query/purchase/market failures without dropping rows. Add a focused `fetchPartyDetail` assertion so this path cannot silently diverge from the global party updates path.

- [ ] **Step 7: Attach the detail estimate.** Use the single update row's paid traffic cost and the same node-wide latest purchase, return `estimatedTrafficUsd` at the response top level, and keep `meta` compatible with its existing transaction metadata.

- [ ] **Step 8: Run the focused backend suites and verify they pass.**

Run: `npm run test --workspace backend -- --runInBand test/pqs/pqs-summary.service.spec.ts test/api/nodes.controller.spec.ts`

Expected: PASS, including the existing recent-update, global-update, namespace, and detail tests.

## Frontend

### Task 4: Add response types and failing UI assertions

**Files:**
- Modify: `frontend/src/types/updates.ts`
- Modify: `frontend/src/types/namespaces.ts`
- Modify: `frontend/src/components/UpdatesBrowser.test.ts` (create if absent)
- Modify: `frontend/src/views/UpdateDetailView.test.ts`
- Modify: `frontend/src/views/NamespaceDetailView.test.ts`

- [ ] **Step 1: Add nullable response fields to TypeScript types.** Add `estimatedTrafficUsd: string | null` to node/global update entries, update detail, and namespace recent updates.

- [ ] **Step 2: Write failing UI assertions.** Assert that a populated estimate renders as `$12.34` (or the chosen stable currency presentation) in the updates table, namespace recent-update row, and detail summary, and that `null` renders as `—`. Keep row links/navigation assertions intact.

- [ ] **Step 3: Run the focused frontend tests and verify they fail for the missing column/items.**

Run: `npm run test --workspace frontend -- --run frontend/src/components/UpdatesBrowser.test.ts frontend/src/views/UpdateDetailView.test.ts frontend/src/views/NamespaceDetailView.test.ts`

Expected: FAIL because the estimate is not rendered yet.

### Task 5: Render estimates in all requested views

**Files:**
- Modify: `frontend/src/components/UpdatesBrowser.vue`
- Modify: `frontend/src/views/UpdateDetailView.vue`
- Modify: `frontend/src/views/NamespaceDetailView.vue`
- Modify: `frontend/src/styles.css`
- Test: `frontend/src/components/UpdatesBrowser.test.ts`, `frontend/src/views/UpdateDetailView.test.ts`, `frontend/src/views/NamespaceDetailView.test.ts`

- [ ] **Step 1: Add the updates-table column.** Render an `Est. USD` header and cell from `estimatedTrafficUsd`, preserving click/keyboard behavior and displaying `—` for `null`.

- [ ] **Step 2: Update responsive grid styles.** Add the estimate column to the existing `node-updates__row` grid and its mobile breakpoint without changing the page width or existing column behavior.

- [ ] **Step 3: Add the update-detail summary item.** Add `Estimated traffic cost` to the summary grid and format the stable backend string as USD, with `—` for `null`.

- [ ] **Step 4: Add the namespace-row estimate.** Show the same USD value beside the existing timestamp metadata while preserving the node update detail link.

- [ ] **Step 5: Run the focused frontend tests and verify they pass.**

Run: `npm run test --workspace frontend -- --run frontend/src/components/UpdatesBrowser.test.ts frontend/src/views/UpdateDetailView.test.ts frontend/src/views/NamespaceDetailView.test.ts`

Expected: PASS.

## Verification

### Task 6: Run complete checks and inspect the diff

**Files:**
- Review all modified files above; no additional product files are expected.

- [ ] **Step 1: Run backend tests.**

Run: `npm run test --workspace backend -- --runInBand`

Expected: all backend suites pass.

- [ ] **Step 2: Run frontend tests.**

Run: `npm run test --workspace frontend -- --run`

Expected: all frontend suites pass.

- [ ] **Step 3: Run the workspace build.**

Run: `npm run build`

Expected: backend and frontend builds pass.

- [ ] **Step 4: Run formatting/diff checks.**

Run: `npx prettier --check backend/src/traffic/traffic-cost-estimate.service.ts backend/src/app.module.ts backend/src/domain/node.types.ts backend/src/pqs/pqs-summary.service.ts backend/test/traffic/traffic-cost-estimate.service.spec.ts backend/test/pqs/pqs-summary.service.spec.ts backend/test/api/nodes.controller.spec.ts frontend/src/types/updates.ts frontend/src/types/namespaces.ts frontend/src/components/UpdatesBrowser.vue frontend/src/components/UpdatesBrowser.test.ts frontend/src/views/UpdateDetailView.vue frontend/src/views/UpdateDetailView.test.ts frontend/src/views/NamespaceDetailView.vue frontend/src/views/NamespaceDetailView.test.ts frontend/src/styles.css && git diff --check && git status --short`

Expected: the touched files are formatted, the diff has no whitespace errors, and `git status --short` confirms the newly created estimator files are included in the review.

- [ ] **Step 5: Review the final diff for scope.** Confirm that only the approved traffic estimate behavior was added, that search results remain unchanged, and that no raw `paidTrafficCost` leaks into public list/detail response fields.
