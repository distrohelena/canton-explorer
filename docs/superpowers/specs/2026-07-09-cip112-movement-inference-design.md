# CIP112 Movement Inference Design

## Goal

Show meaningful token movement history for deployed CIP112/V2-style tokens even when the node does not emit explicit V2 `EventLog` transfer events.

## Current Context

- The explorer already discovers CIP112 token balances and holders from `HoldingV2`-style create events.
- The current transfer browser only recognizes:
  - Canton Coin movement templates
  - CIP56/V1 transfer instruction templates
- On `cnqs-extra-1`, the observed CIP112 activity does not appear as:
  - V2 `EventLog` transfer events
  - `TransferInstructionV2` contracts
- The observed activity does appear as holding lifecycle patterns inside updates:
  - `TestUnderlyingToken.MintUnderlying` creating `TestUnderlyingHolding`
  - `TestUnderlyingHolding.TransferUnderlying` consuming a holding and creating a replacement holding
  - same-update creation of `ShareHolding`

## Scope

Phase 1 covers inferred movement rows derived from observable CIP112 update patterns.

Phase 1 does not attempt to:

- prove full semantic meaning of application-specific flows
- hardcode vault-specific domain labels
- require explicit V2 event packages
- redesign the token UI

## Design

### Core Approach

Treat CIP112 token history as an inferred movement feed derived from update-local event patterns.

Each inferred movement becomes its own row. A single update may generate multiple rows.

### Movement Types

Phase 1 uses only generic, safe movement labels:

- `Mint`
- `Holding Transfer`
- `Share Mint`
- `Burn` (only if a safe pattern is observed and implemented)

Application-specific labels such as `Vault Deposit` are explicitly out of scope for Phase 1 because they depend on package semantics, not just standard token behavior.

### Inference Rules

#### Rule 1: Mint

Observed pattern:

- non-consuming exercise on a token template such as `MintUnderlying`
- create of a holding template in the same update

Emit one `Mint` row for the created holding token.

#### Rule 2: Holding Transfer

Observed pattern:

- consuming exercise on a `HoldingV2:Holding` implementation such as `TransferUnderlying`
- create of a replacement holding in the same update

Emit one `Holding Transfer` row for the created holding token.

Directionality must be conservative:

- `toParty` may be inferred from the created holding owner/account when visible
- `fromParty` is only set when directly visible from consumed/created data
- otherwise leave it null

#### Rule 3: Share Mint

Observed pattern:

- same update as another CIP112 holding transfer flow
- create of a share-like holding such as `ShareHolding`

Emit one `Share Mint` row for the created share token.

### Unknown Patterns

If an update contains CIP112 activity but does not match a safe rule, emit no row.

Accuracy is preferred over completeness.

## Data Model Changes

Extend token transfer summaries with:

- `rowId`
- `movementType`
- `source`

Where:

- `rowId` is stable per inferred movement row
- `movementType` is one of the inferred labels above
- `source` is an explicit provenance marker such as `pqs_inferred_holding_v2`

## UI Behavior

The existing token transfer lists can remain structurally the same.

Add:

- a movement-type pill per row

Allow:

- multiple rows with the same `updateId`
- empty `from` / `to` fields when direction cannot be safely inferred

## Verification Targets

Primary live verification node:

- `cnqs-extra-1`

Known reference offsets:

- `122205`
- `122155`
- `122063`

Expected outcome after implementation:

- `USDCx` shows inferred movement rows
- `vUSDCx-SHARE` shows inferred movement rows
- rows correspond to the observed holding lifecycle patterns

## Risks

- Over-inference could misrepresent app-specific semantics
- Some movements may remain partially directional
- Multiple inferred rows per update may surprise existing UI assumptions

## Non-Goals

- Full CIP112 semantic decoding for every package
- EventLog-first parsing
- Transfer reconstruction across multiple updates
- Application-aware naming such as vault-specific labels
