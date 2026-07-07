# Participant Status Node Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the node synchronizers endpoint with a broader participant-status endpoint sourced only from `ParticipantStatus`, while keeping gRPC health checks separate for serving status.

**Architecture:** The backend will remove the synchronizer-connectivity and ledger-state fallback path and instead expose a participant-status response built from the participant admin RPC. The frontend node detail view will replace the `Synchronizers` block with a full-width `Participant Status` block that renders all returned status fields and preserves `Service Health` / `Ledger Snapshot` as separate cards.

**Tech Stack:** NestJS, TypeScript, Jest, Vue 3, Vitest, canton-typescript-sdk

---

### Task 1: Replace backend response contract

**Files:**
- Modify: `backend/src/domain/node.types.ts`
- Modify: `frontend/src/types/nodes.ts`
- Test: `backend/test/api/nodes.controller.spec.ts`
- Test: `frontend/src/lib/api.test.ts`

- [ ] **Step 1: Write the failing contract tests**
- [ ] **Step 2: Run targeted tests to verify the old synchronizer contract fails**
- [ ] **Step 3: Add participant-status types for common status, components, topology queues, supported protocol versions, connected synchronizers, and not-initialized state**
- [ ] **Step 4: Run the targeted contract tests and make sure they pass**

### Task 2: Replace gRPC participant-status fetching

**Files:**
- Modify: `backend/src/grpc/grpc-client.factory.ts`
- Modify: `backend/src/grpc/grpc-operations.service.ts`
- Test: `backend/test/grpc/grpc-operations.service.spec.ts`

- [ ] **Step 1: Write failing backend service tests for ParticipantStatus success, not-configured, and RPC failure-without-fallback**
- [ ] **Step 2: Run the targeted backend service tests to verify they fail**
- [ ] **Step 3: Add a ParticipantStatus client factory and map the RPC response into the new backend response shape**
- [ ] **Step 4: Delete the synchronizer-connectivity and ledger state fallback path**
- [ ] **Step 5: Run the targeted backend service tests and make sure they pass**

### Task 3: Replace the controller route payload

**Files:**
- Modify: `backend/src/api/nodes.controller.ts`
- Test: `backend/test/api/nodes.controller.spec.ts`

- [ ] **Step 1: Write the failing controller test for `/nodes/:id/synchronizers` returning participant-status payload**
- [ ] **Step 2: Run the controller test to verify it fails**
- [ ] **Step 3: Update the controller to call the new gRPC service method and return the new payload**
- [ ] **Step 4: Run the controller test and make sure it passes**

### Task 4: Replace the node detail frontend block

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/views/NodeDetailView.vue`
- Modify: `frontend/src/views/NodeDetailView.test.ts`
- Modify: `frontend/src/styles.css`
- Test: `frontend/src/lib/api.test.ts`
- Test: `frontend/src/views/NodeDetailView.test.ts`

- [ ] **Step 1: Write failing frontend tests for fetching and rendering `Participant Status` instead of `Synchronizers`**
- [ ] **Step 2: Run the targeted frontend tests to verify they fail**
- [ ] **Step 3: Replace the API helper and node detail view rendering with the participant-status model**
- [ ] **Step 4: Keep `Service Health` and `Ledger Snapshot` as the top half-width cards**
- [ ] **Step 5: Run the targeted frontend tests and make sure they pass**

### Task 5: Verify end-to-end build health

**Files:**
- Modify: none expected
- Test: `backend/test/grpc/grpc-operations.service.spec.ts`
- Test: `backend/test/api/nodes.controller.spec.ts`
- Test: `frontend/src/lib/api.test.ts`
- Test: `frontend/src/views/NodeDetailView.test.ts`

- [ ] **Step 1: Run backend targeted tests**
- [ ] **Step 2: Run frontend targeted tests**
- [ ] **Step 3: Run `npm run build` in `backend`**
- [ ] **Step 4: Run `npm run build` in `frontend`**
