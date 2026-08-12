# Contracts Bottom Pagination Design

## Goal

Add previous/next pagination buttons below the Contracts table so users can
navigate cursor-paginated results without returning to the table header.

## Design

`ContractsBrowser` will render a bottom pager after the Contracts table. It
will use the same `dashboard__refresh` buttons, arrow icons, disabled states,
and `showNewer` / `showOlder` handlers as the existing top `UpdatesToolbar` and
the Updates page bottom pager.

The bottom pager will appear only when there is no error and the browser is
loading or has contracts to display. Its controls will be grouped with the
accessible label `Bottom contracts pagination`. No new state, API endpoint, or
pagination logic is required; existing route cursors, filters, and page-size
settings will continue to be preserved by the current handlers.

## Testing

- Extend Contracts page coverage to assert the bottom pager is rendered with
  the expected buttons and disabled states.
- Verify the bottom Newer and Older buttons invoke the existing cursor
  navigation behavior and preserve the current query/filter contract.
- Run the focused Contracts tests, the full frontend test suite, the frontend
  build, and `git diff --check`.

## Alternatives Considered

- Extract a shared pagination component: unnecessary for this focused change
  because the existing Updates page markup is already the established pattern.
- Add a separate pagination implementation: rejected because it could diverge
  from the existing cursor and filter behavior.
