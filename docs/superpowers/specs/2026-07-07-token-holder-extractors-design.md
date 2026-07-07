# Token Holder Extractors Design

## Goal

Make token holder discovery generic across known token-balance schemas so the token detail page can show holders for Canton Coin as well as CIP56 tokens.

## Current Problem

`Top Holders` currently works only for:

- `Splice.Api.Token.HoldingV1:Holding`

That means:

- CIP56-style tokens can show holders
- `canton-coin` cannot, even when active `Splice.Amulet:Amulet` contracts clearly encode balances

The current implementation is not actually generic. It is hard-wired to one schema.

## Chosen Approach

Introduce a schema-aware holder extraction pipeline.

This is generic in the right way:

- multiple known holder schemas can participate
- each schema explicitly defines how to read token identity, party identity, and balance
- no heuristic guessing from arbitrary decoded contracts

## Supported Holder Schemas

### 1. CIP56 Holding

Template:

- `Splice.Api.Token.HoldingV1:Holding`

Extraction rules:

- `tokenId` from `instrumentId.id`
- `partyId` from `owner`
- `amount` from `amount`

### 2. Canton Coin Amulet

Template:

- `Splice.Amulet:Amulet`

Extraction rules:

- `tokenId = canton-coin`
- `partyId` from `owner`
- `amount` from `amount.initialAmount`

This is an explicit holder schema for Canton Coin, not a heuristic.

## Aggregation Semantics

Holder aggregation should be done by:

- `(tokenId, partyId)`

For each grouped holder:

- sum all active observed balances for that token and party
- preserve the distinct observing node list

This changes semantics from the current “keep one best amount” behavior into “sum active balances per party”.

That is the correct behavior for active Amulet balances and remains reasonable for explicit holding contracts.

## Why Not Use Heuristics

We should not classify any decoded contract with fields like `owner` and `amount` as a token holding.

That would create false positives because many unrelated contracts may have similarly named fields.

The extractor list must remain explicit and schema-based.

## WalletInstall

`WalletInstall` should not be included unless it actually represents token balance state.

At the moment, the intended balance-bearing Canton Coin contract is `Splice.Amulet:Amulet`, so that is the correct source for holder rows.

## Backend Changes

The backend holder pipeline should be refactored so holder extraction does not live behind a single `HoldingV1` condition.

Instead:

- holder queries include all supported holder-bearing templates
- each row is normalized through a small schema-aware extraction path
- `fetchTokenHolders()` aggregates extracted rows by token and party

This keeps future token-holder support additive instead of forcing more special cases into one branch.

## Frontend Impact

No API shape changes are required.

The frontend already supports:

- `tokenId`
- `partyId`
- `amount`
- `nodes`

Once the backend returns Canton Coin holders, the existing token detail page can render them without structural UI changes.

## Testing

Add backend coverage for:

- CIP56 holders still decoding correctly
- Canton Coin holders extracted from active `Splice.Amulet:Amulet` contracts
- multiple active Amulets for one party summing correctly
- node lists remaining deduplicated
- unknown tokens still returning `Token not found`

Frontend changes should not need new behavior tests unless rendering changes are introduced.

## Recommendation

Implement explicit holder extractors for:

- `Splice.Api.Token.HoldingV1:Holding`
- `Splice.Amulet:Amulet`

and aggregate balances by summing all active observed contracts per `(tokenId, partyId)`.

That gives us a genuinely extensible holder model without unsafe inference.
