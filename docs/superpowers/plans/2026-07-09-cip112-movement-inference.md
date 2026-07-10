# CIP112 Movement Inference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inferred CIP112 token movement rows so the explorer can show history for V2 holding-based tokens that do not emit explicit V2 transfer events.

**Architecture:** Extend the backend token-movement pipeline to derive rows from update-local CIP112 holding lifecycle patterns instead of only explicit transfer templates. Keep the existing frontend transfer browser structure, but enrich token transfer rows with movement metadata so the same UI can render inferred rows safely.

**Tech Stack:** NestJS, TypeScript, Jest, existing PQS summary service, Vue frontend API types

---

## File Map

- Modify: `backend/src/domain/node.types.ts`
  - Add movement metadata to token transfer response types.
- Modify: `backend/src/pqs/pqs-summary.service.ts`
  - Add CIP112 inferred movement extraction.
  - Extend token transfer aggregation to include inferred rows.
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`
  - Add failing tests for inferred CIP112 movement rows.
- Modify: `frontend/src/types/tokens.ts`
  - Mirror new backend response fields.
- Modify: `frontend/src/lib/api.test.ts`
  - Update parsing expectations for movement metadata.
- Modify: `frontend/src/components/TokenTransfersBrowser.vue`
  - Render movement type pill in the existing list.
- Modify: `frontend/src/views/TokenTransferDetailView.vue`
  - Show movement type and source when available.
- Modify: `frontend/src/views/TokenTransferDetailView.test.ts`
  - Cover movement metadata rendering.

### Task 1: Add backend type coverage for inferred movement rows

**Files:**
- Modify: `backend/src/domain/node.types.ts`
- Test: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Write the failing backend test expectations**

Add test expectations asserting token transfer rows can include:
- `rowId`
- `movementType`
- `source`

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm test --workspace backend -- pqs-summary.service.spec.ts --runInBand --testNamePattern='CIP112 movement'`
Expected: FAIL because the response shape does not include movement metadata yet.

- [ ] **Step 3: Add minimal backend type fields**

Update `TokenTransferSummary` in `backend/src/domain/node.types.ts` with:
- `rowId: string`
- `movementType: string | null`
- `source: string`

- [ ] **Step 4: Run the targeted test again**

Run: `rtk npm test --workspace backend -- pqs-summary.service.spec.ts --runInBand --testNamePattern='CIP112 movement'`
Expected: still FAIL, but now on missing inference logic instead of missing types.

- [ ] **Step 5: Commit**

```bash
git add backend/src/domain/node.types.ts backend/test/pqs/pqs-summary.service.spec.ts
git commit -m "test: add token movement metadata expectations"
```

### Task 2: Add failing tests for inferred CIP112 movement extraction

