# Canton Explorer

Read-only operations explorer for Canton participant nodes and PQS-backed ledgers.

This package runs a Nest backend and serves the built frontend from the same process.

## Run From NPM

```bash
npx @distrohelena/canton-explorer --config ./config/nodes.local.json
```

By default the explorer binds to `0.0.0.0:4600`.

## CLI Options

```bash
canton-explorer --config ./config/nodes.local.json --port 4600 --host 0.0.0.0
```

- `--config` points to the node config JSON file
- `--port` overrides the HTTP port
- `--host` overrides the bind host

You can also use environment variables:

```bash
PORT=4600
HOST=0.0.0.0
NODE_CONFIG_PATH=./config/nodes.local.json
```

## Config

Create `./config/nodes.local.json` in the directory where you run the command. Use
`config/nodes.example.json` from this package as the starting point.

The explorer also expects the PQS PostgreSQL connection strings referenced by
`connectionUriEnv` to be available in the environment.

## Local Development

From the repo root:

```bash
npm install
npm run dev:backend
npm run dev:frontend
```

Backend: `http://localhost:4600`
Frontend: `http://localhost:46000`

## Build The Publishable Package Locally

From the repo root:

```bash
npm run pack:dry-run
```

That builds the packaged frontend with `/api` as the API base, copies the frontend assets
into the backend dist output, and performs an npm pack dry run for the publishable package.
