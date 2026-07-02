# Generic DAR Decoder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a package-aware generic DAML decoder that turns cached package blobs into strict decoded create payloads, exercise payloads, and contract payloads across the backend and frontend.

**Architecture:** Keep `PackageSyncService` as the writer of raw PQS package blobs into SQLite, then add a lazy in-memory package registry plus a strict generic decoder service that resolves package definitions and decodes payload bytes into a shared recursive value schema. Wire `PqsSummaryService` through that decoder for create, exercise, and contract detail responses, and update the Vue views to render decode states (`decoded`, `invalid_data`, `not_available`) instead of flat ad hoc maps.

**Tech Stack:** NestJS, TypeScript, Jest, Vue 3, Vitest, Testing Library, SQLite (`node:sqlite`), `protobufjs`

---

### File Structure

**Files and responsibilities:**

- `backend/package.json`
  - add the explicit `protobufjs` dependency used by the LF archive/value readers
- `package-lock.json`
  - record the direct backend dependency change so installs remain reproducible
- `backend/src/domain/node.types.ts`
  - replace flat event/contract payload maps with recursive decoded-value types and strict decode-state wrappers
- `backend/src/packages/package-cache.service.ts`
  - keep SQLite package storage and add read APIs for package blobs and metadata
- `backend/src/packages/daml-lf.proto`
  - vendored protobuf schema used to parse cached DAML LF package archives and versioned values
- `backend/src/packages/daml-lf-loader.ts`
  - load the vendored DAML LF protobuf schema through `protobufjs`
- `backend/src/packages/daml-decoder.types.ts`
  - shared backend decode types for recursive values, decode statuses, and package-registry lookups
- `backend/src/packages/package-registry.service.ts`
  - lazily parse cached package blobs, resolve package dependencies, and expose template/choice definitions
- `backend/src/packages/generic-daml-decoder.service.ts`
  - strict full decoding for create, exercise, and contract payloads
- `backend/src/pqs/pqs-summary.service.ts`
  - propagate `package_id`, exercise argument bytes, and exercise result bytes, then delegate all decoding to `GenericDamlDecoderService`
- `backend/src/app.module.ts`
  - register the new package registry and generic decoder services
- `backend/nest-cli.json`
  - copy the vendored LF protobuf asset into the backend build output
- `backend/test/fixtures/daml/package-cache.sqlite`
  - dedicated committed fixture SQLite cache containing the sample package and all transitive dependency blobs needed by the registry/decoder tests
- `backend/test/fixtures/daml/sample-create-value.bin`
  - one committed encoded create payload compatible with the sample template stored in the fixture cache
- `backend/test/fixtures/daml/sample-exercise-argument.bin`
  - one committed encoded exercise argument payload compatible with the sample template stored in the fixture cache
- `backend/test/fixtures/daml/sample-exercise-result.bin`
  - one committed encoded non-unit exercise result payload compatible with the sample template stored in the fixture cache
- `backend/test/fixtures/daml/sample-exercise-result-unit.json`
  - fixture metadata for a known unit-returning choice whose result bytes are intentionally absent
- `backend/test/fixtures/daml/build-sample-values.ts`
  - test-only helper that deterministically encodes the sample create/exercise value fixtures from concrete sample data
- `backend/test/fixtures/daml/build-fixture-cache.ts`
  - one-off regeneration helper that extracts the sample package family and all dependencies into `backend/test/fixtures/daml/package-cache.sqlite`
- `backend/test/fixtures/daml/fixture-manifest.ts`
  - loads the checked-in LF/value fixtures and exports package/template/choice identifiers reused across tests
- `backend/test/packages/package-cache.service.spec.ts`
  - verify new SQLite read APIs for cached package blobs
- `backend/test/packages/package-registry.service.spec.ts`
  - verify one-time package parsing, dependency loading, and missing-package diagnostics
