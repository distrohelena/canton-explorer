# Schema-Qualified PQS Design

## Goal

Make `canton-explorer` work against the PQS layout we actually run by adding a per-node PQS schema setting and removing the `participant.*` SQL path entirely.

## Scope

This slice adds:

- a per-node `pqs.schema` config field
- explicit schema-qualified SQL for PQS relations
- one shared helper for safely qualifying PQS relation names
- `__...`-based query implementations for summary, updates, contracts, parties, tokens, and package reads
- removal of the `participant.*` query family and its fallback branching

This slice does not add:

- database layout auto-detection
- `search_path` manipulation
- support for both PQS schema families at the same time
- gRPC behavior changes beyond continuing to coexist with the PQS path

## Current Problem

The explorer currently mixes two different assumptions about PQS:

- some paths work with `active()` and other already-working behavior
- many SQL paths still hard-code `participant.*` relations such as `participant.lapi_update_meta` and `participant.par_contracts`

Our actual PQS deployments do not expose that `participant` schema. They expose the following PQS relation family instead, sometimes under `public` and sometimes under another schema such as `scribe`:

- `__contracts`
- `__contract_tpe`
- `__events`
- `__exercises`
- `__exercise_tpe`
- `__packages`
- `__transactions`
- `__watermark`

That means the explorer is coupled to the wrong schema family for the deployments we care about.

## Configuration Design

Extend node config so each node can declare its PQS schema explicitly:

```json
{
  "pqs": {
    "connectionUriEnv": "PARTICIPANT_1_PQS_URL",
    "schema": "public"
  }
}
```

Rules:

- `pqs.schema` is optional
- default is `public`
- the value is treated as an SQL identifier, not a free-form SQL fragment
- accepted values must match `^[A-Za-z_][A-Za-z0-9_]*$`
- quoting is applied by the helper after validation; callers never pass pre-quoted schema names

## Backend Design

### PQS Relation Qualification

Add one helper that accepts a node config plus a logical relation name and returns a safely quoted schema-qualified relation reference.

Examples:

- schema `public`, relation `__contracts` -> `"public"."__contracts"`
- schema `scribe`, relation `__packages` -> `"scribe"."__packages"`

This helper is the only place where schema qualification logic should live.

### Query Family

All PQS SQL in the backend should target the following canonical relation set explicitly:

- `__contracts`
- `__contract_tpe`
- `__events`
- `__exercises`
- `__exercise_tpe`
- `__packages`
- `__transactions`
- `__watermark`

This list is based on the live PQS layout we inspected:

- `__contracts` contains contract rows and witness/party arrays
- `__contract_tpe` maps template/type keys to package/module/entity names
- `__events` is the event spine keyed by `pk` and linked to transactions by `tx_ix`
- `__exercises` stores exercise payloads and witness/controller arrays
- `__exercise_tpe` maps exercise type keys to choice/template metadata
- `__packages` contains package identity only: `pk`, `name`, `version`, `id`
- `__transactions` carries update ordering and effective time via `ix`, `offset`, and `effective_at`
- `__watermark` carries the current ingested transaction index and offset

The backend should stop issuing SQL against:

- `participant.lapi_*`
- `participant.par_*`
- `participant.lapi_string_interning`
- `participant.lapi_filter_*`

### Service Updates

### Feature Source Matrix

The implementation plan should treat the following mapping as authoritative:

| Feature | Primary relations | Required joins / columns | Notes |
|---------|-------------------|--------------------------|-------|
| Summary | `__contracts`, `__transactions`, `__watermark` | active contract count from `__contracts.archived_at_ix is null`; latest offset/index from `__watermark`; latest event time and total update count from `__transactions` | Do not rely on `active()` as the only working path |
| Historical activity | `__transactions` | bucket by `effective_at`; count by transaction row | `__transactions` is the update source of truth |
| Recent updates | `__transactions`, `__events`, `__contracts`, `__exercises`, `__contract_tpe`, `__exercise_tpe`, `__packages` | `__events.tx_ix -> __transactions.ix`; create/archive rows from `__contracts.create_event_pk` / `archive_event_pk`; exercise rows from `__exercises.exercise_event_pk`; template/package names from `__contract_tpe`, `__exercise_tpe`, and `__packages` | Build one normalized update row per transaction offset |
| Update detail | `__transactions`, `__events`, `__contracts`, `__exercises`, `__contract_tpe`, `__exercise_tpe`, `__packages` | same join strategy as recent updates, but scoped to one transaction/update; create payload from `__contracts.payload`; exercise payloads from `__exercises.argument` / `__exercises.result` | Event kind comes from source-row classification, not from `participant.*` event tables |
| Contracts list | `__contracts`, `__contract_tpe`, `__transactions`, `__packages` | active rows where `archived_at_ix is null`; create transaction from `created_at_ix -> __transactions.ix`; template metadata from `tpe_pk -> __contract_tpe.pk` | Preserve existing response shape |
| Contract detail | `__contracts`, `__contract_tpe`, `__transactions`, `__packages` | `contract_id`; create and archive transaction metadata from `created_at_ix` / `archived_at_ix`; package identity from `package_pk`; contract data from `__contracts.payload` | |
| Active parties | `__contracts` | distinct union of active-contract `signatories`, `observers`, and `witnesses` arrays | Scope is active-contract visibility, not historic witnesses |
| Search: contracts | `__contracts`, `__contract_tpe`, `__packages` | search by `contract_id`, template metadata, and package identity | |
| Search: updates | `__transactions` | search by `offset` and `transaction_id` | |
| Token holders | `__contracts`, `__contract_tpe`, `__packages` | active token-bearing contracts with balances read from `__contracts.payload`; template resolution through `__contract_tpe` | No package blob dependency for payload access |
| Token transfers | `__contracts`, `__exercises`, `__events`, `__transactions`, `__contract_tpe`, `__exercise_tpe`, `__packages` | classify token movement from create/archive/exercise rows joined through event and transaction keys; use `payload`, `argument`, and `result` JSONB where needed | No package blob dependency for payload access |
| Package list/search | `__packages` | `id`, `name`, `version` | Identity-only PQS metadata |

