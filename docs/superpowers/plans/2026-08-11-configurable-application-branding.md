# Configurable Application Branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load independent browser-tab and header titles from the runtime node JSON configuration.

**Architecture:** Extend the existing parsed node configuration with a validated optional `branding` object. Expose only the sanitized branding values through `GET /api/branding`; the Vue application fetches those values during startup, updates `document.title` from `applicationTitle`, and renders `headerTitle` in the shared header. Missing configuration, whitespace-only values, or a failed branding request use the independent `Canton Explorer` defaults.

**Tech Stack:** NestJS, Zod, Jest, Vue 3, TypeScript, Vitest, Vite.

---

## File map

- Modify `backend/src/config/node-config.schema.ts`: define branding defaults/schema/types and include them in the validated config file.
- Modify `backend/src/config/node-config.service.ts`: expose sanitized branding to API consumers.
- Modify `backend/src/api/nodes.controller.ts`: add the public `GET /api/branding` response.
- Modify `backend/test/config/node-config.spec.ts`: cover branding defaults, partial values, and validation.
- Modify `backend/test/api/nodes.controller.spec.ts`: cover the branding endpoint and response isolation.
- Modify `backend/config/nodes.example.json`: document the optional JSON shape.
- Modify `backend/README.md`: explain the branding keys and their separate targets.
- Create `frontend/src/types/branding.ts`: define the API response type.
- Modify `frontend/src/lib/api.ts`: add `fetchBranding()` using the existing API client.
- Modify `frontend/src/lib/api.test.ts`: verify the branding request path and response handling.
- Modify `frontend/src/App.vue`: load branding at startup, update the browser title, and render the configured header title.
- Modify `frontend/src/App.test.ts`: mock the branding request and verify custom and fallback titles.
- Leave `frontend/index.html` with the static `Canton Explorer` title as the no-JavaScript/initial-load fallback.

### Task 1: Add validated branding to runtime configuration

**Files:**
- Modify: `backend/src/config/node-config.schema.ts`
- Modify: `backend/src/config/node-config.service.ts`
- Test: `backend/test/config/node-config.spec.ts`
- Create: `backend/test/config/node-config.service.spec.ts`
- Modify: `backend/config/nodes.example.json`
- Modify: `backend/README.md`

- [ ] **Step 1: Write failing schema tests.**

Add a local `createValidNodeConfig()` helper in `backend/test/config/node-config.spec.ts` that returns the minimal valid `pqs_only` participant object used by the branding cases. Add tests that assert:

```ts
expect(parseNodeConfigFile({ nodes: [createValidNodeConfig()] }).branding).toEqual({
  applicationTitle: 'Canton Explorer',
  headerTitle: 'Canton Explorer',
});

expect(parseNodeConfigFile({
  branding: { applicationTitle: 'Ledger', headerTitle: 'Ledger UI' },
  nodes: [createValidNodeConfig()],
}).branding).toEqual({
  applicationTitle: 'Ledger',
  headerTitle: 'Ledger UI',
});

expect(parseNodeConfigFile({
  branding: { applicationTitle: 'Ledger' },
  nodes: [createValidNodeConfig()],
}).branding).toEqual({
  applicationTitle: 'Ledger',
  headerTitle: 'Canton Explorer',
});

expect(() => parseNodeConfigFile({
  branding: { applicationTitle: '   ' },
  nodes: [createValidNodeConfig()],
})).toThrow();
```

Also assert that surrounding whitespace is trimmed from accepted title values.

- [ ] **Step 2: Run the focused backend test and verify it fails.**

Run:

```bash
rtk npm run test --workspace backend -- --runInBand backend/test/config/node-config.spec.ts
```

Expected: the new branding assertions fail because the schema has no branding field/defaults yet.

- [ ] **Step 3: Add the service parsing regression test.**

Create `backend/test/config/node-config.service.spec.ts`. For each test, create a temporary JSON config file containing a minimal node and custom branding, set `NODE_CONFIG_PATH` to that file, instantiate `NodeConfigService`, and restore the environment/remove the temporary file in `finally`. Assert `getBranding()` returns the parsed custom values and does not expose `nodes`, `debugger`, or `tokenMetadata`.

