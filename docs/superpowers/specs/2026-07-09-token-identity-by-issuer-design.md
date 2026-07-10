# Token Identity By Issuer Design

## Goal

Make token identity issuer-aware so tokens with the same name or symbol but different issuers are treated as distinct assets everywhere in the explorer.

## Current Problem

The explorer currently derives `tokenId` from token-local fields such as:

- CIP56: `instrumentId.id`
- CIP112: `symbol`, `instrumentIdText`, or `instrumentId.id`

That is insufficient because multiple issuers can publish tokens with the same logical name or symbol. Today those collide in:

- `/tokens`
- `/tokens/:tokenId`
- token transfer aggregation
- token holder aggregation
- token routing and deep links

## Approved Approach

Use issuer-aware token identity as the canonical explorer key.

- Keep `name` as a display label.
- Add `issuer` to token summaries and details.
- Build `tokenId` from both issuer and the token-local identifier when issuer is available.
- Preserve the existing `canton-coin` special case.

## Identity Rules

### Canton Coin

Keep the existing fixed token id:

- `canton-coin`

### CIP56

Use:

- intrinsic id: `instrumentId.id`
- issuer: issuer-like field if present in decoded contract data

Canonical token id:

- `<issuer>::<instrumentId.id>` when issuer is present
- fallback to `instrumentId.id` only when issuer is not present

### CIP112

Use:

- intrinsic id: `symbol`, else `instrumentIdText`, else `instrumentId.id`
- issuer: `issuer`

Canonical token id:

- `<issuer>::<intrinsic-id>` when issuer is present
- fallback to intrinsic id only when issuer is not present

## UI Impact

To keep duplicate-looking tokens understandable:

- show `issuer` in the token inventory cards
- show `issuer` in token detail overview

Transfers and holders can continue to use `tokenId` routing, because the canonical id becomes unique.

## Testing

Add coverage for:

- token discovery returning two same-name tokens from different issuers as separate rows
- transfer and holder filtering using issuer-aware `tokenId`
- token detail lookup using the issuer-aware route key
- frontend token list and token detail rendering the issuer metadata
