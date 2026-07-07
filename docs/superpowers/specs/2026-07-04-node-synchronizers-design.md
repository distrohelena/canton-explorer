# Node Synchronizers Design

## Goal

Add a `Synchronizers` section to each node workspace page using gRPC data that the participant node already exposes.

## Scope

This slice adds:

- a node-scoped synchronizers backend endpoint
- gRPC retrieval of connected synchronizers for `pqs_with_grpc` nodes
- a new `Synchronizers` section on the node detail page
- clear empty/error/configuration states

This slice does not add:

- synchronizer drill-down pages
- PQS-derived synchronizer inference
- caching beyond the existing request lifecycle

## Backend Design

### Endpoint

Add:

`GET /api/nodes/:id/synchronizers`

### Data Source

Use participant admin connectivity gRPC.

The explorer should call the SDK method that lists connected synchronizers and map the fields that are already exposed:

- `synchronizerAlias`
- `synchronizerId`
- `physicalSynchronizerId`
- `healthy`

### Response Shape

```ts
interface NodeSynchronizerSummary {
  synchronizerAlias: string | null;
  synchronizerId: string | null;
  physicalSynchronizerId: string | null;
  healthy: boolean | null;
}

interface NodeSynchronizersResponse {
  nodeId: string;
  label: string;
  mode: 'pqs_only' | 'pqs_with_grpc';
  synchronizers: NodeSynchronizerSummary[];
}
```

For `pqs_only` nodes, return the node metadata with an empty `synchronizers` list. The frontend will render `Not configured`.

## Frontend Design

### Data Loading

Extend the node detail page load to request synchronizers alongside the existing node snapshot and installed packages.

### Section Behavior

Add a `Synchronizers` section beneath `Ledger Snapshot` and above `Installed Packages`.

States:

- `pqs_only`: show `Not configured`
- `pqs_with_grpc` with empty list: show `No synchronizers found`
- populated list: show one row per synchronizer

### Row Layout

Each synchronizer row should show minimal operational metadata:

- `Alias`
- `Synchronizer ID`
- `Physical ID`
- `Healthy`

## Testing

### Backend

- controller test for the new endpoint
- gRPC operations test for mapping connected synchronizers from the SDK response

### Frontend

- API client test for `fetchNodeSynchronizers`
- node detail page test for configured, unconfigured, and empty-list states
