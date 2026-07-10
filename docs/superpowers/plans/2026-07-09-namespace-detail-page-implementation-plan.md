# Namespace Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real namespace-centric detail page, reachable from the Parties page `Namespaces` mode, with aggregated overview, parties, nodes, topology, recent updates, and recent contracts.

**Architecture:** Add a dedicated backend namespace-detail aggregate endpoint and a dedicated frontend namespace route/view. Reuse the existing PQS/grpc aggregation helpers and the existing update/contracts browser components wherever possible, keeping namespace-specific aggregation in backend code.

**Tech Stack:** NestJS, Vue 3, Vue Router, Vitest, Jest, existing PQS/grpc services and frontend browser components.

---

### Task 1: Define Namespace Detail Contracts

**Files:**
- Modify: `backend/src/domain/node.types.ts`
- Create: `frontend/src/types/namespaces.ts`
- Test: `frontend/src/lib/api.test.ts`

- [ ] **Step 1: Write the failing frontend API contract test**

Add a test that expects a new namespace detail API function to deserialize:

- `namespaceId`
- `partyCount`
- `nodeCount`
- `parties`
- `nodes`
- `recentUpdates`
- `recentContracts`
- `topologyByNode`

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm test --workspace frontend -- api.test.ts`

Expected: FAIL because the namespace detail API helper/types do not exist.

- [ ] **Step 3: Add minimal shared types**

Define backend/frontend namespace detail types with exact field names needed by the page.

- [ ] **Step 4: Run test to verify the type contract passes**

Run: `rtk npm test --workspace frontend -- api.test.ts`

Expected: PASS for the new type/API contract test.

- [ ] **Step 5: Commit**

```bash
git add backend/src/domain/node.types.ts frontend/src/types/namespaces.ts frontend/src/lib/api.test.ts
git commit -m "feat: define namespace detail contracts"
```

### Task 2: Add Backend Namespace Detail Aggregation

**Files:**
- Modify: `backend/src/api/nodes.controller.ts`
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Modify: `backend/src/domain/node.types.ts`
- Test: `backend/test/api/nodes.controller.spec.ts`
- Test: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Write the failing backend controller test**

Add a Jest test for `GET /api/namespaces/:namespaceId` that expects:

- exact namespace match
- aggregated parties
- aggregated nodes
- aggregated recent counts

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm test --workspace backend -- nodes.controller.spec.ts --testNamePattern="namespace detail"`

Expected: FAIL because the route/controller method does not exist.

- [ ] **Step 3: Write the failing aggregation service test**

Add a PQS summary service test that expects namespace detail aggregation by exact namespace suffix.

- [ ] **Step 4: Run test to verify it fails**

Run: `rtk npm test --workspace backend -- pqs-summary.service.spec.ts --testNamePattern="namespace detail"`

Expected: FAIL because the service method does not exist.

- [ ] **Step 5: Implement minimal namespace aggregation**

Implement:

- namespace discovery from party suffixes
- party/node aggregation
- recent update/contract aggregation by matching parties

- [ ] **Step 6: Run targeted backend tests**

Run:

- `rtk npm test --workspace backend -- nodes.controller.spec.ts --testNamePattern="namespace detail"`
- `rtk npm test --workspace backend -- pqs-summary.service.spec.ts --testNamePattern="namespace detail"`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src/api/nodes.controller.ts backend/src/pqs/pqs-summary.service.ts backend/src/domain/node.types.ts backend/test/api/nodes.controller.spec.ts backend/test/pqs/pqs-summary.service.spec.ts
git commit -m "feat: add namespace detail backend aggregation"
```

### Task 3: Add Namespace Topology Aggregation

**Files:**
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Modify: `backend/src/grpc/grpc-operations.service.ts` (only if required)
- Test: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Write the failing topology aggregation test**

Add a test that expects deduped topology evidence per node across all parties sharing a namespace.

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm test --workspace backend -- pqs-summary.service.spec.ts --testNamePattern="namespace topology"`

Expected: FAIL because namespace topology aggregation is not implemented.

- [ ] **Step 3: Implement minimal deduped topology merge**

Reuse existing per-party topology reads and merge:

- participant mappings
- key mappings
- node status/error fields

- [ ] **Step 4: Run targeted topology test**

Run: `rtk npm test --workspace backend -- pqs-summary.service.spec.ts --testNamePattern="namespace topology"`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/pqs/pqs-summary.service.ts backend/test/pqs/pqs-summary.service.spec.ts
git commit -m "feat: aggregate namespace topology by node"
```

### Task 4: Add Frontend Namespace API Helper

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/api.test.ts`
- Create: `frontend/src/types/namespaces.ts` (if not already added in Task 1)

- [ ] **Step 1: Write the failing API helper test**

Add a test for `fetchNamespaceDetail(namespaceId)` calling `/api/namespaces/:namespaceId`.

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm test --workspace frontend -- api.test.ts`

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement the minimal API helper**

Add `fetchNamespaceDetail(namespaceId)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npm test --workspace frontend -- api.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/lib/api.test.ts frontend/src/types/namespaces.ts
git commit -m "feat: add namespace detail frontend api"
```

### Task 5: Make Namespace Rows Clickable

**Files:**
- Modify: `frontend/src/views/PartiesView.vue`
- Modify: `frontend/src/views/PartiesView.test.ts`

- [ ] **Step 1: Write the failing UI test**

Add a test expecting namespace rows to link to `/namespaces/:namespaceId`.

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm test --workspace frontend -- PartiesView.test.ts`

