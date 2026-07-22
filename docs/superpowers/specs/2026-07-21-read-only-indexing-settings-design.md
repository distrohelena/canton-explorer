# Read-Only Indexing Settings Design

**Date:** 2026-07-21

## Goal

Add a read-only Settings page that shows the current indexing state for every configured Canton participant node. The page is reached through an expandable top-level Explore menu in the application header.

## Scope

The first version is an operational status view, not a configuration editor. It reports the latest state already maintained by the backend node poller and does not add settings persistence or write endpoints.

### In scope

- A `/settings` frontend route.
- An accessible Explore control in the application header.
- An expandable destination menu that can grow as the explorer gains features.
- A read-only `Indexing status` section.
- Per-node PQS and, where configured, gRPC status.
- Latest indexed PQS offset and event timestamp.
- Total indexed update count.
- Loading, empty, degraded, and API-error states.
- Periodic refresh while the page is open.

### Out of scope

- Editing server-side node configuration.
- Persisting user preferences on this page.
- Direct frontend connections to PQS or gRPC.
- Claiming that PQS is fully caught up against the participant ledger tip. An explicit lag value can be added later once a reliable participant ledger-end comparison is exposed.

## Existing context

The backend already polls each node and exposes the cached snapshot through `GET /nodes`. The snapshot includes:

- `sourceStatus.pqs`: PQS reachability, check time, latency, and error.
- `sourceStatus.grpc`: gRPC reachability, check time, latency, and error.
- `ledgerSummary.latestOffset`: latest transaction offset visible to PQS.
- `ledgerSummary.latestEventAt`: latest event timestamp visible to PQS.
- `ledgerSummary.totalUpdateCount`: total PQS transaction count.
- Overall node status and node identity fields.

The frontend already has a shared application shell, footer, router, `fetchNodes()` API helper, and node status types. The implementation should reuse these patterns.

## User experience

### Entry point

Keep the existing Search bar unchanged. Replace the fixed Updates, Nodes, Parties, Contracts, and Tokens navigation links with an accessible `Explore` button in the header. It should:

- open an expandable menu containing the current top-level destinations and Settings;
- show the active high-level destination in the control label, with detail routes inheriting their parent section label;
- open and close on click and keyboard focus/activation, with hover used only as visual feedback;
- close after selecting a destination and when focus leaves the menu where appropriate;
- expose expanded state through `aria-expanded` and associate the menu with the button;
- remain available on normal application routes without changing the existing Search behavior.

The footer remains attribution-only; it no longer owns the Settings entry point.

### Explore visual treatment

The current Explore treatment should remain muted purple-grey. The header control fills the available header height, has no default fill or visible border, and gains only a subtle purple-grey background on hover or when expanded. The menu can retain a restrained panel edge, shadow, rotating caret, and short fade/slide; avoid bright accent colors and playful effects until a dedicated playful theme is added later. The Explore wrapper owns one fixed width, while both the button and menu use `width: 100%` so their edges align exactly. Respect `prefers-reduced-motion` by disabling decorative transitions and animations.

### Page layout

The page contains:

1. A page title, `Settings`.
2. A short read-only notice explaining that explorer configuration is managed by the server.
3. An `Indexing status` section.
4. One compact status card for each configured node.

Each card shows:

- node label, linked to the existing node detail route;
- overall node status;
- PQS status and last check time;
- latest indexed offset;
- latest indexed event time;
- indexed update count;
- gRPC status when the node is configured as `pqs_with_grpc`;
- source error details when a source is degraded or unavailable.

The wording should describe observed state, for example `Last indexed`, `PQS unavailable`, or `Checked 12 seconds ago`. It must not call a node `fully synced` without a ledger-end comparison.

### Page states

- **Loading:** use the application’s existing loading treatment while `/nodes` is pending.
- **Loaded:** render all configured node cards, including degraded nodes.
- **Empty:** explain that no nodes are configured and that configuration is server-managed.
- **API error:** show a page-level error and a retry action; do not display fabricated zero values.
- **Partial source failure:** preserve all available snapshot fields and show the failing source’s error inline.

The page should refresh from `GET /nodes` on entry and on a modest interval aligned with the backend poller, such as 15 seconds. Refresh failures should preserve the last successfully rendered data and show the error state without causing the page to flicker.

## Data flow

```text
NodePollerService
  -> NodeCacheService
  -> GET /nodes
  -> fetchNodes()
  -> SettingsView.vue
```

No frontend code talks directly to PQS or gRPC. The backend remains responsible for source access, normalization, polling, and cached status.

The frontend node type should include `ledgerSummary.totalUpdateCount`, which is already present in the backend domain response and is needed by the page.

## Components and boundaries

- `App.vue`: owns the Explore button/menu state and renders the header destinations while preserving the existing Search bar.
- `router.ts`: registers `/settings` and imports the view according to existing route conventions.
- `SettingsView.vue`: owns page loading, refresh lifecycle, view state, and presentation of node snapshots.
- `api.ts`: reuses `fetchNodes()`; no new API helper is required for the first version.
- `types/nodes.ts`: aligns the frontend `NodeSnapshot.ledgerSummary` type with the backend by adding `totalUpdateCount`.
- `styles.css`: adds focused settings-page and footer-link styles, reusing existing status tokens and responsive conventions.

## Verification

Add or update tests for:

- `/settings` route registration and view rendering;
- Explore button visibility, accessible expanded state, menu destinations, and navigation behavior;
- unchanged Search bar rendering and submission behavior;
- loading state;
- healthy node rendering with latest offset, event time, and count;
- `pqs_only` rendering without a misleading gRPC failure;
- degraded PQS/gRPC source messaging;
- page-level API error and retry behavior;
- periodic refresh cleanup on unmount.

Run the focused frontend tests, type-check/build, and the existing backend tests that cover the `/nodes` response contract before implementation is considered complete.

## Future extension: explicit indexing lag

If the participant gRPC surface exposes a reliable ledger-end offset, extend the backend snapshot with a normalized indexing comparison:

- participant ledger end;
- PQS latest offset;
- lag in offsets or an explicit unknown state.

That future field can support labels such as `Caught up`, `Behind`, or `Unknown` without changing the Settings page’s overall structure.
