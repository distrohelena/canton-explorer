# Module Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make package module names link to a dedicated page showing the module’s package metadata, templates, and data types.

**Architecture:** Add a focused backend module-detail endpoint that filters the existing cached package inspection by module name. Add a Vue route and view that renders the module metadata and definitions using the existing package type components, and link to it from the package detail module list.

**Tech Stack:** NestJS, TypeScript, Vue 3, Vue Router, Vitest, Jest, Testing Library.

---

### Task 1: Add module detail response and endpoint

**Files:**
- Modify: `backend/src/domain/node.types.ts`
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Modify: `backend/src/api/nodes.controller.ts`
- Test: `backend/test/pqs/pqs-summary.service.spec.ts`
- Test: `backend/test/api/nodes.controller.spec.ts`

- [x] Write failing service/controller tests for module filtering and the endpoint.
- [x] Run the focused backend tests and confirm the new method is missing.
- [x] Implement the response type, service filtering, and controller route.
- [x] Run the focused backend tests and confirm they pass.

### Task 2: Add frontend API, route, and Module detail view

**Files:**
- Modify: `frontend/src/types/packages.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/router.ts`
- Create: `frontend/src/views/ModuleDetailView.vue`
- Test: `frontend/src/lib/api.test.ts`
- Test: `frontend/src/views/ModuleDetailView.test.ts`

- [x] Write failing API and view tests for module URL loading and rendered definitions.
- [x] Run the focused frontend tests and confirm the new API/view are missing.
- [x] Implement the fetch function, route, and view with loading/error/empty states.
- [x] Run the focused frontend tests and confirm they pass.

### Task 3: Link package modules to the new page

**Files:**
- Modify: `frontend/src/views/PackageDetailView.vue`
- Test: `frontend/src/views/PackageDetailView.test.ts`

- [x] Add a failing assertion that a module row links to the module route.
- [x] Implement the module link while preserving the existing module list styling.
- [x] Run the package detail tests and confirm they pass.

### Task 4: Verify the complete change

**Files:**
- No source changes expected.

- [x] Run `npm test` from the repository root.
- [x] Run `npm run build` from the repository root.
- [x] Run `git diff --check` and review the final changed-file list.
