# Party updates and contracts node filters

## Goal

Let a Party page narrow its Updates and Contracts independently to one or more
observed nodes, using the same checkbox control and URL-backed selection model
as the global Contracts page.

## Design

`PartyDetailView` already loads observed nodes independently from its Updates
and Contracts sections.  It will pass that result to both browser components as
their node-filter options.  The sections remain usable when observed-node
loading has not completed; their node filters appear once the options are
available.

Each browser will support node filtering for `party` scope in addition to
`global` scope:

- No node query parameter means every configured node, preserving current
  results and URLs.
- A selection is stored under the component's query prefix.  On a Party page,
  those are `updatesNode` and `contractsNode`, so filtering Updates cannot
  reload or alter Contracts, and vice versa.
- An explicit empty selection is retained in the URL and produces no rows.
- The filter is included in pagination and advanced-filter URL updates.

The frontend API helpers append repeated `node` query parameters.  The Party
controllers translate them to `nodeIds`; the summary service filters the node
fan-out before issuing PQS requests.  This keeps filtering server-side and
avoids requests to unselected nodes.

## Scope and verification

The work covers Party Updates and Party Contracts only.  It does not add a new
node filter to the global Updates page, which currently has no such control.

Tests will cover URL/API serialization, Party browser behavior for both
sections, controller option forwarding, and service fan-out restriction while
retaining default all-node behavior.
