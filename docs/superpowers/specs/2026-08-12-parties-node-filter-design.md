# Parties Node Filter Design

## Goal

Add a Contracts-style node filter to the Parties page so users can select which nodes contribute to Active Parties, All Parties, and Namespaces results.

## User experience

- The Parties results header includes one `Advanced Filter` button.
- Opening the filter displays a unified panel. It always contains a `Nodes` checklist using the existing Contracts filter styling and accessibility semantics. In Namespaces mode it also contains the existing public-key namespace fields; the namespace fields are hidden in party modes.
- All available nodes are checked by default.
- Checking or unchecking a node applies immediately; there is no separate Apply button.
- Changing the node selection resets the current pagination cursor and reloads the active mode.
- The selected node IDs persist in the URL using repeated `node` query parameters, matching Contracts behavior. When every node is selected, the query omits `node`; when no nodes are selected, it records an empty node filter. An explicit node query opens the filter on initial load.

## Data flow

The page maintains the selected node IDs and derives the eligible nodes for the current mode. URL state is read after `fetchNodes()` resolves: an omitted `node` key selects all nodes, repeated values are deduplicated, blank values are ignored when valid values are also present, and unknown IDs are discarded. An explicit empty or unknown-only filter selects no nodes. Subsequent mode changes, pagination, page-size changes, and filter toggles preserve the node query.

Active Parties and All Parties continue to use the existing per-node endpoints, loading only checked nodes. For All Parties, only checked `pqs_with_grpc` nodes are eligible; selecting only PQS-only nodes produces the existing “No gRPC nodes available” state. An empty selection produces no node requests and the existing empty-state copy.

The global Namespaces request gains an optional `nodeIds` client option. The frontend serializes selected IDs as repeated `node` parameters. The backend filters its configured nodes before building the global fingerprint set, preserving one globally sorted, paginated response and the existing source-selection behavior. The backend treats omitted `node` as all configured nodes, `node=` as no nodes, repeated values as a unique set, and unknown-only values as no nodes. Unknown IDs are ignored when valid IDs are present. An empty backend result uses the existing response shape with `source: 'pqs'`, no fingerprints, and no gRPC/PQS node calls. The frontend also short-circuits an empty namespace selection and does not call the endpoint.

The global Active Parties and local Parties endpoints are not required for this page’s filtered flow because their existing per-node endpoints already support the needed aggregation and status details.

## Error and loading behavior

- Loading indicators cover only the checked nodes or the filtered namespace request. Per-node loading state is tracked independently so concurrent requests do not hide one another.
- A failed node retains the existing per-node error/status handling without preventing successful checked nodes from rendering. A stale response from a prior checkbox selection cannot overwrite the current selection’s data or loading state.
- No checked nodes render the page’s existing “no parties” or “no namespaces” empty state.
- For Namespaces, selections with no gRPC-capable nodes use PQS. An all-gRPC selection uses the existing gRPC-first source. A mixed PQS/gRPC selection uses the existing PQS fallback path. If any gRPC request in an all-gRPC selection fails, the backend falls back to PQS for the complete selected set so sorting, source, and cursors remain consistent.
- Invalid or unknown URL node IDs are ignored. A missing `node` query means all available nodes are selected, matching Contracts.

## Implementation boundaries

- Reuse the existing `UpdatesAdvancedFilter` node checklist and styles rather than creating a second checkbox style, or extract its node-only portion into a small reusable component if the current party/template controls prevent clean reuse.
- Keep one Parties filter panel and add only the minimal configuration needed to hide unrelated party/template controls while retaining namespace key fields in Namespaces mode.
- Add node query parsing to the global `/parties/fingerprints` route and pass the filtered node list into the existing global fingerprint builder.
- Keep the existing three mode buttons, source labels, pagination controls, and party aggregation behavior intact.

## Verification

- Parties view tests cover the filter button, default checked nodes, URL-driven selections, immediate reloads for each mode, pagination reset/preservation, empty selection, concurrent node loading, stale-response suppression, partial node failures, and all-PQS/mixed namespace source selection.
- API/controller tests cover repeated node query parameters, omitted node filters, empty filters, valid-plus-unknown filters, and unknown IDs.
- Add a controller/service regression test for selected namespace nodes, repeated/empty/unknown node filters, all-PQS/mixed source selection, and the empty-node response without backend node calls.
- Run the frontend/backend test suites and the frontend production build.