- [ ] **Step 4: Implement the schema and service accessor.**

In `node-config.schema.ts`, add:

```ts
export const DEFAULT_BRANDING_CONFIG = {
  applicationTitle: 'Canton Explorer',
  headerTitle: 'Canton Explorer',
} as const;

const brandingSchema = z.object({
  applicationTitle: z.string().trim().min(1).default(DEFAULT_BRANDING_CONFIG.applicationTitle),
  headerTitle: z.string().trim().min(1).default(DEFAULT_BRANDING_CONFIG.headerTitle),
}).strict().default(DEFAULT_BRANDING_CONFIG);
```

Add `branding: brandingSchema` to the top-level config schema, export `BrandingConfig`, and make `NodeConfigService.getBranding()` return `this.config.branding`. Keep the accessor read-only and return only the two branding fields.

- [ ] **Step 5: Update the example and operator documentation.**

Add an optional top-level `branding` block to `backend/config/nodes.example.json`, and document that `applicationTitle` controls the browser tab while `headerTitle` controls the visible application header. Explain that both default independently to `Canton Explorer` and require a restart after changing the JSON.

- [ ] **Step 6: Run the schema and service tests and commit.**

Run:

```bash
rtk npm run test --workspace backend -- --runInBand backend/test/config/node-config.spec.ts
rtk npm run test --workspace backend -- --runInBand backend/test/config/node-config.service.spec.ts
```

Expected: both focused config test files pass.

Commit:

```bash
rtk git add backend/src/config/node-config.schema.ts backend/src/config/node-config.service.ts backend/test/config/node-config.spec.ts backend/config/nodes.example.json backend/README.md
rtk git commit -m "feat: add configurable branding settings"
```

### Task 2: Expose a sanitized branding endpoint

**Files:**
- Modify: `backend/src/api/nodes.controller.ts`
- Test: `backend/test/api/nodes.controller.spec.ts`

- [ ] **Step 1: Add the failing controller test.**

Extend the controller test’s `NodeConfigService` mock with a `getBranding` spy returning custom values, then add a test for `controller.getBranding()` that expects exactly:

```ts
{
  applicationTitle: 'Configured App',
  headerTitle: 'Configured Header',
}
```

Also assert the method calls `getBranding()` once and does not return any node, debugger, token, or connection configuration. The service parsing behavior is covered separately by `node-config.service.spec.ts`.

- [ ] **Step 2: Run the focused controller test and verify it fails.**

Run:

```bash
rtk npm run test --workspace backend -- --runInBand backend/test/api/nodes.controller.spec.ts
```

Expected: the new test fails because `NodesController.getBranding()` does not exist.

- [ ] **Step 3: Add the endpoint.**

Add a `@Get('/branding')` method to `NodesController`:

```ts
@Get('/branding')
getBranding() {
  return this.configService.getBranding();
}
```

Keep it under the existing `/api` controller prefix and return the service value directly because the service already returns the validated two-field shape.

- [ ] **Step 4: Run the controller test and commit.**

Run:

```bash
rtk npm run test --workspace backend -- --runInBand backend/test/api/nodes.controller.spec.ts
```

Expected: the controller suite passes.

Commit:

```bash
rtk git add backend/src/api/nodes.controller.ts backend/test/api/nodes.controller.spec.ts
rtk git commit -m "feat: expose branding configuration endpoint"
```

### Task 3: Add the frontend branding API client

**Files:**
- Create: `frontend/src/types/branding.ts`
- Modify: `frontend/src/lib/api.ts`
- Test: `frontend/src/lib/api.test.ts`

- [ ] **Step 1: Add the failing API test.**

Import `fetchBranding` in `frontend/src/lib/api.test.ts`, use the existing mocked `fetch` helper, and add a test that resolves `GET /branding` to `{ applicationTitle: 'Configured App', headerTitle: 'Configured Header' }`. Assert the returned value and the requested URL uses the configured API base plus `/branding`.

