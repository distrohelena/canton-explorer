# Token Holder Extractors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add schema-aware token holder extraction so `canton-coin` holders are built from active `Splice.Amulet:Amulet` contracts and balances are summed per party without double-counting cross-node duplicates.

**Architecture:** Extend the backend holder pipeline to query all supported holder-bearing templates, normalize each row through explicit schema-aware extractors, and aggregate by `(tokenId, partyId)` while deduping repeated observations of the same underlying active contract using a stable contract identity.

**Tech Stack:** NestJS, TypeScript, Jest

---

### Task 1: Add failing backend coverage for generic holder extractors

**Files:**
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Write failing tests for Amulet-based Canton Coin holders**

Add tests that assert:
- active `Splice.Amulet:Amulet` rows produce `canton-coin` holders
- multiple active Amulets for the same party sum together
- the same underlying contract observed from two nodes is deduped, not summed twice

- [ ] **Step 2: Run the targeted holder tests to verify they fail**

Run: `rtk npm test --workspace backend -- test/pqs/pqs-summary.service.spec.ts`

Expected: FAIL because only `HoldingV1` rows are considered holders today.

- [ ] **Step 3: Implement the minimal test fixtures**

Use decoded Amulet values with:
- `owner`
- `amount.initialAmount`

and include repeated cross-node observations of the same active contract to lock down dedupe behavior.

- [ ] **Step 4: Re-run the targeted holder tests**

Run: `rtk npm test --workspace backend -- test/pqs/pqs-summary.service.spec.ts`

Expected: still FAIL until production code is implemented.

### Task 2: Implement schema-aware holder extraction and aggregation

**Files:**
- Modify: `backend/src/pqs/pqs-summary.service.ts`

- [ ] **Step 1: Add stable contract identity to token-holder query rows**

Extend the token holder row shape and SQL query so holder normalization can see a stable `contract_id`.

- [ ] **Step 2: Expand holder queries to all supported holder-bearing templates**

Include:
- `Splice.Api.Token.HoldingV1:Holding`
- `Splice.Amulet:Amulet`

- [ ] **Step 3: Implement explicit holder extractors**

Support:
- `HoldingV1`
  - `tokenId = instrumentId.id`
  - `partyId = owner`
  - `amount = amount`
- `Amulet`
  - `tokenId = canton-coin`
  - `partyId = owner`
  - `amount = amount.initialAmount`

- [ ] **Step 4: Aggregate holders by `(tokenId, partyId)` with contract-level dedupe**

For each grouped holder:
- dedupe repeated observations of the same `contract_id`
- sum the distinct active balances
- keep observing nodes deduped

- [ ] **Step 5: Run the targeted holder tests to verify they pass**

Run: `rtk npm test --workspace backend -- test/pqs/pqs-summary.service.spec.ts`

Expected: PASS

### Task 3: Verify the existing token holder API still behaves correctly

**Files:**
- Modify: `backend/test/api/nodes.controller.spec.ts` only if API contract assertions need refresh

- [ ] **Step 1: Run controller and service token tests together**

Run: `rtk npm test --workspace backend -- test/pqs/pqs-summary.service.spec.ts test/api/nodes.controller.spec.ts`

Expected: PASS

- [ ] **Step 2: Confirm no API shape changes are needed**

The existing frontend contract should remain:
- `tokenId`
- `holders[]`
- `partyId`
- `amount`
- `nodes[]`

- [ ] **Step 3: Review diff for intended backend-only changes**

Run: `rtk git diff -- backend/src/pqs/pqs-summary.service.ts backend/test/pqs/pqs-summary.service.spec.ts backend/test/api/nodes.controller.spec.ts`

Expected: only token-holder extractor and aggregation changes
