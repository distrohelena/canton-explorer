# Choice Template Anchors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans (recommended). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Link update-event Choices to their template page and scroll to the matching choice definition.

**Architecture:** Add one shared frontend helper for deriving the Choice hash/DOM anchor. Update-event Choice values become conditional router links using the existing package/template route. `TemplateDetailView` assigns matching IDs and watches the route hash, scrolling the target after asynchronous template data renders; no backend/API changes are needed.

**Tech Stack:** Vue 3, Vue Router, TypeScript, Vitest, Testing Library.

---

### Task 1: Add shared choice-anchor helpers

**Files:**
- Create: `frontend/src/lib/template-anchor.ts` — define the `choice-` prefix, build the logical hash target, build the encoded DOM ID, and safely extract a choice name from Vue Router’s decoded hash.
- Test: `frontend/src/lib/template-anchor.test.ts` — cover ordinary and encoded choice names plus malformed/unexpected hashes.

- [ ] **Step 1: Write the failing helper tests**

  Test that:

  - `choiceHash('Archive')` returns `#choice-Archive`;
  - `choiceAnchorId('A Choice/With:Symbols')` returns `choice-A%20Choice%2FWith%3ASymbols`;
  - `choiceNameFromHash('#choice-A Choice/With:Symbols')` returns the decoded logical name;
  - `choiceNameFromHash()` returns `null` for hashes without the `#choice-` prefix, malformed percent escapes, and empty choice names without throwing;
  - `choiceHash()` and `choiceAnchorId()` return `null` for empty choice names.

- [ ] **Step 2: Run the helper tests and verify the expected failure**

  Run:

  ```bash
  npm test --workspace frontend -- --run src/lib/template-anchor.test.ts
  ```

  Expected: FAIL because the helper module does not yet exist.

- [ ] **Step 3: Implement the helpers**

  Keep the helpers pure. Use the logical choice name in the URL hash, `encodeURIComponent()` only for the DOM ID, and treat the incoming route hash as already decoded. Return `null` for unexpected prefixes, empty values, or malformed input.

- [ ] **Step 4: Run the helper tests and verify they pass**

  Run the same command. Expected: PASS.

- [ ] **Step 5: Commit the helper unit**

  ```bash
  git add frontend/src/lib/template-anchor.ts frontend/src/lib/template-anchor.test.ts
  git commit -m "feat: add choice template anchor helpers"
  ```

### Task 2: Link Choices from update events

**Files:**
- Modify: `frontend/src/views/UpdateDetailView.vue` — conditionally link event Choice values to the template route/hash.
- Test: `frontend/src/views/UpdateDetailView.test.ts` — assert encoded route/hash links and plain-text fallback when identifiers are missing.

- [ ] **Step 1: Write the failing update-view tests**

  Extend the existing exercise-event coverage with an event whose package ID, template ID, and choice are present. Assert the Choice value is an anchor targeting:

  ```text
  /packages/main-package/templates/Main%3AAsset#choice-ReceiveSvRewardCoupon
  ```

  Add a missing-identifier case and assert its Choice remains text rather than a link.

- [ ] **Step 2: Run the focused update-view tests and verify the expected failure**

  Run:

  ```bash
  npm test --workspace frontend -- --run src/views/UpdateDetailView.test.ts
  ```

  Expected: FAIL because the Choice field is currently always plain text.

- [ ] **Step 3: Implement the conditional link**

  Add a local template target helper or compose the existing package/template route with the shared `choiceHash()` helper. Render a `RouterLink` only when `event.packageId`, `event.templateId`, and `event.choice` are present; otherwise retain the current `n/a`/plain-text output.

- [ ] **Step 4: Run the focused update-view tests and verify they pass**

  Run the same command. Expected: PASS.

- [ ] **Step 5: Commit the update-event link**

  ```bash
  git add frontend/src/views/UpdateDetailView.vue frontend/src/views/UpdateDetailView.test.ts
  git commit -m "feat: link update choices to templates"
  ```

### Task 3: Add template anchors and scroll-to-choice behavior

**Files:**
- Modify: `frontend/src/views/TemplateDetailView.vue` — assign choice IDs and scroll to route-hash targets after loading.
- Test: `frontend/src/views/TemplateDetailView.test.ts` — cover stable IDs, encoded names, matching hashes, route hash changes, and no-op malformed/missing targets.

- [ ] **Step 1: Write the failing template-view tests**

  Mock `useRoute()` with a reactive `hash`, render a decoded template containing a choice named `A Choice/With:Symbols`, and mock that row’s `scrollIntoView`. Assert:

  - the row ID is `choice-A%20Choice%2FWith%3ASymbols`;
  - a matching decoded route hash `#choice-A Choice/With:Symbols` scrolls the row after the async response renders;
  - changing the hash to another matching choice scrolls that row;
  - missing, unexpected, and malformed hashes do not throw or call `scrollIntoView`.

- [ ] **Step 2: Run the focused template-view tests and verify the expected failure**

  Run:

  ```bash
  npm test --workspace frontend -- --run src/views/TemplateDetailView.test.ts
  ```

  Expected: FAIL because choice rows have no anchor IDs and the view does not observe or scroll to route hashes.

- [ ] **Step 3: Implement anchor IDs and hash scrolling**

  Import the shared helpers and `useRoute`. Add a stable `id` to each choice row. Watch the decoded route hash and template-detail state, then on the next render tick derive the matching encoded DOM ID and use `document.getElementById()` to find the row before calling `scrollIntoView()`. Guard all missing/invalid states and avoid scrolling when the hash is unrelated.

- [ ] **Step 4: Run the focused template-view tests and verify they pass**

  Run the same command. Expected: PASS.

- [ ] **Step 5: Run related frontend regressions**

  ```bash
  npm test --workspace frontend -- --run src/lib/template-anchor.test.ts src/views/UpdateDetailView.test.ts src/views/TemplateDetailView.test.ts
  ```

  Expected: all related tests pass.

- [ ] **Step 6: Commit the template anchors and scrolling**

  ```bash
  git add frontend/src/views/TemplateDetailView.vue frontend/src/views/TemplateDetailView.test.ts
  git commit -m "feat: scroll template pages to choices"
  ```

### Task 4: Full verification and handoff

**Files:**
- No additional source changes expected.

- [ ] **Step 1: Run the complete test suite**

  ```bash
  VITE_API_BASE_URL=http://localhost:4600/api npm test
  ```

  Expected: backend and frontend suites pass.

- [ ] **Step 2: Run the production build**

  ```bash
  npm run build
  ```

  Expected: backend compilation and frontend type-check/Vite build pass.

- [ ] **Step 3: Check the final diff**

  ```bash
  git diff --check
  git status --short
  ```

  Expected: no whitespace errors and no new unrelated changes beyond the already-present user worktree changes. Do not commit unrelated user changes unless explicitly requested.
