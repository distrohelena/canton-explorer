# Shared Back Control Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every `Back to overview` link with a circular arrow-only back control positioned to the left of the main content block on node detail pages.

**Architecture:** Keep the control as an existing route link, but move the detail-page layout to a two-column wrapper with a narrow back-control rail and a separate main content column. Apply the same shared structure to both the node detail view and the node updates view, then collapse it back into a single column on small screens.

**Tech Stack:** Vue 3, Vue Router, TypeScript, Vitest, Testing Library, Vite, CSS

---

### File Structure

**Files and responsibilities:**

- `frontend/src/views/NodeDetailView.vue`
  - adopt the shared outer layout wrapper and arrow-only back control
- `frontend/src/views/NodeUpdatesView.vue`
  - adopt the same shared wrapper and arrow-only back control
- `frontend/src/styles.css`
  - define the shared back-control rail, circular icon styling, and responsive fallback
- `frontend/src/views/NodeDetailView.test.ts`
  - verify the arrow-only back control exists on the detail page
- `frontend/src/views/NodeUpdatesView.test.ts`
  - verify the same control exists on the updates page

### Task 1: Define the new back-control behavior in tests

**Files:**
- Modify: `frontend/src/views/NodeDetailView.test.ts`
- Modify: `frontend/src/views/NodeUpdatesView.test.ts`

- [ ] **Step 1: Write the failing view tests**

Update both tests so they assert:

- the page still renders its main heading/content
- the back control is a link with the accessible name `Back to overview`
- the visible link content is arrow-only rather than text

Use a text assertion that `Back to overview` is not rendered as visible page copy.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace frontend -- src/views/NodeDetailView.test.ts src/views/NodeUpdatesView.test.ts`

Expected: FAIL because both views still render the visible `Back to overview` text link.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/views/NodeDetailView.test.ts frontend/src/views/NodeUpdatesView.test.ts
git commit -m "test: define shared back control behavior"
```

### Task 2: Update both views to use the shared back-control wrapper

**Files:**
- Modify: `frontend/src/views/NodeDetailView.vue`
- Modify: `frontend/src/views/NodeUpdatesView.vue`

- [ ] **Step 1: Write minimal shared-view implementation**

For both pages:

- add an outer wrapper that separates the back control from the main content block
- move the back link into the left-side rail
- replace the visible text with an arrow glyph only
- keep the accessible name on the link via `aria-label="Back to overview"`

Do not change the core page content beyond the wrapper and control placement.

- [ ] **Step 2: Run the tests to verify the views pass**

Run: `npm test --workspace frontend -- src/views/NodeDetailView.test.ts src/views/NodeUpdatesView.test.ts`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/views/NodeDetailView.vue frontend/src/views/NodeUpdatesView.vue
git commit -m "feat: move shared back control into page rail"
```

### Task 3: Add shared styling for the rail and circular icon button

**Files:**
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Use the existing view tests as the regression**

No separate CSS-only tests are needed; the markup tests remain the guardrail while styling is added.

- [ ] **Step 2: Run the two view tests before styling**

Run: `npm test --workspace frontend -- src/views/NodeDetailView.test.ts src/views/NodeUpdatesView.test.ts`

Expected: PASS on behavior, with layout still unstylized.

- [ ] **Step 3: Write minimal shared CSS**

Add styles for:

- a two-column page wrapper with a narrow left rail
- a circular back icon button
- main content column separation from the rail
- responsive collapse to a single column on small screens

Keep the visual treatment aligned with the existing explorer shell.

- [ ] **Step 4: Re-run the view tests**

Run: `npm test --workspace frontend -- src/views/NodeDetailView.test.ts src/views/NodeUpdatesView.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/styles.css
git commit -m "style: add shared back control rail layout"
```

### Task 4: Run final verification

**Files:**
- Verify only

- [ ] **Step 1: Run the affected frontend tests**

Run: `npm test --workspace frontend -- src/views/NodeDetailView.test.ts src/views/NodeUpdatesView.test.ts src/App.test.ts`

Expected: PASS

- [ ] **Step 2: Run the frontend production build**

Run: `npm run build --workspace frontend`

Expected: PASS
