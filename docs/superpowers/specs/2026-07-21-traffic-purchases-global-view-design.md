# Traffic Purchases Global View Design

## Goal

Make Traffic Purchases behave like the Contracts page: render one combined purchase table, select all configured nodes by default, and expose node selection inside Advanced Search with server-side filtering.

## User experience

- The page keeps the existing `Traffic` / `Traffic Purchases` page heading.
- There is no node selector row outside Advanced Search.
- The default node filter is every configured participant node.
- Advanced Search contains one checked checkbox per configured node, followed by the existing date and purchased/paid amount filters.
- Unchecking a node reloads the page through the backend. If every node is unchecked, the backend request carries an empty node selection and the table shows no rows.
- The purchase history is one combined table with columns `Node`, `Purchased`, `Paid`, `Time`, and `Offset`.
- Node names are table data, not separate node card titles or nested node panels.
- Current traffic state is retained in a compact combined summary using node labels, without per-node titled cards.
- Existing pagination controls, page-size selection, Advanced Search animation, loading, retry, empty, and unavailable states remain available at the page/table level.

## Data flow and API

Add a global read-only endpoint, `GET /traffic-purchases`, alongside the existing per-node endpoint. It accepts repeated query parameters:

- `node`: selected node IDs; omitted means all configured nodes, while an explicitly empty value means no nodes.
- `limit`, `before`, `after`: global pagination controls.
- `minDate`, `maxDate`, `purchasedMin`, `purchasedMax`, `paidMin`, `paidMax`: the existing server-side filters.

The response contains:

- the effective limit and opaque `nextBefore` / `nextAfter` cursors;
- combined purchase rows carrying `nodeId` and node label in addition to the existing purchase fields;
- `current`, an array of entries shaped as `{ nodeId, label, mode, status, states, error }`, where `status` is `ok`, `grpc_not_configured`, or `grpc_error`, `states` is `NodeTrafficState[]`, and `error` is nullable;
- `historyStatus`, an array of entries shaped as `{ nodeId, label, status, error }`, where `status` is `ok` or `pqs_error` and `error` is nullable.

The response schema is therefore:

```ts
interface GlobalTrafficPurchaseRow extends NodeTrafficPurchase {
  nodeId: string;
  label: string;
}

interface GlobalTrafficCurrentEntry {
  nodeId: string;
  label: string;
  mode: NodeMode;
  status: 'ok' | 'grpc_not_configured' | 'grpc_error';
  states: NodeTrafficState[];
  error: string | null;
}

interface GlobalTrafficHistoryStatus {
  nodeId: string;
  label: string;
  status: 'ok' | 'pqs_error';
  error: string | null;
}

interface GlobalTrafficPurchasesResponse {
  limit: number;
  nextBefore: string | null;
  nextAfter: string | null;
  purchases: GlobalTrafficPurchaseRow[];
  current: GlobalTrafficCurrentEntry[];
  historyStatus: GlobalTrafficHistoryStatus[];
}
```

The backend resolves selected IDs against configured nodes, queries PQS and gRPC for those nodes, merges purchases in a deterministic order, and generates an opaque cursor that preserves the per-node pagination positions. This keeps filtering, merging, and pagination out of the browser and avoids treating independently indexed node offsets as one shared offset space.

Unknown node IDs are ignored, matching the existing Contracts global endpoint. The effective node set is therefore the intersection of requested IDs and configured nodes.

Rows are ordered newest-first by record time when available, then by node ID ascending, event offset descending using the existing string comparison convention, and update ID descending. Missing record times sort after timestamped rows. A cursor is an opaque base64url-encoded row boundary containing that row's sort fields; each request refetches per-node pages as needed and filters rows against that boundary, so no cross-node numeric offset is assumed. `before` returns older rows and `after` returns newer rows relative to that boundary. Date filters are inclusive by UTC calendar day, and numeric minimum/maximum filters are inclusive. Changing node selection or any filter starts a fresh request without carrying an old cursor.

If one selected node fails, successful nodes still render and that node appears in the per-node status metadata. If every selected node fails, the endpoint returns an empty combined result with the node errors; it does not turn node-level source failures into a global HTTP failure. An explicitly empty node selection returns an empty result without querying any node.

The frontend replaces its per-node request map with one global response and sends the selected node IDs and filter values to the global endpoint. When all nodes are selected it omits `node` so the backend uses its all-node default, matching Contracts behavior.

## Components and files

- `backend/src/api/nodes.controller.ts`: expose the global endpoint and normalize repeated query parameters.
- `backend/src/pqs/pqs-summary.service.ts`: aggregate selected-node traffic purchases, merge rows, and maintain opaque global cursors.
- `backend/src/domain/node.types.ts`: add global traffic purchase/current-state response and row types.
- `frontend/src/lib/api.ts`: add the global traffic purchases client and query serialization.
- `frontend/src/types/nodes.ts`: add matching frontend response types.
- `frontend/src/views/TrafficPurchasesView.vue`: adopt global state, node checkbox filters, one table, and page-level toolbar.
- `frontend/src/views/TrafficPurchasesView.test.ts`: cover default selection, backend node filtering, empty selection, combined rows, pagination, and existing amount/date filters.
- `frontend/src/styles.css`: remove node-card/title layout from this page and style the combined table and current-state summary consistently with Contracts.
- `backend/test/api/nodes.controller.spec.ts`: cover global query parsing and endpoint delegation.
- `backend/test/pqs/pqs-summary.service.spec.ts`: cover merging, selected-node handling, ordering, and global cursors.

## Error handling

- Unknown node IDs are ignored, matching the existing Contracts global endpoint.
- A node-level PQS or gRPC failure does not prevent other selected nodes from rendering. The response carries status information, and the UI shows the existing concise unavailable/partial-data state without raw gRPC deserialization text.
- A global request failure shows the page-level retry state.
- An empty selected-node set is a valid request and returns an empty combined result without querying node data.

## Testing and acceptance criteria

1. With two configured nodes, the initial request has no node query parameter and the UI shows rows from both nodes in one table.
2. Advanced Search opens with both node checkboxes checked.
3. Unchecking one node sends only the remaining ID to the backend and removes the unchecked node's rows.
4. Unchecking the final node sends an explicit empty selection and shows no rows.
5. Date, purchased amount, paid amount, page-size, Older, and Newer controls remain server-side and preserve selected nodes.
6. The rendered page has no outside node selector and no per-node title/card heading.
7. Backend and frontend tests pass, TypeScript builds, and `git diff --check` is clean for changed files.
