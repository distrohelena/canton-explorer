# Independent Package Detail Panels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the package detail page load Summary, Seen On Nodes, Modules, Templates, and Data Types through independent parallel requests with independent panel states.

**Architecture:** Keep the existing aggregate `/packages/:packageId` endpoint for debugger and other consumers. Add five focused read-only endpoints backed by the existing package metadata cache and cached package registry inspection. The Vue page will render its shell immediately and start all five API requests in parallel, tracking loading, error, empty, and loaded states per panel.

**Tech Stack:** NestJS, TypeScript, Vue 3 Composition API, Vitest, Jest, Testing Library.

---

### Task 1: Add focused package section response types and service methods

**Files:**
- Modify: `backend/src/domain/node.types.ts`
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Test: `backend/test/pqs/pqs-summary.service.spec.ts`

- [x] **Step 1: Write failing service tests** for summary, nodes, modules, templates, and data types, including invalid/not-available inspection results.
- [x] **Step 2: Run the focused Jest tests** and confirm the new methods are missing.
- [x] **Step 3: Implement the response types and service methods**, reusing metadata lookup, node listing, and package-registry inspection without changing the aggregate method.
- [x] **Step 4: Run the focused Jest tests** and confirm they pass.

### Task 2: Expose the focused package endpoints and frontend API functions

**Files:**
- Modify: `backend/src/api/nodes.controller.ts`
- Modify: `frontend/src/types/packages.ts`
- Modify: `frontend/src/lib/api.ts`
- Test: `backend/test/api/nodes.controller.spec.ts`
- Test: `frontend/src/lib/api.test.ts`

- [x] **Step 1: Write failing controller and API tests** asserting each section maps to its own URL and service method.
- [x] **Step 2: Run the focused tests** and confirm the routes/functions are missing.
- [x] **Step 3: Implement the five controller routes and frontend fetch functions.**
- [x] **Step 4: Run the focused tests** and confirm they pass.

### Task 3: Render package panels independently in the frontend

**Files:**
- Modify: `frontend/src/views/PackageDetailView.vue`
- Test: `frontend/src/views/PackageDetailView.test.ts`

- [x] **Step 1: Write failing view tests** proving all panel headings render while requests are pending, requests begin in parallel, one panel can resolve while another remains loading, and one panel can fail without blanking the others.
- [x] **Step 2: Run the focused Vitest tests** and confirm the current aggregate-loading behavior fails these assertions.
- [x] **Step 3: Implement per-panel refs and parallel loading** while preserving the current panel markup, formatting, and aggregate endpoint consumers.
- [x] **Step 4: Run the focused view tests** and confirm they pass.

### Task 4: Verify the complete change

**Files:**
- No source changes expected.

- [x] **Step 1: Run `npm test` from the repository root.**
- [x] **Step 2: Run `npm run build` from the repository root.**
- [x] **Step 3: Run `git diff --check` and review the final changed-file list.**
