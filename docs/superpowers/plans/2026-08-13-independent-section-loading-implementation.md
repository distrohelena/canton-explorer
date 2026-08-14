# Independent Section Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure every multi-section Explorer page loads independent sections in parallel, with section-local spinners, one automatic retry, and isolated retryable errors.

**Architecture:** A small generic Vue composable owns one request lifecycle and protects state against stale completions. Existing component and view sections use one instance each; pages trigger independent instances without awaiting siblings. New Party and Namespace backend endpoints expose the independent portions of legacy aggregate responses while retaining those legacy responses for compatibility.

**Tech Stack:** Vue 3 Composition API, Vitest, NestJS, Jest, TypeScript.

## Global Constraints

- Render page shells, titles, section headings, and section containers before data resolves.
- Start every independent section request concurrently as soon as its route and inputs are known.
- Pending sections use the existing inline spinner inside their own section; do not introduce a global page overlay.
- Retry request failures exactly once automatically. The second failure displays a section-local error and a manual `Retry` control.
- Domain payload states such as `grpc_error`, `grpc_not_configured`, and `pqs_error` are successful responses rendered as data; they are not HTTP failures and must not trigger a retry.
- A failed, loading, or retried section must not clear, hide, or block sibling sections.
- A changed route parameter, filter, cursor, page size, template, or debugger selection supersedes older completions; stale results must be ignored.
- Preserve filter, pagination, route, layout, and API compatibility behavior.
- Retain `GET /parties/:partyId` and `GET /namespaces/:namespaceId`; do not remove their aggregate response contract.
- Do not add polling, a global cache, a generic backend aggregation endpoint, a dependency, or a global loading overlay.

---

### Task 1: Add the reusable section request lifecycle

**Files:**
- Create: `frontend/src/composables/useSectionLoad.ts`
- Create: `frontend/src/composables/useSectionLoad.test.ts`

**Interfaces:**
- Produces `useSectionLoad<T>(loader: () => Promise<T>)`.
- Returns `{ data: Ref<T | null>, loading: Ref<boolean>, retrying: Ref<boolean>, error: Ref<string | null>, load: () => Promise<void>, retry: () => Promise<void>, reset: () => void }`.
- `load()` and `retry()` perform at most two calls for their current generation; only the latest generation may mutate state.

- [ ] **Step 1: Write failing composable tests**

Create tests using deferred promises and a loader spy. Cover these exact cases:

```ts
it('starts one retry after a failed request before exposing a section error', async () => {
  const loader = vi.fn()
    .mockRejectedValueOnce(new Error('first failure'))
    .mockRejectedValueOnce(new Error('second failure'));
  const section = useSectionLoad(loader);

  await section.load();

  expect(loader).toHaveBeenCalledTimes(2);
  expect(section.error.value).toBe('second failure');
  expect(section.loading.value).toBe(false);
});

it('ignores a stale completion after a newer load starts', async () => {
  const first = deferred<string>();
  const second = deferred<string>();
  const loader = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const section = useSectionLoad(loader);

  void section.load();
  void section.load();
  second.resolve('new');
  await flushPromises();
  first.resolve('old');
  await flushPromises();

  expect(section.data.value).toBe('new');
});
```

Also assert that a manual `retry()` clears the prior error, receives its own one automatic retry, and that a successful retry clears `error`.

- [ ] **Step 2: Run the composable test to verify RED**

Run: `npm test --workspace frontend -- --run src/composables/useSectionLoad.test.ts`

Expected: FAIL because the composable module does not exist.

- [ ] **Step 3: Implement the lifecycle composable**

Implement generation protection and a two-attempt helper. The state transition must match this shape:

```ts
async function run(): Promise<void> {
  const generation = ++generationCounter;
  error.value = null;
  loading.value = true;
  retrying.value = false;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await loader();
      if (generation === generationCounter) {
        data.value = result;
        loading.value = false;
        retrying.value = false;
      }
      return;
    } catch (caught) {
      if (generation !== generationCounter) return;
      if (attempt === 0) {
        retrying.value = true;
        continue;
      }
      error.value = message(caught);
      loading.value = false;
      retrying.value = false;
    }
  }
}
```

