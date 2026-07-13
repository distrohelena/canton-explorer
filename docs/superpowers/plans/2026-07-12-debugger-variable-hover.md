# Debugger Variable Hover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show Monaco debugger hover values only for scoped variables that include explicit source ranges.

**Architecture:** Add optional variable-level source locations to the backend and frontend debugger types. Derive proven hover entries in `DebuggerView` from the active source tab and current scoped variables, then let `MonacoCodeSurface` register a Monaco hover provider that returns content only when the cursor is inside one of those explicit ranges.

**Tech Stack:** NestJS/Jest backend, Vue 3/Vitest frontend, Monaco Editor.

---

## File Structure

- `backend/src/debugger/debugger.service.ts`: extend replay variable and API response types with optional `sourceLocation`; map it through when present.
- `backend/src/debugger/debugger.service.spec.ts`: assert backend preserves a variable-level source location.
- `frontend/src/types/debugger.ts`: extend `DebuggerScopeVariable` with optional `sourceLocation`.
- `frontend/src/components/MonacoCodeSurface.vue`: accept proven hover entries, register/dispose a Monaco hover provider, and return markdown only for positions inside explicit ranges.
- `frontend/src/components/MonacoCodeSurface.test.ts`: test hover provider registration and inside/outside range behavior.
- `frontend/src/views/DebuggerView.vue`: compute active-source hover entries from current scopes.
- `frontend/src/views/DebuggerView.test.ts`: assert only complete active-source ranged variables are passed to `MonacoCodeSurface`.

---

### Task 1: Preserve Variable Source Locations In Backend Responses

**Files:**
- Modify: `backend/src/debugger/debugger.service.ts`
- Modify: `backend/src/debugger/debugger.service.spec.ts`

- [ ] **Step 1: Write the failing backend test**

In `backend/src/debugger/debugger.service.spec.ts`, update the mocked replay variable on `steps[1]`, the step returned by `getCurrentStepOrThrow`, to include a variable-specific source location:

```ts
variables: [
  {
    name: 'owner',
    kind: 'text',
    value: 'Alice',
    sourceLocation: {
      path: 'Main.daml',
      startLine: 10,
      startColumn: 14,
      endLine: 10,
      endColumn: 19,
    },
  },
],
```

Then update the existing `expect(service.getSession('session-1').currentStep).toEqual(...)` assertion so the `owner` variable includes:

```ts
sourceLocation: {
  path: 'Main.daml',
  startLine: 10,
  startColumn: 14,
  endLine: 10,
  endColumn: 19,
},
```

- [ ] **Step 2: Run the backend test to verify it fails**

Run:

```bash
npm test --workspace backend -- debugger.service.spec.ts --runInBand
```

Expected: FAIL because `sourceLocation` is missing from the normalized variable response.

- [ ] **Step 3: Add the backend source-location type**

In `backend/src/debugger/debugger.service.ts`, introduce a reusable source-location-like type near the replay types:

```ts
type ReplaySourceLocationLike = {
  path?: string;
  startLine?: number;
  startColumn?: number;
  endLine?: number;
  endColumn?: number;
};
```

Update `ReplayScopeVariableLike`:

```ts
type ReplayScopeVariableLike = {
  name?: string;
  kind?: string;
  value?: string;
  contractType?: string;
  sourceLocation?: ReplaySourceLocationLike;
};
```

Update `ReplayStepLike.sourceLocation` to use `ReplaySourceLocationLike`.

- [ ] **Step 4: Extend the backend response interface**

In `DebuggerScopeVariableResponse`, add:

```ts
sourceLocation: DebuggerStepResponse['sourceLocation'];
```

This keeps the response shape explicit and allows `null` when the SDK provides no variable range.

- [ ] **Step 5: Map variable source locations**

In `mapScope`, add `sourceLocation` to each mapped variable:

```ts
sourceLocation: this.mapSourceLocation(variable.sourceLocation),
```

- [ ] **Step 6: Run the backend test to verify it passes**

Run:

