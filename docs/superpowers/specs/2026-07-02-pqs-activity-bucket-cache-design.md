# PQS Activity Bucket Cache Design

## Goal

Replace the current "active contract count delta" activity graph with true PQS update volume, aggregated into fixed 15 minute in-memory buckets per node for the last 30 days.

## Scope

This design only covers the activity history data pipeline used by the home-page graphs.

Included:
- backend activity sampling changes
- in-memory 15 minute bucket aggregation
- activity history API response changes as needed
- frontend graph wiring to display event-volume buckets
- tests for bucketing, slicing, and graph behavior

Excluded:
- persistent storage across backend restarts
- new UI visualizations beyond the existing line chart
- node detail/update detail page redesign
- arbitrary user-selected bucket sizes

## Current Problem

The current graph is misleading for operator activity checks:

- Backend samples are recorded per poll in `NodePollerService`.
- `activityValue` is computed from the absolute change in active contract count between polls.
- A node can process many ledger updates while active contract count stays flat, which renders as a flat or nearly flat line.
- The graph therefore does not answer the operator question "how much happened on this node over time?"

The user wants the graph to represent total events over time and to be cached in memory every fixed interval.

## Recommended Approach

Use `participant.lapi_update_meta` as the source of truth for activity, and aggregate counts into fixed 15 minute per-node buckets in memory.

At each poll:
- fetch the latest total update count from PQS for the node
- compare it with the previously observed total for that node
- compute the delta since the last successful poll
- add that delta to the bucket that corresponds to the current 15 minute interval

This yields a stable series of "updates seen in this 15 minute window" without rescanning historical ranges on every request.

## Why This Approach

### Option 1: Count updates from `lapi_update_meta` and bucket deltas in memory

Pros:
- directly matches the requested "total events" behavior at the update level
- relatively cheap query shape
- avoids joins to event tables
- resilient to nodes whose contract counts stay flat

Cons:
- counts updates, not individual create/exercise rows
- depends on a monotonic total-count query being available per PQS schema

### Option 2: Count event-table rows and bucket those

Pros:
- richer notion of "activity"
- captures per-update fanout

Cons:
- more expensive
- schema-sensitive across the PQS variants already seen in this repo
- unnecessary for the current operator graph

### Option 3: Keep contract-count deltas and just aggregate them

Pros:
- smallest implementation

Cons:
- does not solve the user’s problem
- still produces misleading flat graphs

Recommendation:
- use update counts from `lapi_update_meta`

## Data Model

### Existing Model

Current activity samples carry:
- `timestamp`
- `activityValue`
- `activeContractCount`
- `latestOffset`

The graph currently interprets `activityValue` as chart height.

### New Model Direction

Keep the existing response shape as much as possible, but change the meaning of `activityValue`:
- `activityValue` becomes total PQS updates observed in that 15 minute bucket

Each bucket should still retain:
- `timestamp`
- `activityValue`
- `activeContractCount`
- `latestOffset`

Interpretation:
- `timestamp`: bucket timestamp, represented as the bucket start time or canonical bucket time
- `activityValue`: total updates counted in that bucket
- `activeContractCount`: latest known active contract count for that bucket
- `latestOffset`: latest known offset observed by the end of that bucket

### In-Memory State

Add per-node bucket-tracking state inside `NodeCacheService`:

- rolling bucket series for the last 30 days
- last observed cumulative update count per node
- current bucket identity derived from the timestamp truncated to 15 minutes

Suggested shape:
- `activityHistory: Map<nodeId, StoredActivitySeries>`
- `StoredActivitySeries.samples`: one entry per 15 minute bucket
- `lastObservedUpdateCount`: tracked alongside or within series metadata

No persistence is required. All activity history resets on backend restart.

## Backend Query Changes

### Summary Query

Extend the PQS summary fetch path to also return a cumulative total update count for the node.

Likely source:
- `participant.lapi_update_meta`

Needed value:
- `count(*)` over update meta

The summary service should expose that count as part of the polled snapshot data so `NodePollerService` can compute deltas without issuing a second redundant query.

### Delta Computation

For each successful poll:
- read current cumulative update count
- compare with the last observed cumulative update count for the node
- if no previous count exists, initialize baseline and record zero for the bucket rather than inventing activity
- if current count is lower than previous count, treat it as a reset/discontinuity and reset baseline for that node

Reset/discontinuity cases:
- backend restart with empty memory
- PQS reset or restored database
- unexpected counter regression

Behavior on regression:
- do not emit negative activity
- start a fresh baseline at the new cumulative count
- continue aggregating from there

