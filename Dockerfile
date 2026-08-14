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
COPY scripts/patch-monaco-dompurify.mjs scripts/patch-monaco-dompurify.mjs
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
ENTRYPOINT ["node", "dist/src/cli.js"]
CMD ["serve"]