```bash
npm test --workspace backend -- debugger.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit Task 1**

Run:

```bash
git add backend/src/debugger/debugger.service.ts backend/src/debugger/debugger.service.spec.ts
git commit -m "feat: preserve debugger variable source ranges"
```

---

### Task 2: Add Monaco Hover Provider Support For Proven Ranges

**Files:**
- Modify: `frontend/src/components/MonacoCodeSurface.vue`
- Modify: `frontend/src/components/MonacoCodeSurface.test.ts`

- [ ] **Step 1: Write the failing Monaco component test**

In `frontend/src/components/MonacoCodeSurface.test.ts`, extend the Monaco mock with:

```ts
let hoverProvider: {
  provideHover: (model: unknown, position: { lineNumber: number; column: number }) => unknown;
} | null = null;
const disposeHoverProvider = vi.fn();
const registerHoverProvider = vi.fn((_language: string, provider) => {
  hoverProvider = provider;
  return { dispose: disposeHoverProvider };
});
```

Add `languages: { registerHoverProvider }` to the mocked `loadMonaco()` result.

Reset `hoverProvider`, `disposeHoverProvider`, and `registerHoverProvider` in `afterEach` to prevent cross-test leakage.

Add a test:

```ts
it('shows debugger hover content only inside proven variable ranges', async () => {
  const model = {
    getValue: () => 'template Example where\n  signatory owner\n',
    dispose: vi.fn(),
  };
  createModel.mockReturnValueOnce(model);

  render(MonacoCodeSurface, {
    props: {
      modelValue: 'template Example where\n  signatory owner\n',
      language: 'daml',
      hoverVariables: [
        {
          name: 'owner',
          kind: 'text',
          value: 'Alice',
          contractType: null,
          range: {
            startLine: 2,
            startColumn: 13,
            endLine: 2,
            endColumn: 18,
          },
        },
      ],
    },
  });

  await Promise.resolve();
  await nextTick();

  expect(registerHoverProvider).toHaveBeenCalledWith('daml', expect.anything());
  expect(hoverProvider?.provideHover(model, { lineNumber: 2, column: 14 })).toEqual({
    contents: [
      { value: '`owner`' },
      { value: 'kind: `text`' },
      { value: 'value: `Alice`' },
    ],
  });
  expect(hoverProvider?.provideHover(model, { lineNumber: 1, column: 1 })).toBeNull();
});
```

- [ ] **Step 2: Run the frontend component test to verify it fails**

Run:

```bash
npm test --workspace frontend -- --run src/components/MonacoCodeSurface.test.ts
```

Expected: FAIL because `hoverVariables` and hover provider registration do not exist.

- [ ] **Step 3: Add the hover prop and types**

In `MonacoCodeSurface.vue`, add:

```ts
export interface MonacoDebuggerHoverVariable {
  name: string;
  kind: string | null;
  value: string | null;
  contractType: string | null;
  range: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
}
```

Extend props:

```ts
hoverVariables?: MonacoDebuggerHoverVariable[];
```

Default `hoverVariables` to `[]`.

- [ ] **Step 4: Implement hover provider registration**

In `MonacoCodeSurface.vue`:

- add a `hoverProviderDisposable` variable
- add `disposeHoverProvider()`
- add `registerHoverProvider()`
- call `registerHoverProvider()` after editor/model creation
- re-register when `props.language` or `props.hoverVariables` changes
- dispose it in `onBeforeUnmount`

Use `activeEditor.getModel()` or the local `model.value` comparison so the provider returns `null` for other Monaco models.

Core provider behavior:

```ts
const match = [...props.hoverVariables]
  .filter((entry) => containsPosition(entry.range, position))
  .sort((left, right) => rangeSize(left.range) - rangeSize(right.range))[0];

return match ? { contents: formatHoverContents(match) } : null;
```

Treat ranges as Monaco-style start-inclusive and end-exclusive: `(startLine,startColumn)` is inside, `(endLine,endColumn)` is outside. This prevents adjacent token ranges from both matching the same cursor position.

Formatting must follow the spec order:

```ts
[
  { value: `\`${escapeMarkdownCode(match.name)}\`` },
  match.kind ? { value: `kind: \`${escapeMarkdownCode(match.kind)}\`` } : null,
  match.value !== null ? { value: `value: \`${escapeMarkdownCode(match.value)}\`` } : null,
  match.contractType !== null ? { value: `contract type: \`${escapeMarkdownCode(match.contractType)}\`` } : null,
].filter(Boolean)
```

Escape backticks in code spans by replacing `` ` `` with `\\``.

- [ ] **Step 5: Run the frontend component test to verify it passes**

Run:

```bash
npm test --workspace frontend -- --run src/components/MonacoCodeSurface.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

Run:

```bash
git add frontend/src/components/MonacoCodeSurface.vue frontend/src/components/MonacoCodeSurface.test.ts
git commit -m "feat: add debugger hover provider to monaco surface"
```

---

### Task 3: Wire Proven Debugger Variables From The View

