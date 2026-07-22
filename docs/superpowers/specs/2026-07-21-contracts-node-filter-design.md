# Contracts Node Filter Design

## Goal

Make `/contracts` an all-node view by default, with node selection exposed as checked controls inside Advanced Filter and enforced by the backend.

## Design

`ContractsView` will always render the global `ContractsBrowser`; the existing top-level node selector will be removed. `UpdatesAdvancedFilter` will gain an optional node-filter section for Contracts. The section will render one checkbox per configured node, with every node checked when there is no node filter in the URL.

The selection will be URL-backed using repeated `node` query parameters. An absent `node` key means all configured nodes. A present key with one or more IDs means only those configured nodes. A present key with no usable IDs means no nodes, so the browser will show its existing empty state without requesting node contract data.

The frontend API client and `/api/contracts` controller will pass selected node IDs to `PqsSummaryService.fetchGlobalContracts`. The service will resolve the selected IDs against configured nodes before creating its per-node merge states. This keeps filtering, pagination, party/template filters, and splice filtering server-side and preserves the current globally merged ordering.

## Error handling

Unknown node IDs are ignored by the backend. If the request explicitly selects nodes but none resolve to configured nodes, the service returns an empty paginated response. If no node filter is supplied, all configured nodes remain eligible.

## Testing

- Frontend API tests verify repeated node query parameters and explicit empty selections.
- Contracts view tests verify no top node selector, all nodes checked by default, single-node selection, and empty selection behavior.
- Advanced filter tests verify accessible node checkboxes and emitted changes.
- Controller tests verify node query normalization.
- PQS service tests verify selected-node restriction, all-node default behavior, and no-node behavior.

