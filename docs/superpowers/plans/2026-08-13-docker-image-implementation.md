# Docker Image Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public, multi-architecture Canton Explorer image that clients deploy with Docker Compose and configure at runtime.

**Architecture:** A multi-stage root Dockerfile builds the existing packaged backend/frontend artifact and copies it with production dependencies into a Node runtime image. Compose runs only the explorer, mounting client configuration and optional debug DARs while a named volume persists the SQLite package cache.

**Tech Stack:** Docker Buildx, Docker Compose v2, Node.js 22, NestJS, Vue/Vite, Node built-in test runner.

## Global Constraints

- Publish `ghcr.io/distrohelena/canton-explorer` manually; do not add a GitHub Actions publishing workflow.
- Support `linux/amd64` and `linux/arm64`.
- Run the production process as unprivileged `node` on port `4600`.
- Keep config and secrets outside the image.
- Use `/app/config/nodes.local.json`, `/app/data/package-cache.sqlite`, and `/app/debug-dars` consistently.
- Keep Docker verification opt-in through `npm run test:docker:image` and `npm run test:docker:compose`; do not add either to `npm test`.
- Preserve static `index: false` behavior so runtime frontend base-path injection cannot be bypassed.

---

### Task 1: Create and smoke-test the production image

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `docker/test/nodes.local.json`
- Create: `scripts/docker-image.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `npm run build:package`, producing `backend/dist/src/main.js` and `backend/dist/public`.
- Produces: a non-root image that accepts read-only config at `/app/config/nodes.local.json` and serves `GET /api/branding` on port `4600`.

- [ ] **Step 1: Write the failing image smoke test**

Create `docker/test/nodes.local.json`:

```json
{
  "branding": {
    "applicationTitle": "Docker Test Explorer",
    "headerTitle": "Docker Test Explorer"
  },
  "nodes": [{
    "id": "docker-test-node",
    "label": "Docker Test Node",
    "role": "participant",
    "mode": "pqs_only",
    "pqs": { "connectionUriEnv": "TEST_PQS_URL" }
  }]
}
```

Create `scripts/docker-image.test.mjs`. The test must build `canton-explorer:test-${process.pid}`, run it with the fixture bind-mounted read-only, expose `127.0.0.1::4600`, poll `/api/branding` until it responds, assert the exact branding JSON, and assert `docker exec <container> id -u` equals `1000`. Always remove the named test container in `t.after()`.

Add:

```json
"test:docker:image": "node --test scripts/docker-image.test.mjs"
```

- [ ] **Step 2: Verify the test fails before the image exists**

Run: `npm run test:docker:image`

Expected: FAIL because Docker cannot find `Dockerfile`.

- [ ] **Step 3: Implement the multi-stage image**

Create a three-stage `Dockerfile`:

```dockerfile
ARG VERSION=dev
FROM node:22.21.1-bookworm-slim AS dependencies
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY scripts/patch-monaco-dompurify.mjs scripts/patch-monaco-dompurify.mjs
RUN npm ci --omit=dev

FROM node:22.21.1-bookworm-slim AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci
COPY backend backend
COPY frontend frontend
COPY scripts scripts
RUN npm run build:package

FROM node:22.21.1-bookworm-slim AS runtime
ARG VERSION
WORKDIR /app
LABEL org.opencontainers.image.source="https://github.com/distrohelena/canton-explorer" \
      org.opencontainers.image.title="Canton Explorer" \
      org.opencontainers.image.description="Read-only operations explorer for Canton participant nodes and PQS-backed ledgers" \
      org.opencontainers.image.version="${VERSION}"
ENV HOST=0.0.0.0 PORT=4600 \
    NODE_CONFIG_PATH=/app/config/nodes.local.json \
    PACKAGE_CACHE_DB_PATH=/app/data/package-cache.sqlite
COPY --from=dependencies --chown=node:node /workspace/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/backend/dist ./dist
RUN mkdir -p /app/config /app/data /app/debug-dars && chown -R node:node /app
USER node
EXPOSE 4600
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4600/api/branding').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "dist/src/main.js"]
```

Create `.dockerignore`:

```gitignore
.git
.worktrees
node_modules
backend/node_modules
frontend/node_modules
backend/dist
frontend/dist
backend/config/nodes.local.json
backend/.env
data
debug-dars
coverage
screenshots
```

- [ ] **Step 4: Verify the image contract**

Run: `npm run test:docker:image`

Expected: PASS; the real image returns the fixture branding and the process UID is `1000`.

- [ ] **Step 5: Commit the runtime image**

```bash
git add Dockerfile .dockerignore docker/test/nodes.local.json scripts/docker-image.test.mjs package.json
git commit -m "feat: add production Docker image"
```

### Task 2: Create and validate the client Compose deployment

**Files:**
- Create: `compose.yaml`
- Create: `docker/.env.example`
- Create: `scripts/docker-compose.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: the GHCR image and runtime mount paths from Task 1.
- Produces: a one-service, standalone client Compose project with a persistent `explorer-data` volume.

- [ ] **Step 1: Write the failing Compose validation test**

