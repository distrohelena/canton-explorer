# Party Section Node Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable independent, URL-backed node filters for the Updates and Contracts sections of a Party page.

**Architecture:** Extend the existing `UpdatesBrowser` and `ContractsBrowser` node-filter flow to support `party` scope, using observed Party nodes as the available options. Propagate the selected IDs as repeated `node` query parameters through frontend API helpers, Party controllers, and PQS fan-out so unselected nodes are never queried.

**Tech Stack:** Vue 3, Vue Router, TypeScript, Vitest, NestJS, Jest, PQS HTTP API.

## Global Constraints

- Keep Updates and Contracts filters independent with the existing Party query prefixes: `updatesNode` and `contractsNode`.
- No node query parameter means all configured nodes; an explicit empty parameter means no selected nodes and returns an empty result without PQS calls.
- Preserve the Party page's independently loading sections and local automatic retry behavior.
- Do not add a global Updates node filter in this work.
- Do not stage or modify the pre-existing `backend/package.json` working-tree edit.

---

## File Structure

- `backend/src/api/nodes.controller.ts` — parse repeated Party `node` query values and forward `nodeIds`.
- `backend/src/pqs/pqs-summary.service.ts` — restrict Party update/contract merge fan-out to selected configured nodes.
- `backend/test/api/nodes.controller.spec.ts` — verify controller serialization of Party node selections.
- `backend/test/pqs/pqs-summary.service.spec.ts` — verify selected-node-only and explicit-empty fan-out behavior.
- `frontend/src/lib/api.ts` — serialize Party node selections as repeated `node` query parameters.
- `frontend/src/lib/api.test.ts` — verify Party helper URLs include repeated node keys.
- `frontend/src/components/UpdatesBrowser.vue` — add Party-scope node filter state, query persistence, and API propagation.
- `frontend/src/components/ContractsBrowser.vue` — generalize the existing global-only node filter to Party scope.
- `frontend/src/components/{UpdatesBrowser,ContractsBrowser}.test.ts` — verify Party-scope filter query/API behavior.
- `frontend/src/views/PartyDetailView.vue` — pass observed nodes into both section browsers.
- `frontend/src/views/PartyDetailView.test.ts` — verify both Party sections render and use isolated node filters.

### Task 1: Restrict Party backend fan-out to selected nodes

**Files:**
- Modify: `backend/src/api/nodes.controller.ts:962-1012`
- Modify: `backend/src/pqs/pqs-summary.service.ts:3294-3489,5165-5185,5366-5550`
- Test: `backend/test/api/nodes.controller.spec.ts:2284-2364`
- Test: `backend/test/pqs/pqs-summary.service.spec.ts:4787-4865`

**Interfaces:**
- Consumes: `node?: string | string[]` from the Party route query.
- Produces: `fetchPartyUpdates(nodes, partyId, { nodeIds?: string[] })` and `fetchPartyContracts(nodes, partyId, { nodeIds?: string[] })`.
- Produces: `fetchGlobalRecentUpdates(..., { nodeIds?: string[] })` as the internal Party-updates merge primitive.

- [ ] **Step 1: Write the failing controller forwarding tests**

  In the existing Party route tests, add a repeated node argument and require the service to receive it unchanged:

  ```ts
  await controller.listPartyUpdates('Alice', '30', undefined, undefined, undefined, undefined, undefined, undefined, [
    'participant-1',
    'participant-2',
  ]);

  expect(pqsSummaryService.fetchPartyUpdates).toHaveBeenCalledWith(
    expect.any(Array),
    'Alice',
    expect.objectContaining({ nodeIds: ['participant-1', 'participant-2'] }),
  );
  ```

  Add the equivalent `listPartyContracts` expectation.

- [ ] **Step 2: Run the controller tests to verify they fail**

  Run: `npm test -- --runInBand backend/test/api/nodes.controller.spec.ts`

  Expected: FAIL because Party controller methods do not accept or forward `nodeIds`.

- [ ] **Step 3: Write failing selected-node service tests**

  Following the existing global-contract node-selection tests, stub `fetchRecentUpdates` and `fetchPartyContractsForNode`, select `participant-2`, and assert only that node is called. Add explicit-empty tests that assert each service returns its standard empty page and makes no PQS call:

  ```ts
  await service.fetchPartyContracts(nodes as never, 'Alice', {
    limit: 15,
    nodeIds: [],
  });

  expect(serviceWithFetch.fetchPartyContractsForNode).not.toHaveBeenCalled();
  ```

