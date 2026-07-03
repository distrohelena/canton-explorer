# Parties Active Parties Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder `Parties` page with a two-mode page shell and implement the `Active Parties` mode using PQS-backed party lists grouped by node.

**Architecture:** Add a backend endpoint that returns active parties per configured node, normalized to the same display format used elsewhere in the explorer. Update the frontend `Parties` page to render two mode buttons, one node button per node, PQS-backed active-party content, and disabled `All Parties` node buttons when gRPC is unavailable.

**Tech Stack:** NestJS, TypeScript, Zod, Jest, Vue 3, Vue Router, Vitest

---

### Task 1: Add backend response types and endpoint contract

**Files:**
- Modify: `backend/src/domain/node.types.ts`
- Modify: `backend/src/api/nodes.controller.ts`
- Test: `backend/test/api/nodes.controller.spec.ts`

- [ ] **Step 1: Write the failing controller test**

Add a test asserting a new controller entry point returns grouped active parties:

```ts
it('returns active parties grouped by node', async () => {
  const response = await controller.listActiveParties();

  expect(response.nodes[0].nodeId).toBe('participant-1');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm test -- --runTestsByPath test/api/nodes.controller.spec.ts`
Expected: FAIL because `listActiveParties` and/or response typing does not exist yet

- [ ] **Step 3: Add minimal backend response types and controller method**

Add new types such as:

```ts
export interface ActivePartiesNodeEntry {
  nodeId: string;
  label: string;
  mode: NodeMode;
  parties: string[];
}

export interface ActivePartiesResponse {
  nodes: ActivePartiesNodeEntry[];
}
```

Add a controller method routed at:

```ts
@Get('/parties')
async listActiveParties()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npm test -- --runTestsByPath test/api/nodes.controller.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/domain/node.types.ts backend/src/api/nodes.controller.ts backend/test/api/nodes.controller.spec.ts
git commit -m "feat: add active parties endpoint contract"
```

### Task 2: Implement PQS-backed active-party extraction

**Files:**
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Test: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Write the failing service test**

Add a test that expects grouped parties for all configured nodes, including empty-party nodes and normalized IDs:

```ts
it('returns active parties grouped by node', async () => {
  await expect(service.fetchActiveParties(nodes)).resolves.toEqual({
    nodes: [
      {
        nodeId: 'participant-1',
        label: 'Participant 1',
        mode: 'pqs_only',
        parties: ['Alice'],
      },
      {
        nodeId: 'participant-2',
        label: 'Participant 2',
        mode: 'pqs_with_grpc',
        parties: [],
      },
    ],
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm test -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts`
Expected: FAIL because `fetchActiveParties` does not exist yet

- [ ] **Step 3: Write minimal implementation**

Implement a service method that:

- queries party data from PQS per node
- supports both legacy and normalized participant schemas if needed
- strips `p|` from returned values
- deduplicates and sorts party IDs
- returns all configured nodes, even when `parties` is empty

Suggested method shape:

```ts
async fetchActiveParties(nodes: NodeConfig[]): Promise<ActivePartiesResponse>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npm test -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/pqs/pqs-summary.service.ts backend/test/pqs/pqs-summary.service.spec.ts
git commit -m "feat: add PQS-backed active parties service"
```

### Task 3: Wire controller to service and verify backend slice

**Files:**
- Modify: `backend/src/api/nodes.controller.ts`
- Modify: `backend/test/api/nodes.controller.spec.ts`
- Test: `backend/test/config/node-config.spec.ts`
- Test: `backend/test/orchestrator/node-poller.service.spec.ts`

- [ ] **Step 1: Add the service mock expectation in controller tests**

Extend the controller fixture to return:

```ts
{
  nodes: [
    {
      nodeId: 'participant-1',
      label: 'Participant 1',
      mode: 'pqs_only',
      parties: ['Alice'],
    },
  ],
}
```

- [ ] **Step 2: Run targeted backend tests**

Run:

```bash
rtk npm test -- --runTestsByPath test/api/nodes.controller.spec.ts test/config/node-config.spec.ts test/orchestrator/node-poller.service.spec.ts
```

Expected: PASS

- [ ] **Step 3: Run backend build**

Run: `rtk npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/api/nodes.controller.ts backend/test/api/nodes.controller.spec.ts
git commit -m "feat: expose active parties endpoint"
```

### Task 4: Add frontend types and API call for active parties

**Files:**
- Create: `frontend/src/types/active-parties.ts`
- Modify: `frontend/src/lib/api.ts`
- Test: `frontend/src/lib/api.test.ts`

- [ ] **Step 1: Write the failing frontend API test**

Add a test like:

```ts
it('loads active parties grouped by node from the backend API', async () => {
  const result = await fetchActiveParties();
  expect(result.nodes[0].nodeId).toBe('participant-1');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm test -- --run api.test.ts`