Ensure success on either attempt ends `loading` and `retrying`, and `reset()` increments the generation before clearing all refs.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test --workspace frontend -- --run src/composables/useSectionLoad.test.ts`

Expected: PASS with the retry, reset, and stale-result cases green.

- [ ] **Step 5: Commit the shared primitive**

```bash
git add frontend/src/composables/useSectionLoad.ts frontend/src/composables/useSectionLoad.test.ts
git commit -m "feat: add section request lifecycle"
```

### Task 2: Publish Party and Namespace section endpoints

**Files:**
- Modify: `backend/src/api/nodes.controller.ts`
- Modify: `backend/test/api/nodes.controller.spec.ts`
- Modify: `backend/test/api/nodes.routes.spec.ts`
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`
- Modify: `backend/src/domain/node.types.ts`
- Modify: `frontend/src/types/parties.ts`
- Modify: `frontend/src/types/namespaces.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/api.test.ts`

**Interfaces:**
- Produces `GET /parties/:partyId/{summary,nodes,topology}` and `GET /namespaces/:namespaceId/{summary,nodes,topology,updates,contracts}`.
- Keeps `fetchPartyDetail()` and `fetchNamespaceDetail()` unchanged for compatibility.
- Adds typed frontend helpers `fetchPartySummary`, `fetchPartyNodes`, `fetchPartyTopology`, `fetchNamespaceSummary`, `fetchNamespaceNodes`, `fetchNamespaceTopology`, `fetchNamespaceUpdates`, and `fetchNamespaceContracts`.

- [ ] **Step 1: Write failing controller and API-client tests**

Add service tests that defer the topology read while resolving the Party or Namespace summary/nodes reads; assert the summary service method resolves without waiting for topology. Add controller tests that mock the new section service methods and assert exact arguments plus Not Found translation. Extend `nodes.routes.spec.ts` to prove each literal section route is registered before its aggregate `:partyId` or `:namespaceId` route:

```ts
await expect(controller.getPartySummary('Alice')).resolves.toEqual(partySummary);
expect(pqsSummaryService.fetchPartySummary).toHaveBeenCalledWith(expect.any(Array), 'Alice');
await expect(controller.getPartySummary('missing')).rejects.toThrow('Unknown party: missing');
```

Use the analogous namespace fields. Add frontend API tests that assert each helper requests `api/parties/<id>/<section>` or `api/namespaces/<id>/<section>`, preserving namespace update/contract pagination query parameters.

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npm test --workspace backend -- --runInBand test/api/nodes.controller.spec.ts
npm test --workspace backend -- --runInBand test/pqs/pqs-summary.service.spec.ts
npm test --workspace frontend -- --run src/lib/api.test.ts
```

Expected: FAIL because the controller methods and frontend helpers do not exist.

- [ ] **Step 3: Add response subset types and controller routes**

Define exported section response types from existing aggregate fields, for example:

```ts
export type PartySummaryResponse = Pick<PartyDetailResponse,
  'partyId' | 'nodeCount' | 'recentUpdateCount' | 'recentContractCount'>;
