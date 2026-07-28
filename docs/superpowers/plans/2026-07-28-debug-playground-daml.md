# Debug Playground DAML Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans (recommended). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone `debug-playground/` DAML project that produces an easy-to-install DAR containing small contracts and choices for exercising Canton Explorer’s debugger.

**Architecture:** Keep the playground independent from the TypeScript application. A single DAML module contains intentionally small templates covering text, parties, integers, booleans, optionals, lists, records, contract IDs, consuming choices, non-consuming choices, and an intentional failure path. The project README documents SDK prerequisites, DAR/debug-DAR builds, participant upload, and example debugger scenarios.

**Tech Stack:** DAML SDK CLI, DAML-LF DAR output, Canton Explorer debug-DAR helper scripts.

## Global Constraints

- Keep all playground source under `debug-playground/`.
- Use only standard `daml-prim` and `daml-stdlib` dependencies.
- Keep constructor and choice parameters small enough to enter manually in the debugger.
- Include no application-specific dependencies or Splice source.
- Preserve unrelated working-tree changes and do not modify the explorer runtime.

---

### Task 1: Scaffold the standalone DAML project

**Files:**
- Create: `debug-playground/daml.yaml`
- Create: `debug-playground/src/DebugPlayground.daml`

**Interfaces:**
- Produces a buildable DAML project whose package name is `canton-explorer-debug-playground`.
- Exposes templates `Message`, `Counter`, `Profile`, `TagList`, `ContractReference`, and `FailureSwitch`.

- [x] **Step 1: Write the project manifest**

Create `debug-playground/daml.yaml` with the installed SDK version, project name/version, source directory, and only standard dependencies:

```yaml
sdk-version: 3.5.2
name: canton-explorer-debug-playground
version: 0.1.0
source: src
dependencies:
- daml-prim
- daml-stdlib
```

- [x] **Step 2: Write the simple message and counter templates**

`Message` has `sender : Party`, `recipient : Party`, and `text : Text`; `Echo` returns the text and `ReplaceText` consumes the message and creates a replacement with a new `Text` value. `Counter` has `owner : Party` and `value : Int`; `Increment` consumes the counter and creates a new one using an `Int` delta, while `Read` returns the current value.

- [x] **Step 3: Add optional/list/record coverage**

`Profile` has `owner : Party`, `displayName : Text`, and `nickname : Optional Text`; `SetNickname` takes `Optional Text`. `TagList` has `owner : Party` and `tags : List Text`; `AddTag` consumes the contract and creates a new one with one appended `Text` value.

- [x] **Step 4: Add contract-reference and intentional-failure coverage**

`ContractReference` has `owner : Party`, `target : ContractId Message`, and `enabled : Bool`; `PingTarget` exercises the referenced message’s `Echo` choice and returns its text. Add a `FailureSwitch` template with `owner : Party` and `fail : Bool`; its `Check` choice calls `assertMsg "Debug playground requested a failure" (not fail)` so the debugger can inspect a failed exercise.

- [x] **Step 5: Build the project and fix only DAML syntax or SDK compatibility errors**

Run:

```bash
cd debug-playground
daml build
```

Expected: a DAR is written under `.daml/dist/` and the build exits successfully.

---

### Task 2: Add installation and debugger scenario documentation

**Files:**
- Create: `debug-playground/README.md`

**Interfaces:**
- Documents the generated DAR path and the exact commands needed to install/upload it.
- Names the templates and choices from `DebugPlayground.daml`.

- [x] **Step 1: Document prerequisites and build**

Explain that users need the DAML SDK matching `daml.yaml`, then document `cd debug-playground && daml build`.

- [x] **Step 2: Document participant installation**

Document the Canton participant admin upload flow using the generated `.daml/dist/canton-explorer-debug-playground-0.1.0.dar`, and state that the user must upload it to every participant where the templates should appear. Keep the upload command clearly marked as participant-specific because ports, TLS, and authentication differ between deployments.

- [x] **Step 3: Document debug-DAR generation**

Point users to the repository’s existing `backend/scripts/build-debug-dar.mjs` and README debug-DAR instructions and show how to produce a companion debug DAR from the playground DAR. Explain that source-level debugger locations require the debug DAR to be available to Canton Explorer.

- [x] **Step 4: Document manual debugger scenarios**

List short scenarios: create `Message` and exercise `Echo`; increment `Counter` with positive and negative `Int` deltas; create `Profile` with and without an `Optional Text` nickname; update `TagList` with `Text` tags; exercise `FailureSwitch.Check` with `fail = true`; and create `ContractReference` after a `Message` to exercise `PingTarget`.

---

### Task 3: Verify package artifacts and repository hygiene

**Files:**
- Modify: none outside `debug-playground/`

**Interfaces:**
- Produces a buildable DAR and documented debug-DAR workflow without changing the explorer application.

- [x] **Step 1: Run the DAML build from the playground directory**

Run `daml build` and confirm the expected DAR exists under `debug-playground/.daml/dist/`.

- [x] **Step 2: Run the repository debug-DAR preparation command against the playground DAR**

Use the documented helper command with an explicit output directory under a temporary directory or `debug-playground/.daml/debug-dist/`, and verify the output contains the original compiled archive plus source/debug metadata.

- [x] **Step 3: Check repository diff scope**

Run `git diff --check` and `git status --short`. Confirm only the new playground files are attributable to this task; do not stage or alter existing unrelated changes.

- [x] **Step 4: Run the relevant existing script tests**

Run `cd backend && node --test test/scripts/dar-archive-entries.test.mjs test/scripts/dar-source-entries.test.mjs`; expected: all selected tests pass.
