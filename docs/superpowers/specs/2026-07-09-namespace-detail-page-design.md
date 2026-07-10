# Namespace Detail Page Design

## Goal

Add a real namespace-centric detail page at `/namespaces/:namespaceId` so a namespace can be explored as a first-class object instead of forcing users to pivot through party pages.

## Scope

This design covers:

- clickable namespace rows from the Parties page `Namespaces` mode
- a dedicated backend namespace-detail endpoint
- a dedicated frontend namespace-detail route and page
- namespace-centric overview, observed parties, observed nodes, recent updates, recent contracts, and topology evidence

This design does not include:

- namespace write actions
- fuzzy namespace matching
- client-side-only derived namespace pages

## User Experience

When the user clicks a namespace in the Parties page `Namespaces` mode, the app navigates to `/namespaces/:namespaceId`.

The namespace page follows the same visual family as the Party detail page:

- left rail back arrow returning to `/parties`
- centered content frame
- overview block first
- supporting blocks below
- reusable update and contract browsers for recent activity

The page is namespace-centric, not party-centric. It should explain:

- which namespace is being viewed
- how many parties use it
- on which nodes it has been observed
- what recent updates and contracts are associated with it
- what topology and key evidence exists for it

## Data Model

Namespace identity is the exact suffix after `::` in a party id.

Example:

- party id: `Alice::1220abcd...`
- namespace id: `1220abcd...`

Matching is exact. A namespace detail request for `1220abcd...` only matches parties whose suffix is exactly `1220abcd...`.

## Backend Design

### New Endpoint

Add:

- `GET /api/namespaces/:namespaceId`

### Response Shape

The endpoint returns a namespace-centric aggregate response:

- `namespaceId`
- `partyCount`
- `nodeCount`
- `parties`
  - `partyId`
  - `nodeIds`
- `nodes`
  - `nodeId`
  - `label`
  - `recentUpdateCount`
  - `recentContractCount`
- `recentUpdateCount`
- `recentContractCount`
- `recentUpdates`
  - merged latest updates across matching parties
- `recentContracts`
  - merged latest contracts across matching parties
- `topologyByNode`
  - per-node namespace topology evidence

### Aggregation Strategy

The backend should do the aggregation so the frontend stays thin.

Party discovery:

- use currently available party inventories
- for active discovery, PQS-backed party lists are sufficient for first pass
- for local/topology details, reuse existing gRPC-backed topology logic where available

Recent updates/contracts:

- reuse existing PQS-backed recent update and recent contract helpers
- query by the concrete party ids that belong to the namespace
- merge and sort globally like the party/global browsers already do

Topology:

- namespace topology is derived from all parties carrying the namespace
- aggregate party-to-participant and party-to-key evidence per node
- dedupe repeated entries per node
- preserve gRPC error/not-configured states per node

### Error Handling

- unknown namespace returns `404`
- if parties exist but topology is unavailable on some nodes, still return page data with per-node topology status
- do not fail the entire namespace page because one gRPC topology read fails

## Frontend Design

### Routing

Add:

- `/namespaces/:namespaceId`

### Navigation

In the Parties page `Namespaces` mode:

- each namespace row becomes a router link to `/namespaces/:namespaceId`

### Namespace Detail Page Layout

Sections:

1. `Overview`
2. `Observed Parties`
3. `Observed Nodes`
4. `Namespace Topology`
5. `Recent Updates`
6. `Recent Contracts`

### Reuse

Reuse existing components where they already fit:

- update browser for recent updates
- contracts browser for recent contracts
- query source pill styles
- node/party detail page frame styling

Create a dedicated namespace detail view rather than overloading Party detail view.

## Topology Presentation

Namespace topology is not the same as party topology.

Per node, show:

- whether matching parties exist on that node
- deduped participant mappings associated with those parties
- deduped key mappings or fingerprint evidence associated with those parties
- gRPC source pill
- grpc status fallback messages where appropriate

The goal is to answer: “what topology evidence do we have for this namespace on this node?”

## Testing Strategy

### Backend

- namespace id exact matching
- namespace not found behavior
- merged party/node aggregation
- merged recent updates/contracts ordering
- deduped topology aggregation
- partial topology failures do not fail the entire response

### Frontend

- namespace rows link to `/namespaces/:namespaceId`
- namespace detail page renders overview
- observed parties link to party pages
- recent updates and contracts render using existing browsers
- back arrow returns to `/parties`

## Tradeoffs

This is more work than reusing a single party page, but it avoids namespace data being misrepresented as if it belonged to one party. It also gives a clean foundation for future namespace-centric search, topology inspection, and filtering.