- `backend/test/packages/generic-daml-decoder.service.spec.ts`
  - verify strict decoded values, strict invalid-data failures, and unit-result handling
- `backend/test/pqs/pqs-summary.service.spec.ts`
  - verify create, exercise, and contract detail flows now use the generic decode-state contract
- `backend/test/api/nodes.controller.spec.ts`
  - verify controller payloads pass through the stricter decode-state shapes
- `frontend/src/types/daml.ts`
  - shared recursive decoded-value and decode-state types for frontend rendering
- `frontend/src/types/updates.ts`
  - move event payload fields to strict create/exercise decode-state wrappers
- `frontend/src/types/contracts.ts`
  - move contract payload fields to the shared strict decode-state wrapper
- `frontend/src/lib/api.test.ts`
  - verify typed API fixtures include the new recursive payload shapes
- `frontend/src/components/DecodedDamlValue.vue`
  - recursive renderer for records, variants, maps, lists, unit, and contract-id links
- `frontend/src/components/DecodedDamlValue.test.ts`
  - verify recursive rendering and contract-id link behavior
- `frontend/src/views/UpdateDetailView.vue`
  - render create/exercise decode states and invalid-data notices
- `frontend/src/views/UpdateDetailView.test.ts`
  - verify create/exercise rendering for `decoded`, `invalid_data`, and `not_available`
- `frontend/src/views/ContractDetailView.vue`
  - render contract payload decode states
- `frontend/src/views/ContractDetailView.test.ts`
  - verify contract payload rendering for all decode states
- `frontend/src/styles.css`
  - add styles for recursive decoded-value blocks and quiet unavailable states

### Task 1: Lock the backend/ frontend payload contracts first

**Files:**
- Modify: `backend/src/domain/node.types.ts`
- Modify: `frontend/src/types/updates.ts`
- Modify: `frontend/src/types/contracts.ts`
- Create: `frontend/src/types/daml.ts`
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`
- Modify: `frontend/src/lib/api.test.ts`

- [ ] **Step 1: Write the failing type-shape tests**

Add backend and frontend fixture assertions that expect:

- a shared recursive decoded value schema:

```ts
type DecodedDamlValue =
  | string
  | number
  | boolean
  | { kind: 'contract_id'; value: string }
  | { kind: 'record'; fields: Array<{ label: string; value: DecodedDamlValue }> }
  | { kind: 'variant'; constructor: string; value: DecodedDamlValue | null }
  | { kind: 'enum'; constructor: string }
  | { kind: 'list'; items: DecodedDamlValue[] }
  | { kind: 'optional'; value: DecodedDamlValue | null }
  | { kind: 'text_map'; entries: Array<{ key: string; value: DecodedDamlValue }> }
  | { kind: 'gen_map'; entries: Array<{ key: DecodedDamlValue; value: DecodedDamlValue }> }
  | { kind: 'unit' };
```

- strict decode-state wrappers:

```ts
type DecodeState<T> =
  | { status: 'decoded'; value: T }
  | { status: 'invalid_data'; reason: 'missing_package' | 'invalid_package' | 'unknown_template' | 'unknown_choice' | 'decode_failure' }
  | { status: 'not_available' };
```

- create payloads use one `DecodeState<DecodedDamlValue>`
- exercise payloads use independent `argument` and `result` states
- contract detail uses one `DecodeState<DecodedDamlValue>`

- [ ] **Step 2: Run the failing tests**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts`

Expected: FAIL because backend fixtures and response types still use flat maps.

Run: `rtk npm test --workspace frontend -- src/lib/api.test.ts`

Expected: FAIL because the typed API fixtures in `src/lib/api.test.ts` still use the pre-decoder flat-map contract.

- [ ] **Step 3: Add the minimal shared types**

Update the backend and frontend types so the compile-time contract is explicit before any decoder work starts.

Use string serialization for:

- `Int64`
- `Numeric`
- `Date`
- `Timestamp`