- [ ] **Step 4: Run the service tests to verify they fail**

  Run: `npm test -- --runInBand backend/test/pqs/pqs-summary.service.spec.ts`

  Expected: FAIL because Party merge code currently initializes state for every configured node.

- [ ] **Step 5: Implement the minimal backend propagation**

  Add `@Query('node') node?: string | string[]` to both Party controller methods and normalize it with the global Contracts route's existing expression:

  ```ts
  nodeIds: node === undefined ? undefined : Array.isArray(node) ? node : [node],
  ```

  Add `nodeIds?: string[]` to Party service options. In `fetchPartyUpdates`, pass it to `fetchGlobalRecentUpdates`; in that method derive `eligibleNodes` before creating `nodeStates`:

  ```ts
  const eligibleNodes = options?.nodeIds === undefined
    ? nodes
    : nodes.filter((node) => options.nodeIds?.includes(node.id));
  const nodeStates = eligibleNodes.map((node) => ({
    node,
    nextBefore: undefined as string | undefined,
    oldestFetched: null as GlobalUpdateCursor | null,
    exhausted: false,
  }));
  ```

  Use the same `eligibleNodes` rule in `fetchPartyContracts` before initializing its states. Leave global Updates route semantics unchanged.

- [ ] **Step 6: Run backend tests to verify they pass**

  Run: `npm test -- --runInBand backend/test/api/nodes.controller.spec.ts backend/test/pqs/pqs-summary.service.spec.ts`

  Expected: PASS, including default all-node behavior and selected/empty node cases.

- [ ] **Step 7: Commit the backend deliverable**

  ```bash
  git add backend/src/api/nodes.controller.ts backend/src/pqs/pqs-summary.service.ts backend/test/api/nodes.controller.spec.ts backend/test/pqs/pqs-summary.service.spec.ts
  git commit -m "feat: filter party activity by node"
  ```

### Task 2: Carry Party node filters through shared frontend browsers

**Files:**
- Modify: `frontend/src/lib/api.ts:1060-1125`
- Test: `frontend/src/lib/api.test.ts:1987-2135`
- Modify: `frontend/src/components/UpdatesBrowser.vue:33-675`
- Modify: `frontend/src/components/ContractsBrowser.vue:28-620`
- Test: `frontend/src/components/UpdatesBrowser.test.ts`
- Test: `frontend/src/components/ContractsBrowser.test.ts`

**Interfaces:**
- Consumes: `nodeOptions?: Array<{ id: string; label: string }>` supplied by `PartyDetailView`.
- Produces: `fetchPartyUpdates(partyId, { nodeIds?: string[] })` and `fetchPartyContracts(partyId, { nodeIds?: string[] })`.
- Produces: Party-scope browser query behavior where `queryPrefix="updates"` maps to `updatesNode` and `queryPrefix="contracts"` maps to `contractsNode`.

- [ ] **Step 1: Write failing API URL tests**

  Extend the existing Party helper tests to call both helpers with two node IDs and assert repeated query values:

  ```ts
  await fetchPartyUpdates?.('Alice', { nodeIds: ['participant-1', 'participant-2'] });
  expect(fetchMock).toHaveBeenCalledWith(
    'api/parties/Alice/updates?node=participant-1&node=participant-2&limit=30',
    expect.anything(),
  );
  ```

  Preserve the existing test expectations for calls without `nodeIds`.

- [ ] **Step 2: Run API tests to verify they fail**

  Run: `npm test -- --run frontend/src/lib/api.test.ts`

  Expected: FAIL because Party helper option types and serializers omit `nodeIds`.

- [ ] **Step 3: Write failing Party browser behavior tests**

  For each browser, render `scope: 'party'` with two node options and a prefixed node query. Assert the advanced filter opens, the selected checkbox is checked, and the Party helper receives the selected IDs:

  ```ts
  expect(fetchPartyUpdatesMock).toHaveBeenLastCalledWith('Alice', {
    nodeIds: ['participant-2'],
    limit: 30,
  });
  ```

  Click a node checkbox and assert the mocked router receives `updatesNode` or `contractsNode`, never the other section's key. Add the explicit-empty selection assertion.

- [ ] **Step 4: Run component tests to verify they fail**

  Run: `npm test -- --run frontend/src/components/UpdatesBrowser.test.ts frontend/src/components/ContractsBrowser.test.ts`

  Expected: FAIL because `UpdatesBrowser` has no node state and `ContractsBrowser` enables it only for global scope.

