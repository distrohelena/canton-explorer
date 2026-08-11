# Updates Link Tone Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make content links on the global Updates page less visually dominant while preserving their link affordance and leaving other views unchanged.

**Architecture:** Use the dedicated `HomeUpdatesView` modifier class already defined in the approved spec to scope a CSS override to global Updates content links. Keep the shared `.contract-detail__link` rule and interaction behavior unchanged; validate the page-specific scope through the existing Home Updates view test.

**Tech Stack:** Vue 3, TypeScript, Testing Library Vue, Vitest, shared CSS custom properties.

---

### Task 1: Apply and verify the global Updates link tone

**Files:**
- Modify: `frontend/src/styles.css` near the existing `.contract-detail__link` rule
- Test: `frontend/src/views/HomeUpdatesView.test.ts`

- [ ] **Step 1: Add the focused scope assertion**

In the existing `HomeUpdatesView` test, assert that the Updates table's offset link and party link have the existing `contract-detail__link` class, and that the rendered Updates section has `activity-home__updates-section--global-updates`. This verifies the CSS selector has a stable page-specific scope without changing link semantics.

- [ ] **Step 2: Run the focused test to establish the current behavior**

Run:

```bash
rtk npm run test --workspace frontend -- src/views/HomeUpdatesView.test.ts --run
```

Expected: PASS before the style-only change.

- [ ] **Step 3: Add the scoped muted-color rule**

Immediately after the shared `.contract-detail__link` rule, add:

```css
.activity-home__updates-section--global-updates .contract-detail__link {
  color: var(--blue-500);
  color: color-mix(in srgb, var(--blue-600) 70%, var(--text-600));
}
```

Do not alter `.contract-detail__link`, its hover underline, or focus-visible styles. The first declaration is the fallback; the second is the theme-aware muted color.

- [ ] **Step 4: Run focused verification**

Run:

```bash
rtk npm run test --workspace frontend -- src/views/HomeUpdatesView.test.ts --run
rtk git diff --check
```

Expected: the focused test passes and `git diff --check` produces no output.

- [ ] **Step 5: Commit the implementation**

```bash
rtk git add frontend/src/styles.css frontend/src/views/HomeUpdatesView.test.ts
rtk git commit -m "style: soften global updates links"
```

Expected: a clean working tree with the Updates-only link preview committed on `main`.
