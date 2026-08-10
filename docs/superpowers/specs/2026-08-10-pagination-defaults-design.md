# Pagination Defaults 15/30/50/100/200

## Goal

Update all user-facing pagination defaults and selector options from `10/25/50/100/200` to `15/30/50/100/200`.

## Design

- Set the shared frontend pagination default to `15`.
- Set the shared frontend page-size options to `15`, `30`, `50`, `100`, and `200`.
- Update backend and frontend API method defaults that currently use `25` to `30`, matching the requested `25` to `30` migration.
- Update pagination-specific tests and documentation so their expected defaults and option values match the new contract.
- Preserve explicit non-default limits and unrelated numeric constants; this is not a blanket replacement of every `10` or `25` in the repository.
- Preserve existing URL behavior: the default page size is omitted from query parameters, while selected non-default sizes are serialized.

## Validation

- Add or update unit coverage for the new default and options, including normalization of `15` and `30` and fallback for the old `10` and `25` values.
- Run the focused frontend pagination tests.
- Run the complete repository test, lint, and build commands if the focused checks pass.
- Review the final diff and search for remaining pagination-specific uses of the old default values.
