# Token List Pagination Design

## Goal

Paginate the Known Tokens section on `/tokens` the same way the explorer paginates other list views.

## Approach

- Add backend pagination to `/api/tokens` with `limit`, `before`, and `after`.
- Return `limit`, `nextBefore`, `nextAfter`, and `tokens`.
- Keep sorting stable by the existing token ordering: `name`, then `tokenId`.
- Update the Tokens page to keep token-list pagination state in the URL independently from the transfer browser below it.

## UI

- Add a pager to the Known Tokens section:
  - page-size combobox
  - `Newer`
  - `Older`
- Reuse the same page-size options used elsewhere.
- Keep Latest Transfers pagination separate and unchanged.
