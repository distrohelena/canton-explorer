# Template Choices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add every DAR-defined choice to the template detail response and render each choice with its consuming mode, argument type, and result type.

**Architecture:** Extend the existing `PackageTemplateSummary` response object with a sorted `choices` array. `PackageRegistryService.inspectPackage()` maps raw template choices using the existing type-node builder; the existing package/module/template endpoints propagate that additive field. `TemplateDetailView` renders a new Choices section using the existing `PackageTypeTree` component.

**Tech Stack:** NestJS, TypeScript, Vue 3, Vue Router, Jest, Vitest, Testing Library.

---

### Task 1: Map template choices in package inspection

**Files:**
- Modify: `backend/src/domain/node.types.ts` — add `choices` to `PackageTemplateSummary`.
- Modify: `frontend/src/types/packages.ts` — mirror the additive response type.
- Modify: `backend/src/packages/package-registry.service.ts` — decode, type-build, and sort raw template choices.
- Test: `backend/test/packages/package-registry.service.spec.ts` — verify a decoded fixture template exposes choices and schemas.
- Test fixtures: `frontend/src/lib/api.test.ts`, `frontend/src/views/PackageDetailView.test.ts`, `frontend/src/views/ModuleDetailView.test.ts`, and `frontend/src/views/DebuggerView.test.ts` — add empty choice arrays to typed package/template fixtures.

- [ ] **Step 1: Write the failing registry test**

  Extend the existing decoded-package inspection test for `SAMPLE_DAML_FIXTURE.templateId` with a `choices` assertion. Assert the known `SvRewardCoupon_DsoExpire` choice is present, has a consuming flag, and has decoded argument/result nodes when available. Also assert the returned choice names are sorted.

- [ ] **Step 2: Run the focused test and verify the expected failure**

  Run:

  ```bash
  npm test --workspace backend -- package-registry.service.spec.ts -t "inspects a decoded package with modules, templates, and data types"
  ```

  Expected: the test fails because template summaries do not yet contain `choices`.

- [ ] **Step 3: Implement the minimal mapping**

  Add `choices: PackageInterfaceChoice[]` to `PackageTemplateSummary`. In `inspectPackage()`, map `template.template.choices ?? []` to the shared choice shape using `resolveRawInternedString()` for names. Call `buildTypeNode()` only when `argBinder?.type` or `retType` exists; otherwise preserve `argumentType` or `resultType` as `null`. Use fresh ancestry/type-binding sets for each type and sort by `name`.

- [ ] **Step 4: Run the focused test and verify it passes**

  Run the same focused Jest command. Expected: PASS, with the fixture’s choice metadata and type nodes present.

- [ ] **Step 5: Run package-registry regression coverage**

  Run:

  ```bash
  npm test --workspace backend -- package-registry.service.spec.ts
  ```

  Expected: all package-registry tests pass.

### Task 2: Verify template-detail response propagation

**Files:**
- Test: `backend/test/pqs/pqs-summary.service.spec.ts` — include choices in the typed template fixture and assert `fetchPackageTemplate()` preserves them.
- Test: `backend/test/api/nodes.controller.spec.ts` — include a choice in the endpoint fixture and assert package, module, and template controller methods return it unchanged.
- Test fixtures: `frontend/src/lib/api.test.ts`, `frontend/src/views/PackageDetailView.test.ts`, `frontend/src/views/ModuleDetailView.test.ts`, and `frontend/src/views/DebuggerView.test.ts` — update every typed package/template response fixture with `choices: []` where no choices are relevant.

- [ ] **Step 1: Write the failing service and controller assertions**

  Add a representative choice with argument and result nodes to `typedPackageDetailFixture.templates[0]` (or the local endpoint fixture where appropriate). Assert the package templates, module detail, template detail service/controller results preserve that choice. Update existing TypeScript fixtures with empty arrays so all `PackageTemplateSummary` values remain valid.

- [ ] **Step 2: Run the focused backend tests and verify the expected failure**

  Run:

  ```bash
  npm test --workspace backend -- pqs-summary.service.spec.ts nodes.controller.spec.ts -t "template detail|package template"
  ```

  Expected: TypeScript/Jest reports the fixture shape is incomplete until `choices` is added to the shared template summary and the assertions are updated.

- [ ] **Step 3: Make the additive type updates needed for propagation**

  Keep `fetchPackageTemplate()` and `getPackageTemplate()` behavior unchanged; their existing summary return path should carry the new field automatically. Update only fixtures/types required by the new field, preserving invalid/missing-package empty-list behavior.

- [ ] **Step 4: Run the focused backend tests and verify they pass**

  Run the same focused command. Expected: PASS, including endpoint-level propagation coverage.

### Task 3: Render choices on the template detail page

**Files:**
- Modify: `frontend/src/views/TemplateDetailView.vue` — render the Choices section and type trees.
- Test: `frontend/src/views/TemplateDetailView.test.ts` — cover populated choices and empty/unavailable schemas.

- [ ] **Step 1: Write the failing view test**

  Add a decoded template fixture with at least one consuming choice and one non-consuming choice. Assert the page renders the choice names, `Consuming`/`Non-Consuming`, `Argument`, `Result`, and representative type labels. Add an empty-choice assertion and an unavailable argument/result assertion.

- [ ] **Step 2: Run the focused view test and verify the expected failure**

  Run:

  ```bash
  npm test --workspace frontend -- --run TemplateDetailView.test.ts
  ```

  Expected: the new assertions fail because no Choices section is rendered.

- [ ] **Step 3: Implement the minimal view**

  Add a `Choices` section below `Create Data`. Render an empty-state message when `templateDetail.template.choices` is empty. For each choice, show its name and mode, then render `PackageTypeTree` for non-null argument/result types. For null schemas, show an unavailable message so the choice remains visible. Reuse existing `node-detail__section`, `package-tree`, and detail-page styles; add no new endpoint or interaction.

- [ ] **Step 4: Run the focused view test and verify it passes**

  Run the same Vitest command. Expected: PASS.

- [ ] **Step 5: Run related frontend regression coverage**

  Run:

  ```bash
  npm test --workspace frontend -- --run api.test.ts PackageDetailView.test.ts ModuleDetailView.test.ts DebuggerView.test.ts TemplateDetailView.test.ts
  ```

  Expected: all related API/package views pass.

### Task 4: Full verification and handoff

**Files:**
- No additional source changes expected.

- [ ] **Step 1: Run the complete test suite**

  Run:

  ```bash
  npm test
  ```

  Expected: backend and frontend suites pass.

- [ ] **Step 2: Run the production build**

  Run:

  ```bash
  npm run build
  ```

  Expected: backend compilation and frontend type-check/Vite build pass.

- [ ] **Step 3: Check the final diff**

  Run:

  ```bash
  git diff --check
  git status --short
  ```

  Expected: no whitespace errors; only the intended implementation files are modified. Commit changes only if explicitly requested by the user.