Create `scripts/docker-compose.test.mjs`. It must create a temporary client directory, copy `compose.yaml`, copy `docker/.env.example` to `.env`, copy `docker/test/nodes.local.json` to `config/nodes.local.json`, create `debug-dars/`, then run:

```js
execFileSync('docker', ['compose', '-f', 'compose.yaml', 'config', '--quiet'], {
  cwd: clientDirectory,
  stdio: 'inherit',
});
const rendered = execFileSync(
  'docker',
  ['compose', '-f', 'compose.yaml', 'config'],
  { cwd: clientDirectory, encoding: 'utf8' },
);
assert.match(rendered, /ghcr\.io\/distrohelena\/canton-explorer/);
assert.match(rendered, /explorer-data/);
```

Add:

```json
"test:docker:compose": "node --test scripts/docker-compose.test.mjs"
```

- [ ] **Step 2: Verify the test fails before Compose files exist**

Run: `npm run test:docker:compose`

Expected: FAIL because `compose.yaml` does not exist.

- [ ] **Step 3: Implement the explorer-only Compose contract**

Create `compose.yaml`:

```yaml
services:
  canton-explorer:
    image: ghcr.io/distrohelena/canton-explorer:${CANTON_EXPLORER_VERSION:-latest}
    restart: unless-stopped
    ports:
      - ${CANTON_EXPLORER_PORT:-4600}:4600
    env_file:
      - .env
    environment:
      HOST: 0.0.0.0
      PORT: "4600"
      NODE_CONFIG_PATH: /app/config/nodes.local.json
      PACKAGE_CACHE_DB_PATH: /app/data/package-cache.sqlite
    volumes:
      - ./config/nodes.local.json:/app/config/nodes.local.json:ro
      - ./debug-dars:/app/debug-dars:ro
      - explorer-data:/app/data

volumes:
  explorer-data:
```

Create `docker/.env.example` with `CANTON_EXPLORER_VERSION=latest`, `CANTON_EXPLORER_PORT=4600`, and commented instructions to define every secret variable referenced by the client's own `nodes.local.json`. Include no usable credential.

- [ ] **Step 4: Verify the Compose contract**

Run: `npm run test:docker:compose`

Expected: PASS; Docker Compose renders one explorer service with the GHCR image and named cache volume.

Run: `npm test --workspace backend`

Expected: backend tests remain green and do not run Docker tests.

- [ ] **Step 5: Commit the Compose deliverable**

```bash
git add compose.yaml docker/.env.example scripts/docker-compose.test.mjs package.json
git commit -m "feat: add client Compose deployment"
```

### Task 3: Document client deployment and manual publishing

**Files:**
- Modify: `README.md`
- Modify: `backend/README.md`

**Interfaces:**
- Consumes: the image, Compose file, examples, and test scripts from Tasks 1 and 2.
- Produces: executable client and maintainer instructions.

- [ ] **Step 1: Add client and maintainer documentation**

Add a root `## Docker` section with these client commands:

```bash
curl -O https://raw.githubusercontent.com/distrohelena/canton-explorer/main/compose.yaml
mkdir -p config debug-dars
curl -o .env https://raw.githubusercontent.com/distrohelena/canton-explorer/main/docker/.env.example
curl -o config/nodes.local.json https://raw.githubusercontent.com/distrohelena/canton-explorer/main/backend/config/nodes.example.json
# Edit .env and config/nodes.local.json with actual endpoint and credential values.
docker compose up -d
docker compose logs -f canton-explorer
```

Document `explorer-data`, the optional `debug-dars` mount, `http://localhost:4600`, and subpath proxy behavior: `frontend.basePath` must match the public prefix and `/canton-explorer/api` must forward to backend `/api`.

Add the manual release command:

```bash
docker login ghcr.io
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --build-arg VERSION=1.0.9 \
  --push \
  --tag ghcr.io/distrohelena/canton-explorer:1.0.9 \
  --tag ghcr.io/distrohelena/canton-explorer:latest \
  .
```

State that the GHCR package must be made public after its first push. In `backend/README.md`, link to the root Docker section and document the container config mount path.

- [ ] **Step 2: Run full Docker and package verification**

Run: `npm run test:docker:image && npm run test:docker:compose`

Expected: image smoke test and standalone Compose validation both pass.

Run: `npm test --workspace backend`

Expected: all backend tests pass.

Run: `npm run build:package --workspace backend`

Expected: `backend/dist/src/main.js` and `backend/dist/public/index.html` exist.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 3: Commit documentation**

```bash
git add README.md backend/README.md
git commit -m "docs: explain Docker deployment and publishing"
```

## Plan Self-Review

- Task 1 covers the multi-stage, non-root image, runtime configuration, health check, and real container smoke test.
- Task 2 covers the explorer-only Compose deployment, client config/secrets/debug-DAR/cache contract, and standalone validation.
- Task 3 covers client pull/deploy instructions, manual amd64/arm64 GHCR publishing, subpath proxy behavior, and final verification.
- Every task uses the same image name, port, and runtime paths; no automatic publishing or bundled dependencies are introduced.