Expected: FAIL because `fetchActiveParties` does not exist yet

- [ ] **Step 3: Write minimal API/types implementation**

Add:

```ts
export interface ActivePartiesNodeEntry {
  nodeId: string;
  label: string;
  mode: 'pqs_only' | 'pqs_with_grpc';
  parties: string[];
}

export interface ActivePartiesResponse {
  nodes: ActivePartiesNodeEntry[];
}
```

And:

```ts
export function fetchActiveParties(): Promise<ActivePartiesResponse> {
  return fetchJson<ActivePartiesResponse>('/parties');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npm test -- --run api.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/active-parties.ts frontend/src/lib/api.ts frontend/src/lib/api.test.ts
git commit -m "feat: add frontend active parties API client"
```

### Task 5: Replace placeholder Parties page with two-mode shell

**Files:**
- Modify: `frontend/src/views/PartiesView.vue`
- Modify: `frontend/src/styles.css`
- Test: `frontend/src/App.test.ts`

- [ ] **Step 1: Write the failing app-level route test**

Add assertions that the `/parties` route shows:

- `Active Parties`
- `All Parties`

```ts
expect(screen.getByRole('button', { name: 'Active Parties' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'All Parties' })).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm test -- --run App.test.ts`
Expected: FAIL because the placeholder page does not render the new controls

- [ ] **Step 3: Implement the page shell**

Add state for:

- `selectedMode`
- `selectedNodeId`

Render:

- top mode buttons
- node button row
- content section placeholder

Do not wire final party data yet beyond the page shell.

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npm test -- --run App.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/PartiesView.vue frontend/src/styles.css frontend/src/App.test.ts
git commit -m "feat: add parties page mode shell"
```

### Task 6: Implement Active Parties node loading and rendering

**Files:**
- Modify: `frontend/src/views/PartiesView.vue`
- Modify: `frontend/src/styles.css`
- Create or Modify: `frontend/src/views/PartiesView.test.ts`

- [ ] **Step 1: Write the failing page behavior test**

Add tests for:

- one node button per backend node
- clicking a node shows that node’s parties
- party entries link to `/parties/:partyId`
- empty node shows `No active parties found`

```ts
expect(screen.getByRole('button', { name: 'Participant 1' })).toBeInTheDocument();
expect(screen.getByRole('link', { name: 'Alice' })).toHaveAttribute('href', '/parties/Alice');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm test -- --run PartiesView.test.ts`
Expected: FAIL because data loading/rendering is incomplete

- [ ] **Step 3: Write minimal implementation**

Implement:

- load `fetchActiveParties()` on mount
- default selected node to the first returned node
- render node buttons from returned data
- render selected node’s `parties` as links
- show `No active parties found` when `parties.length === 0`

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npm test -- --run PartiesView.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/PartiesView.vue frontend/src/views/PartiesView.test.ts frontend/src/styles.css
git commit -m "feat: render active parties by node"
```

### Task 7: Add disabled All Parties node behavior

**Files:**
- Modify: `frontend/src/views/PartiesView.vue`
- Modify: `frontend/src/styles.css`
- Modify: `frontend/src/views/PartiesView.test.ts`

- [ ] **Step 1: Write the failing UI-state test**

Add a test that:

- switches to `All Parties`
- disables node buttons whose mode is `pqs_only`
- shows `No gRPC` on disabled node buttons

```ts
expect(screen.getByRole('button', { name: /Participant 1/i })).toBeDisabled();
expect(screen.getByText('No gRPC')).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm test -- --run PartiesView.test.ts`
Expected: FAIL because disabled-state logic does not exist yet

- [ ] **Step 3: Write minimal implementation**

Implement:

- `All Parties` mode stays selectable
- node buttons are disabled only when mode is `pqs_only`
- disabled state text shows `No gRPC`
- placeholder content is shown for enabled `All Parties` nodes until the SDK work lands

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npm test -- --run PartiesView.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/PartiesView.vue frontend/src/views/PartiesView.test.ts frontend/src/styles.css
git commit -m "feat: disable all parties per node without grpc"
```

### Task 8: Final verification

**Files:**
- Verify only

- [ ] **Step 1: Run backend targeted tests**

Run:

```bash
rtk npm test -- --runTestsByPath test/config/node-config.spec.ts test/orchestrator/node-poller.service.spec.ts test/api/nodes.controller.spec.ts test/pqs/pqs-summary.service.spec.ts
```

Expected: PASS

- [ ] **Step 2: Run frontend targeted tests**

Run:

```bash
rtk npm test -- --run App.test.ts api.test.ts PartiesView.test.ts NodeDetailView.test.ts NodesView.test.ts
```

Expected: PASS

- [ ] **Step 3: Run full builds**

Run:

```bash
rtk npm run build --workspace backend
rtk npm run build --workspace frontend
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add PQS-backed active parties page"
```