Keep JS-safe numeric values in the generic type as `number`, matching the approved spec.

- [ ] **Step 4: Re-run the focused tests**

Run: `rtk npm run build --workspace backend`

Expected: PASS or fail only on still-unimplemented service logic.

Run: `rtk npm test --workspace frontend -- src/lib/api.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/domain/node.types.ts frontend/src/types/daml.ts frontend/src/types/updates.ts frontend/src/types/contracts.ts backend/test/pqs/pqs-summary.service.spec.ts frontend/src/lib/api.test.ts
git commit -m "feat: define generic DAML decode contracts"
```

### Task 2: Add SQLite package-cache read APIs

**Files:**
- Modify: `backend/src/packages/package-cache.service.ts`
- Modify: `backend/test/packages/package-cache.service.spec.ts`

- [ ] **Step 1: Write the failing package-cache tests**

Extend `backend/test/packages/package-cache.service.spec.ts` to expect:

- `getPackage(packageId)` returning the stored blob and metadata
- `listPackages()` returning stored package IDs and metadata
- `getPackage('missing')` returning `null`

Example assertion:

```ts
expect(service.getPackage('package-a')).toEqual({
  packageId: 'package-a',
  name: 'splice-amulet',
  version: '0.1.14',
  uploadedAt: '1782930510606316',
  packageSize: 1466372,
  data: Buffer.from('package-a-data'),
});
```

- [ ] **Step 2: Run the failing package-cache test**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/packages/package-cache.service.spec.ts`

Expected: FAIL because the read APIs do not exist yet.

- [ ] **Step 3: Write the minimal SQLite read implementation**

Add:

- `getPackage(packageId)`
- `listPackages()`

Do not change the existing write schema unless absolutely required by the tests.

- [ ] **Step 4: Re-run the package-cache test**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/packages/package-cache.service.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/packages/package-cache.service.ts backend/test/packages/package-cache.service.spec.ts
git commit -m "feat: add cached package read APIs"
```

### Task 3: Add the package-registry service over cached blobs

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/nest-cli.json`
- Create: `backend/src/packages/daml-lf.proto`
- Create: `backend/src/packages/daml-lf-loader.ts`
- Create: `backend/src/packages/daml-decoder.types.ts`
- Create: `backend/src/packages/package-registry.service.ts`
- Modify: `backend/src/app.module.ts`
- Create: `backend/test/fixtures/daml/package-cache.sqlite`
- Create: `backend/test/fixtures/daml/sample-create-value.bin`
- Create: `backend/test/fixtures/daml/sample-exercise-argument.bin`
- Create: `backend/test/fixtures/daml/sample-exercise-result.bin`
- Create: `backend/test/fixtures/daml/sample-exercise-result-unit.json`
- Create: `backend/test/fixtures/daml/build-sample-values.ts`
- Create: `backend/test/fixtures/daml/build-fixture-cache.ts`
- Create: `backend/test/fixtures/daml/fixture-manifest.ts`
- Create: `backend/test/packages/package-registry.service.spec.ts`

- [ ] **Step 1: Write the failing package-registry tests**

Create `backend/test/packages/package-registry.service.spec.ts` with tests for:

The fixture manifest should export the exact IDs the tests rely on:

```ts
export const SAMPLE_DAML_FIXTURE = {
  packageId: 'a31be0483f3175647053f28965a4e6d97e3dbc433ea2338be303fae69bbcff6a',
  templateId: 'Splice.Amulet:SvRewardCoupon',
  resultChoice: 'SvRewardCoupon_DsoExpire',
  unitChoice: 'Archive',
};
```

- parsing a cached package blob only once
- loading referenced packages on demand
- resolving a template definition by `packageId + templateId`
- resolving a choice definition by `packageId + templateId + choice`
- returning deterministic diagnostics for:
  - missing package
  - invalid package blob
  - unknown template
  - unknown choice

Example shape:

```ts
await expect(
  registry.resolveTemplate({
    packageId: 'package-a',
    templateId: 'Splice.Amulet:SvRewardCoupon',
  }),
).resolves.toEqual({ ok: true, definition: expect.any(Object) });
```

- [ ] **Step 2: Run the failing package-registry test**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/packages/package-registry.service.spec.ts`

