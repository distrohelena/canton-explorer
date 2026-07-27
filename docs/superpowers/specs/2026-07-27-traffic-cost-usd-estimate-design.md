# Traffic Cost USD Estimate Design

## Goal

Show an estimated USD value for every update in the updates list and update
detail views, based on the node's latest traffic purchase and the Canton Coin
price on that purchase day.

## Calculation

For each node, use the latest traffic purchase returned by the existing
`AmuletRules_BuyMemberTraffic` PQS history, ordered newest first. This is the
latest purchase overall for the node, and the same purchase is used for every
visible update for that node; it is not time-matched separately for each
update.

```text
traffic CC per byte = amuletPaid / purchasedTraffic
purchase-day CC USD price = cross-venue median close for the purchase UTC day
estimated USD = paid_traffic_cost * traffic CC per byte * purchase-day CC USD price
```

`paid_traffic_cost` is read from `__transactions` and is an update-level
metadata field. It is not derived from individual event rows. It represents a
non-negative integer of Canton traffic-cost units: the protocol's calculated
byte-equivalent traffic amount, which can differ from raw serialized payload
bytes because recipient count and protocol parameters affect the cost. It uses
the same traffic-unit scale as `purchasedTraffic`, so the ratio below is
dimensionally valid. The latest purchase is scoped per node because traffic
balances and purchases belong to a participant node.

The market feed exposes CC/USDT candles. For this estimate only, USDT is
treated as USD at a 1:1 value; no separate FX feed is introduced. The
purchase-day price is computed in the backend from the UTC calendar day of the
purchase record. Only same-quote USDT closes are eligible, and at least two
venue closes are required; their median is used. The numeric candle median is
quantized with JavaScript `Number.toFixed(8)` and then parsed as an exact
decimal before the final arithmetic. Non-finite or non-positive values are
ineligible.

The estimate is an approximation and is only returned when all required inputs
are valid: positive purchased traffic, valid CC paid, a positive historical CC
price for the purchase day, and a valid non-negative paid traffic cost. Missing
or unavailable inputs produce `null`, rendered as `—`.

## Backend

- Add `estimatedTrafficUsd: string | null` to update list entries. The field is
  always present, with `null` when unavailable. The raw `paidTrafficCost`
  remains an internal query value and is not added to the public response.
- Add `estimatedTrafficUsd: string | null` as a top-level typed field on the
  update detail response, keeping it out of the untyped `meta` object. The
  field is always present, with `null` when unavailable.
- Select `tx.paid_traffic_cost::text` in recent-update and single-update query
  paths before any JavaScript conversion. The global and party recent-update
  merges must copy the estimate field without recalculating it. The estimate
  is included in the node, global, party, and namespace recent-update views;
  standalone search-result rows remain out of scope because they use a
  separate response contract.
- Reuse the existing traffic-purchase decoding path and Canton Coin daily
  history service through a backend estimate service. A short-lived history
  cache prevents one market fan-out per updates request. Market failures,
  traffic-purchase query/decode failures, and cache refresh failures make
  estimates `null` without failing or dropping the updates response. A failed
  refresh may use a still-valid cached history; an expired or unavailable
  cache produces `null`.
- Perform decimal arithmetic with scaled integers/`BigInt`, not binary
  floating-point operations. Parse `amuletPaid` as a decimal, represent the
  eight-decimal daily CC price as a scaled integer, multiply by the integer
  `paid_traffic_cost`, divide by `purchasedTraffic`, and round the resulting
  USD amount to two decimal places using half-up rounding. Return a stable
  two-decimal string such as `"12.34"` or `null`.

## Frontend

- Add the always-present nullable estimate fields to update and namespace
  recent-update response types.
- Add an `Est. USD` column to the updates table, preserving existing row
  navigation and responsive behavior.
- Add an `Estimated traffic cost` item to update detail summary.
- Add an `Est. USD` value to each namespace recent-update row beside its
  existing timestamp metadata, preserving its link to the node update detail.
- Render `—` when the backend cannot produce an estimate.

## Testing

- Test decimal calculation, half-up cent rounding, same-quote median selection,
  latest-overall purchase semantics, and invalid-input fallbacks.
- Test recent-update, global merge, and single-update paths preserve
  `paid_traffic_cost` long enough to calculate the estimate.
- Test API response mapping for list and top-level detail estimates.
- Test the updates table, namespace recent-update list, and update detail
  render the estimate and fallback.