- [ ] **Step 2: Run the focused API test and verify it fails.**

Run:

```bash
rtk npm run test --workspace frontend -- src/lib/api.test.ts --run
```

Expected: the test fails because `fetchBranding()` and its response type do not exist.

- [ ] **Step 3: Implement the typed API function.**

Create `frontend/src/types/branding.ts`:

```ts
export interface BrandingConfig {
  applicationTitle: string;
  headerTitle: string;
}
```

Import that type in `frontend/src/lib/api.ts` and add:

```ts
export function fetchBranding(): Promise<BrandingConfig> {
  return fetchJson<BrandingConfig>('/branding');
}
```

- [ ] **Step 4: Run the API tests and commit.**

Run:

```bash
rtk npm run test --workspace frontend -- src/lib/api.test.ts --run
```

Expected: the API test file passes.

Commit:

```bash
rtk git add frontend/src/types/branding.ts frontend/src/lib/api.ts frontend/src/lib/api.test.ts
rtk git commit -m "feat: add frontend branding client"
```

### Task 4: Apply branding to the application shell

**Files:**
- Modify: `frontend/src/App.vue`
- Test: `frontend/src/App.test.ts`

- [ ] **Step 1: Add failing App tests and a default API mock.**

Mock `./lib/api` in `App.test.ts` with `fetchBranding`. Keep the default mock response as the two `Canton Explorer` values so existing navigation tests remain deterministic. Add a default test that asserts the existing header and browser title remain `Canton Explorer`. Add a custom test that changes the mock to `{ applicationTitle: 'Configured App', headerTitle: 'Configured Header' }`, renders the app, waits for the branding request, and asserts:

```ts
expect(screen.getByRole('heading', { name: 'Configured Header' })).toBeInTheDocument();
expect(document.title).toBe('Configured App');
```

Add an explicit rejected-request test that makes `fetchBranding()` reject and asserts the header and browser title retain their independent `Canton Explorer` defaults. The custom test must use different application/header strings to prove the targets are not coupled.

- [ ] **Step 2: Run the focused App test and verify the new assertions fail.**

Run:

```bash
rtk npm run test --workspace frontend -- src/App.test.ts --run
```

Expected: the existing hard-coded header remains “Canton Explorer” and `document.title` is not updated from the mocked response.

- [ ] **Step 3: Load and apply the branding in `App.vue`.**

Import `fetchBranding` and the `BrandingConfig` type. Define the independent default object, store it in a `ref`, and add an async startup loader that catches request errors and retains the defaults. Use a watcher with `immediate: true` (or equivalent setup logic) to set `document.title` to `branding.applicationTitle`, and start the request from `onMounted`.

Replace the hard-coded header text in the existing `.app-brand__title` element with `branding.headerTitle`. Do not alter navigation labels, route titles, or the static `frontend/index.html` fallback.

- [ ] **Step 4: Run the focused App tests and commit.**

Run:

```bash
rtk npm run test --workspace frontend -- src/App.test.ts --run
```

Expected: all App tests pass, including custom header/browser titles and fallback behavior.

Commit:

```bash
rtk git add frontend/src/App.vue frontend/src/App.test.ts
rtk git commit -m "feat: apply configured application branding"
```

### Task 5: Verify the integrated feature

**Files:**
- No source changes expected; inspect all commits and the final worktree.

- [ ] **Step 1: Run the complete test suites.**

Run:

```bash
rtk npm test
```

Expected: all backend and frontend tests pass. Existing environment warnings, including unavailable optional gRPC refresh targets, may remain non-fatal.

- [ ] **Step 2: Run the frontend type-check and production build.**

Run:

```bash
rtk npm run build --workspace frontend
```

Expected: `vue-tsc -b` and the Vite production build complete successfully.

- [ ] **Step 3: Check the diff and final branch state.**

Run:

```bash
rtk git diff --check
rtk git status --short --branch
```

Expected: no whitespace errors, no uncommitted changes, and all implementation commits are on `main`.
