# Global Updates Node Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Narrow the global Updates table's Node column by 30% and make each known node label link to its node detail view.

**Architecture:** Keep the shared node-column grid unchanged for other `UpdatesBrowser` instances, then add a global Updates row modifier override and a matching mobile single-column override. Render a node label as a scoped `RouterLink` only when `nodeId` exists, using `encodeURIComponent` and stopping click/keyboard propagation so the existing update-row navigation remains intact.

**Tech Stack:** Vue 3, Vue Router, TypeScript, Testing Library Vue, Vitest, shared CSS.

---

### Task 1: Add failing Home Updates behavior tests

**Files:**
- Modify: `frontend/src/views/HomeUpdatesView.test.ts`

- [ ] **Step 1: Add a reserved-character node fixture and router spy**

Use a hoisted `push` spy for the mocked `useRouter`, and set the fixture node ID to a value containing `/` such as `participant/1`. Import `fireEvent` and retain the existing RouterLink anchor stub so rendered `to` values can be asserted as `href` values.

- [ ] **Step 2: Add assertions for the node link and navigation isolation**

Assert that the global Updates section contains a node link named `Participant 1`, has the existing Updates content-link class, and points to `/nodes/participant%2F1`. Click that link and assert the router push spy has not been called for the update route. Then click the surrounding update row and assert the update route is pushed. Add keyboard assertions for Enter and Space on the row/link as needed to verify link events cannot bubble into row navigation.

- [ ] **Step 3: Run the focused test to verify it fails for the missing node link**

Run:

```bash
rtk npm run test --workspace frontend -- src/views/HomeUpdatesView.test.ts --run
```

Expected: FAIL because the Node label is currently plain text and the requested node link does not exist.

### Task 2: Implement the scoped node link and 30% narrower column

**Files:**
- Modify: `frontend/src/components/UpdatesBrowser.vue`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Add the node route helper**

Add a small helper beside the existing `updateLink` and `partyLink` helpers that returns `/nodes/${encodeURIComponent(nodeId)}` for a non-empty node ID.

- [ ] **Step 2: Render the node label as a RouterLink**

In the `showNodeColumn` cell, render a `RouterLink` for updates with a node ID. Apply `activity-home__updates-node contract-detail__link`, use the encoded node route, and add `@click.stop`, `@keydown.enter.stop`, and `@keydown.space.stop`. Keep the current `Unknown node` span when no node ID exists.

- [ ] **Step 3: Add the global Updates grid overrides**

Keep the existing shared `.node-updates__row--with-node` grid at `minmax(120px, 0.8fr)`. Add the global Updates row override with the first track changed to `minmax(84px, 0.56fr)`. In the existing mobile media query, add the more-specific global Updates selector with `grid-template-columns: 1fr`.

- [ ] **Step 4: Run the focused test to verify it passes**

Run:

```bash
rtk npm run test --workspace frontend -- src/views/HomeUpdatesView.test.ts --run
```

Expected: PASS, including the encoded node destination and row-navigation isolation.

### Task 3: Verify and commit

**Files:**
- Verify: `frontend/src/components/UpdatesBrowser.vue`
- Verify: `frontend/src/styles.css`
- Verify: `frontend/src/views/HomeUpdatesView.test.ts`

- [ ] **Step 1: Run the full workspace suite and diff check**

```bash
rtk npm test
rtk git diff --check
```

Expected: all backend and frontend tests pass; `git diff --check` produces no output.

- [ ] **Step 2: Commit the implementation**

```bash
rtk git add frontend/src/components/UpdatesBrowser.vue frontend/src/styles.css frontend/src/views/HomeUpdatesView.test.ts
rtk git commit -m "feat: link nodes from global updates"
```

- [ ] **Step 3: Verify the final branch state**

```bash
rtk git status --short --branch
rtk git log -1 --oneline
```

Expected: `main` is clean with the implementation commit at HEAD.
