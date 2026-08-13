# DAML Type-Aware Update Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the DAML schema resolved from loaded DARs through update-detail decoding so empty optionals display their declared inner type.

**Architecture:** The backend decoder will attach a `PackageTypeNode` schema to successful decoded create, exercise-argument, and exercise-result states. The update-detail table will flatten decoded values together with that schema, using the schema for exact type labels and retaining the current value-based fallback for raw JSON/manual decodes.

**Tech Stack:** NestJS/TypeScript backend, Vue 3 frontend, Vitest, Jest, DAML-LF package registry.

## Global Constraints

- Do not change the raw decoded value shape used by existing consumers.
- Keep schema metadata optional so untyped JSON and special-case decodes continue to render.
- Preserve existing links, labels, and table layout.

---

### Task 1: Propagate resolved schemas from the backend decoder

**Files:**
- Modify: `backend/src/domain/node.types.ts`
- Modify: `backend/src/packages/package-registry.service.ts`
- Modify: `backend/src/packages/daml-value-decoder.service.ts`
- Test: `backend/src/packages/daml-value-decoder.service.spec.ts`

- [x] **Step 1: Add a failing decoder test** asserting that a successful typed decode carries the resolved template/choice schema, including an `Optional<Text>` field when its value is absent.
- [x] **Step 2: Run the focused backend test and confirm it fails because decoded states have no schema.**
- [x] **Step 3: Add optional `PackageTypeNode` metadata to decoded states and expose package-registry helpers that build template and choice type nodes from the already loaded DAR definitions.**
- [x] **Step 4: Attach the template schema to create data and argument/result schemas to exercise data without changing the decoded value tree.**
- [x] **Step 5: Run the focused backend test and confirm it passes.**

### Task 2: Render update data using schema metadata

**Files:**
- Modify: `frontend/src/types/daml.ts`
- Modify: `frontend/src/views/UpdateDetailView.vue`
- Test: `frontend/src/views/UpdateDetailView.test.ts`

- [x] **Step 1: Add a failing UI regression assertion where an empty optional’s declared schema says `Optional<Text>` while its field name suggests another type.**
- [x] **Step 2: Run the focused frontend test and confirm it fails with the name-based inferred type.**
- [x] **Step 3: Extend event-data flattening to carry the matching schema node through records, variants, optionals, lists, maps, and nested values.**
- [x] **Step 4: Prefer `PackageTypeNode` labels for the Type column, including the full optional wrapper; retain existing inference when schema metadata is absent.**
- [x] **Step 5: Run the focused frontend test and confirm it passes.**

### Task 3: Verify the complete change

**Files:**
- No additional files.

- [x] **Step 1: Run backend and frontend test suites.**
- [x] **Step 2: Run the full workspace build.**
- [x] **Step 3: Run `git diff --check` and review the final diff for unrelated changes.**