The key normalization rule is:

- `__transactions` defines the update timeline
- `__events` defines event membership within a transaction
- `__contracts` and `__exercises` provide the typed payload-bearing rows referenced by event keys

### Update Detail Meta Contract

`NodeUpdateDetailResponse.meta` remains present, but under the `__...` PQS family it becomes a synthetic transaction metadata object derived from `__transactions`.

It must include at least:

- `update_id`: `__transactions.transaction_id`
- `record_time`: ISO string derived from `__transactions.effective_at`
- `transaction_ix`: `__transactions.ix`
- `offset`: `__transactions.offset`
- `workflow_id`: `__transactions.workflow_id`
- `domain_id`: `__transactions.domain_id`
- `trace_context`: `__transactions.trace_context`
- `external_transaction_hash`: `__transactions.external_transaction_hash`
- `paid_traffic_cost`: `__transactions.paid_traffic_cost`

This keeps the response contract stable at the shape level while replacing the old raw `participant.lapi_update_meta` payload with an explicit `__transactions`-backed object.

#### `PqsSummaryService`

Replace the current `participant.*` query families with schema-qualified `__...` queries for:

- summary
- recent updates
- historical activity
- update detail
- contracts list
- contract detail
- active parties
- search paths that currently depend on participant relations
- token discovery, token holders, and token transfers

The existing `active()` summary query may remain if it continues to work across target deployments, but it must not be the only path that works. Every feature above needs a real `__...` implementation.

Remove code whose only purpose is choosing between `participant.*` and another layout.

#### `PqsPackageService`

Replace package queries currently pointed at `participant.par_daml_packages` and `participant.par_dar_packages` with schema-qualified `__packages` queries for package identity only.

Important constraints from the live PQS schema:

- `__packages` does not contain raw package bytes
- `__packages` does not contain DAR/main-package linkage
- `__packages` does not contain package upload timestamps or package sizes
- `__contracts.payload` is already `jsonb`
- `__exercises.argument` and `__exercises.result` are already `jsonb`

Package behavior after this change should be explicit:

- package list and package search may use `__packages`
- contract detail, update detail, and token features should read PQS JSON payloads directly and must not depend on package blobs
- raw package blob fetches and DAR/type-definition package detail remain gRPC-backed only
- for `pqs_with_grpc` nodes, keep using gRPC for blob-dependent package features
- for `pqs_only` nodes, blob-dependent package features should return an explicit unavailable/not-available result rather than silently pretending the PQS has that data

This means:

- `NodeContractDetailResponse.contractData`, update-detail `createData`, and update-detail `exerciseData` stay in scope for `pqs_only` nodes, sourced from PQS JSON
- `PackageDetailResponse` becomes the main unavailable path on `pqs_only` nodes unless a future PQS layout provides package blobs
- `PackageDetailResponse.status` should grow a `not_available` variant for this explicit case instead of overloading `missing_package`

Global package-detail precedence must be explicit:

- if any node that has seen the package is `pqs_with_grpc` and can supply the package bytes, use that node as the package-detail source
- if no such node exists, return the global package detail response with `status: not_available`
- package family and package list routes may still surface identity metadata from `__packages` even when detail decode is unavailable

The design should not preserve `participant.*` just to keep the old package SQL path alive.

If one or more existing package features need data that is not present in `__packages`, the implementation should prefer:

- using gRPC when the node is `pqs_with_grpc`, or
- narrowing the explorer feature contract explicitly

### Data Flow

Per request:

1. The controller selects the node.
2. The service reads `node.pqs.schema`, defaulting to `public`.
3. SQL builders qualify every PQS relation with that schema.
4. The service normalizes rows into the existing API response shapes.

This keeps the external API stable while replacing the internal PQS query model.

## Error Handling

If a configured schema or required relation does not exist, surface a clear backend error that identifies:

- the node id
- the configured PQS schema
- the missing relation or failing query family

Do not silently retry against another schema.

## Testing

### Config

- parse accepts omitted `pqs.schema` and defaults it to `public`
- parse accepts explicit schema names such as `scribe`
- parse rejects invalid or empty schema identifiers

### SQL Qualification

- relation helper quotes identifiers correctly
- generated SQL uses the configured schema on every PQS relation reference
- no generated SQL contains `participant.` after this change

### Service Coverage

Update backend tests so they validate the `__...` query family directly for:

- summary
- recent updates
- update detail
- contracts list
- contract detail
- active parties
- token queries
- package reads

Add at least one test that uses a non-default schema such as `scribe` and verifies the emitted SQL is schema-qualified correctly.

Add at least one package-behavior test per node mode:

- `pqs_with_grpc` still supports blob-dependent package features
- `pqs_only` returns the explicit unavailable path for blob-dependent package features

Add update-detail and contract-detail tests that verify:

- `meta` is synthesized from `__transactions`
- payload decoding reads PQS JSON columns rather than package blobs

### Regression Guard

Add a lightweight assertion strategy that fails if new PQS SQL reintroduces `participant.` references in the affected services.

## Migration Notes

After this change:

- explorer support is intentionally limited to the `__...` PQS schema family
- `participant.*` PQS support is removed
- each node can point at a different schema within that family through `pqs.schema`

This is an explicit narrowing of supported PQS layouts to match the deployments we actually run.
