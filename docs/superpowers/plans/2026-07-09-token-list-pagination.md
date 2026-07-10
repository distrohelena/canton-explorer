# Token List Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Paginate the Known Tokens section on `/tokens` with backend cursors and URL-backed frontend state.

**Architecture:** Extend the backend token list response with opaque cursor pagination, then update the Tokens page to read and write an independent token-list pagination query state. Reuse the existing page-size options and pager interaction pattern used by other explorer pages.

**Tech Stack:** NestJS, TypeScript, Jest, Vue 3, Vitest

---

### Task 1: Add failing backend pagination tests

**Files:**
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] Add a failing test for paginated token listing with `limit`, `before`, and `after`.
- [ ] Run the targeted test and verify it fails.

### Task 2: Implement backend token pagination

**Files:**
- Modify: `backend/src/domain/node.types.ts`
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Modify: `backend/src/api/nodes.controller.ts`

- [ ] Extend `TokensResponse` with cursor metadata.
- [ ] Add cursor pagination to `fetchTokens()`.
- [ ] Accept `limit`, `before`, and `after` on `/api/tokens`.
- [ ] Run targeted backend tests and build.

### Task 3: Add failing frontend pagination tests

**Files:**
- Modify: `frontend/src/lib/api.test.ts`
- Modify: `frontend/src/views/TokensView.test.ts`

- [ ] Add API test coverage for token list pagination params.
- [ ] Add Tokens view coverage for page-size and `Newer`/`Older`.
- [ ] Run targeted frontend tests and verify failure.

### Task 4: Implement frontend token list pagination

**Files:**
- Modify: `frontend/src/types/tokens.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/views/TokensView.vue`

- [ ] Mirror backend cursor fields.
- [ ] Support paginated `fetchTokens(options)`.
- [ ] Add URL-backed token-list pagination state and UI.
- [ ] Run targeted frontend tests.

### Task 5: Final verification

**Files:**
- Modify: none unless bugs are found

- [ ] Run targeted backend tests.
- [ ] Run targeted frontend tests.
- [ ] Run backend build.