export type PartyNodesResponse = Pick<PartyDetailResponse, 'nodes'>;
export type PartyTopologyResponse = Pick<PartyDetailResponse, 'partyTopologyByNode'>;
```

Extract dedicated PqsSummaryService methods for Party summary/nodes discovery and topology, and Namespace summary/nodes discovery, topology, updates, and contracts. The summary and nodes methods must not call gRPC topology. The topology method may call the lightweight Party/Namespace discovery method to determine observed node IDs and local-party mappings, but must not fetch recent updates/contracts solely to populate another section. Namespace update/contract endpoints return the existing namespace-scoped recent lists with their pagination behavior. Keep `fetchPartyDetail()` and `fetchNamespaceDetail()` as compatibility wrappers that compose the new methods plus their existing recent updates/contracts fields.

Add controller routes before the aggregate `:partyId` and `:namespaceId` routes so literal section names are never captured as an identifier. Each controller method calls its matching dedicated section service method, preserving the existing `NotFoundException` translation.

Add API helpers:

```ts
export function fetchPartySummary(partyId: string): Promise<PartySummaryResponse> {
  return fetchJson(`/parties/${encodeURIComponent(partyId)}/summary`);
}
```

Follow the same encoding, query parameter, and type conventions for the other endpoints.

- [ ] **Step 4: Run targeted verification**

Run:

```bash
npm test --workspace backend -- --runInBand test/api/nodes.controller.spec.ts
npm test --workspace backend -- --runInBand test/pqs/pqs-summary.service.spec.ts
npm test --workspace frontend -- --run src/lib/api.test.ts
npm run build --workspace backend
```

Expected: PASS; aggregate routes and section routes both remain covered.

- [ ] **Step 5: Commit section endpoint support**

```bash
git add backend/src/api/nodes.controller.ts backend/src/pqs/pqs-summary.service.ts backend/src/domain/node.types.ts backend/test/api/nodes.controller.spec.ts backend/test/api/nodes.routes.spec.ts backend/test/pqs/pqs-summary.service.spec.ts frontend/src/types/parties.ts frontend/src/types/namespaces.ts frontend/src/lib/api.ts frontend/src/lib/api.test.ts
git commit -m "feat: expose party and namespace sections"
```

### Task 3: Migrate Party, Namespace, Node, Token, and Package detail sections

**Files:**
- Modify: `frontend/src/views/PartyDetailView.vue`
- Modify: `frontend/src/views/PartyDetailView.test.ts`
- Modify: `frontend/src/views/NamespaceDetailView.vue`
- Modify: `frontend/src/views/NamespaceDetailView.test.ts`
- Modify: `frontend/src/views/NodeDetailView.vue`
- Modify: `frontend/src/views/NodeDetailView.test.ts`
- Modify: `frontend/src/views/TokenDetailView.vue`
- Modify: `frontend/src/views/TokenDetailView.test.ts`
- Modify: `frontend/src/views/PackageDetailView.vue`
- Modify: `frontend/src/views/PackageDetailView.test.ts`

**Interfaces:**
- Consumes Task 1 section loaders and Task 2 section API helpers.
- Produces independently retryable detail sections; `UpdatesBrowser`, `ContractsBrowser`, and `TokenTransfersBrowser` remain their own mounted sections for now.

- [ ] **Step 1: Write failing view tests for independent rendering**

For Party Detail, mock summary success, nodes pending, and topology failure. Assert overview renders, Observed Nodes has only its own spinner, topology displays its error after two rejected calls and its `Retry` button does not refetch summary.

For Node Detail, defer package loading while resolving `fetchNode`; assert Service Health renders before packages and participant-status complete.

For Token Detail, reject holders twice while resolving token detail; assert the summary remains visible and only holders gets a local error/retry.

For Package Detail, prove a second failed section call turns an existing local error into success without replacing another section's data.

- [ ] **Step 2: Run detail tests to verify RED**

Run:

```bash
npm test --workspace frontend -- --run src/views/PartyDetailView.test.ts src/views/NamespaceDetailView.test.ts src/views/NodeDetailView.test.ts src/views/TokenDetailView.test.ts src/views/PackageDetailView.test.ts
```

Expected: FAIL because current detail views share aggregate/global loading and error state, or do not perform an automatic retry.

- [ ] **Step 3: Move each displayed data block to its own loader**

Apply these exact boundaries:

- Party: `fetchPartySummary`, `fetchPartyNodes`, `fetchPartyTopology`.
- Namespace: `fetchNamespaceSummary`, `fetchNamespaceNodes`, `fetchNamespaceTopology`, `fetchNamespaceParties`, `fetchNamespaceUpdates`, and `fetchNamespaceContracts`.
- Node: `fetchNode`, `fetchNodePackages`, `fetchNodeParticipantStatus`.
- Token: existing `fetchTokenDetail` and `fetchTokenHolders`.
- Package: existing five section helpers.

For each route-identity watch, invoke every relevant loader with `void section.load()` rather than awaiting one before starting another. Replace page-wide `v-if="error"` guards with per-section error blocks:

```vue
<div v-else-if="packages.error" class="node-detail__message node-detail__message--error" role="alert">
  <span>{{ packages.error }}</span>
  <button type="button" class="button button--secondary" @click="packages.retry">Retry</button>