- [ ] **Step 5: Implement minimal API and shared-browser support**

  Add `nodeIds?: string[]` to the two Party helper option types and call the existing `appendNodeQueryParams(params, options?.nodeIds)` before the limit is appended.

  In both browsers, make node options and active selection available to `party` scope. Reuse the Contracts component's current semantics:

  ```ts
  const nodeFilteringEnabled = computed(
    () => (props.scope === 'global' || props.scope === 'party') && props.nodeOptions.length > 0,
  );
  ```

  Use this guard consistently when reading/writing `queryKey('node')`, deciding whether all nodes are selected, exposing node controls to `UpdatesAdvancedFilter`, and attaching `options.nodeIds` to Party helper calls. Do not expose node filtering when `nodeOptions` is empty, and keep global Updates unchanged by not giving it options.

  Include the node-options identity in the existing route synchronization watch for
  both browsers. This lets a Party section first load normally while observed
  nodes are still loading, then apply an incoming `updatesNode` or
  `contractsNode` deep link as soon as those options arrive:

  ```ts
  watch(
    () => [route.fullPath, props.scope, props.nodeId, props.partyId, props.nodeOptions],
    () => {
      syncFiltersFromRoute();
      contracts.reset();
      void contracts.load();
    },
    { immediate: true },
  );
  ```

  Use the equivalent watcher in `UpdatesBrowser`, preserving its current local
  retry behavior.

- [ ] **Step 6: Run frontend unit tests to verify they pass**

  Run: `npm test -- --run frontend/src/lib/api.test.ts frontend/src/components/UpdatesBrowser.test.ts frontend/src/components/ContractsBrowser.test.ts`

  Expected: PASS with independent prefixed query keys and selected IDs forwarded to Party APIs.

- [ ] **Step 7: Commit the shared frontend deliverable**

  ```bash
  git add frontend/src/lib/api.ts frontend/src/lib/api.test.ts frontend/src/components/UpdatesBrowser.vue frontend/src/components/UpdatesBrowser.test.ts frontend/src/components/ContractsBrowser.vue frontend/src/components/ContractsBrowser.test.ts
  git commit -m "feat: support node filters in party browsers"
  ```

### Task 3: Wire observed Party nodes into both sections

**Files:**
- Modify: `frontend/src/views/PartyDetailView.vue:479-514`
- Test: `frontend/src/views/PartyDetailView.test.ts:59-520`

**Interfaces:**
- Consumes: `nodesData.nodes`, whose entries contain `{ nodeId, label }`.
- Produces: `nodeOptions` for both Party browser instances as `{ id: node.nodeId, label: node.label }`.

- [ ] **Step 1: Write a failing Party view integration test**

  Render `/parties/Alice?updatesNode=participant-1&contractsNode=participant-2`, resolve observed nodes, open each section's advanced filter, and assert only its matching node is selected. Assert API calls keep the selections isolated:

  ```ts
  expect(api.fetchPartyUpdates).toHaveBeenLastCalledWith('Alice', {
    nodeIds: ['participant-1'],
    limit: 15,
  });
  expect(api.fetchPartyContracts).toHaveBeenLastCalledWith('Alice', {
    nodeIds: ['participant-2'],
    limit: 15,
  });
  ```

- [ ] **Step 2: Run the Party view test to verify it fails**

  Run: `npm test -- --run frontend/src/views/PartyDetailView.test.ts`

  Expected: FAIL because neither Party browser receives observed-node options.

- [ ] **Step 3: Implement the view wiring**

  Add a computed `partyNodeOptions` derived from `nodesData.value?.nodes ?? []`:

  ```ts
  const partyNodeOptions = computed(() =>
    (nodesData.value?.nodes ?? []).map((node) => ({ id: node.nodeId, label: node.label })),
  );
  ```

  Pass `:node-options="partyNodeOptions"` to both browser instances. Do not make either component wait for observed-node loading; an initially empty options list preserves its normal load and the control appears after node data arrives.

- [ ] **Step 4: Run Party view and frontend regression tests**

  Run: `npm test -- --run frontend/src/views/PartyDetailView.test.ts frontend/src/components/UpdatesBrowser.test.ts frontend/src/components/ContractsBrowser.test.ts frontend/src/lib/api.test.ts`

  Expected: PASS; each section reloads only after its own URL prefix changes.

- [ ] **Step 5: Run the complete validation suite**

  Run: `npm test && npm run build`

  Expected: all backend/frontend tests and the production frontend build pass. If tests regenerate `backend/test/fixtures/daml/package-cache.sqlite`, verify it differs only from test execution and restore it before staging.

- [ ] **Step 6: Commit the Party view integration**

  ```bash
  git add frontend/src/views/PartyDetailView.vue frontend/src/views/PartyDetailView.test.ts
  git commit -m "feat: filter party updates and contracts by node"
  ```
