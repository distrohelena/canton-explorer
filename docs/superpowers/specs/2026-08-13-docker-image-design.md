# Docker Image Distribution Design

## Goal

Publish Canton Explorer as a public, multi-architecture Docker image that
clients run with Docker Compose while supplying their own Canton/PQS endpoints,
node configuration, and credentials.

## Distribution

- Image registry: GitHub Container Registry.
- Image name: `ghcr.io/distrohelena/canton-explorer`.
- Supported platforms: `linux/amd64` and `linux/arm64`.
- Publishing is manual. Maintainers authenticate with `docker login ghcr.io`
  and publish immutable release tags plus an updated `latest` tag with Docker
  Buildx.
- No GitHub Actions publishing workflow is part of this work.

## Image Architecture

The repository-root Dockerfile uses a multi-stage build:

1. A Node.js build stage installs the locked workspace dependencies and runs
   `npm run build:package`. That existing command builds the Vue frontend,
   builds the Nest backend, and copies the frontend assets into
   `backend/dist/public`.
2. The runtime stage contains only the compiled backend, compiled frontend,
   and production Node.js dependencies. It starts
   `node dist/src/main.js` from `/app` as the unprivileged `node` user.

The image exposes TCP port `4600` and defines a health check against
`GET /api/branding`. This endpoint is available without contacting configured
Canton or PQS services, while still proving the application has loaded its
configuration and begun serving HTTP.

The runtime environment is fixed as follows:

- `HOST=0.0.0.0`
- `PORT=4600`
- `NODE_CONFIG_PATH=/app/config/nodes.local.json`
- `PACKAGE_CACHE_DB_PATH=/app/data/package-cache.sqlite`

The application must retain its current runtime frontend-base injection. Static
middleware must not serve `index.html` directly, because a reverse proxy that
strips a configured deployment prefix would otherwise bypass the injected
`<base>` element.

## Client Compose Contract

The repository supplies a Compose example for an explorer-only deployment. It
does not run Canton, PostgreSQL, or any other dependency.

Clients copy the example and provide these adjacent files/directories:

- `config/nodes.local.json`: mounted read-only at
  `/app/config/nodes.local.json`.
- `.env`: loaded with Compose `env_file`; it holds connection strings and
  secrets named by `nodes.local.json`, such as PQS connection URI variables or
  gRPC credentials.
- `debug-dars/` (optional): mounted read-only at `/app/debug-dars` when the
  debugger should use locally generated debug DARs.

A named `explorer-data` volume mounts at `/app/data` to preserve the SQLite
package cache between container recreation. The Compose service publishes
`4600:4600` and uses an explicit image version; users can override the version
through `CANTON_EXPLORER_VERSION`, whose default is `latest`.

For a reverse-proxy deployment below a path such as `/canton-explorer/`, the
client sets `frontend.basePath` to `/canton-explorer/` in
`nodes.local.json`. The proxy must forward requests from
`/canton-explorer/api` to the backend API path `/api` and strip the same prefix
when forwarding frontend routes.

## Repository Deliverables

- Repository-root `Dockerfile`.
- Repository-root `.dockerignore` that excludes Git state, local configuration,
  dependencies, build outputs, cache data, debug DARs, and unrelated local
  artifacts from the build context.
- A client Compose example plus a matching environment-file example.
- README documentation for pulling/running the image and manually building and
  publishing a multi-architecture release to GHCR.
- Automated tests or build validation that cover the container build and the
  client Compose configuration without requiring live Canton or PQS services.

## Non-Goals

- Automated container publication from GitHub Actions.
- Bundling Canton participants, PQS PostgreSQL databases, or reverse proxies.
- Embedding client connection strings, auth tokens, private keys, or node
  configuration into the image.
- Replacing the existing npm package distribution channel.
