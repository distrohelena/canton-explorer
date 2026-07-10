# Token Identity By Issuer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make explorer token identity issuer-aware so same-name tokens from different issuers no longer collide.

**Architecture:** Extend the canonical token model with an optional `issuer` field and change backend token-id construction to include issuer when available. Reuse that canonical id through token discovery, transfer aggregation, holder aggregation, token detail lookup, and frontend routing. Add minimal UI metadata so duplicate-looking tokens remain understandable.

**Tech Stack:** NestJS, TypeScript, Jest, Vue 3, Vitest

---

## File Map

- Modify: `backend/src/domain/node.types.ts`
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`
- Modify: `backend/test/api/nodes.controller.spec.ts`
- Modify: `frontend/src/types/tokens.ts`
- Modify: `frontend/src/lib/api.test.ts`
- Modify: `frontend/src/views/TokensView.vue`
- Modify: `frontend/src/views/TokenDetailView.vue`
- Modify: `frontend/src/views/TokensView.test.ts`
- Modify: `frontend/src/views/TokenDetailView.test.ts`

### Task 1: Add failing backend identity tests

**Files:**
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Write a failing token discovery test**

Add a test that returns two decoded token contracts with the same name or intrinsic id and different issuers, and assert `fetchTokens()` returns two distinct `tokenId` values.

- [ ] **Step 2: Write a failing token detail lookup test**

Add a test that asserts token detail lookup resolves by the issuer-aware `tokenId`.

- [ ] **Step 3: Run the targeted backend tests to verify failure**

Run: `rtk npm test --workspace backend -- pqs-summary.service.spec.ts --runInBand --testNamePattern='issuer-aware token'`

- [ ] **Step 4: Commit**

```bash
git add backend/test/pqs/pqs-summary.service.spec.ts
git commit -m "test: cover issuer-aware token identity"
```

### Task 2: Implement issuer-aware backend token identity

**Files:**
- Modify: `backend/src/domain/node.types.ts`
- Modify: `backend/src/pqs/pqs-summary.service.ts`

- [ ] **Step 1: Extend the token response type**

Add `issuer: string | null` to `TokenSummary`.

- [ ] **Step 2: Implement canonical token-id building**

Add a focused helper in `pqs-summary.service.ts` that builds:

- `canton-coin`
- `<issuer>::<intrinsic-id>` when issuer exists
- fallback intrinsic id when issuer is absent

- [ ] **Step 3: Apply the helper in both CIP56 and CIP112 discovery paths**

Update `extractCip56TokenSummary()` and `extractCip112TokenSummary()`.

- [ ] **Step 4: Run the targeted backend tests**

Run: `rtk npm test --workspace backend -- pqs-summary.service.spec.ts --runInBand --testNamePattern='issuer-aware token'`

- [ ] **Step 5: Commit**

```bash
git add backend/src/domain/node.types.ts backend/src/pqs/pqs-summary.service.ts backend/test/pqs/pqs-summary.service.spec.ts
git commit -m "feat: make token identity issuer-aware"
```

### Task 3: Prove routing, transfers, and holders still work with the new ids

**Files:**
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`
- Modify: `backend/test/api/nodes.controller.spec.ts`

- [ ] **Step 1: Add or update transfer and holder tests**

Assert filtering and token detail routes use the issuer-aware id, not the display name alone.

- [ ] **Step 2: Run the targeted backend suite**

Run: `rtk npm test --workspace backend -- nodes.controller.spec.ts pqs-summary.service.spec.ts --runInBand --testNamePattern='issuer-aware token|token detail|top holders|token transfer'`

- [ ] **Step 3: Commit**

```bash
git add backend/test/api/nodes.controller.spec.ts backend/test/pqs/pqs-summary.service.spec.ts
git commit -m "test: verify issuer-aware token routing"
```

### Task 4: Update frontend token types and rendering

**Files:**
- Modify: `frontend/src/types/tokens.ts`
- Modify: `frontend/src/lib/api.test.ts`
- Modify: `frontend/src/views/TokensView.vue`
- Modify: `frontend/src/views/TokenDetailView.vue`
- Modify: `frontend/src/views/TokensView.test.ts`
- Modify: `frontend/src/views/TokenDetailView.test.ts`

- [ ] **Step 1: Write failing frontend tests**

Add expectations for:

- issuer returned in token API payloads
- token inventory cards showing issuer
- token detail overview showing issuer

- [ ] **Step 2: Run the targeted frontend tests to verify failure**

Run: `rtk npm test --workspace frontend -- api.test.ts TokensView.test.ts TokenDetailView.test.ts`

- [ ] **Step 3: Implement the minimal frontend updates**

Mirror the new `issuer` field in frontend types and render it in the token list and detail page.

- [ ] **Step 4: Run the targeted frontend tests**

Run: `rtk npm test --workspace frontend -- api.test.ts TokensView.test.ts TokenDetailView.test.ts`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/tokens.ts frontend/src/lib/api.test.ts frontend/src/views/TokensView.vue frontend/src/views/TokenDetailView.vue frontend/src/views/TokensView.test.ts frontend/src/views/TokenDetailView.test.ts
git commit -m "feat: show issuer-aware token metadata"
```

### Task 5: Final verification

**Files:**
- Modify: none unless bugs are found

- [ ] **Step 1: Build the backend**

Run: `rtk npm run build --workspace backend`

- [ ] **Step 2: Run the targeted backend tests**

Run: `rtk npm test --workspace backend -- nodes.controller.spec.ts pqs-summary.service.spec.ts --runInBand --testNamePattern='issuer-aware token|token detail|top holders|token transfer'`

- [ ] **Step 3: Run the targeted frontend tests**

Run: `rtk npm test --workspace frontend -- api.test.ts TokensView.test.ts TokenDetailView.test.ts`

- [ ] **Step 4: Sanity-check live API if available**

Run:

```bash
rtk curl -s http://localhost:4600/api/tokens
rtk curl -s http://localhost:4600/api/tokens/<issuer-aware-token-id>
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: verify issuer-aware token identity end to end"
```
