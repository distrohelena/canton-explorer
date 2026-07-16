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

For self-signed ES256 gRPC authentication, set the environment variable named
by `privateKeyEnv` to the base64url encoding of the JSON private P-256 JWK. The
auth configuration uses `sub`, `aud`, and `privateKeyEnv`; see
`config/nodes.example.json` for the complete shape.

## Local Debug DARs

The debugger can prefer local source-mapped DARs before falling back to the
participant package service.

By default it scans:

```bash
./debug-dars
```

relative to the current working directory.

You can also set this explicitly in `nodes.local.json`:

```json
{
  "debugger": {
    "localDarDirectory": "./debug-dars"
  }
}
```

Put sibling `*-debug.dar` files in that folder. The explorer indexes them by
their main package id and uses them only for debugger source/artifact loading.

## Generate Debug DARs

The published package includes the debug-DAR generation scripts. From an
installed package, prepare debug DARs for every DAML package in a workspace:

```bash
npm --prefix ./node_modules/@distrohelena/canton-explorer \
  run dar:prepare-workspace -- \
  --workspace-root /path/to/daml-workspace \
  --output-dir /path/to/debug-dars
```

For one package, generate the source map and inject it into a sibling debug DAR:

```bash
npm --prefix ./node_modules/@distrohelena/canton-explorer \
  run dar:source-map -- \
  --input /path/to/package.dar \
  --workspace-root /path/to/daml-workspace

npm --prefix ./node_modules/@distrohelena/canton-explorer \
  run dar:debug -- \
  --input /path/to/package.dar \
  --source-map /path/to/package-source-map.json \
  --source-root /path/to/daml-project/daml=daml \
  --output /path/to/debug-dars/package-debug.dar
```

The generated debug DAR must retain the same compiled `.dalf` payloads as the
original DAR. See the repository's `docs/debug-dar.md` for source-copy rules
and source-map options.

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
