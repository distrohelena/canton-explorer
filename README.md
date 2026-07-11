# Canton Node Explorer

Read-only operations explorer for multiple Canton participant nodes and ledgers.

## Publishable Package

The publishable runtime package is the backend workspace:

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

## Test

```bash
npm test
```