Expected: FAIL because no registry service or LF loader exists yet.

- [ ] **Step 3: Add the minimal LF loading and registry implementation**

Concrete implementation choices:

- add `protobufjs` to `backend/package.json`
- update `backend/nest-cli.json` so `daml-lf.proto` is copied as a backend build asset
- vendor the DAML LF protobuf schema in `backend/src/packages/daml-lf.proto`
- create `daml-lf-loader.ts` that loads the schema once
- freeze the registry test inputs under `backend/test/fixtures/daml/`:
  - create `package-cache.sqlite` as a dedicated committed fixture cache containing package `a31be0483f3175647053f28965a4e6d97e3dbc433ea2338be303fae69bbcff6a` and all of its transitive dependencies
  - generate `sample-create-value.bin`, `sample-exercise-argument.bin`, and `sample-exercise-result.bin` only after the protobuf tooling exists
  - keep `sample-exercise-result-unit.json` as the metadata fixture for the `Archive` unit choice
- add the one-off regeneration helpers:
  - `build-fixture-cache.ts` reads from the current checked-in application cache source `backend/data/package-cache.sqlite` and writes the frozen test fixture cache `backend/test/fixtures/daml/package-cache.sqlite`
  - `rtk npm exec --workspace backend ts-node -- test/fixtures/daml/build-fixture-cache.ts`
  - `build-sample-values.ts` reads only from `backend/test/fixtures/daml/package-cache.sqlite` plus the fixed manifest sample values
  - `rtk npm exec --workspace backend ts-node -- test/fixtures/daml/build-sample-values.ts`
- create `PackageRegistryService` that:
  - asks `PackageCacheService` for blobs
  - memoizes parsed packages by `packageId`
  - parses dependencies only when required
  - returns typed resolution results instead of throwing for expected lookup failures

Reuse only the committed fixture cache and committed binary value fixtures from this task in Task 4 so the registry and decoder tests stay aligned and do not depend on `backend/data/package-cache.sqlite` at test runtime.

- [ ] **Step 4: Re-run the package-registry test**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/packages/package-registry.service.spec.ts`

Expected: PASS

Run: `rtk npm run build --workspace backend`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/package.json package-lock.json backend/nest-cli.json backend/src/packages/daml-lf.proto backend/src/packages/daml-lf-loader.ts backend/src/packages/daml-decoder.types.ts backend/src/packages/package-registry.service.ts backend/src/app.module.ts backend/test/fixtures/daml/package-cache.sqlite backend/test/fixtures/daml/sample-create-value.bin backend/test/fixtures/daml/sample-exercise-argument.bin backend/test/fixtures/daml/sample-exercise-result.bin backend/test/fixtures/daml/sample-exercise-result-unit.json backend/test/fixtures/daml/build-fixture-cache.ts backend/test/fixtures/daml/build-sample-values.ts backend/test/fixtures/daml/fixture-manifest.ts backend/test/packages/package-registry.service.spec.ts
git commit -m "feat: add package registry for cached DAR blobs"
```

### Task 4: Build the strict generic decoder service

