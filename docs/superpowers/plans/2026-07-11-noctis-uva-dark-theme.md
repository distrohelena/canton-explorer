# Noctis Uva Dark Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retheme Canton Explorer dark mode, including Monaco and debugger surfaces, to a restrained Noctis Uva-inspired visual system.

**Architecture:** Keep the existing application structure and route layout intact. Implement the redesign primarily through shared CSS tokens and common surface rules, then wire Monaco dark mode to a matching custom theme so the debugger inherits the same visual language.

**Tech Stack:** Vue 3, Vite, shared CSS in `frontend/src/styles.css`, Monaco Editor, Vitest, Testing Library

---

### Task 1: Document And Stabilize Theme Inputs

**Files:**
- Modify: `frontend/src/styles.css`
- Test: `frontend/src/App.test.ts`

- [ ] **Step 1: Identify missing shared theme tokens**

Check references in `frontend/src/styles.css` for variables such as `--blue-500`, `--surface-0`, `--accent-600`, and `--text-600` that currently lack root definitions.

- [ ] **Step 2: Add a complete token set for light and dark themes**

Define all shared color tokens in `:root` and `:root[data-theme='dark']` so the theme is internally consistent.

- [ ] **Step 3: Keep theme switching behavior intact**

Run: `npm test -- --run src/App.test.ts`
Expected: PASS

### Task 2: Retheme Shared Explorer Surfaces

**Files:**
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Retune shell and navigation surfaces**

Update header, footer, frame, nav button, search input, and theme toggle styling to the Noctis Uva palette.

- [ ] **Step 2: Retune shared cards and data surfaces**

Update shared panel, selector, advanced filter, combobox, and list-row surfaces so dark mode reads flatter and calmer.

- [ ] **Step 3: Retune debugger chrome**

Update debugger background, side panels, divider, scope cards, and event states so Monaco becomes the primary visual anchor.

### Task 3: Add Matching Monaco Dark Theme

**Files:**
- Modify: `frontend/src/lib/monaco.ts`
- Modify: `frontend/src/components/MonacoCodeSurface.vue`
- Test: `frontend/src/components/MonacoCodeSurface.test.ts`

- [ ] **Step 1: Write the failing Monaco theme expectation**

Add a test that verifies the dark-mode code surface selects a custom Explorer Monaco theme instead of Monaco’s stock `vs-dark`.

- [ ] **Step 2: Register the custom Monaco theme**

Define a Noctis Uva-inspired editor theme in `frontend/src/lib/monaco.ts` after Monaco loads.

- [ ] **Step 3: Switch editor theme resolution**

Update `frontend/src/components/MonacoCodeSurface.vue` so dark mode uses the new custom theme while light mode stays on `vs`.

- [ ] **Step 4: Run focused Monaco tests**

Run: `npm test -- --run src/components/MonacoCodeSurface.test.ts`
Expected: PASS

### Task 4: Verify Debugger And Build Output

**Files:**
- Modify: `frontend/src/views/DebuggerView.test.ts`

- [ ] **Step 1: Add or preserve debugger shell coverage**

Keep debugger tests green while the shared theme changes land.

- [ ] **Step 2: Run focused debugger coverage**

Run: `npm test -- --run src/views/DebuggerView.test.ts`
Expected: PASS

- [ ] **Step 3: Run frontend production build**

Run: `npm run build`
Expected: PASS with only existing non-fatal bundle-size warnings, if any
