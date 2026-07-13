# Frontend Package Version Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display the published Canton Explorer package version in the existing frontend footer.

**Architecture:** Vite reads `backend/package.json` at configuration time, resolving the path relative to `frontend/vite.config.ts` rather than the process working directory, and injects the version as a compile-time global constant. `App.vue` renders that constant beside the existing SDK attribution, keeping the backend npm package as the only version source and avoiding a runtime API request.

**Tech Stack:** Vue 3, TypeScript, Vite/Vitest, Testing Library for Vue, Node filesystem APIs in Vite config.

---

### Task 1: Add the package version build constant

**Files:**
- Modify: `frontend/vite.config.ts`
- Create: `frontend/src/env.d.ts`
- Modify: `frontend/vite.config.test.ts`

- [ ] **Step 1: Define the expected build contract in the type declarations**

Declare `__CANTON_EXPLORER_VERSION__` as a string global so Vue and TypeScript can consume the Vite-injected value without an untyped global. Keep the declaration under `frontend/src`, which is already included by `frontend/tsconfig.app.json`.

- [ ] **Step 2: Read the backend package metadata in Vite config**

Use `fileURLToPath(import.meta.url)` plus Node filesystem/path utilities from `frontend/vite.config.ts` to resolve the repository-relative `../backend/package.json`, parse its `version`, and add:

```ts
define: {
  __CANTON_EXPLORER_VERSION__: JSON.stringify(packageMetadata.version),
}
```

Keep the existing Vue plugin, dev server, preview, and Vitest configuration unchanged.

- [ ] **Step 3: Add a Vite config regression test**

Extend `frontend/vite.config.test.ts` and assert that the exported Vite config defines `__CANTON_EXPLORER_VERSION__` as the JSON-encoded `version` from `backend/package.json`. Preserve the existing host-allowlist assertion. This protects both the source-of-truth path and the injected constant contract.

- [ ] **Step 4: Verify the config compiles**

Run: `npm run build --workspace frontend`

Expected: Vue type-checking and Vite production build complete successfully.

### Task 2: Render the version in the shared footer

**Files:**
- Modify: `frontend/src/App.vue`
- Test: `frontend/src/App.test.ts`

- [ ] **Step 1: Add the failing App shell assertion**

In the existing home-route footer test, assert that the footer contains `version 0.1.7`, matching the current `backend/package.json` version and proving the injected value is rendered.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm run test --workspace frontend -- App.test.ts --run`

Expected: the existing footer renders, but the new version assertion fails because `App.vue` does not yet display the version.

- [ ] **Step 3: Render the injected version**

Expose the global constant from `<script setup>` and add a compact `version {{ explorerVersion }}` element beside the existing SDK attribution in the non-debugger footer. Preserve the debugger route’s footer omission.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm run test --workspace frontend -- App.test.ts --run`

Expected: all `App.vue` tests pass, including the version assertion.

### Task 3: Verify packaged frontend behavior

**Files:**
- Verify: `backend/scripts/prepack.mjs`
- Verify: generated `backend/dist/public/index.html` and assets

- [ ] **Step 1: Run the complete frontend test suite**

Run: `npm test --workspace frontend -- --run`

Expected: all frontend tests pass.

- [ ] **Step 2: Run the packaged frontend build**

Run: `npm run build:packaged --workspace frontend`

Expected: the packaged Vite build succeeds with the version compiled into the generated assets.

- [ ] **Step 3: Run the npm-package prepack flow**

Run: `npm run pack:dry-run`

Expected: npm invokes the package `prepack` lifecycle, the packaged frontend build completes, and `backend/scripts/copy-frontend-dist.mjs` copies it into `backend/dist/public`.

- [ ] **Step 4: Assert the packaged assets contain the package version**

Run:

```bash
version=$(node -p "require('./backend/package.json').version")
rg -F "$version" backend/dist/public
```

Expected: `rg` finds the current backend package version in the generated frontend assets.

- [ ] **Step 5: Review the final diff**

Run: `git diff --check` and inspect the changed files. Confirm no duplicate frontend version source or runtime API request was introduced.

- [ ] **Step 6: Commit the implementation**

```bash
git add frontend/vite.config.ts frontend/src/env.d.ts frontend/src/App.vue frontend/src/App.test.ts frontend/vite.config.test.ts
git commit -m "feat: show explorer package version in frontend"
```