**Files:**
- Create: `backend/src/packages/generic-daml-decoder.service.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `backend/test/fixtures/daml/build-sample-values.ts`
- Modify: `backend/test/fixtures/daml/fixture-manifest.ts`
- Create: `backend/test/packages/generic-daml-decoder.service.spec.ts`

- [ ] **Step 1: Write the failing generic-decoder tests**

Create `backend/test/packages/generic-daml-decoder.service.spec.ts` with tests that define:

- `decodeCreate()` returns `{ status: 'decoded', value: ... }` for a known create payload
- `decodeExercise()` returns independent `argument` and `result` states
- one non-unit result payload from `sample-exercise-result.bin` decodes successfully
- known unit-returning choices without result bytes return:

```ts
{
  result: { status: 'decoded', value: { kind: 'unit' } }
}
```

- corrupt payload bytes return:

```ts
{ status: 'invalid_data', reason: 'decode_failure' }
```

- corrupted cached package blobs return:

```ts
{ status: 'invalid_data', reason: 'invalid_package' }
```

- missing package or unresolved template/choice return the matching reason code
- no partial nested data is returned for failures

All payload fixtures in this task must come from `backend/test/fixtures/daml/fixture-manifest.ts`; do not generate ad hoc byte arrays inside the test file.

- [ ] **Step 2: Run the failing generic-decoder tests**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/packages/generic-daml-decoder.service.spec.ts`

Expected: FAIL because the decoder service does not exist yet.

- [ ] **Step 3: Write the minimal strict decoder**

Implement `GenericDamlDecoderService` so it:

- receives resolved definitions from `PackageRegistryService`
- decodes versioned create payloads into the recursive `DecodedDamlValue` shape
- decodes exercise argument and result bytes independently
- maps all expected failures to the fixed reason enum
- synthesizes `{ kind: 'unit' }` only for choices whose return type is known to be unit

Do not preserve or return partial nested objects under any failure branch.

- [ ] **Step 4: Re-run the decoder tests**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/packages/generic-daml-decoder.service.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/packages/generic-daml-decoder.service.ts backend/src/app.module.ts backend/test/fixtures/daml/build-sample-values.ts backend/test/fixtures/daml/fixture-manifest.ts backend/test/packages/generic-daml-decoder.service.spec.ts
git commit -m "feat: add strict generic DAML decoder"
```

### Task 5: Replace hard-coded create and contract decoding in `PqsSummaryService`

**Files:**
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`
- Modify: `backend/test/api/nodes.controller.spec.ts`

- [ ] **Step 1: Extend the failing service/controller tests**

Add expectations that:

- create events now return `createData` as a strict decode-state wrapper
- contract detail now returns `contractData` as a strict decode-state wrapper
- `Splice.Amulet:SvRewardCoupon` no longer depends on template-specific decoding helpers
- the controller passes the stricter payloads through unchanged

Explicitly remove old fixture assumptions like:

```ts
createData: { rewardRound: 258, rewardAmount: 20000 }
```

and replace them with recursive decoded-value assertions.

- [ ] **Step 2: Run the failing backend tests**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts test/api/nodes.controller.spec.ts -t \"create|contract\"`

Expected: FAIL because `PqsSummaryService` still uses `decodeKnownContractData()` and reward-coupon-specific helpers.

- [ ] **Step 3: Write the minimal service integration**

In `backend/src/pqs/pqs-summary.service.ts`:

- inject `GenericDamlDecoderService`
- make the normalized event query the preferred update-detail path whenever it is available, because it is the only current path that can supply `contract.instance` and `package_id` for create rows
- keep the legacy event-table query only as a fallback when the normalized tables are unavailable
- propagate `package_id` on create rows and contract detail rows
- replace `decodeKnownContractData()` calls with generic decoder calls
- remove the reward-coupon-specific create/contract decode path once the tests are green

Keep the surrounding query fallback logic intact.

- [ ] **Step 4: Re-run the backend tests**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts test/api/nodes.controller.spec.ts -t \"create|contract\"`

Expected: PASS for create and contract decode flows

- [ ] **Step 5: Commit**

```bash
git add backend/src/pqs/pqs-summary.service.ts backend/test/pqs/pqs-summary.service.spec.ts backend/test/api/nodes.controller.spec.ts
git commit -m "feat: use generic decoder for create and contract payloads"
```

### Task 6: Add exercise package identity and payload-byte decoding

**Files:**
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Modify: `backend/src/domain/node.types.ts`
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Extend the failing exercise-path tests**

