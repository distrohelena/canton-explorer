# Generic DAR Decoder Design

## Goal

Add a generic backend decoder that uses cached DAML package blobs to fully decode:

- create payloads
- exercise arguments
- exercise results
- contract-detail payloads

The decoder must only return fully decoded data. If bytes are present but cannot be fully decoded, the API should return an explicit invalid-data state rather than a partial value tree.

## Scope

Included:

- backend package-registry and generic decode services
- package-cache read APIs needed by the decoder
- update-detail API enrichment for generic create and exercise decoding
- contract-detail API migration to the same generic decode path
- frontend handling for decoded vs invalid-data states
- tests covering decode success and decode failure behavior

Excluded:

- partial or best-effort decoding
- frontend redesign beyond rendering the new decode states
- persistent decoded-value caching
- package download outside the existing PQS-backed package cache flow
- arbitrary ad hoc template-specific decoders as the primary path

## Current Problem

The update-detail and contract-detail flows can fetch raw contract-instance bytes, but they only decode a narrow set of known templates today.

This creates two problems:

- valid create and contract payloads often show no data even when bytes are present
- exercise data is handled through a special-case path instead of a generic package-aware decoder

The user wants generic decoding based on installed DAR/package data, with strict semantics:

- fully decoded values are shown
- undecodable values are not partially rendered
- the UI should still make clear that invalid or undecodable data was found

## Recommended Approach

Build a backend-only generic decoder on top of the existing SQLite package cache.

The flow is:

1. package sync continues storing raw PQS package blobs in `package-cache.sqlite`
2. a new package-registry service lazily parses cached packages into a reusable in-memory definition registry
3. a new generic decoder service resolves template and choice definitions from that registry
4. update-detail and contract-detail endpoints delegate all payload decoding to that generic decoder
5. the API returns either:
   - `decoded` with a complete JSON-safe value
   - or `invalid_data` with a machine-readable reason and no partial value tree

This keeps persistence simple, avoids reparsing packages on every request, and replaces narrow hard-coded decoders with one shared decode path.

## Alternatives Considered

### Option 1: Generic decoder over cached package blobs with in-memory registry

Pros:

- fits the existing PQS package-cache architecture
- avoids introducing another persistent metadata schema
- gives one shared decode path for create, exercise, and contract-detail payloads
- supports on-demand loading instead of full startup scans

Cons:

- requires package parsing and type-resolution infrastructure in-process
- cold decode for a previously unseen package will cost more than warm decode

Recommendation:

- choose this option

### Option 2: Parse packages once and persist extracted metadata in SQLite

Pros:

- lower cold-request overhead
- deterministic metadata reuse across restarts

Cons:

- adds another persistence model and schema migration burden
- more implementation surface before delivering user-visible value

### Option 3: Parse cached blobs from scratch on every decode request

Pros:

- smallest first implementation

Cons:

- repeats expensive work
- creates inconsistent latency
- becomes harder to maintain once create payloads and exercise payloads share the same package graph

This option should not be used.

## Architecture

### Package Cache

`PackageCacheService` remains the system of record for raw package blobs.

Add read APIs for:

- fetching a package blob by `packageId`
- listing cached package IDs
- fetching package metadata for diagnostics when needed

The existing write path from `PackageSyncService` stays unchanged.

### Package Registry

Add `PackageRegistryService` with one responsibility: transform cached package blobs into a resolved in-memory registry of packages, templates, choices, and types.

Responsibilities:

- lazily load package blobs from `PackageCacheService`
- parse each package at most once per backend process
- recursively load referenced packages as required by the current decode target
- resolve:
  - template definitions by `templateId`
  - choice definitions by `templateId + choice`
  - package availability and parse-failure diagnostics

Non-responsibilities:

- querying PQS directly
- formatting frontend data
- deciding API status codes

### Generic Decoder

Add `GenericDamlDecoderService` with one responsibility: fully decode raw payload bytes using definitions provided by `PackageRegistryService`.

Entry points:

- `decodeCreate(templateId, packageId, contractInstance)`
- `decodeExercise(templateId, packageId, choice, argumentBytes, resultBytes)`
- `decodeContract(templateId, packageId, contractInstance)`

Output contract:

- success:
  - `status: "decoded"`
  - decoded JSON-safe `value`, `argumentValue`, and/or `resultValue`
- failure:
  - `status: "invalid_data"`
  - `reason`
  - no partial value tree

The decoder must never return partially decoded nested objects.

### Canonical Decoded Value Shape

All decoded payloads should use one shared recursive JSON-safe schema so backend serialization, frontend rendering, and tests all target the same contract.

Suggested shape:

- scalar values:
  - `string`
  - `number`
  - `boolean`
  - `null`
- contract references:
  - `{ kind: "contract_id", value: string }`
