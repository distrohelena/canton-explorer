# DAML-LF SDK Package Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the explorer's custom `protobufjs`-based package registry parsing with `canton-typescript-sdk/daml-lf` while keeping current registry contracts and runtime value decoding behavior stable.

**Architecture:** Keep `PackageRegistryService` as the backend boundary for package inspection, template lookup, choice lookup, and datatype lookup, but swap its internal loader/indexing logic to use the SDK `DamlLfPackageLoader` and semantic model. Preserve the current registry result contracts so `DamlValueDecoderService` and existing API flows do not need to change in this step.

**Tech Stack:** NestJS, TypeScript, Jest, canton-typescript-sdk/daml-lf, sqlite cache, existing backend package fixtures

---

### Task 1: Lock in current registry behavior with focused failing tests

**Files:**
- Modify: `backend/test/packages/package-registry.service.spec.ts`
- Test: `backend/test/packages/package-registry.service.spec.ts`

- [ ] **Step 1: Write the failing compatibility tests**

Add assertions that explicitly lock down the registry behavior that must survive the SDK migration:

```ts
it('returns stable package inspection metadata from cached package bytes', async () => {
  await expect(registry.inspectPackage?.(SAMPLE_DAML_FIXTURE.packageId)).resolves.toMatchObject({
    ok: true,
    definition: {
      packageId: SAMPLE_DAML_FIXTURE.packageId,
      packageName: expect.any(String),
      packageVersion: expect.any(String),
      modules: expect.arrayContaining(['Splice.Amulet']),
      templates: expect.arrayContaining([
        expect.objectContaining({ templateId: SAMPLE_DAML_FIXTURE.templateId }),
      ]),
    },
  });
});
```

Add at least one additional test that locks:

- exact `unknown_template`
- exact `unknown_choice`
- exact `unknown_data_type`

- [ ] **Step 2: Run the registry test file to verify the new assertions fail when expectations are tightened**

Run:

```bash
npm test -- package-registry.service.spec.ts
```

Expected: FAIL if the new compatibility assertions expose missing or underspecified behavior.

- [ ] **Step 3: Refine the tests until they fail for real compatibility gaps, not test mistakes**

Keep the failures focused on:

- package metadata shape
- template id shape
- datatype id shape
- stable failure reasons

- [ ] **Step 4: Re-run the same test file**

Run:

```bash
npm test -- package-registry.service.spec.ts
```

Expected: FAIL for the intended migration gap.

- [ ] **Step 5: Commit the test lock-in**

```bash
git add backend/test/packages/package-registry.service.spec.ts
git commit -m "test: lock DAML-LF package registry compatibility"
```

### Task 2: Introduce SDK-backed registry cache types without changing public service methods

**Files:**
- Modify: `backend/src/packages/daml-decoder.types.ts`
- Modify: `backend/src/packages/package-registry.service.ts`
- Test: `backend/test/packages/package-registry.service.spec.ts`

- [ ] **Step 1: Write the failing type-level/service-level test expectation**

Extend an existing registry test so it also relies on one compatibility detail that currently comes from the custom raw model, for example:

```ts
expect(choiceResult).toMatchObject({
  ok: true,
  definition: {
    template: {
      moduleName: 'Splice.Amulet',
      entityName: expect.any(String),
    },
  },
});
```

- [ ] **Step 2: Run the registry test file**

Run:

```bash
npm test -- package-registry.service.spec.ts
```

Expected: FAIL after the new assertion if the compatibility model is not fully captured.

- [ ] **Step 3: Add SDK-backed internal cache/result shapes**

In `backend/src/packages/daml-decoder.types.ts`, introduce or revise internal result types so they can be populated from SDK package/module/template/datatype objects instead of raw protobuf interned-string structures.

Keep the public result contracts stable:

- `ResolvedPackageInspection`
- `ResolvedTemplate`
- `ResolvedChoice`
- `ResolvedDataType`

- [ ] **Step 4: Run the registry test file again**

Run:

```bash
npm test -- package-registry.service.spec.ts
```

Expected: still FAIL, but now only because the loader/indexing implementation is not yet migrated.

- [ ] **Step 5: Commit the compatibility type prep**

```bash
git add backend/src/packages/daml-decoder.types.ts backend/src/packages/package-registry.service.ts backend/test/packages/package-registry.service.spec.ts
git commit -m "refactor: prepare package registry for SDK DAML-LF types"
```

### Task 3: Replace custom archive parsing in `PackageRegistryService` with SDK package loading

**Files:**
- Modify: `backend/src/packages/package-registry.service.ts`
- Modify: `backend/src/packages/daml-lf-loader.ts`
- Test: `backend/test/packages/package-registry.service.spec.ts`

- [ ] **Step 1: Write the failing test for invalid package handling through the SDK path**

Use the existing broken-package fixture path and ensure the service still returns:

```ts
{ ok: false, reason: 'invalid_package' }
```

for both `resolveTemplate(...)` and `inspectPackage(...)`.

- [ ] **Step 2: Run the registry test file to verify the failure**

Run:

```bash
npm test -- package-registry.service.spec.ts
```

Expected: FAIL once the invalid-package path is asserted against the new internal behavior.

- [ ] **Step 3: Implement SDK package loading**

In `backend/src/packages/package-registry.service.ts`:

- remove `loadArchiveRoot()` usage from the registry path
- instantiate and use SDK `DamlLfPackageLoader`
- call `loadPackageOrThrow(...)` on cached package bytes
- map loader exceptions to `invalid_package`
- keep `missing_package` behavior unchanged

In `backend/src/packages/daml-lf-loader.ts`:

