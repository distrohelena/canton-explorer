# Debugger Lexical Hover Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show current debugger-scope values for parameter declarations and references that can be resolved unambiguously in the active DAML source file.

**Architecture:** Keep explicit variable source ranges as the highest-confidence source. Add a small, conservative lexical scanner that identifies function parameter lists and parameter occurrences in that function body, stopping at the next top-level declaration. It emits a hover range only when exactly one current-scope variable has that name and no nested binding (`let`, lambda, or case-pattern binding) can shadow it.

**Tech Stack:** Vue 3, TypeScript, Vitest, Monaco Editor.

---

## File Structure

- Create: `frontend/src/lib/daml-hover-resolution.ts` — pure, conservative resolver from source text and in-scope variable names to precise hover ranges.
- Create: `frontend/src/lib/daml-hover-resolution.test.ts` — resolver boundaries, including declarations, repeated references, fields, and shadowing.
- Modify: `frontend/src/views/DebuggerView.vue` — combine explicit SDK ranges with resolver-produced ranges for the active source tab.
- Modify: `frontend/src/views/DebuggerView.test.ts` — verify the view passes declaration/reference ranges for the current scope and does not pass uncertain occurrences.

### Task 1: Resolve Proven Function Parameters and References

**Files:**
- Create: `frontend/src/lib/daml-hover-resolution.ts`
- Create: `frontend/src/lib/daml-hover-resolution.test.ts`

- [ ] **Step 1: Write failing resolver tests**

Cover a DAML declaration such as:

```daml
executeBaseDepositLike vaultIdentity vaultParty assetInstrumentId shareTokenCid virtualAssets virtualShares name symbol args = do
  validateBaseOperationPositiveAmount args.operation args.amount
```

Assert that a unique in-scope `args` produces three start-inclusive/end-exclusive ranges: the parameter declaration and both `args` reference tokens. Assert that `operation` and `amount` field tokens produce no range.

- [ ] **Step 2: Run the resolver test to verify it fails**

Run: `rtk npm test --workspace frontend -- --run src/lib/daml-hover-resolution.test.ts`

Expected: FAIL because the resolver does not exist.

- [ ] **Step 3: Implement the minimal lexical resolver**

Export a pure function accepting source text plus current variable names. It must:

1. recognize a top-level `name parameter… =` declaration;
2. constrain matches to its body before the next top-level declaration;
3. match identifier tokens only, excluding tokens immediately following `.`;
4. return ranges only for names appearing exactly once in the active scope.

- [ ] **Step 4: Run resolver tests to verify they pass**

Run: `rtk npm test --workspace frontend -- --run src/lib/daml-hover-resolution.test.ts`

Expected: PASS.

### Task 2: Reject Ambiguous/Shadowed Occurrences

**Files:**
- Modify: `frontend/src/lib/daml-hover-resolution.ts`
- Modify: `frontend/src/lib/daml-hover-resolution.test.ts`

- [ ] **Step 1: Write failing shadowing tests**

Add examples with nested `let args = …`, lambda parameters, and case-pattern bindings. Assert the nested binding and body occurrences receive no hover range from the outer current-scope `args`; unrelated functions with an `args` parameter must also receive none.

- [ ] **Step 2: Run the resolver test to verify it fails**

Run: `rtk npm test --workspace frontend -- --run src/lib/daml-hover-resolution.test.ts`

Expected: FAIL because the initial resolver has no shadowing guard.

- [ ] **Step 3: Add conservative ambiguity guards**

When an unsupported nested binding is encountered, exclude that nested region from fallback resolution. Prefer omission over a value that could belong to another binding.

- [ ] **Step 4: Run resolver tests to verify they pass**

Run: `rtk npm test --workspace frontend -- --run src/lib/daml-hover-resolution.test.ts`

Expected: PASS.

### Task 3: Wire Resolved Ranges Into the Debugger View

**Files:**
- Modify: `frontend/src/views/DebuggerView.vue`
- Modify: `frontend/src/views/DebuggerView.test.ts`

- [ ] **Step 1: Write a failing DebuggerView test**

Provide the `executeBaseDepositLike` source and one uniquely scoped `args` value. Assert `MonacoCodeSurface` receives all three proven `args` ranges and no ranges for `.operation` or `.amount`.

- [ ] **Step 2: Run the view test to verify it fails**

Run: `rtk npm test --workspace frontend -- --run src/views/DebuggerView.test.ts`

Expected: FAIL because current fallback is limited to the current exact step span.

- [ ] **Step 3: Replace exact-step-only fallback with lexical resolver results**

Keep direct SDK variable locations unchanged. Feed active source content and uniquely valued current-scope variables into the resolver, then merge/deduplicate its proven ranges with direct ranges. Do not produce ranges for unknown, null-valued, duplicate-named, or ambiguous variables.

- [ ] **Step 4: Run relevant tests and build**

Run:

```bash
rtk npm test --workspace frontend -- --run src/lib/daml-hover-resolution.test.ts src/views/DebuggerView.test.ts src/components/MonacoCodeSurface.test.ts
rtk npm run build --workspace frontend
```

Expected: all tests and the frontend build pass.

### Task 4: Verify the Live Debugger Session

- [ ] **Step 1: Open the supplied session URL in the Vite app**

Verify that both `args` references on line 498 and the `args` parameter in the `executeBaseDepositLike` declaration show the same current scoped value.

- [ ] **Step 2: Verify proof boundaries**

Confirm field names, another function’s `args`, and an intentionally shadowed `args` do not receive a value hover.