- records:
  - `{ kind: "record", fields: Array<{ label: string; value: DecodedDamlValue }> }`
- variants:
  - `{ kind: "variant", constructor: string; value: DecodedDamlValue | null }`
- enums:
  - `{ kind: "enum", constructor: string }`
- lists:
  - `{ kind: "list", items: DecodedDamlValue[] }`
- optionals:
  - `{ kind: "optional", value: DecodedDamlValue | null }`
- text maps:
  - `{ kind: "text_map", entries: Array<{ key: string; value: DecodedDamlValue }> }`
- generic maps:
  - `{ kind: "gen_map", entries: Array<{ key: DecodedDamlValue; value: DecodedDamlValue }> }`
- unit:
  - `{ kind: "unit" }`

`DecodedDamlValue` should be the shared backend/frontend type alias for this recursive schema.

Contract-id references should remain explicit objects rather than bare strings so the frontend can reliably render them as links without guessing from field names.

### Summary Service Integration

`PqsSummaryService` should stop owning template-specific decode logic.

Responsibilities after the change:

- fetch raw PQS rows
- normalize row identifiers and metadata
- delegate payload decoding to `GenericDamlDecoderService`

This applies to:

- create event payloads in update detail
- exercise argument and result payloads in update detail
- contract payloads in contract detail

Existing reward-coupon-specific decoding should be removed or reduced to tests/reference fixtures once the generic path covers the same data.

## Data Source Changes

### Create Payloads

The normalized event fallback query already carries `contract.instance` for create events. The generic decoder should consume those bytes instead of relying on template-specific logic.

### Exercise Arguments and Results

Update the event query path so exercise rows carry raw argument and result bytes when PQS exposes them.

Design requirement:

- both the primary event-table query and the normalized fallback query should expose enough raw bytes for generic exercise decoding when the underlying schema supports them
- if bytes are absent in the source tables, return `not_available` rather than inventing decoded output
- both query paths should propagate the event's `package_id` or another stable package identity sufficient to resolve the exercised template definition without relying on display-only identifiers

The design assumes `PqsSummaryService` will continue its current fallback strategy across PQS schema variants, but the normalized event contract should be extended to include raw exercise payload bytes.

### Package Identity for Decode

The generic decoder should not rely on display-oriented template identifiers alone when a stable package identifier is available.

Design requirement:

- create events and contract-detail rows should carry `package_id` through the backend normalization path for decoder lookup
- exercise events should also carry `package_id` through the backend normalization path for decoder lookup
- exercise decoding should use the resolved template and choice definitions from the package registry, anchored by package-aware lookups rather than frontend display strings

`package_id` does not need to be rendered in the UI for update events, but it should be available in the backend event model used for decoding.

## API Contract

### Update Detail

Each event keeps its explorer-facing normalized fields and adds strict decode-state blocks.

Create events:

- `createData`
  - `status: "decoded" | "invalid_data" | "not_available"`
  - `value` only when `status === "decoded"`
  - `reason` only when `status === "invalid_data"`

Exercise events:

- `exerciseData`
  - `argument`
    - `status: "decoded" | "invalid_data" | "not_available"`
    - `value` only when `status === "decoded"`
    - `reason` only when `status === "invalid_data"`
  - `result`
    - `status: "decoded" | "invalid_data" | "not_available"`
    - `value` only when `status === "decoded"`
    - `reason` only when `status === "invalid_data"`

Semantics:

- `decoded`: payload bytes were present and fully decoded
- `invalid_data`: payload bytes were found but full decoding failed
- `not_available`: no payload bytes were available from the source tables for that field

Exercise-specific rules:

- argument and result are evaluated independently
- if argument bytes are present and decode cleanly, `argument.status` is `decoded` even if result decoding fails
- if the exercised choice return type is known to be unit and PQS provides no result bytes, `result.status` is `decoded` with `value: { kind: "unit" }`
- if result bytes are absent and the return type is not known to be unit, `result.status` is `not_available`
- no combined top-level exercise status should collapse argument and result into a single ambiguous state

No partial nested objects should be returned under any non-`decoded` state.

### Example Decoded Shapes

Create payload example:

```json
{
  "status": "decoded",
  "value": {
    "kind": "record",
    "fields": [
      { "label": "svParty", "value": "sv::1220abc" },
      { "label": "coupon", "value": { "kind": "contract_id", "value": "001fcf..." } },
      {
        "label": "weights",
        "value": {
          "kind": "list",
          "items": [1, 2, 3]
        }
      }
    ]
  }
}
```

Exercise argument example:

```json
{
  "argument": {
    "status": "decoded",
    "value": {
      "kind": "variant",
      "constructor": "Receive",
      "value": {
        "kind": "record",
        "fields": [
          { "label": "round", "value": 258 }
        ]
      }
    }
  },
  "result": {
    "status": "decoded",
    "value": { "kind": "unit" }
  }
}
```