Add service tests that define:

- event rows carry package-aware exercise lookup context
- exercise events return:

```ts
exerciseData: {
  argument: { status: 'decoded', value: expect.any(Object) },
  result: { status: 'decoded', value: { kind: 'unit' } }
}
```

or mixed states like:

```ts
exerciseData: {
  argument: { status: 'decoded', value: expect.any(Object) },
  result: { status: 'invalid_data', reason: 'decode_failure' }
}
```

- rows without exposed bytes return `not_available`

- [ ] **Step 2: Run the failing exercise-path tests**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts`

Expected: FAIL because the event queries do not yet expose exercise argument/result bytes or package identity.

- [ ] **Step 3: Write the minimal exercise query and decode integration**

Update `backend/src/pqs/pqs-summary.service.ts` so both the primary and normalized event queries expose:

- `package_id`
- exercise argument bytes
- exercise result bytes where PQS provides them

Add one capability-detection helper before building the exercise SQL, for example:

```ts
async function detectEventPayloadCapabilities(query: (sql: string) => Promise<{ rows: unknown[] }>) {
  return query(`
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'participant'
      and table_name in (
        'lapi_events_consuming_exercise',
        'lapi_events_non_consuming_exercise',
        'lapi_events_deactivate_contract',
        'lapi_events_various_witnessed'
      )
  `);
}
```

Use that capability map to choose a safe query variant:

- if normalized event relations exist, use only the normalized query family for that request
- inside the chosen query family, if a byte column exists, select it normally
- inside the chosen query family, if a byte column does not exist, select `null::bytea as ...` instead of referencing the missing column
- if a chosen query family does not expose `package_id`, select `null::text as package_id`
- consult the legacy query family only when the normalized relations themselves are absent, not merely because a normalized column is missing

This is required so missing columns degrade to `not_available` in the response instead of failing the whole SQL query.

Query-source rules:

- legacy exercise rows should read from:
  - `participant.lapi_events_consuming_exercise.exercise_argument`
  - `participant.lapi_events_consuming_exercise.exercise_result`
  - `participant.lapi_events_consuming_exercise.package_id` when present
  - `participant.lapi_events_non_consuming_exercise.exercise_argument`
  - `participant.lapi_events_non_consuming_exercise.exercise_result`
  - `participant.lapi_events_non_consuming_exercise.package_id` when present
- normalized create rows should continue joining `participant.par_contracts` for `package_id`
- normalized exercise rows should read payload bytes from:
  - `participant.lapi_events_deactivate_contract.exercise_argument`
  - `participant.lapi_events_deactivate_contract.exercise_result`
  - `participant.lapi_events_various_witnessed.exercise_argument`
  - `participant.lapi_events_various_witnessed.exercise_result`
- when normalized exercise rows need `package_id`, join `participant.par_contracts` on `contract.contract_id = event.contract_id` where that contract row is still available
- if any one of those byte or package columns is unavailable in the current PQS schema variant, keep the row in the response and return `not_available` for the missing decode state instead of adding more schema-discovery work in this slice

Then:

- normalize those raw byte columns into the internal event row model
- call `decodeExercise(templateId, packageId, choice, argumentBytes, resultBytes)`
- preserve the spec semantics for:
  - `decoded`
  - `invalid_data`
  - `not_available`
  - unit-result synthesis

Remove the remaining reward-coupon-specific exercise code when the generic path is green.

- [ ] **Step 4: Re-run the service tests**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/pqs/pqs-summary.service.ts backend/src/domain/node.types.ts backend/test/pqs/pqs-summary.service.spec.ts
git commit -m "feat: decode exercise payloads through package-aware generic path"
```

### Task 7: Add the recursive frontend renderer and update the detail pages