## Bucketing Rules

### Bucket Size

Fixed bucket size:
- 15 minutes

### Bucket Key

Bucket key is the poll timestamp floored to the nearest 15 minute boundary in UTC.

Examples:
- `12:03` -> `12:00`
- `12:14` -> `12:00`
- `12:15` -> `12:15`

### Bucket Merge Behavior

If multiple polls land in the same bucket:
- sum their deltas into one bucket’s `activityValue`
- update `activeContractCount` to the latest polled value
- update `latestOffset` to the latest polled offset

If a poll lands in a new bucket:
- append a new sample bucket

### Retention

Retain only the last 30 days of buckets in memory.

At 15 minute granularity:
- 4 buckets per hour
- 96 buckets per day
- 2880 buckets per 30 days per node

This is small enough for in-memory retention for the current node counts.

## API Behavior

The existing endpoint can remain:
- `GET /api/nodes/activity-history?days=1|7|30`

Response contract can remain largely unchanged:
- `windowMinutes` may stay as-is for frontend plotting
- `samples` become pre-aggregated bucket samples

Server-side slicing:
- `1 day`: return buckets from the last 24 hours
- `7 days`: return buckets from the last 7 days
- `30 days`: return buckets from the last 30 days

No additional bucket-size parameter is required.

## Frontend Behavior

The current line chart can remain unchanged structurally:
- same card layout
- same route behavior
- same `1 / 7 / 30` selector

Only the underlying meaning of the plotted series changes:
- chart height now represents updates in each 15 minute bucket

This should make the graph visibly active even when contract counts are stable.

No new UI elements are required for this step.

## File-Level Design

### Backend

`backend/src/domain/node.types.ts`
- extend ledger summary types to carry cumulative update-count data if needed

`backend/src/pqs/pqs-summary.service.ts`
- extend summary query/normalization to fetch cumulative total updates from PQS
- keep compatibility with the existing PQS schema handling already in this service

`backend/src/orchestrator/node-poller.service.ts`
- stop deriving graph activity from contract-count delta
- pass cumulative update count into cache recording

`backend/src/cache/node-cache.service.ts`
- replace raw-per-poll activity storage semantics with 15 minute bucket aggregation
- track last observed cumulative count per node
- merge multiple polls into a single bucket
- prune buckets older than 30 days
- continue slicing by 1, 7, and 30 day windows

### Frontend

`frontend/src/types/activity.ts`
- no shape change likely required if `activityValue` is reused

`frontend/src/views/HomeActivityView.vue`
- no major structural change required
- continue plotting `activityValue`
- chart will naturally reflect event-volume buckets

`frontend/src/composables/useActivityHistory.ts`
- no behavior change required beyond consuming the same endpoint

## Error Handling

### PQS Poll Failure

If a poll fails:
- do not emit synthetic zero-activity buckets from failed PQS reads
- keep existing node status/error behavior
- the next successful poll computes delta against the last successful cumulative total

This means missed poll intervals may collapse activity into the next successful bucket. That is acceptable for an in-memory operator graph in this phase.

### Counter Regression

If cumulative update count decreases:
- treat it as a reset
- start a new baseline
- do not produce negative deltas

### Missing History

If the backend has been up for less than the selected window:
- return only the available buckets
- frontend renders what exists

## Testing Strategy

### Backend Tests

Add coverage for:
- first successful poll initializes baseline with zero activity
- multiple successful polls in one 15 minute bucket accumulate into one sample
- crossing a 15 minute boundary creates a new sample
- 1/7/30 day slicing returns the correct bucket ranges
- retention pruning removes buckets older than 30 days
- counter regression resets baseline without negative activity
- failed poll does not create synthetic activity

### Frontend Tests

Add or update coverage for:
- graph still renders activity history cards from API samples
- window selector still switches data ranges
- header label remains `Last 1 day`, `Last 7 days`, `Last 30 days`
- chart geometry updates when the selected window changes

## Tradeoffs

- This counts updates, not low-level event rows. That is intentional to keep the implementation simpler and more stable.
- Missed polls compress multiple intervals of real activity into the next successful bucket. Fixing that would require historical backfill queries, which are out of scope for this step.
- In-memory history resets on restart. That matches the user’s current preference.

## Open Decisions Resolved

- bucket size: 15 minutes
- retention: 30 days
- storage: in memory only
- metric: total updates from PQS update metadata

## Implementation Readiness

This spec is intentionally scoped for a single implementation plan:
- one backend pipeline change
- one cache aggregation change
- minor frontend semantic shift
- targeted test updates

No additional product decisions are required before planning.
