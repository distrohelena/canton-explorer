# Independent Section Loading Design

## Goal

Make every multi-section Explorer page render its shell immediately and load each
independent section concurrently. A slow or failed section must never block the
rest of its page.

## User Experience Contract

Each independent visible section owns its own request state:

1. The page shell, title, section heading, and section container render immediately.
2. All eligible section requests start concurrently once the route identity and
   section inputs are known.
3. A pending section displays the existing inline spinner inside that section.
4. A failed request is retried automatically exactly once.
5. If the retry fails, only that section displays a local error and a manual
   `Retry` button. Other sections retain their ready, loading, or failed state.
6. A manual retry affects only its failed section.
7. When a route parameter, filter, cursor, or page size changes, the new request
   supersedes any earlier in-flight response. A late older response must not
   overwrite the new section state.

The Party Detail visual treatment is the standard: section headings remain
visible while their own body is loading. The new behavior improves that page by
making its overview, observed-nodes, and topology data truly independent rather
than using one compound response.

## Shared Frontend Primitive

Add a composable such as `useSectionLoad` that accepts an async loader and
exposes:

- `data`, `loading`, `retrying`, and `error` refs;
- `load()` and `retry()` methods;
- exactly one automatic retry per `load()` invocation;
- a monotonically increasing request generation (or `AbortController` where the
  API client supports it) so stale completions are ignored;
- a `reset()` method for route changes.

The composable is intentionally request-agnostic. It must not own page state,
pagination state, or UI markup. Views and already-sectioned components own those
concerns and bind the exposed state to existing inline loading/error patterns.

The automatic retry occurs immediately after a failed request. A later manual
retry creates a new attempt cycle with one further automatic retry.

## API Boundary

Do not use a compound response merely because several cards happen to share a
route. A section endpoint returns the data needed for one independently rendered
section. Existing aggregate endpoints remain during migration for compatibility;
the frontend stops calling them after its sections are migrated. Remove a legacy
aggregate endpoint only in a later compatibility-breaking cleanup.

The backend keeps endpoint work focused on response decomposition and reuses the
existing service methods and DTO types where possible. It does not add a generic
fan-out endpoint or server-side request orchestrator.

## Page Migration Matrix

| Page | Independent sections | Endpoint plan |
| --- | --- | --- |
| Home | overview activity, market history, recent active parties, updates, transfers | Existing per-section endpoints already exist; move each loader to `useSectionLoad`. |
| Node Detail | node overview, installed packages, participant status, updates, contracts | Existing per-section endpoints already exist; replace the page-level `Promise.all` and global error. |
| Party Detail | overview, observed nodes, party topology, updates, contracts | Split `GET /parties/:partyId` into summary, nodes, and topology section endpoints; retain aggregate endpoint temporarily. |
| Namespace Detail | overview, observed nodes, topology, observed parties, updates, contracts | Split `GET /namespaces/:namespaceId` into summary, nodes, topology, updates, and contracts section endpoints; retain aggregate endpoint temporarily. |
| Token Detail | token summary, holders, transfers | Existing token/holders/transfers endpoints; remove the shared error state and load each independently. |
| Package Detail | summary, observed nodes, modules, templates, data types | Existing section endpoints; migrate to common retry/stale-response behavior. |
| Settings | node/indexing status, traffic purchases for each node | Load the node snapshot section separately; start each node traffic card after node IDs arrive, each with independent state and retry. |
| Debugger | session list, selected session, template catalog, active contracts, constructor schema, event list | Preserve existing functional dependency edges, but make all otherwise independent panels use section-local state and retry. A selected session remains a prerequisite for its session-scoped events; a selected template remains a prerequisite for constructor schema; a selected node/simulation kind remains a prerequisite for active contracts. |
| Existing browsers | updates, contracts, token transfers | These are already independently mounted sections. Migrate their request state to the common retry/stale-response contract without changing filtering or pagination behavior. |
| Other single-record pages | update, contract, module, template, package family, token transfer, search, traffic, lists | No decomposition when the page has one data section. Their existing loading behavior remains unless they embed independently loaded browser sections. |

## Section Endpoint Shapes

Add these compatibility-preserving routes:

- `GET /parties/:partyId/summary`
- `GET /parties/:partyId/nodes`
- `GET /parties/:partyId/topology`
- `GET /namespaces/:namespaceId/summary`
- `GET /namespaces/:namespaceId/nodes`
- `GET /namespaces/:namespaceId/topology`
- `GET /namespaces/:namespaceId/updates`
- `GET /namespaces/:namespaceId/contracts`

Each uses the corresponding fields of the current aggregate response. The
frontend API client receives typed fetch helpers for each endpoint. No new
section endpoint is needed where a suitable typed endpoint already exists.

## Failure and Retry Rules

- A response-level status such as `grpc_error` remains displayed as data inside
  its appropriate card; it is not retried as an HTTP request failure.
- Network, non-OK HTTP, JSON, and API-client failures get one automatic retry.
- Retried calls preserve the exact query, cursor, page size, and filter inputs
  that created the original section request.
- Section failures never clear another section's previous successful data.
- On a successful refresh, clear that section's error and replace only its data.

## Verification

Frontend tests must prove, for representative sections on each migrated pattern:

- sibling section fetches start without awaiting each other;
- a pending or failing section leaves its sibling content visible;
- the failed request happens twice before local error appears;
- clicking the local retry controls only that section;
- route/filter changes ignore late results from older requests.

Backend controller/service tests cover each new Party and Namespace section
endpoint and prove it returns the field subset from the existing service result.
Run the full backend and frontend test suites, build both workspaces, and run
`git diff --check`.

## Non-Goals

- Changing dashboard layout, pagination semantics, or route URLs.
- Retrying domain-level `grpc_error` and `pqs_error` status payloads.
- Introducing polling, caching, a global loading overlay, or a generic backend
  aggregation service.
- Removing legacy aggregate Party or Namespace endpoints in this migration.
