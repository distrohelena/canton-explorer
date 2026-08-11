# Home Dashboard and Updates Route Design

## Goal

Make `/` a dedicated home dashboard and move the full global updates browser to `/updates`, while giving the home dashboard compact previews of recent updates and token trades.

## Routes and navigation

- `/` renders a new home dashboard.
- `/updates` renders the existing full global updates experience with filters, pagination, and its current update-detail links.
- The Explore menu’s Updates item points to `/updates`.
- The selected Explore label is `Home` on `/` and `Updates` on `/updates`.
- Existing node, party, contract, token, search, and detail routes remain unchanged.

## Home dashboard

The home page renders two responsive cards in a two-column desktop grid and a single column on narrow screens:

1. Latest updates: six rows with Node, Offset, Record Time, and Parties.
2. Latest trades: six rows with Token, Amount, a combined From → To party cell, and Record Time.

Each preview table has a seventh row containing a `View all` link to its full page (`/updates` or `/tokens`). Rows retain the existing update-detail, node, token, and party navigation behavior. Loading, empty, and error states remain visible within each card.

## Component design

Extend `UpdatesBrowser` and `TokenTransfersBrowser` with an explicit compact-preview mode. In that mode they fetch six records, omit advanced filters and pagination controls, render only the compact columns, and append the view-all row. Their existing full-table behavior remains the default for `/updates`, `/tokens`, node pages, party pages, and token detail pages.

Create a focused `HomeView` that composes the two compact browsers. Keep the existing full updates view component dedicated to `/updates`, changing only its route path and navigation metadata as needed.

## Testing and compatibility

- Add route-shell coverage that `/` renders the home dashboard and `/updates` renders the full updates view.
- Add home-view coverage for both preview table labels, six-row limits, compact columns, and seventh-row view-all links.
- Preserve existing full-table tests and add compact-mode tests for each browser as needed.
- Verify the full frontend test suite and keep all changes committed.
