# DAML-LF SDK Package Registry Design

## Goal

Replace the explorer's custom `protobufjs`-based DAML-LF package registry with the `canton-typescript-sdk/daml-lf` package loader and semantic model.

This is the first migration step only.

The current runtime value decoder stays in place for now.

## Scope

This design covers:

- replacing archive/package parsing inside `PackageRegistryService`
- replacing template, choice, datatype, and package-inspection indexing with SDK-backed structures
- preserving current response contracts and failure semantics used by the rest of the backend
- removing the backend's dependency on the custom archive package protobuf loader for the registry path

This design does not cover:

- rewriting `DamlValueDecoderService`
- changing decoded event/contract payload output shapes
- changing frontend contracts
- changing package cache persistence

## Current State

Today the explorer has two separate custom DAML-LF layers:

1. `PackageRegistryService`
   - reads cached package bytes from `PackageCacheService`
   - decodes `daml_lf.Archive`, `ArchivePayload`, and `daml_lf_2.Package` with `protobufjs`
   - builds custom `ResolvedPackage`, `ResolvedTemplate`, and `ResolvedDataType` indexes

2. `DamlValueDecoderService`
   - uses the registry's custom raw LF type shapes to interpret versioned values
   - already works against current explorer APIs and UI expectations

The risk in replacing both together is that package-model migration and value-decoder migration would fail in the same area and be harder to isolate.

## Requirements

### Functional

- package inspection must still return:
  - package id
  - package name
  - package version
  - module list and counts
  - template list and counts
  - datatype list and counts
- template lookup by `packageId + templateId` must behave exactly as today
- choice lookup by `packageId + templateId + choice` must behave exactly as today
- datatype lookup by `packageId + typeId` must behave exactly as today
- current failure reasons must remain stable:
  - `missing_package`
  - `invalid_package`
  - `unknown_template`
  - `unknown_choice`
  - `unknown_data_type`

### Non-Functional

- no frontend changes required
- no API contract changes required
- minimize impact on `DamlValueDecoderService`
- tests must prove the registry still supports the existing package detail and update detail paths

## Options

### Option 1: Replace Only `PackageRegistryService`

Use the SDK package loader in `PackageRegistryService`, but keep the current value decoder untouched.

Pros:

- smallest safe step
- isolates archive/model migration from runtime value decoding
- preserves current API contracts
- easiest to debug if package lookups regress

Cons:

- temporary coexistence of SDK-backed registry plus legacy decoder types
- one more migration step remains afterward

### Option 2: Replace Registry and Value Decoder Together

Move both package loading and value decoding onto SDK types in one pass.

Pros:

- cleaner end state immediately
- removes more legacy code at once

Cons:

- much larger blast radius
- harder to isolate failures
- higher risk of breaking update detail / contract detail decoding

### Option 3: Add a Parallel SDK Registry Behind a Toggle

Keep the current registry and build an alternate SDK registry behind a feature flag or environment switch.

Pros:

- easiest rollback path
- side-by-side comparison possible

Cons:

- duplicates logic
- adds operational complexity
- unnecessary for a local explorer unless step 1 proves too risky

## Recommendation

Use Option 1.

That gives a clean, incremental migration:

1. replace only package archive/model loading
2. keep current decoder behavior stable
3. verify package lookup and inspection behavior
4. migrate runtime value decoding in a separate step afterward

## Target Architecture

### Registry Responsibilities

`PackageRegistryService` remains the public backend boundary for:

- `resolveTemplate`
- `resolveChoice`
- `resolveDataType`
- `inspectPackage`

Its internals change from:

- custom raw protobuf structures

to:

- SDK `DamlLfPackageLoader`
- SDK `DamlLfPackage`
- SDK `DamlLfCompilation`
- SDK `DamlLfSemanticModel`

### Internal Model Strategy

The service should still return the explorer's current resolved result contracts.

That means we do not expose SDK classes directly outside the registry yet.

Instead, the service builds a compatibility index from SDK types:

- `templatesById`
- `dataTypesById`
- package/module/template/datatype metadata used by package inspection

This keeps all downstream code stable while swapping the source model.

### Proposed Internal Shape

The registry cache should store an SDK-backed resolved package object that contains:

- package id
- package name
- package version
- the loaded SDK package
- the compilation
- the semantic model
- compatibility lookup maps for templates and datatypes

The explorer compatibility types can be revised internally so they no longer depend on raw protobuf interned-string structures.

## Data Mapping

### Package Loading

When loading from `PackageCacheService`:

1. read cached package bytes
2. call SDK `DamlLfPackageLoader.loadPackageOrThrow`
3. if loading fails, cache `invalid_package`
4. if package bytes are absent, cache `missing_package`

### Template IDs

Build explorer template ids in the existing format:

- `Module.Name:EntityName`

The SDK package model already exposes module, template, and name structure directly, so the registry no longer needs to reconstruct names from interned dotted names.

### Choice Resolution

Choices are resolved by:

- template lookup first
- then exact match on SDK choice name

Returned choice definitions must still preserve:

- package id
- template id
- choice name
- template reference

### Datatype Resolution

Datatypes are indexed by the same current explorer key:

- `Module.Name:TypeName`

Record field and choice metadata needed later by the value-decoder migration should be retained in the registry cache where useful, but not yet exposed differently.

## Interaction With `DamlValueDecoderService`

This step intentionally avoids rewriting the value decoder.

To keep that stable, the registry should continue exposing the compatibility information the decoder currently needs.

That implies one of two sub-approaches internally:

1. Keep current `daml-decoder.types.ts` result interfaces and adapt SDK package data into them.
2. Introduce a smaller compatibility layer specifically for the decoder while leaving the registry public methods unchanged.

Recommended sub-approach:

- adapt SDK data into the current registry result interfaces first

Reason:

- smaller downstream diff
- fewer simultaneous code changes
- easier regression testing

## Error Handling

The new registry should preserve current behavior:

- no package bytes -> `missing_package`
- SDK parse/load failure -> `invalid_package`
- missing template -> `unknown_template`
- missing choice -> `unknown_choice`
- missing datatype -> `unknown_data_type`

Unexpected runtime exceptions should not leak raw SDK exceptions through the existing service contract.

## Testing

### Unit Tests

Add or update tests for:

- loading a valid cached package through the SDK path
- package inspection results
- template lookup
- choice lookup
- datatype lookup
- `missing_package`
- `invalid_package`

### Integration-Style Backend Tests

Existing tests that exercise:

- package detail page
- update detail decoding preconditions
- contract detail package metadata

should continue to pass without API changes.

### Regression Focus

The main regressions to guard against are:

- package names/versions disappearing
- template ids changing format
- choice names not matching current normalized expectations
- datatype ids changing format

## Implementation Order

1. Refactor registry internals to load packages through SDK `DamlLfPackageLoader`
2. Build compatibility indexes from SDK package/module/template/datatype structures
3. Keep current public registry method signatures unchanged
4. Update registry tests to prove SDK-backed behavior
5. Run full backend tests and build
6. Leave `DamlValueDecoderService` unchanged

## Follow-Up

The second DAML-LF migration step should replace the custom value-decoder type traversal with SDK semantic-model-backed decoding.

That follow-up can then safely remove more of:

- `loadValueRoot()`/custom protobuf plumbing
- raw LF compatibility structures that only exist for the old decoder