- remove archive-descriptor helpers only if they are no longer used anywhere
- keep `loadValueRoot()` intact because `DamlValueDecoderService` still depends on it

- [ ] **Step 4: Run the registry tests**

Run:

```bash
npm test -- package-registry.service.spec.ts
```

Expected: PASS

- [ ] **Step 5: Commit the SDK loader swap**

```bash
git add backend/src/packages/package-registry.service.ts backend/src/packages/daml-lf-loader.ts backend/test/packages/package-registry.service.spec.ts
git commit -m "refactor: load DAML-LF packages through SDK"
```

### Task 4: Rebuild template, choice, and datatype indexes from SDK package structures

**Files:**
- Modify: `backend/src/packages/package-registry.service.ts`
- Modify: `backend/src/packages/daml-decoder.types.ts`
- Test: `backend/test/packages/package-registry.service.spec.ts`

- [ ] **Step 1: Write the failing test for template/choice/datatype compatibility**

Add explicit assertions that the SDK-backed registry still returns:

- template ids formatted as `Module.Name:EntityName`
- datatype ids formatted as `Module.Name:TypeName`
- choice lookups by exact current choice names

Example:

```ts
await expect(
  registry.resolveDataType({
    packageId: SAMPLE_DAML_FIXTURE.packageId,
    typeId: SAMPLE_DAML_FIXTURE.templateId,
  }),
).resolves.toMatchObject({
  ok: true,
  definition: {
    typeId: SAMPLE_DAML_FIXTURE.templateId,
  },
});
```

- [ ] **Step 2: Run the registry test file**

Run:

```bash
npm test -- package-registry.service.spec.ts
```

Expected: FAIL if the new SDK index builder does not yet preserve the old identifier formats.

- [ ] **Step 3: Implement minimal SDK index building**

Build and cache:

- package metadata from SDK `DamlLfPackage`
- module names from SDK modules
- template ids from SDK templates
- datatype ids from SDK datatypes
- choice lookup maps from SDK template choices

Do not change public method signatures.

- [ ] **Step 4: Re-run the registry tests**

Run:

```bash
npm test -- package-registry.service.spec.ts
```

Expected: PASS

- [ ] **Step 5: Commit the index migration**

```bash
git add backend/src/packages/package-registry.service.ts backend/src/packages/daml-decoder.types.ts backend/test/packages/package-registry.service.spec.ts
git commit -m "refactor: rebuild registry indexes from SDK package model"
```

### Task 5: Verify downstream backend flows still pass unchanged

**Files:**
- Test: `backend/test/api/nodes.controller.spec.ts`
- Test: `backend/test/pqs/pqs-summary.service.spec.ts`
- Test: `backend/test/packages/package-registry.service.spec.ts`

- [ ] **Step 1: Run the targeted downstream regression suite**

Run:

```bash
npm test -- nodes.controller.spec.ts pqs-summary.service.spec.ts package-registry.service.spec.ts
```

Expected: PASS

- [ ] **Step 2: If any downstream test fails, fix only the registry compatibility layer**

Do not rewrite `DamlValueDecoderService` in this step.

Keep fixes limited to:

- registry metadata mapping
- template/choice/datatype index mapping
- failure-reason translation

- [ ] **Step 3: Re-run the targeted suite**

Run:

```bash
npm test -- nodes.controller.spec.ts pqs-summary.service.spec.ts package-registry.service.spec.ts
```

Expected: PASS

- [ ] **Step 4: Commit the downstream compatibility fixes**

```bash
git add backend/src/packages/package-registry.service.ts backend/src/packages/daml-decoder.types.ts backend/test/api/nodes.controller.spec.ts backend/test/pqs/pqs-summary.service.spec.ts backend/test/packages/package-registry.service.spec.ts
git commit -m "test: verify SDK package registry downstream compatibility"
```

### Task 6: Run full backend verification and clean up dead registry-only parsing code

**Files:**
- Modify: `backend/src/packages/daml-lf-loader.ts`
- Modify: `backend/package.json`
- Test: `backend/test/packages/package-registry.service.spec.ts`
- Test: `backend/test/api/nodes.controller.spec.ts`
- Test: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Audit whether archive-descriptor helpers or `protobufjs` registry-only dependencies are still needed**

Check:

- `backend/src/packages/daml-lf-loader.ts`
- `backend/package.json`
- imports in `backend/src/packages/package-registry.service.ts`

- [ ] **Step 2: Remove only dead registry-specific parsing code**

Allowed cleanup:

- delete unused `loadArchiveRoot()` helpers if no longer referenced
- remove unused imports introduced solely for the old registry path

Not allowed in this step:

- changing `loadValueRoot()` consumer behavior
- rewriting `DamlValueDecoderService`

- [ ] **Step 3: Run the full backend test suite**

Run:

```bash
npm test
```

Expected: PASS

- [ ] **Step 4: Run the backend build**

Run:

```bash
npm run build
```

Expected: PASS

- [ ] **Step 5: Commit the migration slice**

```bash
git add backend/src/packages/package-registry.service.ts backend/src/packages/daml-lf-loader.ts backend/src/packages/daml-decoder.types.ts backend/test backend/package.json
git commit -m "refactor: migrate package registry to SDK DAML-LF loader"
```

## Notes For Execution

- Keep `DamlValueDecoderService` behavior unchanged in this slice.
- If the old registry result types are too tightly coupled to raw protobuf interned-string structures, introduce the smallest compatibility layer needed rather than widening the migration scope.
- Do not remove `protobufjs` from `backend/package.json` unless a fresh search proves it is unused everywhere after the registry swap. The value decoder may still require it in later work.