</div>
```

Keep `grpc_error` payload rendering unchanged. For route parameter changes call `reset()` before each fresh `load()`.

- [ ] **Step 4: Run detail tests to verify GREEN**

Run the Task 3 command again.

Expected: PASS; each representative route proves sibling isolation, auto retry, manual retry, and stale-route protection.

- [ ] **Step 5: Commit detail-page migration**

```bash
git add frontend/src/views/PartyDetailView.vue frontend/src/views/PartyDetailView.test.ts frontend/src/views/NamespaceDetailView.vue frontend/src/views/NamespaceDetailView.test.ts frontend/src/views/NodeDetailView.vue frontend/src/views/NodeDetailView.test.ts frontend/src/views/TokenDetailView.vue frontend/src/views/TokenDetailView.test.ts frontend/src/views/PackageDetailView.vue frontend/src/views/PackageDetailView.test.ts
git commit -m "feat: load detail sections independently"
```

### Task 4: Apply the section lifecycle to reusable data browsers and Home

**Files:**
- Modify: `frontend/src/components/UpdatesBrowser.vue`
- Create: `frontend/src/components/UpdatesBrowser.test.ts`
- Modify: `frontend/src/components/ContractsBrowser.vue`
- Create: `frontend/src/components/ContractsBrowser.test.ts`
- Modify: `frontend/src/components/TokenTransfersBrowser.vue`
- Create: `frontend/src/components/TokenTransfersBrowser.test.ts`
- Modify: `frontend/src/components/HomeDashboardOverview.vue`
- Modify: `frontend/src/components/HomeDashboardOverview.test.ts`
- Modify: `frontend/src/views/HomeView.test.ts`

**Interfaces:**
- Consumes `useSectionLoad` for list request lifecycle only; existing filter/query construction stays in each browser.
- Produces section-local automatic/manual retry behavior for Home overview, global updates, global contracts where mounted, and token transfers.

- [ ] **Step 1: Write failing browser and Home tests**

Add one test to each browser that rejects the current list request twice and asserts two calls, an inline section error, and a Retry click that only reloads that browser.

In `HomeDashboardOverview.test.ts`, defer activity and resolve market/recent parties. Assert the market and party cards render while only activity remains loading. Add a rejected activity test proving a retry does not refetch market or recent parties.

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npm test --workspace frontend -- --run src/components/UpdatesBrowser.test.ts src/components/ContractsBrowser.test.ts src/components/TokenTransfersBrowser.test.ts src/components/HomeDashboardOverview.test.ts src/views/HomeView.test.ts
```

Expected: FAIL because current browser and dashboard request failures expose no one-time auto retry and/or no local Retry control.

- [ ] **Step 3: Replace local request flags with section loaders**

Keep browser-specific pagination/filter refs, but make the final API call the loader for one `useSectionLoad` instance. When filters/cursors change, set their current query inputs, call `reset()`, then `void load()`.

In `HomeDashboardOverview`, create three loaders for activity, market, and recent parties. In `onMounted`, call all three without awaiting. In range selection, reload only activity and recent parties; market stays independent. Leave `UpdatesBrowser` and `TokenTransfersBrowser` as separately mounted Home sections.

- [ ] **Step 4: Run focused browser and Home tests**

Run the Task 4 command again.

Expected: PASS with list filtering/pagination behavior intact and section-local failure recovery covered.

- [ ] **Step 5: Commit browser and Home migration**

