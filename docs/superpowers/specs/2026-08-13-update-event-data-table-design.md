# Update Event Data Table Design

## Context

The update detail page currently renders an event's Create Data or Exercise Data as a stack of labeled value blocks. This makes data-heavy events harder to scan than the Updates page tables.

## Goal

Render the single data payload belonging to each event as a compact, Updates-style table inside the existing event card.

## Design

- Each event continues to render at most one data section: `Create Data` or `Exercise Data`.
- The data section becomes a native three-column HTML table with `Field`, `Type`, and `Value` columns.
- The Type column displays DAML type labels for normalized scalar values: `Party`, `ContractId`, `Unit`, `Text`, `Bool`, `Int64`, `Numeric`, and `Optional<T>`. Populated Optionals use the inner value's type; empty Optionals use the field semantics when available.
- Existing flattened field labels are preserved, including nested paths formatted for display.
- Existing value formatting is preserved:
  - contract IDs remain links to the node's contract page;
  - party values remain links to the party page;
  - units, booleans, numbers, nulls, and ordinary strings retain their current display values.
- The table lives inside the existing event card, as a sibling to the event metadata definition list, and does not introduce another surrounding card or panel.
- The table header and rows should use the same visual language as the Updates table (`.node-updates__table` and `.node-updates__row`): a muted header, separated rows, compact padding, and the shared surface/line tokens, implemented with dedicated event-data classes because the column structure differs.
- On narrow screens, the table remains a three-column table inside a wrapper that can shrink and scroll horizontally; the table itself has a `560px` minimum width and does not collapse into ambiguous stacked cells.

## Data flow and error behavior

No API or data-model changes are needed. The view continues to read the already-normalized `createData` and `exerciseData` values and the existing entry-formatting/link helpers. The event selects the one non-empty payload: Create Data when `createData` has entries, otherwise Exercise Data when `exerciseData` has entries. The source data contract permits only one of these payloads for an event. If neither payload has entries, the data table is omitted as it is today. Missing values continue to display as `n/a` where applicable.

## Accessibility

The result uses a native `<table>` with a header row containing `Field`, `Type`, and `Value`. The data section heading receives a deterministic unique `id` based on the rendered event index, and the table references it with `aria-labelledby`; the heading remains visible. Existing links must remain keyboard accessible, and the event card's existing headings remain the labels for their sections.

## Testing

- Update the UpdateDetailView rendering test to assert the data table headers and rows for both Create Data and Exercise Data, including DAML type labels and a party-valued fixture field.
- Assert that contract and party values remain links after the conversion.
- Add style regression coverage for the table layout and responsive behavior.
- Run the full frontend test suite, production build, and `git diff --check`.

## Non-goals

- No changes to API responses, data normalization, pagination, or event ordering.
- No changes to the surrounding event card layout, event metadata rows, parties, or witnesses.
