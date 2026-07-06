# Contracts Browser Advanced Filter Design

## Goal

Standardize the `/contracts` page around reusable browser components, matching the interaction model used by Updates while keeping contracts node-scoped. Add backend-backed advanced filtering for active contracts by `Party ID`, `Template ID`, and `Hide Splice Templates`, with URL-backed pagination and filter state.

## Scope

In scope:

- Keep the current node-selector layout on `/contracts`
- Introduce reusable contracts browsing components
- Add Advanced Filter UI to Contracts matching Updates patterns
- Add backend query support for node contract filtering
- Keep paging and filters shareable via the URL

Out of scope:

- Converting Contracts into a global merged cross-node feed
- gRPC fallback for contract browsing
- Deep-linking the selected node on `/contracts`
- Reworking contract detail pages

## Current State

The Updates experience is already standardized around reusable toolbar and filter primitives plus URL-backed state. The Contracts page is still a page-specific implementation:

- node selection is local to `ContractsView`
- pagination is page-local and only supports `before` / `after`
- no advanced filtering exists
- the presentational table is reusable, but the browser logic is not

This makes Contracts inconsistent with Updates and makes future reuse on party or node pages harder.

## Requirements

### User Experience

- `/contracts` remains node-scoped, with one node selected at a time
- the selected node’s ACS is shown in a reusable browser
- header actions match Updates:
  - `Advanced Filter`
  - `Newer`
  - `Older`
  - `PQS` pill
- filters should behave like Updates:
  - `Party ID` as chips with `+`
  - global `OR` / `AND` for party matching
  - `Template ID` using the same searchable combobox + `+`
  - `Hide Splice Templates` checkbox
- if any contracts filter is present in the URL, the advanced filter opens automatically
- changing node preserves filters and reapplies them to the newly selected node

### Data Semantics

- filters must be backend-backed, not frontend-only
- pagination must remain correct after filters are applied
- `Party ID` semantics:
  - `or`: any selected party may witness the contract
  - `and`: all selected parties must witness the contract
- `Template ID` semantics:
  - OR across selected templates
- `Hide Splice Templates` semantics:
  - exclude contracts whose `templateId` starts with `Splice.`

## Proposed Architecture

### 1. `ContractsView.vue` becomes a thin shell

Responsibilities:

- load the list of nodes
- manage selected node in local page state
- render node-selector buttons
- host a reusable contracts browser for the selected node

It should stop owning pagination and filter mechanics directly.

### 2. Introduce `ContractsBrowser.vue`

This component will be the Contracts equivalent of `UpdatesBrowser.vue`.

Responsibilities:

- fetch contracts for the current node
- read and write URL-backed filters and cursors
- manage loading and error state
- render the shared header actions
- render the advanced filter panel
- render `ContractsTable`

Inputs:

- `nodeId`
- `path`
- `queryPrefix` if later reused in nested contexts
- optional title/eyebrow strings
- data-source tag if later needed beyond PQS

This creates a reuse boundary that can later support party-scoped or node-embedded contract browsers without rewriting the logic.

### 3. Introduce `ContractsAdvancedFilter.vue`

This component mirrors `UpdatesAdvancedFilter.vue`, but with Contracts-appropriate wording.

Fields:

- `Party ID`
- `Template ID`
- `Hide Splice Templates`

Behavior:

- party chips plus add/remove
- party mode toggle: `OR` / `AND`
- searchable template combobox plus add/remove
- hide-splice checkbox

It should reuse `SearchableCombobox.vue` and align with the existing Updates visual system.

### 4. Keep `ContractsTable.vue` as the presentational primitive

`ContractsTable.vue` should remain table-only:

- receives already-fetched rows
- renders links and fixed columns
- contains no fetch or URL logic

This preserves a clean split between browser/state logic and view-only rendering.

## Backend Design

### API Surface

Extend `GET /api/nodes/:id/contracts` to accept:

- repeated `party`
- repeated `template`
- `partyMode=or|and`
- legacy `mode` fallback only if needed for consistency
- `hideSplice=true`
- existing `before`
- existing `after`
- existing `limit`

### Service Behavior

Enhance the node ACS query in `PqsSummaryService.fetchNodeContracts(...)` to apply filters at query time.

Filtering must happen before pagination slicing so that:

- page counts remain honest
- `Older` and `Newer` navigate through the filtered result set
- the user does not see partial or misleading filtered pages

### Query Behavior

The ACS query should support:

- template inclusion filtering
- witness/party filtering with `or` and `and`
- splice-template exclusion

The current page is node-scoped, so no global cursor design is needed.

## URL State Design

The Contracts route remains `/contracts`.

Selected node:

- remains local page state for now
- does not become a URL parameter in this pass

Filter state:

- `party=...`
- `template=...`
- `partyMode=or|and`
- `hideSplice=true`
- `before=...`
- `after=...`

Rules:

- when filters change, pagination cursor is reset
- when node changes, the same filters remain active
- when a filter exists in the URL on initial load, the advanced filter auto-opens

## Error Handling

- initial contracts load failure shows the existing page-level error message
- filtered reload failure preserves the browser shell and shows the error state in the browser region
- empty filtered results show a contracts-specific empty state:
  - `No active contracts found for this node.`

## Testing Strategy

### Frontend

API tests:

- verify `fetchNodeContracts(...)` serializes:
  - repeated `party`
  - repeated `template`
  - `partyMode`
  - `hideSplice`
  - `before` / `after`

Component/view tests:

- advanced filter toggles open and closed
- advanced filter auto-opens when filter query params exist
- party chips can be added and removed
- template filters can be added and removed
- `OR` / `AND` updates the URL and fetch behavior
- `Hide Splice Templates` updates the URL and fetch behavior
- switching nodes preserves active filters
- pager still works under filtered queries
- `PQS` pill remains positioned after `Older`

### Backend

Controller tests:

- parse new query parameters on `GET /api/nodes/:id/contracts`
- forward normalized options to `PqsSummaryService.fetchNodeContracts(...)`

Service tests:

- template filtering
- party filtering in `or` mode
- party filtering in `and` mode
- splice-template exclusion
- filtered paging still returns correct cursors

## Risks

- party filtering depends on the contract query having reliable witness/party visibility in PQS-backed ACS data
- if current ACS rows do not expose enough party information, the query may need an additional join or derived witness aggregation
- reusing the Updates interaction model should reduce frontend risk, but the backend query path is the real correctness boundary

## Recommendation

Implement the Contracts page as a reusable node-scoped browser with backend-backed filtering. Do not fake filtering on the current page of rows. Match the Updates interaction model closely, but use Contracts-appropriate wording: `Hide Splice Templates` instead of `Hide Splice Offsets`.
