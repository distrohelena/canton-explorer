# Node Synchronizers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a gRPC-backed `Synchronizers` section to the node detail page so operators can see which synchronizers each participant is connected to.

**Architecture:** Add a node-scoped backend endpoint that delegates to the existing gRPC operations layer and returns a small typed response. Extend the node detail page to fetch that response with the rest of the node workspace data and render clear configured, empty, and unconfigured states.

**Tech Stack:** NestJS, TypeScript, Jest, Vue 3, Vue Router, Vitest

---

### Task 1: Add backend synchronizers contract and controller endpoint

**Files:**
- Modify: `backend/src/domain/node.types.ts`
- Modify: `backend/src/api/nodes.controller.ts`
- Test: `backend/test/api/nodes.controller.spec.ts`

- [ ] Write a failing controller test for `GET /api/nodes/:id/synchronizers`
- [ ] Run the targeted controller test and confirm failure
- [ ] Add `NodeSynchronizerSummary` and `NodeSynchronizersResponse`
- [ ] Add controller wiring that delegates to `GrpcOperationsService`
- [ ] Re-run the targeted controller test and confirm pass

### Task 2: Add gRPC synchronizers retrieval

**Files:**
- Modify: `backend/src/grpc/grpc-operations.service.ts`
- Test: `backend/test/grpc/grpc-operations.service.spec.ts`

- [ ] Write a failing service test for mapping connected synchronizers
- [ ] Run the targeted service test and confirm failure
- [ ] Implement `listConnectedSynchronizers`
- [ ] Re-run the targeted service test and confirm pass

### Task 3: Add frontend API and types

**Files:**
- Modify: `frontend/src/types/nodes.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/api.test.ts`

- [ ] Write a failing API client test for `fetchNodeSynchronizers`
- [ ] Run the targeted API test and confirm failure
- [ ] Add synchronizers response types and API call
- [ ] Re-run the targeted API test and confirm pass

### Task 4: Render the node synchronizers section

**Files:**
- Modify: `frontend/src/views/NodeDetailView.vue`
- Modify: `frontend/src/views/NodeDetailView.test.ts`
- Modify: `frontend/src/styles.css`

- [ ] Write failing node detail tests for unconfigured, empty, and populated synchronizers states
- [ ] Run the targeted page test and confirm failure
- [ ] Implement the `Synchronizers` section and styling
- [ ] Re-run the targeted page test and confirm pass

### Task 5: Verify

**Files:**
- No additional code changes required

- [ ] Run targeted backend tests
- [ ] Run targeted frontend tests
- [ ] Run backend build
- [ ] Run frontend build