Expected: FAIL because rows are still plain divs.

- [ ] **Step 3: Implement minimal namespace links**

Wrap namespace rows in `RouterLink`.

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npm test --workspace frontend -- PartiesView.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/PartiesView.vue frontend/src/views/PartiesView.test.ts
git commit -m "feat: link namespace rows to detail page"
```

### Task 6: Add Namespace Route and Detail View Skeleton

**Files:**
- Modify: `frontend/src/router.ts`
- Create: `frontend/src/views/NamespaceDetailView.vue`
- Create: `frontend/src/views/NamespaceDetailView.test.ts`

- [ ] **Step 1: Write the failing route/view test**

Add a test rendering `/namespaces/:namespaceId` and expecting:

- loading state
- overview heading
- back arrow to `/parties`

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm test --workspace frontend -- NamespaceDetailView.test.ts`

Expected: FAIL because the route/view do not exist.

- [ ] **Step 3: Implement minimal route and view skeleton**

Create the route and load namespace detail via the new API helper.

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npm test --workspace frontend -- NamespaceDetailView.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/router.ts frontend/src/views/NamespaceDetailView.vue frontend/src/views/NamespaceDetailView.test.ts
git commit -m "feat: add namespace detail route and skeleton"
```

### Task 7: Render Overview, Parties, and Nodes

**Files:**
- Modify: `frontend/src/views/NamespaceDetailView.vue`
- Modify: `frontend/src/views/NamespaceDetailView.test.ts`

- [ ] **Step 1: Write the failing detail rendering test**

Add assertions for:

- namespace id overview
- observed party count/node count
- party links
- node links

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm test --workspace frontend -- NamespaceDetailView.test.ts`

Expected: FAIL because these sections are not rendered yet.

- [ ] **Step 3: Implement minimal overview/parties/nodes sections**

Follow the Party detail visual pattern.

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npm test --workspace frontend -- NamespaceDetailView.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/NamespaceDetailView.vue frontend/src/views/NamespaceDetailView.test.ts
git commit -m "feat: render namespace overview parties and nodes"
```

### Task 8: Reuse Updates and Contracts Browsers

**Files:**
- Modify: `frontend/src/views/NamespaceDetailView.vue`
- Modify: `frontend/src/components/UpdatesBrowser.vue` (if namespace scope support is needed)
- Modify: `frontend/src/components/ContractsBrowser.vue` (if namespace scope support is needed)
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/views/NamespaceDetailView.test.ts`

- [ ] **Step 1: Write the failing browser integration test**

Add assertions that the namespace detail page renders recent updates and recent contracts sections.

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm test --workspace frontend -- NamespaceDetailView.test.ts`

Expected: FAIL because namespace recent activity is not shown.

- [ ] **Step 3: Implement minimal namespace-scoped activity rendering**

Prefer reusing existing browser components. If they require a new scope, add the smallest scope extension necessary.

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npm test --workspace frontend -- NamespaceDetailView.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/NamespaceDetailView.vue frontend/src/components/UpdatesBrowser.vue frontend/src/components/ContractsBrowser.vue frontend/src/lib/api.ts frontend/src/views/NamespaceDetailView.test.ts
git commit -m "feat: add namespace recent updates and contracts"
```

### Task 9: Render Namespace Topology

**Files:**
- Modify: `frontend/src/views/NamespaceDetailView.vue`
- Modify: `frontend/src/views/NamespaceDetailView.test.ts`

- [ ] **Step 1: Write the failing topology section test**

Add assertions for per-node topology cards and deduped evidence rendering.

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm test --workspace frontend -- NamespaceDetailView.test.ts`

Expected: FAIL because topology is not rendered.

- [ ] **Step 3: Implement minimal topology presentation**

Reuse Party detail topology visual patterns where sensible, but keep labels namespace-centric.

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npm test --workspace frontend -- NamespaceDetailView.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/NamespaceDetailView.vue frontend/src/views/NamespaceDetailView.test.ts
git commit -m "feat: render namespace topology"
```

### Task 10: Final Verification

**Files:**
- No new files

- [ ] **Step 1: Run focused frontend tests**

Run:

- `rtk npm test --workspace frontend -- PartiesView.test.ts NamespaceDetailView.test.ts api.test.ts`

Expected: PASS

- [ ] **Step 2: Run focused backend tests**

Run:

- `rtk npm test --workspace backend -- nodes.controller.spec.ts --testNamePattern="namespace detail|namespace topology"`
- `rtk npm test --workspace backend -- pqs-summary.service.spec.ts --testNamePattern="namespace detail|namespace topology"`

Expected: PASS

- [ ] **Step 3: Run builds**

Run:

- `rtk npm run build --workspace frontend`
- `rtk npm run build --workspace backend`

Expected: PASS

- [ ] **Step 4: Commit final integration**

```bash
git add frontend/src backend/src backend/test docs/superpowers/specs/2026-07-09-namespace-detail-page-design.md docs/superpowers/plans/2026-07-09-namespace-detail-page-implementation-plan.md
git commit -m "feat: add namespace detail page"
```
