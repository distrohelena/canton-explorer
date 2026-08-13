# Canton Node Explorer

Read-only operations explorer for multiple Canton participant nodes and ledgers.

## See it in action

These captures come from the live Canton localnet and show both the explorer's
ledger views and its deeper filtering and transfer workflows.

<table>
  <tr>
    <td><img src="https://raw.githubusercontent.com/distrohelena/canton-explorer/main/screenshots/readme/custom-1440x900/updates.png" alt="Canton Explorer updates overview" /></td>
    <td><img src="https://raw.githubusercontent.com/distrohelena/canton-explorer/main/screenshots/readme/custom-1440x900/update-detail.png" alt="Canton Explorer update detail with events and exercise data" /></td>
  </tr>
  <tr>
    <td><img src="https://raw.githubusercontent.com/distrohelena/canton-explorer/main/screenshots/readme/custom-1440x900/updates--filters.png" alt="Canton Explorer updates Advanced Filter" /></td>
    <td><img src="https://raw.githubusercontent.com/distrohelena/canton-explorer/main/screenshots/readme/custom-1440x900/contracts--filters.png" alt="Canton Explorer contracts Advanced Filter with node and template controls" /></td>
  </tr>
  <tr>
    <td><img src="https://raw.githubusercontent.com/distrohelena/canton-explorer/main/screenshots/readme/custom-1440x900/traffic--filters.png" alt="Canton Explorer Traffic Purchases Advanced Search" /></td>
    <td><img src="https://raw.githubusercontent.com/distrohelena/canton-explorer/main/screenshots/readme/custom-1440x900/token-detail-transfers.png" alt="Canton Explorer Canton Coin balances and latest transfers" /></td>
  </tr>
</table>

## Publishable Package

The publishable runtime package is the backend workspace:

[npmjs.com/package/@distrohelena/canton-explorer](https://www.npmjs.com/package/@distrohelena/canton-explorer)

```bash
npx @distrohelena/canton-explorer --config ./config/nodes.local.json
```

To simulate the published package locally from this repo:

```bash
npm run pack:dry-run
```

## Local setup

1. Copy `backend/config/nodes.example.json` to `backend/config/nodes.local.json`.
2. Copy `backend/.env.example` to `backend/.env`.
3. Fill in the PQS PostgreSQL connection strings and gRPC targets for your Canton nodes. Set `nodes[].pqs.schema` when your PQS objects live outside `public`, for example `scribe`.
4. Optionally adjust `tokenMetadata.nameKeys` and `tokenMetadata.symbolKeys` in `nodes.local.json` if your token metadata uses non-default keys inside `meta.values`.
5. Install dependencies with `npm install`.

### gRPC authentication

The example uses a pre-issued static bearer token. Set the environment
variable named by `nodes[].grpc.auth.tokenEnv` to the complete token. The
token is passed unchanged to the SDK's bearer-token gRPC auth provider; keep it
in deployment secret management rather than in the node configuration.

The static-token auth block has this shape:

```json
{
  "kind": "static_token",
  "tokenEnv": "CANTON_STATIC_TOKEN"
}
```

Static tokens are opaque and do not configure a Canton user for debugger
rights lookup. The debugger therefore does not infer identity from the token.

Self-signed ES256 JWT authentication remains supported. Set the environment
variable named by `nodes[].grpc.auth.privateKeyEnv` to the base64url encoding of
the JSON private P-256 JWK. Its JWT contains the configured `sub` and `aud`
claims.

The auth block has this shape:

```json
{
  "kind": "self_signed_es256",
  "sub": "ledger-api-user",
  "aud": "https://canton.network.global",
  "privateKeyEnv": "CANTON_ES256_PRIVATE_JWK"
}
```

The existing `shared_secret_jwt` auth mode also remains supported for
deployments that use an HMAC-signed token.

### PQS schema setup

The explorer expects the `__...` PQS tables such as `__contracts`, `__transactions`, and `__packages`.

If those tables live in the default PostgreSQL schema, you can omit `schema` and it will default to `public`:

```json
{
  "id": "participant-1",
  "label": "Participant 1",
  "role": "participant",
  "mode": "pqs_only",
  "ledgerLabel": "Participant 1",
  "pqs": {
    "connectionUriEnv": "PARTICIPANT_1_PQS_URL"
  }
}
```

If the same PQS tables live in a different schema, set it explicitly per node:

```json
{
  "id": "participant-2",
  "label": "Participant 2",
  "role": "participant",
  "mode": "pqs_only",
  "ledgerLabel": "Participant 2",
  "pqs": {
    "connectionUriEnv": "PARTICIPANT_2_PQS_URL",
    "schema": "scribe"
  }
}
```

This is per-node, so mixed deployments are supported. One node can use `public` while another uses `scribe`.

Quick check in PostgreSQL:

```sql
select table_schema, table_name
from information_schema.tables
where table_name in ('__contracts', '__transactions', '__packages')
order by table_schema, table_name;
```

Use the `table_schema` value you see there as `nodes[].pqs.schema`.

## Run

```bash
npm run dev:backend
npm run dev:frontend
```

Backend: `http://localhost:4600`
Frontend: `http://localhost:46000`

## Run without dev mode

```bash
npm run start:frontend
```

This builds the frontend once and serves the built assets on `http://localhost:46000` without file watching or hot reload.

## Capture screenshots

The screenshot command uses Playwright against the live application. Install the browser once on each development machine:

```bash
npx playwright install chromium
```

Before capturing, start the frontend, backend, and the Canton localnet/PQS services that provide the records shown by the explorer. The screenshot command does not start, stop, or provision those services. From the repository root, the usual development startup is:

```bash
npm run dev:backend
npm run dev:frontend
```

The backend listens on `http://localhost:4600` and the frontend on `http://localhost:46000`. Run the two commands in separate terminals, with `backend/config/nodes.local.json`, `backend/.env`, the configured PostgreSQL services, and the Canton localnet ready first. A built frontend can be served with `npm run start:frontend`; the backend and localnet prerequisites are unchanged.

Once those services are already running, capture the default matrix with:

```bash
npm run screenshots
```

The CLI options shown by `npm run screenshots -- --help` are also available for focused captures:

```bash
# Use a one-off 1440x900 viewport. The output folder uses custom-1440x900.
npm run screenshots -- --viewport 1440x900

# Capture one route and its configured states, or one exact route/state.
npm run screenshots -- --route updates
npm run screenshots -- --route tokens-known--filters

# Choose the image/report directory.
npm run screenshots -- --output ./screenshots/readme

# Point the runner at services on another host or port.
npm run screenshots -- --base-url http://127.0.0.1:46000 --api-url http://127.0.0.1:4600/api

# Treat optional dynamic skips as failures, and show Chromium while capturing.
npm run screenshots -- --strict
npm run screenshots -- --headed
```

`--route` and `--viewport` are repeatable. `--route` accepts a route name such as `updates` or a route-state name such as `updates--filters`. `--base-url` is the frontend URL; `--api-url` may be a host-only URL or include `/api`, with trailing slashes normalized. `--output` defaults to `screenshots`. A custom ESM configuration can be supplied with `--config <path>`.

### Advanced Filter and Search states

The default matrix includes these exact optional route-state captures:

| Route-state | UI state |
| --- | --- |
| `updates--filters` | Updates `Advanced Filter` (`home-updates-advanced-filter`) |
| `contracts--filters` | Contracts `Advanced Filter` (`contracts-advanced-filter`) |
| `parties--filters` | Parties in `Namespaces` mode, then `namespace-advanced-filter` |
| `party-detail-updates--filters` | Party detail Updates `Advanced Filter` (`party-updates-advanced-filter`) |
| `party-detail-contracts--filters` | Party detail Contracts `Advanced Filter` (`party-contracts-advanced-filter`) |
| `tokens-known--filters` | Known Tokens `Advanced Filter` (`tokens-advanced-filter`) |
| `tokens-transfers--filters` | Latest Transfers `Advanced Filter` (`token-transfers-advanced-filter`) |
| `token-detail-transfers--filters` | Token detail Transfers `Advanced Filter` (`token-transfers-advanced-filter`) |
| `traffic--filters` | Traffic Purchases `Advanced Search` (`traffic-purchases-advanced-search`) |

Where live values exist, the runner fills representative party, template, token, issuer, movement, namespace, date, amount, and node fields before capturing. Missing controls, modes, or values make an optional state `skipped`; the default capture remains independent. Search Results is a separate dynamic route named `search-results` and uses a discovered party or update identifier.

### Live records and output

Dynamic route URLs are discovered immediately before the run from the live API, including nodes, updates, contracts, parties, namespace fingerprints, tokens, transfers, packages, templates, and traffic purchases. Update IDs, event offsets, contract IDs, party IDs, package IDs, token IDs, and debugger inputs therefore do not need to be edited by hand. Empty collections produce optional skipped entries with reasons. Dynamic candidates are validated after navigation, and optional skips or validation failures are recorded in `report.json`; `--strict` makes them fail the run. The manifest contains the resolved URLs and live context for diagnosis; filenames never contain live IDs and remain stable when the localnet is restarted.

The default output is organized by viewport:

```text
screenshots/
  desktop/
    updates.png
    updates--filters.png
    contracts.png
    ...
  manifest.json
  report.json
```

Custom viewports use names such as `custom-1440x900`, so their files are written under `screenshots/custom-1440x900/`. `manifest.json` records the discovered context and routes used for the run. `report.json` records the overall status and exit code, each captured/skipped/failed entry, timings, errors, and debugger-session cleanup results.

The command exits with:

- `0` when required captures succeed and optional entries are only skipped or have non-fatal validation/action failures in non-strict mode;
- `1` for frontend/API service or discovery failures, required route/state failures, optional infrastructure/browser/capture failures, or any optional dynamic/filter skip or failure when `--strict` is enabled;
- `2` for invalid CLI/configuration input or a missing Chromium installation.

### Troubleshooting

Use these checks from the repository root:

```bash
npm run screenshots -- --help
npm run test:screenshots
curl -f http://localhost:46000/
curl -f 'http://localhost:4600/api/nodes?limit=1'
```

If the frontend or API is unreachable, restart the relevant service with `npm run dev:frontend` or `npm run dev:backend`, then verify that the configured Canton localnet, PQS database, gRPC targets, and `nodes.local.json` are available. For non-default ports or hosts, pass matching `--base-url` and `--api-url` values. If Chromium is missing, run `npx playwright install chromium` once and retry. If dynamic pages are skipped, inspect `manifest.json` and `report.json`; use `--strict` when a missing live record should fail the run.

To embed an intentionally committed capture in this README, use a stable route/state path relative to the repository root:

```markdown
![Updates](https://raw.githubusercontent.com/distrohelena/canton-explorer/main/screenshots/readme/custom-1440x900/updates.png)
![Updates with filters](https://raw.githubusercontent.com/distrohelena/canton-explorer/main/screenshots/readme/custom-1440x900/updates--filters.png)
```

Commit only the PNGs you want to publish. Keep `manifest.json` and `report.json` for local diagnostics unless they are useful as documentation.

## Generate debug DARs

The debugger can show DAML source and source locations when it has a companion
`*-debug.dar` for the package being replayed. Generate these from a built DAML
workspace and write them into the explorer's local `debug-dars/` directory:

```bash
npm run dar:prepare-workspace --workspace backend -- \
  --workspace-root /path/to/daml-workspace \
  --output-dir ./debug-dars
```

The command scans `**/.daml/dist/*.dar`, skips existing `*-debug.dar` files,
and creates matching debug DARs with the original compiled payload, source map,
and DAML source files. Ensure the backend is configured to load that directory:

```json
{
  "debugger": {
    "localDarDirectory": "./debug-dars"
  }
}
```

The default is already `./debug-dars`, relative to the backend's working
directory. For generating one DAR or customizing source-map inputs, see
[Debug DARs](docs/debug-dar.md).

## Test

```bash
npm test
```