**Files:**
- Create: `frontend/src/components/DecodedDamlValue.vue`
- Create: `frontend/src/components/DecodedDamlValue.test.ts`
- Modify: `frontend/src/views/UpdateDetailView.vue`
- Modify: `frontend/src/views/UpdateDetailView.test.ts`
- Modify: `frontend/src/views/ContractDetailView.vue`
- Modify: `frontend/src/views/ContractDetailView.test.ts`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Write the failing frontend rendering tests**

Add tests that expect:

- records render labeled field rows
- variants render their constructor and nested value
- lists and maps render nested entries
- `{ kind: 'contract_id', value: '...' }` renders as a link to `/nodes/:id/contracts/:contractId`
- `invalid_data` renders a compact “data found but could not be decoded” notice
- `not_available` stays quiet by default on both update-detail and contract-detail pages

- [ ] **Step 2: Run the failing frontend tests**

Run: `rtk npm test --workspace frontend -- src/components/DecodedDamlValue.test.ts src/views/UpdateDetailView.test.ts src/views/ContractDetailView.test.ts`

Expected: FAIL because the recursive renderer and decode-state rendering do not exist yet.

- [ ] **Step 3: Write the minimal recursive renderer and page wiring**

Create `DecodedDamlValue.vue` to recursively render:

- record fields
- variant constructors
- enum constructors
- lists
- optionals
- text maps
- generic maps
- unit
- contract-id links

Then update `UpdateDetailView.vue` and `ContractDetailView.vue` so they:

- render decoded values through `DecodedDamlValue`
- show invalid-data notices from `reason`
- omit `not_available` blocks by default

- [ ] **Step 4: Re-run the frontend tests**

Run: `rtk npm test --workspace frontend -- src/components/DecodedDamlValue.test.ts src/views/UpdateDetailView.test.ts src/views/ContractDetailView.test.ts`

Expected: PASS

Run: `rtk npm exec --workspace frontend vue-tsc -- --noEmit`

Expected: PASS

Run: `rtk npm run build --workspace frontend`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/DecodedDamlValue.vue frontend/src/components/DecodedDamlValue.test.ts frontend/src/views/UpdateDetailView.vue frontend/src/views/UpdateDetailView.test.ts frontend/src/views/ContractDetailView.vue frontend/src/views/ContractDetailView.test.ts frontend/src/styles.css
git commit -m "feat: render generic DAML decode states in detail views"
```

### Task 8: Full regression verification

**Files:**
- Modify: `backend/test/packages/package-sync.service.spec.ts` only if package-cache read additions require fixture updates
- Modify: `frontend/src/lib/api.ts` only if type narrowing needs runtime helper adjustments

- [ ] **Step 1: Run the focused backend suite**

Run: `rtk npm test --workspace backend -- --runTestsByPath test/packages/package-cache.service.spec.ts test/packages/package-registry.service.spec.ts test/packages/generic-daml-decoder.service.spec.ts test/packages/package-sync.service.spec.ts test/pqs/pqs-summary.service.spec.ts test/api/nodes.controller.spec.ts`

Expected: PASS

- [ ] **Step 2: Run the focused frontend suite**

Run: `rtk npm test --workspace frontend -- src/lib/api.test.ts src/components/DecodedDamlValue.test.ts src/views/UpdateDetailView.test.ts src/views/ContractDetailView.test.ts`

Expected: PASS

- [ ] **Step 3: Run both builds**

Run: `rtk npm run build --workspace backend`

Expected: PASS

Run: `rtk npm run build --workspace frontend`

Expected: PASS

- [ ] **Step 4: Make any minimal fixture/runtime adjustments surfaced by verification**

Keep any fixes narrowly scoped to:

- stale test fixtures
- compile-only type mismatches
- renderer assumptions that conflict with the shared decoded-value contract

- [ ] **Step 5: Commit**

```bash
git add backend/test/packages/package-sync.service.spec.ts frontend/src/lib/api.ts
git commit -m "test: finalize generic decoder regression coverage"
```

If neither file changes, skip this commit.
