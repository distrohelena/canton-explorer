# Token Transfers Browser Design

## Goal

Standardize token transfer browsing so the global `/tokens` page and per-token `/tokens/:tokenId` page use the same component, paging behavior, row layout, and URL-backed cursors.

## Current Problem

Token transfers are rendered in two separate views:

- `frontend/src/views/TokensView.vue` renders the global latest-transfer list with `Newer` / `Older` pagination.
- `frontend/src/views/TokenDetailView.vue` renders a separate token-specific transfer list without pagination.

This duplicates markup and behavior. It also means the token detail page will drift from the global page unless both implementations are kept in sync manually.

## Chosen Approach

Introduce a shared `TokenTransfersBrowser.vue` component that follows the existing browser pattern used by updates and contracts.

This component will own:

- cursor parsing from the route
- cursor persistence back into the route
- loading, error, and empty states
- pager rendering
- transfer-row rendering
- navigation to party pages and transfer detail pages

`TokensView` and `TokenDetailView` will each delegate their transfer section to this component.

## Component API

`TokenTransfersBrowser` will accept a small prop surface:

- `scope: 'global' | 'token'`
- `path: string`
- `title: string`
- `eyebrow?: string`
- `tokenId?: string`
- `queryPrefix?: string`
- `loadingMessage?: string`
- `emptyMessage?: string`
- `tableAriaLabel?: string`
- `spinnerLabel?: string`

## Data Flow

### Global scope

When `scope === 'global'`, the component will call:

- `fetchLatestTokenTransfers(25, { before, after })`

The current `/tokens` page behavior will be preserved.

### Token scope

When `scope === 'token'`, the component will call a token-scoped API function:

- `fetchTokenTransfers(tokenId, 25, { before, after })`

This requires backend support for token-scoped pagination if it does not already exist.

## URL Behavior

The component will use the route query for cursor state in both scopes.

Managed query keys:

- `before`
- `after`

If a `queryPrefix` is provided, the component will use prefixed keys to avoid collisions, following the same pattern used elsewhere in the app.

This ensures:

- the global transfers page can be refreshed without losing position
- a token detail page can be refreshed without losing position
- back/forward browser navigation preserves paging state

## Rendering Behavior

The table layout will be unified across both pages:

- `Nodes`
- `Token`
- `Amount`
- `From`
- `To`
- `Record Time`

For token-scoped pages, the token column will still be shown for consistency unless we explicitly choose to hide it later. This keeps the component simpler and makes transfer rows visually identical between global and token contexts.

Each row will continue to support:

- transfer detail navigation on row click
- party navigation on sender/receiver click
- token navigation on token click
- one node per line in the `Nodes` cell
- two-line local-time rendering for record time

## View Integration

### Tokens page

`TokensView.vue` will continue to render:

- header
- known token inventory

Its transfer section will be replaced with:

- `TokenTransfersBrowser` in `global` scope

### Token detail page

`TokenDetailView.vue` will continue to render:

- overview
- top holders

Its transfer section will be replaced with:

- `TokenTransfersBrowser` in `token` scope

## Error Handling

The component will own transfer-fetch errors and render them in the same place for both scopes.

Expected states:

- loading
- load error
- empty result
- refreshing overlay while navigating between pages

## Testing

Add or update tests to cover:

- global transfers still page with `Newer` / `Older`
- token detail transfers gain `Newer` / `Older`
- global and token pages both preserve cursors in the URL
- transfer rows still navigate to the transfer detail page
- sender and receiver links still navigate to party pages
- token links still navigate to token detail pages

## Non-Goals

- advanced token filters
- changing transfer row visual design
- changing token holder behavior
- changing token overview fields

## Recommendation

Proceed with `TokenTransfersBrowser.vue` and keep token paging URL-backed in both scopes.

This is the smallest change that removes duplication and aligns tokens with the existing reusable browser pattern already established for updates and contracts.
