# Legacy Transaction URL Redirect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve legacy `/tx/:updateId` URLs through the existing update search API and forward the browser to the first matching node-scoped update detail page.

**Architecture:** Add a focused `LegacyTransactionRedirectView` that reads the route update ID, searches for matching updates, and replaces the legacy route with `/nodes/:nodeId/updates/:eventOffset`. Register the view in the frontend router; on lookup failure or an empty result, replace the route with the encoded search page query so the user can continue from visible results.

**Tech Stack:** Vue 3, Vue Router, TypeScript, Vitest, Testing Library Vue.

---

### Task 1: Add failing redirect-view tests

**Files:**
- Create: `frontend/src/views/LegacyTransactionRedirectView.test.ts`
- Reference: `frontend/src/router.ts` (exported application router)
- Reference: `frontend/src/lib/api.ts` (`fetchSearchResults`)
- Reference: `frontend/src/types/search.ts` (`SearchResultsResponse`)

- [ ] **Step 1: Write the failing tests**

Create a memory-router harness with `/tx/:updateId`, the node update destination, and the search fallback destination. Mock only `fetchSearchResults` and render the redirect view with the router plugin. Also assert that the exported application router resolves `/tx/example` to the redirect view, covering actual route registration. Add tests that:

1. Search with the route update ID and replace the URL with the first returned update's `/nodes/:nodeId/updates/:eventOffset` destination, even when a second match is present.
2. Replace an empty result with `/search?q=<updateId>`.
3. Replace a rejected search request with `/search?q=<updateId>`.
4. Render the resolving state while the search promise is pending.

Assert both the API call and `router.currentRoute.value.fullPath`; use `waitFor` or an equivalent async assertion so the test waits for the redirect.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npm run test --workspace frontend -- --run src/views/LegacyTransactionRedirectView.test.ts`

Expected: FAIL because `LegacyTransactionRedirectView.vue` does not exist yet.

### Task 2: Implement the redirect view and route

**Files:**
- Create: `frontend/src/views/LegacyTransactionRedirectView.vue`
- Modify: `frontend/src/router.ts`

- [ ] **Step 1: Implement the minimal redirect view**

Use `useRoute` and `useRouter`. Read the `updateId` route param as a string, call `fetchSearchResults(updateId)`, select `results.updates.items[0]`, and call `router.replace` with the node-scoped update detail path. If there is no first item or the request throws, call `router.replace` with `{ path: '/search', query: { q: updateId } }`. Render a concise resolving message while the asynchronous lookup is pending. Keep the implementation scoped to this compatibility behavior.

- [ ] **Step 2: Register the route**

Import the new view in `frontend/src/router.ts` and add `{ path: '/tx/:updateId', component: LegacyTransactionRedirectView, props: true }` alongside the other top-level routes.

- [ ] **Step 3: Run the focused tests to verify they pass**

Run: `npm run test --workspace frontend -- --run src/views/LegacyTransactionRedirectView.test.ts`

Expected: PASS for the first-match redirect and both search fallbacks.

### Task 3: Verify frontend routing and build

**Files:**
- Modify: none unless verification reveals a route/test integration issue.

- [ ] **Step 1: Run all frontend tests**

Run: `npm run test --workspace frontend -- --run`

Expected: PASS with no new failures.

- [ ] **Step 2: Run the frontend typecheck and production build**

Run: `npm run build --workspace frontend`

Expected: Vue typecheck and Vite build complete successfully.

- [ ] **Step 3: Review the diff and commit**

Run: `git diff --check && git diff -- frontend/src/router.ts frontend/src/views/LegacyTransactionRedirectView.vue frontend/src/views/LegacyTransactionRedirectView.test.ts`

Expected: No whitespace errors and only the scoped redirect view, route, and tests changed.

Commit with: `git add frontend/src/router.ts frontend/src/views/LegacyTransactionRedirectView.vue frontend/src/views/LegacyTransactionRedirectView.test.ts && git commit -m "feat: redirect legacy transaction URLs"`