Contract detail example:

```json
{
  "status": "invalid_data",
  "reason": "decode_failure"
}
```

### Contract Detail

`contractData` should use the same pattern:

- `status: "decoded" | "invalid_data" | "not_available"`
- `value` only when fully decoded
- `reason` only when invalid data was found

This keeps contract detail and update detail aligned on one decode-state model.

## Frontend Behavior

The frontend should render data blocks from the decode-state contract rather than assuming decoded objects are always present.

Rules:

- when `status === "decoded"`, render the structured data block
- when `status === "invalid_data"`, show a compact explicit message that data was found but could not be decoded
- when `status === "not_available"`, omit the data block or show a quiet unavailable state depending on the current page pattern

This satisfies the user requirement to surface invalid data without rendering speculative or partial content.

## Error Handling

### Missing Package

If the required package or referenced package is missing from the cache:

- return `invalid_data`
- set `reason` to a specific code such as `missing_package`

### Package Parse Failure

If a cached package blob cannot be parsed:

- return `invalid_data`
- set `reason` to `invalid_package`

### Definition Resolution Failure

If the template or choice cannot be resolved from the loaded package graph:

- return `invalid_data`
- use a reason such as:
  - `unknown_template`
  - `unknown_choice`

### Payload Decode Failure

If payload bytes exist but do not fully decode against the resolved definition:

- return `invalid_data`
- set `reason` to `decode_failure`

### Absent Source Bytes

If PQS does not provide the raw bytes needed for a field:

- return `not_available`
- do not synthesize invalid data

### Reason Codes

`reason` should be modeled as a small fixed enum shared by backend and frontend types.

Initial set:

- `missing_package`
- `invalid_package`
- `unknown_template`
- `unknown_choice`
- `decode_failure`

## File-Level Design

### Backend

`backend/src/packages/package-cache.service.ts`

- add read APIs for cached package blobs and diagnostics

`backend/src/packages/package-sync.service.ts`

- no functional change beyond remaining the producer of cached package blobs

`backend/src/packages/package-registry.service.ts`

- new service for lazy package parsing, dependency loading, and definition lookup

`backend/src/packages/generic-daml-decoder.service.ts`

- new service for strict full-value decoding of create, exercise, and contract payloads

`backend/src/pqs/pqs-summary.service.ts`

- extend normalized event rows to include exercise argument/result bytes where available
- replace hard-coded contract decode logic with generic decoder calls
- replace exercise special-case decode logic with generic decoder calls

`backend/src/domain/node.types.ts`

- update response types for:
  - strict decode-state wrappers
  - create payload data
  - exercise argument and result payload data as separate wrappers
  - contract-detail payload data

`backend/src/app.module.ts`

- register the new package registry and generic decoder services

### Frontend

`frontend/src/types/updates.ts`

- update event and contract payload types to the new decode-state wrappers

`frontend/src/types/contracts.ts`

- update contract-detail payload types to the shared recursive decoded-value schema and decode-state wrappers

`frontend/src/lib/api.ts`

- no major transport changes expected beyond updated types

`frontend/src/views/UpdateDetailView.vue`

- render decoded create and exercise blocks from `status`
- render invalid-data notices when present

`frontend/src/views/ContractDetailView.vue`

- render decoded contract payloads from `status`
- render invalid-data notice when present

## Testing

### Package Registry Tests

- loads a cached package blob once and reuses the parsed definition
- recursively resolves referenced packages
- reports missing-package diagnostics cleanly
- reports invalid-package parse failures cleanly

### Generic Decoder Tests

- fully decodes a known create payload from cached package definitions
- fully decodes a known exercise argument and result
- returns `invalid_data` for corrupt or mismatched payload bytes
- returns `invalid_data` for unresolved template or choice definitions
- returns no partial object on decode failure

### Summary Service Tests

- update detail returns decoded create data through the generic decoder
- update detail returns decoded exercise argument and result data through the generic decoder
- update detail returns `invalid_data` when bytes exist but decoding fails
- update detail returns `not_available` when the underlying row has no argument bytes or no result bytes
- update detail preserves independent argument/result states when one decodes and the other does not
- contract detail returns the same decode-state model as update detail

### Frontend Tests

- decoded create data renders correctly
- decoded exercise argument and decoded exercise result render correctly
- invalid-data state renders an explicit notice
- unavailable state does not render a fake data block
- mixed exercise states render each field according to its own status

## Scope Guard

This slice should not add:

- partial decoding output
- user-configurable decoder strategies
- new persistence for decoded values
- template-specific fallback rendering as a substitute for generic decoding

The success criterion is a single shared generic decode path that either returns a complete decoded value or explicitly signals that found data could not be decoded.