**Files:**
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`
- Test: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Write a failing test for inferred holding transfer rows**

Add a test using an update shaped like offsets `122205` / `122155` / `122063`:
- consuming `TestUnderlyingHolding.TransferUnderlying`
- create `TestUnderlyingHolding`
- create `ShareHolding`

Assert the response emits:
- one `Holding Transfer` row for `USDCx`
- one `Share Mint` row for `vUSDCx-SHARE`

- [ ] **Step 2: Write a failing test for inferred mint rows**

Add a test using a `MintUnderlying` + create `TestUnderlyingHolding` update and assert one `Mint` row is emitted.

- [ ] **Step 3: Run the targeted backend tests**

Run: `rtk npm test --workspace backend -- pqs-summary.service.spec.ts --runInBand --testNamePattern='CIP112 movement|CIP112 mint'`
Expected: FAIL because the inference code does not exist yet.

- [ ] **Step 4: Commit**

```bash
git add backend/test/pqs/pqs-summary.service.spec.ts
git commit -m "test: cover inferred CIP112 token movements"
```

### Task 3: Implement CIP112 inferred movement extraction

**Files:**
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Test: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Isolate CIP112 transfer-row extraction behind dedicated helpers**

Add helpers in `backend/src/pqs/pqs-summary.service.ts` for:
- grouping update-local CIP112 events
- inferring mint rows
- inferring holding-transfer rows
- inferring share-mint rows

- [ ] **Step 2: Generate stable row ids**

Use a deterministic row id shape based on:
- `updateId`
- relevant `eventId`
- `templateId`
- `movementType`

- [ ] **Step 3: Add inferred row source tagging**

Set `source` to a fixed explicit value such as `pqs_inferred_holding_v2`.

- [ ] **Step 4: Wire inference into token transfer loading**

Extend the token transfer path so CIP112 updates can contribute inferred movement rows alongside existing explicit transfer rows.

- [ ] **Step 5: Keep unknown patterns silent**

If a CIP112 update does not match a safe rule, return no row for it.

- [ ] **Step 6: Run the targeted backend tests**

Run: `rtk npm test --workspace backend -- pqs-summary.service.spec.ts --runInBand --testNamePattern='CIP112 movement|CIP112 mint|token transfer'`
Expected: PASS for new CIP112 movement tests.

- [ ] **Step 7: Commit**

```bash
git add backend/src/pqs/pqs-summary.service.ts backend/test/pqs/pqs-summary.service.spec.ts
git commit -m "feat: infer CIP112 token movements from holding flows"
```

### Task 4: Update frontend types and API expectations

**Files:**
- Modify: `frontend/src/types/tokens.ts`
- Modify: `frontend/src/lib/api.test.ts`

- [ ] **Step 1: Add movement metadata to frontend token transfer types**

Mirror backend fields in `frontend/src/types/tokens.ts`.

- [ ] **Step 2: Update API parsing tests**

Add or update fixtures in `frontend/src/lib/api.test.ts` to include:
- `rowId`
- `movementType`
- `source`

- [ ] **Step 3: Run frontend API tests**

Run: `rtk npm test --workspace frontend -- api.test.ts --runInBand`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/tokens.ts frontend/src/lib/api.test.ts
git commit -m "test: accept token movement metadata in frontend api"
```

### Task 5: Render movement-type metadata in the transfer UI

**Files:**
- Modify: `frontend/src/components/TokenTransfersBrowser.vue`
- Modify: `frontend/src/views/TokenTransferDetailView.vue`
- Modify: `frontend/src/views/TokenTransferDetailView.test.ts`

- [ ] **Step 1: Write failing UI tests**

Add tests asserting:
- movement type pill renders in transfer rows
- movement type renders in transfer detail

- [ ] **Step 2: Run tests to verify failure**

Run: `rtk npm test --workspace frontend -- TokenTransferDetailView.test.ts TokensView.test.ts --runInBand`
Expected: FAIL because movement metadata is not rendered yet.

- [ ] **Step 3: Implement minimal UI rendering**

In `TokenTransfersBrowser.vue`:
- render a movement-type pill in each row when present

In `TokenTransferDetailView.vue`:
- render `movementType`
- render `source`

- [ ] **Step 4: Run the targeted frontend tests**

Run: `rtk npm test --workspace frontend -- TokenTransferDetailView.test.ts --runInBand`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/TokenTransfersBrowser.vue frontend/src/views/TokenTransferDetailView.vue frontend/src/views/TokenTransferDetailView.test.ts
git commit -m "feat: render inferred token movement metadata"
```

### Task 6: Verify end-to-end behavior against the live node

**Files:**
- Modify: none unless bugs are found

- [ ] **Step 1: Build the backend**

Run: `rtk npm run build --workspace backend`
Expected: successful Nest build

- [ ] **Step 2: Run targeted backend tests**

Run: `rtk npm test --workspace backend -- package-sync.service.spec.ts pqs-summary.service.spec.ts --runInBand --testNamePattern='CIP112|token movement|token transfer'`
Expected: PASS

- [ ] **Step 3: Run targeted frontend tests**

Run: `rtk npm test --workspace frontend -- api.test.ts TokenTransferDetailView.test.ts --runInBand`
Expected: PASS

- [ ] **Step 4: Verify live API output**

Check:
- `rtk curl -s http://localhost:4600/api/tokens`
- `rtk curl -s http://localhost:4600/api/tokens/USDCx/transfers`
- `rtk curl -s http://localhost:4600/api/tokens/vUSDCx-SHARE/transfers`

Expected:
- inferred movement rows exist
- rows include movement metadata
- `USDCx` and `vUSDCx-SHARE` both show history

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: verify inferred CIP112 token movements end to end"
```
