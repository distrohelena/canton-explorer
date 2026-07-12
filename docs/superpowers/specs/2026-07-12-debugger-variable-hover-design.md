# Debugger Variable Hover Design

## Goal

Add debugger hover support in the Monaco DAML source view so hovering a proven in-scope variable token shows its current debugger value.

The key constraint is correctness: hover must appear only when the debugger can prove the source token corresponds to a current scoped variable. The UI must not guess by matching variable names across the source file.

## Current Context

The debugger already returns each current step with:

- source content and a current expression `sourceLocation`
- scoped variables under `currentStep.scopes[].variables[]`
- variable fields `name`, `kind`, `value`, and `contractType`

The current normalized variable shape does not include variable-specific source ranges. The current step expression range alone is not enough to prove that an arbitrary token under the cursor is the variable represented by a scoped value.

## Requirements

- Show a Monaco hover for a debugger variable only when the variable has a complete source range.
- Require the range path to match the active source tab/current source file after normalizing path separators to `/`.
- Require the cursor position to be inside the variable-specific range.
- Include the variable name, kind, value, and contract type when present.
- Show no hover when the debugger/runtime does not provide a variable-specific range.
- Do not fall back to plain text name matching.
- Keep the API additive and backward compatible.

## Non-Goals

- Do not infer bindings by parsing DAML in the frontend.
- Do not hover repeated variable-name occurrences unless each occurrence is explicitly ranged by debugger metadata.
- Do not add new network calls for hover lookup.
- Do not change debugger stepping semantics.

## Architecture

Extend the normalized debugger variable model with an optional `sourceLocation`:

```ts
{
  path: string | null;
  startLine: number | null;
  startColumn: number | null;
  endLine: number | null;
  endColumn: number | null;
}
```

The backend maps this only when the replay/debugger SDK provides variable-level location metadata. Missing metadata stays `null`; this is intentional and means the frontend will not show hover.

The frontend computes a small list of hover entries from the current step scopes. It filters out any variable without a complete range, missing name, missing displayable value, or a normalized path that does not match the active source. `MonacoCodeSurface` receives those entries and registers a Monaco hover provider for the current editor language/model.

Hover content uses a compact markdown layout:

- first line: `` `variableName` ``
- second line: `kind: <kind>` when present
- third line: `value: <value>` when present
- fourth line: `contract type: <contractType>` when present

## Data Flow

1. Debugger SDK produces replay step data.
2. Backend normalizes each scope variable, preserving optional variable `sourceLocation`.
3. `DebuggerView` receives the session payload and derives hover entries from `currentStep.scopes`.
4. `MonacoCodeSurface` registers a hover provider.
5. On hover, Monaco passes the cursor position.
6. The provider returns markdown hover content only if the cursor is inside a known variable range.
7. Otherwise the provider returns `null`.

## Error Handling

- If Monaco is not loaded, no hover provider is registered.
- If the hover entry list changes, the existing provider is disposed and replaced.
- If variable metadata is malformed or incomplete, the variable is excluded from hover.
- If multiple proven ranges overlap, choose the smallest range first so the most specific token wins.

## Testing

Use test-first implementation.

- Backend unit test: a replay variable with `sourceLocation` is preserved in `DebuggerSessionResponse`.
- Frontend component test: `MonacoCodeSurface` registers a hover provider that returns content inside the exact range and `null` outside it.
- Frontend view test: `DebuggerView` passes only complete, active-source ranged variables to `MonacoCodeSurface`.

## Acceptance Criteria

- Hover is visible only for variables with explicit source ranges.
- Hover is absent for same-name text outside those ranges.
- Existing debugger sessions without variable ranges behave exactly as today.
- Focused frontend and backend tests pass.
