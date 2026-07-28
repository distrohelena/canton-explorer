# Debugger Constructor Arguments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a package-aware Step 04 to the Create debugger wizard that renders and validates a full recursive DAML constructor-argument form.

**Architecture:** Extend node template metadata with package identity, then load the selected package detail and pass its `createType` into a focused recursive form component. Keep form state separate from `NodeDecodedDamlValue` so incomplete controls never serialize; integrate the form into the existing debugger picker without creating a debugger session.

**Tech Stack:** NestJS/TypeScript backend, Vue 3 `<script setup>`, Vitest, Testing Library Vue, existing `PackageTypeNode` and `NodeDecodedDamlValue` types.

---

### Task 1: Add package-aware template metadata

**Files:**
- Modify: `backend/src/domain/node.types.ts`
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`
- Modify: `frontend/src/types/templates.ts`
- Modify: `frontend/src/components/DebuggerTemplatePicker.vue`
- Modify: `frontend/src/views/DebuggerView.vue` (`DebuggerTemplateGroup.templates`, `templateOptions`, and selection reset contract)
- Test: `backend/test/api/nodes.controller.spec.ts`
- Test: `backend/test/pqs/pqs-summary.service.spec.ts` (package metadata, duplicate template response, deterministic ordering)
- Test: `frontend/src/components/DebuggerTemplatePicker.test.ts`

- [ ] Write failing tests for `{ templateId, packageId, packageName, packageVersion }` entries, duplicate template IDs from two packages, and selection values preserving package identity through both `DebuggerTemplatePicker` and `DebuggerView`'s `templateGroups`/`templateOptions` transformation.
- [ ] Run the focused backend/frontend tests and confirm they fail because the response and selection types currently omit package identity.
- [ ] Update backend types and `buildTemplateFilterResponse` to emit one entry per package/template, sorted by template ID then package ID, with package metadata from the package cache.
- [ ] Add the exact backend fixture response for `Main:Asset` from `pkg-a`/`1.0.0` and `pkg-b`/`2.0.0`, including nullability for missing package name/version.
- [ ] Update frontend types, picker keys/labels, and `DebuggerTemplateSelection` to carry package identity.
- [ ] Run focused tests and confirm they pass.

### Task 2: Build the recursive constructor form

**Files:**
- Create: `frontend/src/components/DebuggerValueForm.vue`
- Create: `frontend/src/components/DebuggerValueForm.test.ts`
- Create: `frontend/src/lib/debugger-value-form.ts` (form state/validation only; accept a view-owned constructor-schema resolver interface rather than loading packages inside the form)
- Modify: `frontend/src/lib/debugger-value-schema.ts` only if a small shared type/helper extraction is needed; do not use its decoded-value lookup as the constructor-schema resolver
- Create: `frontend/src/lib/debugger-value-form.test.ts`
- Modify: `frontend/src/types/packages.ts`

- [ ] Write failing unit tests for the fixture schema: record, Text, Int64, Numeric, Party, Date, Optional, List, TextMap, generic map, variant, enum, nested record, contract ID, Unit, generic substitution, recursive reference depth 8, and exact `NodeDecodedDamlValue` output.
- [ ] Define a separate form-state `UNSET` sentinel in the unit under test and assert that only completed values convert to `NodeDecodedDamlValue`.
- [ ] Write failing tests for deterministic validation: integer grammar/range, Numeric scale, Date/Time/Timestamp, required fields, duplicate map keys, variants/enums, trimmed values, missing definitions, `type_var`, unsupported nodes, and recursive-reference diagnostics.
- [ ] Add a negative renderer assertion that a missing package/type lookup renders no child controls and emits no child value.
- [ ] Run the focused tests and confirm the missing form model/renderer failures.
- [ ] Implement form state with an internal `UNSET` sentinel, recursive schema traversal, generic binding resolution, bounded recursion, validation, and conversion to `NodeDecodedDamlValue`. The form receives a resolver interface from the view (`resolveType(packageId, typeId)` plus generic/builtin resolution); missing package/type lookups prevent child fields from rendering and produce a non-completable diagnostic.
- [ ] Implement the Vue renderer with typed controls, nested records, variants/enums, repeatable lists/maps, optional toggles, loading/error states, and an emit for validity/value.
- [ ] Run focused form tests and confirm they pass.

### Task 3: Integrate Step 04 and the layout

**Files:**
- Modify: `frontend/src/lib/api.ts` (use existing `fetchPackageDetail`; add mocks/assertions only if needed)
- Modify: `frontend/src/views/DebuggerView.vue`
- Modify: `frontend/src/components/DebuggerTemplatePicker.vue`
- Modify: `frontend/src/styles.css`
- Modify: `frontend/src/views/DebuggerView.test.ts`

- [ ] Add a failing view test that selects Create → node → template, waits for package detail, and expects Step 04 with the generated form while no session-creation call occurs; assert the view stores the emitted validated `NodeDecodedDamlValue` payload.
- [ ] Add failing tests for the stacked simulation rail and for the explicit child-to-parent reset event: switching simulation type clears selected node, `selectedTemplate`, schema, form state, and payload; reselecting a template retains the node but replaces schema/form state and cancels stale requests.
- [ ] Run the focused view tests and confirm the new assertions fail.
- [ ] Use the existing `fetchPackageDetail` API, load the selected package with stale-request guards, resolve the matching template `createType`, and render the constructor form as Step 04 for Create only. Cover package fetch failure, non-decoded package, missing `createType`, and template-not-found states.
- [ ] Rework the picker into the left simulation rail plus right dependent steps while preserving existing Exercise Existing/Exercise New behavior.
- [ ] Add responsive styles for the two-column wizard and mobile stacking.
- [ ] Run focused view tests and confirm they pass.

### Task 4: Verify and hand off

**Files:**
- Modify only files needed to fix test/type/build failures.

- [ ] Run all backend tests.
- [ ] Run all frontend tests.
- [ ] Run frontend and backend builds/type checks.
- [ ] Inspect `git diff` to ensure the existing unrelated debugger, `.gitignore`, and global-update changes remain intact.
- [ ] Add the final implementation outcome to persistent memory.
