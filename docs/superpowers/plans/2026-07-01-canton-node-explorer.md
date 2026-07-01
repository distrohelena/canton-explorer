# Canton Node Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only Canton node explorer monorepo with a NestJS backend that polls PQS PostgreSQL databases and gRPC endpoints, plus a Vue frontend that shows multi-node health and ledger summaries.

**Architecture:** The backend owns static node configuration, PQS SQL access, gRPC operational checks, in-memory caching, and REST APIs. The frontend reads only those APIs and renders an operations dashboard plus per-node detail pages for multiple participant nodes and ledgers.

**Tech Stack:** Git, npm workspaces, TypeScript, NestJS, PostgreSQL (`pg`), gRPC (`@grpc/grpc-js` and `@grpc/proto-loader`), Vue 3, Vite, Vue Router, Jest, Supertest, Vitest, Testing Library

---

## File Structure

### Root

- Create: `package.json`
- Create: `.gitignore`
- Create: `.editorconfig`
- Create: `tsconfig.base.json`
- Create: `README.md`

### Backend

- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/tsconfig.build.json`
- Create: `backend/nest-cli.json`
- Create: `backend/src/main.ts`
- Create: `backend/src/app.module.ts`
- Create: `backend/src/config/node-config.schema.ts`
- Create: `backend/src/config/node-config.service.ts`
- Create: `backend/src/domain/node.types.ts`
- Create: `backend/src/domain/node-health.ts`
- Create: `backend/src/pqs/pqs-client.factory.ts`
- Create: `backend/src/pqs/pqs-summary.service.ts`
- Create: `backend/src/grpc/grpc-client.factory.ts`
- Create: `backend/src/grpc/grpc-operations.service.ts`
- Create: `backend/src/cache/node-cache.service.ts`
- Create: `backend/src/orchestrator/node-poller.service.ts`
- Create: `backend/src/api/nodes.controller.ts`
- Create: `backend/config/nodes.example.json`
- Create: `backend/.env.example`
- Create: `backend/proto/grpc/health/v1/health.proto`
- Test: `backend/test/config/node-config.spec.ts`
- Test: `backend/test/domain/node-health.spec.ts`
- Test: `backend/test/pqs/pqs-summary.service.spec.ts`
- Test: `backend/test/grpc/grpc-operations.service.spec.ts`
- Test: `backend/test/api/nodes.e2e-spec.ts`

### Frontend

- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.app.json`
- Create: `frontend/tsconfig.node.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/src/main.ts`
- Create: `frontend/src/App.vue`
- Create: `frontend/src/router.ts`
- Create: `frontend/src/styles.css`
- Create: `frontend/src/types/nodes.ts`
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/composables/useNodes.ts`
- Create: `frontend/src/components/NodeStatusCard.vue`
- Create: `frontend/src/views/OperationsDashboardView.vue`
- Create: `frontend/src/views/NodeDetailView.vue`
- Test: `frontend/src/lib/api.test.ts`
- Test: `frontend/src/views/OperationsDashboardView.test.ts`
- Test: `frontend/src/views/NodeDetailView.test.ts`
- Test: `frontend/src/test/setup.ts`

## Task 1: Initialize the Repository and Workspace

**Files:**
- Create: `.gitignore`
- Create: `.editorconfig`
- Create: `package.json`
- Create: `tsconfig.base.json`

- [ ] **Step 1: Initialize git and npm at the repo root**

Run:

```bash
git init
npm init -y
```

Expected:

```text
Initialized empty Git repository in .../canton-explorer/.git/
Wrote to .../canton-explorer/package.json
```

- [ ] **Step 2: Replace the root workspace files with the monorepo baseline**

Write `package.json`:

```json
{
  "name": "canton-node-explorer",
  "private": true,
  "version": "0.1.0",
  "workspaces": [
    "backend",
    "frontend"
  ],
  "scripts": {
    "build": "npm run build --workspace backend && npm run build --workspace frontend",
    "test": "npm run test --workspace backend && npm run test --workspace frontend",
    "lint": "npm run lint --workspace backend && npm run lint --workspace frontend"
  }
}
```

Write `.gitignore`:

```gitignore
node_modules/
dist/
coverage/
.env
.env.local
.DS_Store
backend/config/nodes.local.json
frontend/.env.local
```

Write `.editorconfig`:

```ini
root = true

[*.{ts,js,json,md,vue}]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
```

Write `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Node",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  }
}
```

- [ ] **Step 3: Commit the workspace baseline**

Run:

```bash
git add .gitignore .editorconfig package.json tsconfig.base.json
git commit -m "chore: initialize monorepo workspace"
```

Expected:

```text
[main (root-commit) ...] chore: initialize monorepo workspace
 4 files changed, ...
