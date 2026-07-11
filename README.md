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
