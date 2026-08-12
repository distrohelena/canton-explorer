# Tokens Bottom Pagination Design

## Goal

Add bottom `<` / `>` pagination buttons to both the Known Tokens table and the
Latest Transfers table on the Tokens page.

## Design

`TokensView` will render a bottom pager after the Known Tokens table. It will
reuse `showPreviousTokens` and `showNextTokens`, the existing token cursor
query keys, and the same arrow button/icon styling used by the top toolbar and
other paginated pages. The pager will be grouped with the accessible label
`Bottom known tokens pagination` and will appear only when there is no token
error and the token data is loading or contains rows.

`TokenTransfersBrowser` will render a bottom pager after its transfer table for
non-compact instances. It will reuse `showNewer` and `showOlder`, preserve the
existing transfer filters and cursors, and use the accessible label `Bottom
latest transfers pagination`. Compact dashboard previews will not render the
bottom pager.

Both pagers will use the same disabled conditions as their top controls:
loading disables both buttons, and each direction is disabled when its
response cursor is absent. No API, state, or backend changes are required.

## Testing

- Extend `TokensView` coverage to assert both bottom pager groups and their
  cursor-dependent disabled states.
- Exercise bottom Known Tokens navigation and verify it preserves the existing
  token cursor query/request behavior.
- Exercise bottom Latest Transfers navigation and verify it preserves the
  existing transfer cursor query/request behavior.
- Confirm compact transfer previews do not gain pagination controls.
- Run focused Tokens tests, the full frontend test suite, the frontend build,
  and `git diff --check`.

## Alternatives Considered

- Extract a shared pager component: deferred because the existing pages use
  small established markup patterns and this change needs no new behavior.
- Reuse `UpdatesToolbar` below each table: rejected because it would duplicate
  filters and page-size controls instead of adding only navigation buttons.