**Files:**
- Modify: `frontend/src/types/debugger.ts`
- Modify: `frontend/src/views/DebuggerView.vue`
- Modify: `frontend/src/views/DebuggerView.test.ts`

- [ ] **Step 1: Write the failing DebuggerView test**

In `frontend/src/views/DebuggerView.test.ts`, extend the `MonacoCodeSurface` mock props:

```ts
hoverVariables: {
  type: Array,
  default: () => [],
},
```

Update the mock template to expose the count:

```html
<div data-testid="monaco-stub" :data-language="language" :data-hover-count="hoverVariables.length">{{ modelValue }}</div>
```

Add a focused test that returns scoped variables:

- one included variable with non-empty `name`, non-null `value`, and a complete source range whose path uses `\` separators but normalizes to the active source tab path
- one same-name or other variable without source range
- one variable with an incomplete range
- one variable ranged in another source path
- one variable with a complete matching range but `value: null`

Assert:

```ts
expect(await screen.findByTestId('monaco-stub')).toHaveAttribute('data-hover-count', '1');
```

The one included variable should prove both path normalization and complete displayable value filtering: only the backslash-path ranged active-source variable with a non-null value is counted. Every other fixture variable must be excluded for exactly one explicit reason.

- [ ] **Step 2: Run the DebuggerView test to verify it fails**

Run:

```bash
npm test --workspace frontend -- --run src/views/DebuggerView.test.ts
```

Expected: FAIL because `DebuggerView` does not pass `hoverVariables`.

- [ ] **Step 3: Extend frontend debugger types**

In `frontend/src/types/debugger.ts`, add a reusable location type:

```ts
export interface DebuggerSourceLocation {
  path: string | null;
  startLine: number | null;
  startColumn: number | null;
  endLine: number | null;
  endColumn: number | null;
}
```

Use it for `DebuggerScopeVariable.sourceLocation?: DebuggerSourceLocation | null` and replace duplicated step/event source-location shapes where straightforward.

- [ ] **Step 4: Derive hover entries in DebuggerView**

In `DebuggerView.vue`, import `type { MonacoDebuggerHoverVariable }` from `MonacoCodeSurface.vue`.

Add helpers:

```ts
function normalizeSourcePath(path: string | null | undefined): string | null {
  return path ? path.replace(/\\/g, '/') : null;
}

function isCompleteSourceLocation(location: DebuggerSourceLocation | null | undefined) {
  return Boolean(
    location?.path
    && typeof location.startLine === 'number'
    && typeof location.startColumn === 'number'
    && typeof location.endLine === 'number'
    && typeof location.endColumn === 'number',
  );
}
```

Add a computed `hoverVariables` that:

- uses `activeSourceTab.value?.path`
- normalizes both paths
- walks `currentScopes.value`
- includes only variables with non-empty `name`, a non-null displayable `value`, a complete `sourceLocation`, and matching active source path
- maps location fields to the `range` object expected by `MonacoCodeSurface`

- [ ] **Step 5: Pass hover entries to MonacoCodeSurface**

Update the template:

```vue
<MonacoCodeSurface
  ...
  :hover-variables="hoverVariables"
/>
```

- [ ] **Step 6: Run the DebuggerView test to verify it passes**

Run:

```bash
npm test --workspace frontend -- --run src/views/DebuggerView.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

Run:

```bash
git add frontend/src/types/debugger.ts frontend/src/views/DebuggerView.vue frontend/src/views/DebuggerView.test.ts
git commit -m "feat: wire debugger scoped variables to hover"
```

---

### Task 4: Final Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run focused backend verification**

Run:

```bash
npm test --workspace backend -- debugger.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run focused frontend verification**

Run:

```bash
npm test --workspace frontend -- --run src/components/MonacoCodeSurface.test.ts src/views/DebuggerView.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run type/build verification**

Run:

```bash
npm run build --workspace frontend
```

Expected: PASS.

Run:

```bash
npm run build --workspace backend
```

Expected: PASS.

- [ ] **Step 4: Inspect the final diff**

Run:

```bash
git diff --stat main...HEAD
git diff main...HEAD -- backend/src/debugger/debugger.service.ts frontend/src/components/MonacoCodeSurface.vue frontend/src/views/DebuggerView.vue
```

Expected: only debugger variable source-range and hover wiring changes.

- [ ] **Step 5: Commit any remaining verification fixes**

If verification required fixes, commit them:

```bash
git add <changed-files>
git commit -m "fix: stabilize debugger variable hover"
```

If there are no changes, skip this step.
