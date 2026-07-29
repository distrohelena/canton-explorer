# Simulated debugger create sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a button that evaluates a selected DAML template create in memory and opens the resulting synthetic replay in the debugger without submitting to Canton.

**Architecture:** Extend `DebuggerService` with a simulation-specific bootstrap that creates a synthetic transaction snapshot and reuses the existing compilation, source-map, evaluator, and replay-session machinery. Add a typed frontend API call and a step-04 button that submits valid constructor data and routes directly to the returned session.

**Tech Stack:** NestJS, TypeScript, Vue 3, Vitest/Jest, Canton TypeScript SDK DAML-LF replay debugger.

---

### Task 1: Backend simulation request and synthetic replay

**Files:**
- Modify: `backend/src/api/debugger.controller.ts`
- Modify: `backend/src/debugger/debugger.service.ts`
- Test: `backend/test/api/debugger.controller.spec.ts` and/or `backend/test/debugger/debugger.service.spec.ts`

- [ ] Write failing tests for request validation and a synthetic create snapshot/session path.
- [ ] Run the focused backend tests and confirm the new behavior fails.
- [ ] Add `POST /api/debugger/sessions/simulate` accepting node ID, package ID, template ID, and constructor argument.
- [ ] Build a synthetic transaction snapshot with a generated simulation offset and create entrypoint, then reuse the existing replay bootstrap/session artifact mapping.
- [ ] Run focused backend tests and the backend build.

### Task 2: Frontend API and create-session action

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/views/DebuggerView.vue`
- Modify: `frontend/src/components/DebuggerTemplatePicker.vue`
- Test: `frontend/src/views/DebuggerView.test.ts`

- [ ] Write failing tests for the step-04 button disabled/enabled states, request payload, loading/error state, and session opening.
- [ ] Run the focused frontend test and confirm the expected failure.
- [ ] Add the simulation API client and emit a create-session action from the constructor step.
- [ ] Submit the selected create configuration, set the returned session, and route using `sessionId` without requiring `updateId`.
- [ ] Run the focused frontend test and the frontend build.

### Task 3: Integration verification

**Files:**
- Modify: `frontend/src/views/DebuggerView.vue` if session-only routing needs adjustment.

- [ ] Verify synthetic sessions have no real ledger events and expose replay events.
- [ ] Run backend and frontend focused tests, builds, and `git diff --check`.
- [ ] Verify the live UI/API flow against a playground template without submitting a ledger command.
