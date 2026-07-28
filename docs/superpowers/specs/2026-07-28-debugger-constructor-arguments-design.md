# Debugger constructor-arguments step

## Goal

Extend the New Simulation wizard so the Create path has a fourth step after template selection. Step 04 generates a typed constructor-argument form from the selected template's DAML type schema.

## UX

Use a two-column wizard layout:

- The left rail contains the three simulation choices as a stacked selection album: Create, Exercise Existing, and Exercise New.
- The right side contains the dependent workflow: step 02 Select a node, step 03 Choose a template (or active contract), and step 04 Constructor arguments.
- Step 04 is disabled until a template or active contract selection provides the required type information.
- Create is the first path wired to the constructor form. Exercise Existing and Exercise New keep their current selection behavior until their own argument/choice flows are defined.

## Type schema and form

Use the existing node-packages endpoint to collect installed package IDs for the selected node, then fetch package details and resolve the selected template's `createType`. Extend the node-template response and `DebuggerTemplateOption` with `packageId`, `packageName`, and `packageVersion`; each entry has shape `{ templateId, packageId, packageName, packageVersion }`. Template identity is `(nodeId, packageId, templateId)`, so duplicate template IDs from different packages remain separate choices and display package/version metadata. The picker key and selected value must include all three identity fields. The duplicate fixture contains `Main:Asset` from `pkg-a`/`1.0.0` and `pkg-b`/`2.0.0`, and both must remain selectable.

The form renderer recursively handles the full schema:

- records: nested labelled field groups;
- primitives: typed controls for DAML builtins emitted by the registry (`Bool`, `Int`, `Int64`, `Numeric`, `Text`, `Party`, `Date`, `Time`, `Timestamp`, `Unit`, and type applications such as `Optional`, `List`, and `TextMap`);
- variants and enums: constructor selectors, with fields for the selected variant constructor;
- lists: repeatable add/remove item controls;
- optionals: presence toggle plus a nested value when present;
- maps: repeatable typed key/value rows;
- type applications and references: resolve through the package schema while preventing infinite recursion;
- unsupported or missing definitions: an explicit inline error/state, never an silently invalid value.

Schema resolution is explicit: `type_con` follows `(packageId, typeId)` into `dataTypes`; `synonym` follows its `definition`; `forall` renders its `body`; `struct` renders like a record; and `builtin` arguments map to `Optional`, `List`, `TextMap`, and generic-map editors. Generic applications carry a substitution environment from `forall` parameters to their concrete arguments; missing package/type lookups take precedence over rendering any child fields. `type_var`, `missing_definition`, `unsupported`, and unresolved package/type references are non-completable diagnostics.

The renderer maintains a typed value tree matching the existing `NodeDecodedDamlValue` domain model: records are `{ kind: 'record', fields: [{ label, value }] }`, variants are `{ kind: 'variant', constructor, value }`, enums are `{ kind: 'enum', constructor }`, optionals are `{ kind: 'optional', value }`, lists are `{ kind: 'list', items }`, text maps are `{ kind: 'text_map', entries: [{ key, value }] }`, generic maps are `{ kind: 'gen_map', entries: [{ key, value }] }`, contract IDs are `{ kind: 'contract_id', value }`, and Unit is `{ kind: 'unit' }`. Scalar values are strings for Text, Party, ContractId, Int, Int64, Numeric, Date, Time, and Timestamp; booleans for Bool; and no scalar for Unit. Empty required controls use a form-only `UNSET` sentinel and never serialize. Conversion to protobuf `sum.oneofKind` values remains a later submission-boundary concern.

Required record fields start empty and block completion. Inputs are trimmed on blur and completion; an empty trimmed value remains `UNSET`. `Int` accepts `^-?(0|[1-9][0-9]*)$` and serializes as the trimmed string. `Int64` uses the same grammar and must be in `[-9223372036854775808, 9223372036854775807]`. `Numeric` accepts `^-?(0|[1-9][0-9]*)(\.[0-9]+)?$`, rejects a leading plus sign, and allows no more fractional digits than its type scale. `Date` is a valid calendar date matching `^[0-9]{4}-[0-9]{2}-[0-9]{2}$`; `Time` is `HH:mm:ss` with optional 1–6 fractional digits; `Timestamp` is UTC RFC3339 `YYYY-MM-DDTHH:mm:ss[.fraction]Z` with a valid calendar/time value. Party and contract-id fields require non-empty strings; map keys must be non-empty and unique after trimming; lists and optionals start empty/unset; variants and enums require an explicit constructor. Validation errors appear after blur and on completion attempt.

Recursive references are tracked by type identity and render as a bounded recursive editor up to a fixed depth of 8. At the bound, the user may leave the recursive value empty only when the surrounding type permits an empty value (for example `Optional`); otherwise the form reports that the recursive value cannot be expanded. `recursive_reference`, missing definitions, type variables, and unsupported nodes are explicit non-completable states with a diagnostic label.

## Boundaries

Keep schema loading in the debugger view/wizard state and keep recursive rendering in focused form components. The existing `DebuggerTemplatePicker` remains responsible for simulation, node, and template/contract selection; the constructor form is a separate step component so it can later be reused for Exercise New and choice arguments.

Only Create enters an active Step 04 in this change. Selecting a different simulation choice resets the node, template, schema, and form state. Reselecting a template replaces the form and cancels any stale package-detail response. While loading, Step 04 shows a loading state; fetch failures, non-decoded packages, missing `createType`, and template-not-found cases show actionable inline errors. There is no submit/session-creation action yet; the step exposes the validated payload for the later simulation-submit integration.

## Testing

- Add component tests for the four-step layout and the left simulation rail.
- Add `frontend/src/components/DebuggerValueForm.test.ts` with a fixture record containing Text, Int64, Numeric, Party, Date, Optional, List, TextMap, a variant, an enum, a nested record, a contract ID, and Unit; enter representative values and assert the exact `NodeDecodedDamlValue` tree, including `{ kind: 'record', fields: [...] }`, string scalar preservation, and empty-field `UNSET` behavior.
- Add tests for invalid Int64 bounds, Numeric scale, invalid Date/Time/Timestamp, duplicate map keys, missing required fields, empty variants/enums, and recursive depth-8 termination.
- Add `frontend/src/components/DebuggerTemplatePicker.test.ts` and `frontend/src/views/DebuggerView.test.ts` cases proving package identity is carried through selection, the `pkg-a`/`pkg-b` duplicate template fixture remains distinct, the selected package detail is fetched, and the matching template `createType` is passed to the renderer.
- Cover loading, stale responses, failed/non-decoded/missing schemas, unsupported/cyclic nodes, selection resets, and the guarantee that no debugger session is created during this step.
- Preserve existing debugger session catalog, template selection, and navigation tests.