```bash
git add frontend/src/components/UpdatesBrowser.vue frontend/src/components/UpdatesBrowser.test.ts frontend/src/components/ContractsBrowser.vue frontend/src/components/ContractsBrowser.test.ts frontend/src/components/TokenTransfersBrowser.vue frontend/src/components/TokenTransfersBrowser.test.ts frontend/src/components/HomeDashboardOverview.vue frontend/src/components/HomeDashboardOverview.test.ts frontend/src/views/HomeView.test.ts
git commit -m "feat: isolate browser and dashboard loading"
```

### Task 5: Migrate Settings, Parties, Contracts, Tokens, and Traffic pages

**Files:**
- Modify: `frontend/src/views/SettingsView.vue`
- Modify: `frontend/src/views/SettingsView.test.ts`
- Modify: `frontend/src/views/PartiesView.vue`
- Modify: `frontend/src/views/PartiesView.test.ts`
- Modify: `frontend/src/views/ContractsView.vue`
- Modify: `frontend/src/views/ContractsView.test.ts`
- Modify: `frontend/src/views/TokensView.vue`
- Modify: `frontend/src/views/TokensView.test.ts`
- Modify: `frontend/src/views/TrafficPurchasesView.vue`
- Modify: `frontend/src/views/TrafficPurchasesView.test.ts`

**Interfaces:**
- Settings starts node status loading first, then creates one traffic loader per resolved node ID.
- Parties starts its node discovery once, then owns one independently retryable request per selected node; there is no aggregate parties request to split.
- Contracts keeps node discovery as the browser-filter prerequisite, while Tokens owns two independent sections (token list and `TokenTransfersBrowser`). Traffic begins its all-nodes query in parallel with node discovery, because no `nodeIds` filter already means all nodes.

- [ ] **Step 1: Write failing page-local isolation tests**

For Settings, resolve `fetchNodes` with two nodes, resolve traffic for one node and reject the other twice. Assert the first node’s traffic remains rendered, the second card alone errors with Retry, and retrying it does not refetch nodes or the first node’s traffic.

For Parties, resolve node discovery with two nodes, resolve one selected node’s parties and reject the other twice. Assert the successful node-derived results remain visible, the failed node gets a local Retry, and retrying it does not refetch node discovery or the successful node.

For Traffic, defer node discovery while resolving the initial all-nodes request. Assert Purchases renders with its own result while only the node-filter control remains loading. For Tokens, reject the token-list request twice while the separately mounted `TokenTransfersBrowser` succeeds; assert the transfer section remains visible. For Contracts, reject node discovery twice and assert its inline prerequisite error/retry is local to the Contracts filter setup (the browser itself must not receive a synthetic retry or an artificial duplicate request).

- [ ] **Step 2: Run page tests to verify RED**

Run:

```bash
npm test --workspace frontend -- --run src/views/SettingsView.test.ts src/views/PartiesView.test.ts src/views/ContractsView.test.ts src/views/TokensView.test.ts src/views/TrafficPurchasesView.test.ts
```

Expected: FAIL because page-level loaders currently block the full page or coalesce independent failures.

- [ ] **Step 3: Separate selector/status and data-browser loading**

Settings creates a record of section loaders keyed by node ID after node status resolves; do not use `Promise.all` to make one failed traffic response fail the node snapshot section. Parties does the same per selected node after discovery. For Traffic, start its unfiltered all-nodes loader and node discovery together; once nodes resolve, populate the default selection without blocking an already-resolved result. Tokens uses one loader for its paginated list while the migrated transfer browser owns the other. Contracts uses one loader for its required node metadata.

Keep each existing page’s current query strings, pagination reset behavior, and result shape. Add section-local inline spinner/error/retry markup where a standalone section lacks it.

- [ ] **Step 4: Run focused page verification**

Run the Task 5 command again.

Expected: PASS; each page preserves existing lists while selector/status/traffic failures are isolated.

- [ ] **Step 5: Commit list and settings migration**

