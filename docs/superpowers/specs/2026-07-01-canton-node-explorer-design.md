# Canton Node Explorer Design

Date: 2026-07-01

## Overview

Build a greenfield Canton node explorer as a TypeScript monorepo with separate `backend/` and `frontend/` applications.

The first version is:

- read-only
- unauthenticated
- participant-first
- operations-dashboard-first
- backed by a static endpoint configuration file
- stateless apart from short-lived in-memory caching

The system must connect to multiple Canton participant nodes, surface multiple ledgers, use PQS as the primary read path, and use gRPC for operational metadata that PQS does not expose well enough.

## Goals

- Show one operational status entry per configured Canton endpoint
- Support multiple participant nodes and multiple ledgers
- Present health and connectivity first, with ledger summaries beneath
- Normalize PQS and gRPC responses into a single backend API for the frontend
- Keep the architecture extensible for future Canton roles and authentication

## Non-Goals

- Authentication or authorization
- Browser-managed endpoint configuration
- Persistent historical storage
- Full ledger mirroring
- Sequencer, mediator, or other non-participant deep support in v1
- Control-plane or mutating actions

## Repository Layout

```text
backend/
frontend/
docs/
  superpowers/
    specs/
```

## Architecture

The recommended architecture is a thin aggregator backend.

Vue does not communicate with PQS or gRPC directly. NestJS owns all endpoint configuration, upstream communication, polling, normalization, caching, and frontend-facing APIs.

This keeps transport details and Canton-specific integration logic out of the browser while preserving a stable UI contract for future changes.

## Backend Design

### Stack

- NestJS
- TypeScript
- REST API for the frontend
- in-memory cache for latest node snapshots

### Responsibilities

- load and validate static node configuration at startup
- poll PQS endpoints for ledger and summary data
- call gRPC endpoints for operational metadata not covered by PQS
- merge source responses into one normalized node snapshot
- expose frontend-oriented APIs for dashboard and node detail views

### Modules

#### `config`

Loads the static configuration file and validates required fields.

Each configured node includes:

- `id`
- `label`
- `role` with v1 fixed to participant
- `pqs` connection settings for the node's PQS PostgreSQL database
- optional `grpcTarget`
- optional `ledgerLabel`
- optional polling overrides

Startup fails fast on invalid configuration.

#### `connectors/pqs`

Responsible for querying the node's PQS PostgreSQL database for read data such as:

- ledger summaries
- read-model information suitable for the operations view
- any per-ledger summary fields needed by node detail pages

This connector is the primary data source for ledger-facing information. It uses SQL against PQS rather than calling PQS over HTTP.

#### `connectors/grpc`

Responsible only for operational metadata that PQS does not provide adequately for v1, such as:

- service reachability
- version metadata
- readiness-style information
- other health-adjacent node metadata

This connector should stay narrow in v1 to avoid premature protocol sprawl.

#### `orchestrator`

Schedules polling for each configured node, executes PQS and gRPC fetches, merges results, computes health state, and updates cache entries independently per node.

#### `cache`

Stores the latest normalized snapshot for each node with timestamps and source diagnostics.

No persistent datastore is used in v1.

#### `api`

Exposes frontend-oriented endpoints such as:

- `GET /nodes`
- `GET /nodes/:id`
- `GET /ledgers`

The API returns normalized application models rather than raw PQS or gRPC payloads.

## Frontend Design

### Stack

- Vue
- TypeScript

### Responsibilities

- display the operations dashboard
- render one card or row per configured participant node
- emphasize health, connectivity, latency, and last successful refresh
- provide drill-down into per-node ledger summaries

### UI Structure

#### App Shell

Provides layout, page title, refresh metadata, and high-level navigation.

#### Operations Dashboard

The landing page. It shows:

- one status tile or row per node
- overall health status
- response latency
- last successful poll time
- current degradation or error summary
- ledger summary highlights

Nodes should be sortable or visually prioritized so degraded and down nodes are easy to spot first.

#### Node Detail

Shows a deeper per-node view including:

- endpoint metadata
- source-specific fetch status for PQS and gRPC
- ledger summary data
- recent fetch outcome information

#### Shared Data Layer

Contains the typed API client, polling/query logic, and status formatting helpers used by the Vue views.

## Core Data Model

Each backend node snapshot should include:

- `id`
- `label`
- `role`
- `ledgerLabel`
- `status`
- `latencyMs`
- `lastSuccessAt`
- `lastErrorAt`
- `errorSummary`
- `serviceInfo`
- `ledgerSummary`
- `sourceStatus`

The backend may keep raw connection settings internally, but frontend API responses must not expose PQS credentials or raw internal connection strings.

`sourceStatus` tracks per-source diagnostics for at least:

- `pqs`
- `grpc`

## Health Model

The backend computes a normalized health state:

- `healthy`: PQS is reachable and required gRPC checks succeed
- `degraded`: partial data is available, data is stale, or one source fails while useful data remains
- `down`: the node is unreachable or no usable data can be produced

The UI must present the computed health state directly rather than attempting to infer it client-side.

## Runtime Flow

1. NestJS loads and validates static endpoint configuration at startup.
2. The polling orchestrator schedules refreshes for each configured participant node.
3. For each node, the backend fetches PQS data first.
4. The backend then fetches the small set of required operational metadata via gRPC.
5. Responses are normalized and merged into a node snapshot.
6. The cache is updated independently for that node.
7. Vue fetches backend API responses on its own refresh interval and renders the latest cached state.

## Error Handling

- failures are isolated per node
- failures are isolated per source
- one broken node must not block refreshes for other nodes
- partial results are allowed and should be surfaced as degraded state
- stale but usable cache entries are acceptable if clearly labeled
- upstream timeouts and malformed payloads must be converted into structured diagnostics
- invalid configuration must fail startup with clear messages

## Testing Strategy

### Backend Unit Tests

- configuration validation
- health-state computation
- normalization of PQS responses
- normalization of gRPC responses

### Backend Integration Tests

Use mocked PQS and gRPC clients to cover:

- healthy nodes
- degraded nodes
- down nodes
- mixed multi-node states

### Frontend Tests

- component tests for dashboard status rendering
- component tests for node detail rendering
- one integration path using mocked backend responses to prove multi-node rendering

## Future Extensions

The architecture should allow future additions without breaking the frontend contract:

- authentication and authorization
- persistent history and trend views
- support for non-participant Canton roles
- richer ledger exploration
- server-push updates instead of frontend polling
- UI-managed endpoint configuration

## Initial Build Scope

The first implementation plan should cover:

- monorepo scaffolding for `backend/` and `frontend/`
- static config model
- backend polling and cache orchestration
- PQS connector for dashboard-relevant summaries
- gRPC connector for health metadata
- REST API for node list and node detail
- Vue operations dashboard
- Vue node detail page
- baseline automated tests for backend and frontend
