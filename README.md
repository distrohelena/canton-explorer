# Canton Node Explorer

Read-only operations explorer for multiple Canton participant nodes and ledgers.

## Local setup

1. Copy `backend/config/nodes.example.json` to `backend/config/nodes.local.json`.
2. Copy `backend/.env.example` to `backend/.env`.
3. Fill in the PQS PostgreSQL connection strings and gRPC targets for your Canton nodes.
4. Install dependencies with `npm install`.

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