```bash
git add frontend/src/views/SettingsView.vue frontend/src/views/SettingsView.test.ts frontend/src/views/PartiesView.vue frontend/src/views/PartiesView.test.ts frontend/src/views/ContractsView.vue frontend/src/views/ContractsView.test.ts frontend/src/views/TokensView.vue frontend/src/views/TokensView.test.ts frontend/src/views/TrafficPurchasesView.vue frontend/src/views/TrafficPurchasesView.test.ts
git commit -m "feat: isolate settings and list page loading"
```

### Task 6: Migrate Debugger dependent panels without breaking prerequisites

**Files:**
- Modify: `frontend/src/views/DebuggerView.vue`
- Modify: `frontend/src/views/DebuggerView.test.ts`
- Modify: `frontend/src/components/DebuggerTemplatePicker.vue`
- Create: `frontend/src/components/DebuggerTemplatePicker.test.ts`
- Modify: `frontend/src/components/DebuggerEventList.vue`
- Modify: `frontend/src/components/DebuggerEventList.test.ts`

**Interfaces:**
- Independent: session list, template catalog, and route-selected session start concurrently.
- Dependent: event list requires a session ID; active contracts require selected node plus simulation kind; constructor schema requires selected template.

- [ ] **Step 1: Write failing Debugger panel tests**

Add a test with a pending template catalog and resolved session list/session. Assert sessions render and are usable while the template-picker section alone spins. Add a test that template catalog rejects twice, displays its local Retry, and does not clear the loaded session/list.

Add a stale-selection test: select template A, leave its schema promise pending, then select template B and resolve B before A; assert only B’s constructor schema is rendered.

- [ ] **Step 2: Run Debugger tests to verify RED**

Run:

```bash
npm test --workspace frontend -- --run src/views/DebuggerView.test.ts src/components/DebuggerTemplatePicker.test.ts src/components/DebuggerEventList.test.ts
```

Expected: FAIL because the affected panels share page/global lifecycle state or accept stale responses.

- [ ] **Step 3: Apply the common lifecycle at each valid dependency boundary**

Create distinct loaders for debugger sessions, current route session, template catalog, active contracts, constructor schema, and events. Trigger the first three concurrently in `onMounted`/route watch. Before loading a dependent panel, call its `reset()` when its prerequisite selection changes; do not start it when its prerequisite is absent.

Bind the loader error/retry state to the owning panel (session sidebar, template picker, contract picker, constructor panel, event list). Keep action submission state (`actionLoading`, simulation creation, step selection) distinct; it is not passive section loading.

- [ ] **Step 4: Run Debugger tests to verify GREEN**

Run the Task 6 command again.

Expected: PASS with concurrent independent panels and correct dependency/staleness behavior.

- [ ] **Step 5: Commit Debugger migration**

```bash
git add frontend/src/views/DebuggerView.vue frontend/src/views/DebuggerView.test.ts frontend/src/components/DebuggerTemplatePicker.vue frontend/src/components/DebuggerTemplatePicker.test.ts frontend/src/components/DebuggerEventList.vue frontend/src/components/DebuggerEventList.test.ts
git commit -m "feat: isolate debugger panel loading"
```

## Completion Verification

After the task commits, run the complete regression and build suite from the repository root:

```bash
npm test --workspace backend
npm test --workspace frontend
npm run build --workspace backend
npm run build --workspace frontend
git diff --check
```

The expected result is that all test suites and both builds pass. If `git diff --check` reports an unrelated pre-existing user change, run it again against only files changed by this plan and report the unrelated finding separately.

## Plan Self-Review

- Task 1 defines and proves the shared retry/stale-result contract every later task consumes.
- Task 2 supplies the only new backend endpoints and preserves old aggregate response compatibility.
- Tasks 3–6 migrate every independently sourced multi-section pattern: detail pages, reusable browsers/Home, list/settings, and Debugger dependencies.
- `HomeActivityView`, `HomeUpdatesView`, Operations Dashboard, Canton Coin, Search, and individual record views are not omitted compound loads: each owns one backend data section, and `HomeUpdatesView` receives the migrated `UpdatesBrowser` behavior through Task 4.
- Every section has explicit spinner, auto-retry, local-error, manual-retry, and stale-result requirements; no global error/loader is introduced.
