# Contracts Page Design

## Goal

Add a top-level `Contracts` page that shows the Active Contract Set per node using PQS only.

## Scope

This slice adds:

- a new top-header `Contracts` navigation item after `Parties`
- a new `/contracts` route
- a node-scoped ACS list with lazy loading, one node at a time
- server-side pagination at 25 rows per page
- minimal ACS row metadata:
  - `Contract ID`
  - `Template ID`
  - `Created Record Time`

This slice does not add:

- contract search
- decoded summaries inside ACS rows
- gRPC-specific contract inventory behavior

## Backend Design

### Endpoint

Add a node-scoped endpoint:

`GET /api/nodes/:id/contracts?limit=25&before=<cursor>&after=<cursor>`

### Data Source

Use PQS tables only.

The query should:

- identify active contracts from participant contract/event tables
- derive each contract's create-time metadata
- order rows by newest `createdRecordTime` first
- paginate with keyset cursors instead of page numbers

### Response Shape

```ts
interface NodeActiveContractSummary {
  contractId: string;
  templateId: string | null;
  createdRecordTime: string | null;
}

interface NodeContractsResponse {
  nodeId: string;
  label: string;
  limit: number;
  nextBefore: string | null;
  nextAfter: string | null;
  contracts: NodeActiveContractSummary[];
}
```

## Frontend Design

### Route and Navigation

- Add `/contracts`
- Add `Contracts` to the shared top navigation after `Parties`

### Page Behavior

Model the page after `PartiesView`:

- node buttons at the top
- load node list first
- automatically load the first node's ACS
- lazy-load other nodes only when clicked

### ACS List

Each selected node renders:

- a heading with the node label
- a paginated list of 25 active contracts
- `Newer` / `Older` buttons

Each row shows:

- `Contract ID` as a link to `/nodes/:id/contracts/:contractId`
- `Template ID`
- `Created Record Time` in the browser local timezone

## Testing

### Backend

- controller test for the new node-scoped ACS endpoint
- service test for active-contract query ordering and pagination cursors

### Frontend

- API client test for `fetchNodeContracts`
- app shell/nav test for the new `Contracts` item and route
- page test for first-node lazy load, node switching, and pagination