```

## Task 2: Scaffold NestJS and Vue Applications

**Files:**
- Create: `backend/*`
- Create: `frontend/*`
- Modify: `package.json`
- Modify: `frontend/package.json`

- [ ] **Step 1: Generate the backend and frontend apps**

Run:

```bash
npx @nestjs/cli new backend --package-manager npm --skip-git --strict
npm create vite@latest frontend -- --template vue-ts
```

Expected:

```text
CREATE backend/package.json ...
Scaffolding project in .../frontend...
Done. Now run:
  cd frontend
  npm install
```

- [ ] **Step 2: Install the libraries needed for v1**

Run:

```bash
npm install --workspace backend @nestjs/config dotenv pg zod @grpc/grpc-js @grpc/proto-loader
npm install --workspace backend --save-dev supertest
npm install --workspace frontend vue-router
npm install --workspace frontend --save-dev vitest @vitest/coverage-v8 @testing-library/vue @testing-library/jest-dom happy-dom
```

Expected:

```text
added ... packages
```

- [ ] **Step 3: Normalize the root scripts now that the workspaces exist**

Update `package.json`:

```json
{
  "name": "canton-node-explorer",
  "private": true,
  "version": "0.1.0",
  "workspaces": [
    "backend",
    "frontend"
  ],
  "scripts": {
    "build": "npm run build --workspace backend && npm run build --workspace frontend",
    "test": "npm run test --workspace backend && npm run test --workspace frontend",
    "lint": "npm run lint --workspace backend && npm run lint --workspace frontend",
    "dev:backend": "npm run start:dev --workspace backend",
    "dev:frontend": "npm run dev --workspace frontend"
  }
}
```

Update `frontend/package.json`:

```json
{
  "name": "frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest"
  }
}
```

- [ ] **Step 4: Verify the generated applications boot and build before feature work**

Run:

```bash
npm run build --workspace backend
npm run build --workspace frontend
```

Expected:

```text
webpack ... compiled successfully
vite v... building for production...
✓ built in ...
```

- [ ] **Step 5: Commit the generated applications**

Run:

```bash
git add package.json backend frontend
git commit -m "chore: scaffold backend and frontend apps"
```

## Task 3: Add Backend Config Loading and Health-State Modeling

**Files:**
- Create: `backend/src/config/node-config.schema.ts`
- Create: `backend/src/config/node-config.service.ts`
- Create: `backend/src/domain/node.types.ts`
- Create: `backend/src/domain/node-health.ts`
- Test: `backend/test/config/node-config.spec.ts`
- Test: `backend/test/domain/node-health.spec.ts`

- [ ] **Step 1: Write the failing unit tests for config validation and health-state computation**

Write `backend/test/config/node-config.spec.ts`:

```ts
import { describe, expect, it } from '@jest/globals';
import { parseNodeConfigFile } from '../../src/config/node-config.schema';

describe('parseNodeConfigFile', () => {
  it('parses a valid participant-node config', () => {
    const result = parseNodeConfigFile({
      nodes: [
        {
          id: 'participant-1',
          label: 'Participant 1',
          role: 'participant',
          ledgerLabel: 'Retail Ledger',
          pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
          grpc: { target: 'localhost:5012', useTls: false, connectTimeoutMs: 5000 },
          polling: { intervalMs: 15000, staleAfterMs: 45000 }
        }
      ]
    });

    expect(result.nodes[0].id).toBe('participant-1');
    expect(result.nodes[0].pqs.connectionUriEnv).toBe('PARTICIPANT_1_PQS_URL');
  });

  it('rejects a config with no node id', () => {
    expect(() =>
      parseNodeConfigFile({
        nodes: [
          {
            id: '',
            label: 'Broken',
            role: 'participant',
            pqs: { connectionUriEnv: 'BROKEN_URL' }
          }
        ]
      }),
    ).toThrow(/id/i);
  });
});
```

Write `backend/test/domain/node-health.spec.ts`:

```ts
import { describe, expect, it } from '@jest/globals';
import { computeNodeStatus } from '../../src/domain/node-health';

describe('computeNodeStatus', () => {
  it('returns healthy when PQS and gRPC are both usable', () => {
    expect(
      computeNodeStatus({
        pqsOk: true,
        grpcRequired: true,
        grpcOk: true,
        isStale: false,
        hasUsableSnapshot: true
      }),
    ).toBe('healthy');
  });

  it('returns degraded when snapshot is stale but still usable', () => {
    expect(
      computeNodeStatus({
        pqsOk: true,
        grpcRequired: false,
        grpcOk: false,
        isStale: true,
        hasUsableSnapshot: true
      }),
    ).toBe('degraded');
  });

  it('returns down when PQS is unavailable and nothing usable remains', () => {
    expect(
      computeNodeStatus({
        pqsOk: false,
        grpcRequired: true,
        grpcOk: false,
        isStale: true,
        hasUsableSnapshot: false
      }),
    ).toBe('down');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npm test --workspace backend -- --runTestsByPath test/config/node-config.spec.ts test/domain/node-health.spec.ts
```

Expected:

```text
Cannot find module '../../src/config/node-config.schema'
Cannot find module '../../src/domain/node-health'
```

- [ ] **Step 3: Implement config parsing and status computation**

Write `backend/src/domain/node.types.ts`:

```ts
export type NodeRole = 'participant';
export type NodeStatus = 'healthy' | 'degraded' | 'down';

export interface SourceStatus {
  ok: boolean;
  checkedAt: string;
  latencyMs: number | null;
  message: string | null;
}

export interface LedgerSummary {
  ledgerLabel: string;
  pqsDatabase: string;
  activeContractCount: number;
  latestOffset: string | null;
  latestEventAt: string | null;
}

export interface ServiceInfo {
  target: string | null;
  reachable: boolean;
  healthCheckImplemented: boolean;
  servingStatus: string | null;
}
```

Write `backend/src/domain/node-health.ts`:

```ts
import type { NodeStatus } from './node.types';

export interface ComputeNodeStatusArgs {
  pqsOk: boolean;
  grpcRequired: boolean;
  grpcOk: boolean;
  isStale: boolean;
  hasUsableSnapshot: boolean;
}

export function computeNodeStatus(args: ComputeNodeStatusArgs): NodeStatus {
  if (!args.pqsOk && !args.hasUsableSnapshot) {
    return 'down';
  }

  if (args.isStale) {
    return 'degraded';
  }

  if (args.grpcRequired && !args.grpcOk) {
    return 'degraded';
  }

  return args.pqsOk ? 'healthy' : 'degraded';
}
```

Write `backend/src/config/node-config.schema.ts`:

```ts
import { z } from 'zod';

const nodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  role: z.literal('participant'),
  ledgerLabel: z.string().min(1).optional(),
  pqs: z.object({
    connectionUriEnv: z.string().min(1),
  }),
  grpc: z
    .object({
      target: z.string().min(1),
      useTls: z.boolean().default(false),
      connectTimeoutMs: z.number().int().positive().default(5000),
    })
    .optional(),
  polling: z
    .object({
      intervalMs: z.number().int().positive().default(15000),
      staleAfterMs: z.number().int().positive().default(45000),
    })
    .optional(),
});

const configSchema = z.object({
  nodes: z.array(nodeSchema).min(1),
});

export type NodeConfigFile = z.infer<typeof configSchema>;
export type NodeConfig = z.infer<typeof nodeSchema>;

export function parseNodeConfigFile(input: unknown): NodeConfigFile {
  return configSchema.parse(input);
}
```

Write `backend/src/config/node-config.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NodeConfig, parseNodeConfigFile } from './node-config.schema';

@Injectable()
export class NodeConfigService {
  private readonly nodes: NodeConfig[];

  constructor() {
    const configPath =
      process.env.NODE_CONFIG_PATH ?? resolve(process.cwd(), 'config', 'nodes.local.json');
    const fileContents = readFileSync(configPath, 'utf8');
    const parsed = parseNodeConfigFile(JSON.parse(fileContents));
    this.nodes = parsed.nodes;
  }

  list(): NodeConfig[] {
    return this.nodes;
  }
}
```

- [ ] **Step 4: Run the backend tests and verify they pass**

Run:

```bash
npm test --workspace backend -- --runTestsByPath test/config/node-config.spec.ts test/domain/node-health.spec.ts
```

Expected:

```text
PASS test/config/node-config.spec.ts
PASS test/domain/node-health.spec.ts
```

- [ ] **Step 5: Commit the backend config and health model**

Run:

```bash
git add backend/src/config backend/src/domain backend/test/config backend/test/domain
git commit -m "feat: add backend config parsing and health modeling"
```

## Task 4: Add the PQS SQL Summary Connector

**Files:**
- Create: `backend/src/pqs/pqs-client.factory.ts`
- Create: `backend/src/pqs/pqs-summary.service.ts`
- Test: `backend/test/pqs/pqs-summary.service.spec.ts`

- [ ] **Step 1: Write the failing unit test for the PQS summary query**

Write `backend/test/pqs/pqs-summary.service.spec.ts`:

```ts
import { describe, expect, it, jest } from '@jest/globals';
import { PqsSummaryService } from '../../src/pqs/pqs-summary.service';

describe('PqsSummaryService', () => {
  it('returns a normalized ledger summary from the active() query', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          pqs_database: 'participant1_pqs',
          active_contract_count: '12',
          latest_offset: '000000000000123456',
          latest_event_at: '2026-07-01T12:00:00.000Z'
        }
      ]
    });

    const service = new PqsSummaryService({
      getClient: () => ({ query })
    } as never);

    const summary = await service.fetchSummary({
      id: 'participant-1',
      label: 'Participant 1',
      role: 'participant',
      ledgerLabel: 'Retail Ledger',
      pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' }
    });

    expect(query).toHaveBeenCalledWith(expect.stringContaining('from active()'));
    expect(summary.activeContractCount).toBe(12);
    expect(summary.ledgerLabel).toBe('Retail Ledger');
  });
});
```

- [ ] **Step 2: Run the PQS unit test to verify it fails**

Run:

```bash
npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts
```

Expected:

```text
Cannot find module '../../src/pqs/pqs-summary.service'
```

- [ ] **Step 3: Implement the PQS client factory and summary query**

Write `backend/src/pqs/pqs-client.factory.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import type { NodeConfig } from '../config/node-config.schema';

@Injectable()
export class PqsClientFactory {
  private readonly clients = new Map<string, Pool>();

  getClient(node: NodeConfig): Pool {
    const existing = this.clients.get(node.id);
    if (existing) {
      return existing;
    }

    const connectionString = process.env[node.pqs.connectionUriEnv];
    if (!connectionString) {
      throw new Error(`Missing PQS connection string env var: ${node.pqs.connectionUriEnv}`);
    }

    const client = new Pool({ connectionString });
    this.clients.set(node.id, client);
    return client;
  }
}
```

Write `backend/src/pqs/pqs-summary.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type { NodeConfig } from '../config/node-config.schema';
import type { LedgerSummary } from '../domain/node.types';
import { PqsClientFactory } from './pqs-client.factory';

@Injectable()
export class PqsSummaryService {
  constructor(private readonly clientFactory: PqsClientFactory) {}

  async fetchSummary(node: NodeConfig): Promise<LedgerSummary> {
    const client = this.clientFactory.getClient(node);
    const result = await client.query(`
      select
        current_database() as pqs_database,
        count(*)::int as active_contract_count,
        max(created_at_offset) as latest_offset,
        max(created_effective_at)::text as latest_event_at
      from active()
    `);

    const row = result.rows[0] ?? {
      pqs_database: 'unknown',
      active_contract_count: 0,
      latest_offset: null,
      latest_event_at: null,
    };

    return {
      ledgerLabel: node.ledgerLabel ?? node.label,
      pqsDatabase: row.pqs_database,
      activeContractCount: Number(row.active_contract_count ?? 0),
      latestOffset: row.latest_offset ?? null,
      latestEventAt: row.latest_event_at ?? null,
    };
  }
}
```

- [ ] **Step 4: Run the PQS unit test and verify it passes**

Run:

```bash
npm test --workspace backend -- --runTestsByPath test/pqs/pqs-summary.service.spec.ts
```

Expected:

```text
PASS test/pqs/pqs-summary.service.spec.ts
```

- [ ] **Step 5: Commit the PQS connector**

Run:

```bash
git add backend/src/pqs backend/test/pqs
git commit -m "feat: add pqs ledger summary connector"
```

## Task 5: Add the gRPC Operational Metadata Connector

**Files:**
- Create: `backend/proto/grpc/health/v1/health.proto`
- Create: `backend/src/grpc/grpc-client.factory.ts`
- Create: `backend/src/grpc/grpc-operations.service.ts`
- Test: `backend/test/grpc/grpc-operations.service.spec.ts`

- [ ] **Step 1: Write the failing unit test for gRPC operational checks**

Write `backend/test/grpc/grpc-operations.service.spec.ts`:

```ts
import { describe, expect, it, jest } from '@jest/globals';
import { GrpcOperationsService } from '../../src/grpc/grpc-operations.service';

describe('GrpcOperationsService', () => {
  it('returns reachability metadata when the channel becomes ready', async () => {
    const service = new GrpcOperationsService({
      create: () => ({
        waitForReady: (_deadline: number, callback: (error: Error | null) => void) => callback(null),
        Check: (_request: { service: string }, callback: (_error: null, response: { status: string }) => void) =>
          callback(null, { status: 'SERVING' })
      })
    } as never);

    const result = await service.fetchOperationalInfo({
      id: 'participant-1',
      label: 'Participant 1',
      role: 'participant',
      pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
      grpc: { target: 'localhost:5012', useTls: false, connectTimeoutMs: 5000 }
    });

    expect(result.reachable).toBe(true);
    expect(result.healthCheckImplemented).toBe(true);
    expect(result.servingStatus).toBe('SERVING');
  });
});
```

- [ ] **Step 2: Run the gRPC unit test to verify it fails**

Run:

```bash
npm test --workspace backend -- --runTestsByPath test/grpc/grpc-operations.service.spec.ts
```

Expected:

```text
Cannot find module '../../src/grpc/grpc-operations.service'
```

- [ ] **Step 3: Implement the proto, client factory, and operational service**

Write `backend/proto/grpc/health/v1/health.proto`:

```proto
syntax = "proto3";

package grpc.health.v1;

service Health {
  rpc Check(HealthCheckRequest) returns (HealthCheckResponse);
}

message HealthCheckRequest {
  string service = 1;
}

message HealthCheckResponse {
  enum ServingStatus {
    UNKNOWN = 0;
    SERVING = 1;
    NOT_SERVING = 2;
    SERVICE_UNKNOWN = 3;
  }

  ServingStatus status = 1;
}
```

Write `backend/src/grpc/grpc-client.factory.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { credentials, loadPackageDefinition } from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import { join } from 'node:path';
import type { NodeConfig } from '../config/node-config.schema';

@Injectable()
export class GrpcClientFactory {
  create(node: NodeConfig) {
    if (!node.grpc) {
      throw new Error(`Node ${node.id} does not define grpc settings`);
    }

    const packageDefinition = loadSync(
      join(process.cwd(), 'proto', 'grpc', 'health', 'v1', 'health.proto'),
      { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true },
    );

    const loaded = loadPackageDefinition(packageDefinition) as {
      grpc: { health: { v1: { Health: new (...args: unknown[]) => any } } };
    };

    const Client = loaded.grpc.health.v1.Health;
    const channelCredentials = node.grpc.useTls ? credentials.createSsl() : credentials.createInsecure();
    return new Client(node.grpc.target, channelCredentials);
  }
}
```

Write `backend/src/grpc/grpc-operations.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type { NodeConfig } from '../config/node-config.schema';
import type { ServiceInfo } from '../domain/node.types';
import { GrpcClientFactory } from './grpc-client.factory';

@Injectable()
export class GrpcOperationsService {
  constructor(private readonly clientFactory: GrpcClientFactory) {}

  async fetchOperationalInfo(node: NodeConfig): Promise<ServiceInfo> {
    if (!node.grpc) {
      return {
        target: null,
        reachable: false,
        healthCheckImplemented: false,
        servingStatus: null,
      };
    }

    const client = this.clientFactory.create(node);
    const deadline = Date.now() + node.grpc.connectTimeoutMs;

    await new Promise<void>((resolve, reject) => {
      client.waitForReady(deadline, (error: Error | null) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const servingStatus = await new Promise<string | null>((resolve) => {
      client.Check({ service: '' }, (error: { code?: number } | null, response?: { status?: string }) => {
        if (error) {
          resolve(null);
          return;
        }
        resolve(response?.status ?? null);
      });
    });

    return {
      target: node.grpc.target,
      reachable: true,
      healthCheckImplemented: servingStatus !== null,
      servingStatus,
    };
  }
}
```

- [ ] **Step 4: Run the gRPC unit test and verify it passes**

Run:

```bash
npm test --workspace backend -- --runTestsByPath test/grpc/grpc-operations.service.spec.ts
```

Expected:

```text
PASS test/grpc/grpc-operations.service.spec.ts
```

- [ ] **Step 5: Commit the gRPC connector**

Run:

```bash
git add backend/proto backend/src/grpc backend/test/grpc
git commit -m "feat: add grpc operational metadata connector"
```

## Task 6: Add Cache, Polling, and the Backend REST API

**Files:**
- Create: `backend/src/cache/node-cache.service.ts`
- Create: `backend/src/orchestrator/node-poller.service.ts`
- Create: `backend/src/api/nodes.controller.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/main.ts`
- Test: `backend/test/api/nodes.e2e-spec.ts`

- [ ] **Step 1: Write the failing backend integration test for multi-node API responses**

Write `backend/test/api/nodes.e2e-spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { NodeCacheService } from '../../src/cache/node-cache.service';
import { NodeConfigService } from '../../src/config/node-config.service';

describe('Nodes API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(NodeConfigService)
      .useValue({ list: () => [] })
      .compile();

    app = moduleRef.createNestApplication();
    const cache = app.get(NodeCacheService);
    cache.upsert({
      id: 'participant-1',
      label: 'Participant 1',
      role: 'participant',
      ledgerLabel: 'Retail Ledger',
      status: 'healthy',
      latencyMs: 21,
      lastSuccessAt: '2026-07-01T12:00:00.000Z',
      lastErrorAt: null,
      errorSummary: null,
      serviceInfo: {
        target: 'localhost:5012',
        reachable: true,
        healthCheckImplemented: true,
        servingStatus: 'SERVING'
      },
      ledgerSummary: {
        ledgerLabel: 'Retail Ledger',
        pqsDatabase: 'participant1_pqs',
        activeContractCount: 12,
        latestOffset: '000000000000123456',
        latestEventAt: '2026-07-01T11:59:00.000Z'
      },
      sourceStatus: {
        pqs: { ok: true, checkedAt: '2026-07-01T12:00:00.000Z', latencyMs: 11, message: null },
        grpc: { ok: true, checkedAt: '2026-07-01T12:00:00.000Z', latencyMs: 10, message: null }
      }
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns node summaries', async () => {
    const response = await request(app.getHttpServer()).get('/api/nodes').expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe('participant-1');
  });

  it('returns aggregated ledgers', async () => {
    const response = await request(app.getHttpServer()).get('/api/ledgers').expect(200);

    expect(response.body[0].ledgerLabel).toBe('Retail Ledger');
  });
});
```

- [ ] **Step 2: Run the backend integration test and verify it fails**

Run:

```bash
npm test --workspace backend -- --runTestsByPath test/api/nodes.e2e-spec.ts
```

Expected:

```text
Nest can't resolve dependencies of the NodeCacheService ...
```

- [ ] **Step 3: Implement the cache, poller, API controller, and application wiring**

Write `backend/src/cache/node-cache.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type { LedgerSummary, NodeRole, NodeStatus, ServiceInfo, SourceStatus } from '../domain/node.types';

export interface NodeSnapshot {
  id: string;
  label: string;
  role: NodeRole;
  ledgerLabel: string;
  status: NodeStatus;
  latencyMs: number | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  errorSummary: string | null;
  serviceInfo: ServiceInfo;
  ledgerSummary: LedgerSummary;
  sourceStatus: Record<'pqs' | 'grpc', SourceStatus>;
}

@Injectable()
export class NodeCacheService {
  private readonly snapshots = new Map<string, NodeSnapshot>();

  upsert(snapshot: NodeSnapshot): void {
    this.snapshots.set(snapshot.id, snapshot);
  }

  list(): NodeSnapshot[] {
    return [...this.snapshots.values()].sort((left, right) => left.label.localeCompare(right.label));
  }

  get(id: string): NodeSnapshot | undefined {
    return this.snapshots.get(id);
  }
}
```

Write `backend/src/orchestrator/node-poller.service.ts`:

```ts
import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { NodeConfigService } from '../config/node-config.service';
import { computeNodeStatus } from '../domain/node-health';
import { NodeCacheService } from '../cache/node-cache.service';
import { PqsSummaryService } from '../pqs/pqs-summary.service';
import { GrpcOperationsService } from '../grpc/grpc-operations.service';
import type { NodeConfig } from '../config/node-config.schema';

@Injectable()
export class NodePollerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(NodePollerService.name);
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly configService: NodeConfigService,
    private readonly cacheService: NodeCacheService,
    private readonly pqsSummaryService: PqsSummaryService,
    private readonly grpcOperationsService: GrpcOperationsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    for (const node of this.configService.list()) {
      await this.refreshNode(node);
      const intervalMs = node.polling?.intervalMs ?? 15000;
      this.timers.set(node.id, setInterval(() => void this.refreshNode(node), intervalMs));
    }
  }

  onApplicationShutdown(): void {
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();
  }

  private async refreshNode(node: NodeConfig): Promise<void> {
    const previous = this.cacheService.get(node.id);
    const timestamp = new Date().toISOString();

    try {
      const startedAt = Date.now();
      const ledgerSummary = await this.pqsSummaryService.fetchSummary(node);
      const serviceInfo = await this.grpcOperationsService.fetchOperationalInfo(node);
      const latencyMs = Date.now() - startedAt;

      this.cacheService.upsert({
        id: node.id,
        label: node.label,
        role: node.role,
        ledgerLabel: node.ledgerLabel ?? node.label,
        status: computeNodeStatus({
          pqsOk: true,
          grpcRequired: Boolean(node.grpc),
          grpcOk: node.grpc ? serviceInfo.reachable : true,
          isStale: false,
          hasUsableSnapshot: true,
        }),
        latencyMs,
        lastSuccessAt: timestamp,
        lastErrorAt: null,
        errorSummary: null,
        serviceInfo,
        ledgerSummary,
        sourceStatus: {
          pqs: { ok: true, checkedAt: timestamp, latencyMs, message: null },
          grpc: {
            ok: node.grpc ? serviceInfo.reachable : true,
            checkedAt: timestamp,
            latencyMs,
            message: node.grpc && !serviceInfo.reachable ? 'gRPC unreachable' : null,
          },
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown refresh failure';
      this.logger.error(`Failed to refresh ${node.id}: ${message}`);

      if (previous) {
        this.cacheService.upsert({
          ...previous,
          status: computeNodeStatus({
            pqsOk: false,
            grpcRequired: Boolean(node.grpc),
            grpcOk: previous.sourceStatus.grpc.ok,
            isStale: true,
            hasUsableSnapshot: true,
          }),
          lastErrorAt: timestamp,
          errorSummary: message,
          sourceStatus: {
            ...previous.sourceStatus,
            pqs: {
              ok: false,
              checkedAt: timestamp,
              latencyMs: previous.sourceStatus.pqs.latencyMs,
              message,
            },
          },
        });
        return;
      }

      this.cacheService.upsert({
        id: node.id,
        label: node.label,
        role: node.role,
        ledgerLabel: node.ledgerLabel ?? node.label,
        status: 'down',
        latencyMs: null,
        lastSuccessAt: null,
        lastErrorAt: timestamp,
        errorSummary: message,
        serviceInfo: {
          target: node.grpc?.target ?? null,
          reachable: false,
          healthCheckImplemented: false,
          servingStatus: null,
        },
        ledgerSummary: {
          ledgerLabel: node.ledgerLabel ?? node.label,
          pqsDatabase: 'unavailable',
          activeContractCount: 0,
          latestOffset: null,
          latestEventAt: null,
        },
        sourceStatus: {
          pqs: { ok: false, checkedAt: timestamp, latencyMs: null, message },
          grpc: {
            ok: false,
            checkedAt: timestamp,
            latencyMs: null,
            message: node.grpc ? message : 'gRPC not configured',
          },
        },
      });
    }
  }
}
```

Write `backend/src/api/nodes.controller.ts`:

```ts
import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { NodeCacheService } from '../cache/node-cache.service';

@Controller('/api')
export class NodesController {
  constructor(private readonly cacheService: NodeCacheService) {}

  @Get('/nodes')
  listNodes() {
    return this.cacheService.list();
  }

  @Get('/nodes/:id')
  getNode(@Param('id') id: string) {
    const node = this.cacheService.get(id);
    if (!node) {
      throw new NotFoundException(`Unknown node: ${id}`);
    }
    return node;
  }

  @Get('/ledgers')
  listLedgers() {
    return this.cacheService.list().map((node) => node.ledgerSummary);
  }
}
```

Write `backend/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { NodeConfigService } from './config/node-config.service';
import { PqsClientFactory } from './pqs/pqs-client.factory';
import { PqsSummaryService } from './pqs/pqs-summary.service';
import { GrpcClientFactory } from './grpc/grpc-client.factory';
import { GrpcOperationsService } from './grpc/grpc-operations.service';
import { NodeCacheService } from './cache/node-cache.service';
import { NodePollerService } from './orchestrator/node-poller.service';
import { NodesController } from './api/nodes.controller';

@Module({
  controllers: [NodesController],
  providers: [
    NodeConfigService,
    PqsClientFactory,
    PqsSummaryService,
    GrpcClientFactory,
    GrpcOperationsService,
    NodeCacheService,
    NodePollerService,
  ],
})
export class AppModule {}
```

Write `backend/src/main.ts`:

```ts
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000);
}

void bootstrap();
```

- [ ] **Step 4: Run the backend integration test and verify it passes**

Run:

```bash
npm test --workspace backend -- --runTestsByPath test/api/nodes.e2e-spec.ts
```

Expected:

```text
PASS test/api/nodes.e2e-spec.ts
```

- [ ] **Step 5: Commit the backend API slice**

Run:

```bash
git add backend/src/app.module.ts backend/src/main.ts backend/src/cache backend/src/orchestrator backend/src/api backend/test/api
git commit -m "feat: add polling cache and nodes api"
```

## Task 7: Add Frontend Routing and the Backend API Client

**Files:**
- Create: `frontend/src/types/nodes.ts`
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/composables/useNodes.ts`
- Create: `frontend/src/router.ts`
- Modify: `frontend/src/main.ts`
- Modify: `frontend/src/App.vue`
- Modify: `frontend/vite.config.ts`
- Test: `frontend/src/lib/api.test.ts`
- Test: `frontend/src/test/setup.ts`

- [ ] **Step 1: Write the failing frontend API client test**

Write `frontend/src/lib/api.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchNodes } from './api';

describe('fetchNodes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads node summaries from the backend API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ id: 'participant-1', label: 'Participant 1', status: 'healthy' }],
      }),
    );

    const nodes = await fetchNodes();

    expect(nodes[0].id).toBe('participant-1');
  });
});
```

- [ ] **Step 2: Run the frontend test to verify it fails**

Run:

```bash
npm test --workspace frontend -- --run frontend/src/lib/api.test.ts
```

Expected:

```text
Failed to resolve import "./api"
```

- [ ] **Step 3: Implement the shared API client, composable, and router wiring**

Write `frontend/src/types/nodes.ts`:

```ts
export type NodeStatus = 'healthy' | 'degraded' | 'down';

export interface SourceStatus {
  ok: boolean;
  checkedAt: string;
  latencyMs: number | null;
  message: string | null;
}

export interface NodeSnapshot {
  id: string;
  label: string;
  role: 'participant';
  ledgerLabel: string;
  status: NodeStatus;
  latencyMs: number | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  errorSummary: string | null;
  serviceInfo: {
    target: string | null;
    reachable: boolean;
    healthCheckImplemented: boolean;
    servingStatus: string | null;
  };
  ledgerSummary: {
    ledgerLabel: string;
    pqsDatabase: string;
    activeContractCount: number;
    latestOffset: string | null;
    latestEventAt: string | null;
  };
  sourceStatus: Record<'pqs' | 'grpc', SourceStatus>;
}
```

Write `frontend/src/lib/api.ts`:

```ts
import type { NodeSnapshot } from '../types/nodes';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function fetchNodes(): Promise<NodeSnapshot[]> {
  return fetchJson<NodeSnapshot[]>('/nodes');
}

export function fetchNode(id: string): Promise<NodeSnapshot> {
  return fetchJson<NodeSnapshot>(`/nodes/${id}`);
}
```

Write `frontend/src/composables/useNodes.ts`:

```ts
import { onMounted, ref } from 'vue';
import { fetchNodes } from '../lib/api';
import type { NodeSnapshot } from '../types/nodes';

export function useNodes() {
  const nodes = ref<NodeSnapshot[]>([]);
  const loading = ref(true);
  const error = ref<string | null>(null);

  async function refresh() {
    loading.value = true;
    error.value = null;
    try {
      nodes.value = await fetchNodes();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
    } finally {
      loading.value = false;
    }
  }

  onMounted(() => {
    void refresh();
  });

  return { nodes, loading, error, refresh };
}
```

Write `frontend/src/router.ts`:

```ts
import { createRouter, createWebHistory } from 'vue-router';
import OperationsDashboardView from './views/OperationsDashboardView.vue';
import NodeDetailView from './views/NodeDetailView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: OperationsDashboardView },
    { path: '/nodes/:id', component: NodeDetailView, props: true },
  ],
});
```

Write `frontend/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

Write `frontend/src/App.vue`:

```vue
<template>
  <div class="app-shell">
    <header class="app-header">
      <p class="eyebrow">Canton Operations</p>
      <h1>Canton Node Explorer</h1>
      <p class="subtitle">Multi-node participant health and ledger visibility</p>
    </header>
    <main>
      <RouterView />
    </main>
  </div>
</template>
```

Write `frontend/src/main.ts`:

```ts
import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import './styles.css';

createApp(App).use(router).mount('#app');
```

Update `frontend/vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

- [ ] **Step 4: Run the frontend API client test and verify it passes**

Run:

```bash
npm test --workspace frontend -- --run frontend/src/lib/api.test.ts
```

Expected:

```text
✓ frontend/src/lib/api.test.ts
```

- [ ] **Step 5: Commit the frontend shell and API client**

Run:

```bash
git add frontend/src/types frontend/src/lib frontend/src/composables frontend/src/router.ts frontend/src/test frontend/src/App.vue frontend/src/main.ts frontend/vite.config.ts
git commit -m "feat: add frontend routing and api client"
```

## Task 8: Build the Operations Dashboard and Node Detail Views

**Files:**
- Create: `frontend/src/components/NodeStatusCard.vue`
- Create: `frontend/src/views/OperationsDashboardView.vue`
- Create: `frontend/src/views/NodeDetailView.vue`
- Modify: `frontend/src/styles.css`
- Test: `frontend/src/views/OperationsDashboardView.test.ts`
- Test: `frontend/src/views/NodeDetailView.test.ts`

- [ ] **Step 1: Write the failing component tests for the dashboard and detail view**

Write `frontend/src/views/OperationsDashboardView.test.ts`:

```ts
import { render, screen } from '@testing-library/vue';
import { ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import OperationsDashboardView from './OperationsDashboardView.vue';

vi.mock('../composables/useNodes', () => ({
  useNodes: () => ({
    nodes: ref([
      {
        id: 'participant-1',
        label: 'Participant 1',
        role: 'participant',
        ledgerLabel: 'Retail Ledger',
        status: 'healthy',
        latencyMs: 21,
        lastSuccessAt: '2026-07-01T12:00:00.000Z',
        lastErrorAt: null,
        errorSummary: null,
        serviceInfo: { target: 'localhost:5012', reachable: true, healthCheckImplemented: true, servingStatus: 'SERVING' },
        ledgerSummary: { ledgerLabel: 'Retail Ledger', pqsDatabase: 'participant1_pqs', activeContractCount: 12, latestOffset: '1', latestEventAt: '2026-07-01T11:59:00.000Z' },
        sourceStatus: {
          pqs: { ok: true, checkedAt: '2026-07-01T12:00:00.000Z', latencyMs: 11, message: null },
          grpc: { ok: true, checkedAt: '2026-07-01T12:00:00.000Z', latencyMs: 10, message: null }
        }
      }
    ]),
    loading: ref(false),
    error: ref(null),
    refresh: vi.fn()
  }),
}));

describe('OperationsDashboardView', () => {
  it('renders the node card and summary metrics', () => {
    render(OperationsDashboardView, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>'
          }
        }
      }
    });

    expect(screen.getByText('Participant 1')).toBeInTheDocument();
    expect(screen.getByText('Retail Ledger')).toBeInTheDocument();
    expect(screen.getByText(/12 active contracts/i)).toBeInTheDocument();
  });
});
```

Write `frontend/src/views/NodeDetailView.test.ts`:

```ts
import { render, screen } from '@testing-library/vue';
import { describe, expect, it, vi } from 'vitest';
import NodeDetailView from './NodeDetailView.vue';

vi.mock('../lib/api', () => ({
  fetchNode: vi.fn().mockResolvedValue({
    id: 'participant-1',
    label: 'Participant 1',
    role: 'participant',
    ledgerLabel: 'Retail Ledger',
    status: 'healthy',
    latencyMs: 21,
    lastSuccessAt: '2026-07-01T12:00:00.000Z',
    lastErrorAt: null,
    errorSummary: null,
    serviceInfo: { target: 'localhost:5012', reachable: true, healthCheckImplemented: true, servingStatus: 'SERVING' },
    ledgerSummary: { ledgerLabel: 'Retail Ledger', pqsDatabase: 'participant1_pqs', activeContractCount: 12, latestOffset: '1', latestEventAt: '2026-07-01T11:59:00.000Z' },
    sourceStatus: {
      pqs: { ok: true, checkedAt: '2026-07-01T12:00:00.000Z', latencyMs: 11, message: null },
      grpc: { ok: true, checkedAt: '2026-07-01T12:00:00.000Z', latencyMs: 10, message: null }
    }
  })
}));

describe('NodeDetailView', () => {
  it('renders source diagnostics for the selected node', async () => {
    render(NodeDetailView, {
      props: { id: 'participant-1' },
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>'
          }
        }
      }
    });

    expect(await screen.findByText('Participant 1')).toBeInTheDocument();
    expect(screen.getByText(/SERVING/)).toBeInTheDocument();
    expect(screen.getByText(/participant1_pqs/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the dashboard tests and verify they fail**

Run:

```bash
npm test --workspace frontend -- --run frontend/src/views/OperationsDashboardView.test.ts frontend/src/views/NodeDetailView.test.ts
```

Expected:

```text
Failed to resolve import "./OperationsDashboardView.vue"
```

- [ ] **Step 3: Implement the card, views, and styling**

Write `frontend/src/components/NodeStatusCard.vue`:

```vue
<script setup lang="ts">
import type { NodeSnapshot } from '../types/nodes';

defineProps<{
  node: NodeSnapshot;
}>();
</script>

<template>
  <RouterLink class="node-card" :to="`/nodes/${node.id}`">
    <div class="node-card__header">
      <div>
        <p class="node-card__eyebrow">{{ node.role }}</p>
        <h2>{{ node.label }}</h2>
      </div>
      <span class="status-pill" :data-status="node.status">{{ node.status }}</span>
    </div>
    <dl class="node-card__metrics">
      <div>
        <dt>Ledger</dt>
        <dd>{{ node.ledgerSummary.ledgerLabel }}</dd>
      </div>
      <div>
        <dt>Latency</dt>
        <dd>{{ node.latencyMs ?? 'n/a' }} ms</dd>
      </div>
      <div>
        <dt>Contracts</dt>
        <dd>{{ node.ledgerSummary.activeContractCount }} active contracts</dd>
      </div>
    </dl>
  </RouterLink>
</template>
```

Write `frontend/src/views/OperationsDashboardView.vue`:

```vue
<script setup lang="ts">
import NodeStatusCard from '../components/NodeStatusCard.vue';
import { useNodes } from '../composables/useNodes';

const { nodes, loading, error, refresh } = useNodes();
</script>

<template>
  <section class="dashboard">
    <div class="dashboard__toolbar">
      <div>
        <p class="eyebrow">Landing View</p>
        <h2>Operations Dashboard</h2>
      </div>
      <button type="button" @click="refresh">Refresh</button>
    </div>

    <p v-if="loading">Loading node status...</p>
    <p v-else-if="error">{{ error }}</p>
    <div v-else class="dashboard__grid">
      <NodeStatusCard v-for="node in nodes" :key="node.id" :node="node" />
    </div>
  </section>
</template>
```

Write `frontend/src/views/NodeDetailView.vue`:

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { fetchNode } from '../lib/api';
import type { NodeSnapshot } from '../types/nodes';

const props = defineProps<{ id: string }>();

const node = ref<NodeSnapshot | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    node.value = await fetchNode(props.id);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
  }
});
</script>

<template>
  <section class="node-detail">
    <p v-if="error">{{ error }}</p>
    <p v-else-if="!node">Loading node detail...</p>
    <div v-else>
      <RouterLink to="/">Back to dashboard</RouterLink>
      <h2>{{ node.label }}</h2>
      <p>{{ node.serviceInfo.servingStatus ?? 'Health check unavailable' }}</p>
      <dl class="detail-grid">
        <div>
          <dt>PQS database</dt>
          <dd>{{ node.ledgerSummary.pqsDatabase }}</dd>
        </div>
        <div>
          <dt>Latest offset</dt>
          <dd>{{ node.ledgerSummary.latestOffset ?? 'n/a' }}</dd>
        </div>
        <div>
          <dt>gRPC target</dt>
          <dd>{{ node.serviceInfo.target ?? 'not configured' }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>
```

Write `frontend/src/styles.css`:

```css
:root {
  font-family: "IBM Plex Sans", sans-serif;
  color: #f2f4f8;
  background:
    radial-gradient(circle at top, rgba(12, 96, 171, 0.4), transparent 40%),
    linear-gradient(180deg, #07111f 0%, #0f1d2e 100%);
}

body {
  margin: 0;
  min-height: 100vh;
}

#app {
  min-height: 100vh;
}

.app-shell {
  padding: 32px;
}

.app-header {
  margin-bottom: 24px;
}

.eyebrow {
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #8fb3d9;
}

.subtitle {
  color: #c1d4e8;
}

.dashboard__toolbar,
.node-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.dashboard__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.node-card,
.node-detail {
  border: 1px solid rgba(143, 179, 217, 0.24);
  border-radius: 20px;
  background: rgba(7, 17, 31, 0.72);
  padding: 20px;
  color: inherit;
  text-decoration: none;
}

.node-card__metrics,
.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
}

.status-pill {
  border-radius: 999px;
  padding: 6px 10px;
  text-transform: capitalize;
}

.status-pill[data-status='healthy'] {
  background: #123c28;
}

.status-pill[data-status='degraded'] {
  background: #5c4310;
}

.status-pill[data-status='down'] {
  background: #5e1e1e;
}
```

- [ ] **Step 4: Run the dashboard tests and verify they pass**

Run:

```bash
npm test --workspace frontend -- --run frontend/src/views/OperationsDashboardView.test.ts frontend/src/views/NodeDetailView.test.ts
```

Expected:

```text
✓ frontend/src/views/OperationsDashboardView.test.ts
✓ frontend/src/views/NodeDetailView.test.ts
```

- [ ] **Step 5: Commit the dashboard and detail UI**

Run:

```bash
git add frontend/src/components frontend/src/views frontend/src/styles.css
git commit -m "feat: add operations dashboard and node detail views"
```

## Task 9: Add Sample Configuration, Local Run Docs, and Full Verification

**Files:**
- Create: `backend/config/nodes.example.json`
- Create: `backend/.env.example`
- Create: `README.md`

- [ ] **Step 1: Add the local sample node config and env template**

Write `backend/config/nodes.example.json`:

```json
{
  "nodes": [
    {
      "id": "participant-1",
      "label": "Participant 1",
      "role": "participant",
      "ledgerLabel": "Retail Ledger",
      "pqs": {
        "connectionUriEnv": "PARTICIPANT_1_PQS_URL"
      },
      "grpc": {
        "target": "localhost:5012",
        "useTls": false,
        "connectTimeoutMs": 5000
      },
      "polling": {
        "intervalMs": 15000,
        "staleAfterMs": 45000
      }
    }
  ]
}
```

Write `backend/.env.example`:

```dotenv
PORT=3000
NODE_CONFIG_PATH=./config/nodes.local.json
PARTICIPANT_1_PQS_URL=postgres://postgres:postgres@localhost:5432/participant1_pqs
```

- [ ] **Step 2: Document the local development flow**

Write `README.md`:

```md
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

Backend: `http://localhost:3000`
Frontend: `http://localhost:5173`

## Test

```bash
npm test
```
```

- [ ] **Step 3: Run the full build-and-test verification**

Run:

```bash
npm test
npm run build
```

Expected:

```text
PASS backend ...
✓ frontend ...
webpack ... compiled successfully
vite v... ✓ built in ...
```

- [ ] **Step 4: Commit the docs and verification pass**

Run:

```bash
git add backend/config/nodes.example.json backend/.env.example README.md
git commit -m "docs: add local setup and sample node config"
```
