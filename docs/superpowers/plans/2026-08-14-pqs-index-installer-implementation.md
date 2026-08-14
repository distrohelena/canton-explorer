# PQS Index Installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an opt-in PQS index installer through the npm CLI and Docker image, and make Explorer’s generic page queries use those indexes at large history sizes.

**Architecture:** Add a compiled backend CLI with `serve` and `indexes` commands. The index command reuses `NodeConfigService` and `PqsManagerFactory`, discovers PQS partitions from PostgreSQL catalogs, and executes independently versioned Explorer-owned index migrations. Query builders are then rewritten to use numeric offsets, static template primary keys, and indexable keyset predicates.

**Tech Stack:** Node.js 22, TypeScript, NestJS configuration services, `@distrohelena/canton-typescript-sdk` PQS raw SQL, PostgreSQL 14+, Jest, Docker Compose.

## Global Constraints

- Do not modify PQS configuration, pipeline filters, PQS tables/functions, or `flyway_schema_history`.
- The installer is explicit: `inspect` is read-only and `apply` is never run by Explorer startup or `docker compose up`.
- Use an Explorer-owned `canton_explorer_index_migrations` table and a per-database advisory lock.
- Create index builds outside transactions and use `CREATE INDEX CONCURRENTLY` for existing physical partitions.
- Support schema-qualified PQS relations; valid Explorer node configurations are PQS-backed.
- Preserve the existing `canton-explorer --config/--host/--port` server invocation.
- All query lists remain bounded and use keyset pagination; do not add `OFFSET` pagination.

---

## File structure

- `backend/src/cli.ts` — compiled command dispatcher; starts HTTP by default or invokes index commands.
- `backend/src/bootstrap-http.ts` — HTTP bootstrap extracted from `main.ts`, callable by the CLI and existing production entrypoint.
- `backend/src/indexes/index-command.ts` — argument parser and node-selection orchestration.
- `backend/src/indexes/pqs-index-installer.ts` — catalog checks, advisory locking, migration bookkeeping, and one-statement-at-a-time DDL execution.
- `backend/src/indexes/pqs-index-sql.ts` — pure, schema-safe catalog/DDL SQL builders and the migration manifest.
- `backend/src/pqs/pqs-summary.service.ts` — indexable Explorer query builders and template-PK resolution.
- `backend/bin/canton-explorer.js` — npm wrapper that forwards to the compiled CLI.
- `Dockerfile`, `compose.yaml`, `README.md` — Docker command entrypoint, one-shot Compose service, and operational instructions.
- `backend/test/cli/*.spec.ts`, `backend/test/indexes/*.spec.ts`, `backend/test/pqs/*.spec.ts`, `scripts/docker-*.test.mjs` — unit, integration-shaped SQL, and distribution tests.

### Task 1: Establish the compiled CLI without changing normal server startup

**Files:**
- Create: `backend/src/bootstrap-http.ts`
- Create: `backend/src/cli.ts`
- Modify: `backend/src/main.ts`
- Modify: `backend/bin/canton-explorer.js`
- Test: `backend/test/cli/cli.spec.ts`

**Interfaces:**
- Produces `bootstrapHttp(): Promise<void>` for normal Explorer startup.
- Produces `runCli(argv: readonly string[]): Promise<void>`; the default command is `serve`.
- Reserves `indexes` for Task 3’s `runIndexCommand(args)` export.

- [ ] **Step 1: Write the failing CLI dispatch tests**

```ts
import { describe, expect, it, jest } from '@jest/globals';
import { runCli } from '../../src/cli';

describe('runCli', () => {
  it('starts HTTP when invoked with no command', async () => {
    const bootstrapHttp = jest.fn<() => Promise<void>>().mockResolvedValue();
    await runCli([], { bootstrapHttp, runIndexCommand: jest.fn() });
    expect(bootstrapHttp).toHaveBeenCalledTimes(1);
  });

  it('forwards indexes arguments without starting HTTP', async () => {
    const runIndexCommand = jest.fn<(args: readonly string[]) => Promise<void>>().mockResolvedValue();
    await runCli(['indexes', 'inspect', '--node', 'participant-1'], {
      bootstrapHttp: jest.fn(), runIndexCommand,
    });
    expect(runIndexCommand).toHaveBeenCalledWith(['inspect', '--node', 'participant-1']);
  });
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run: `npm run test --workspace backend -- --runInBand test/cli/cli.spec.ts`

Expected: FAIL because `src/cli.ts` and `runCli` do not exist.

- [ ] **Step 3: Extract the HTTP bootstrap and add the dispatcher**

```ts
// src/bootstrap-http.ts
export async function bootstrapHttp(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 4600, process.env.HOST ?? '0.0.0.0');
}

// src/cli.ts
export async function runCli(
  argv: readonly string[],
  dependencies = { bootstrapHttp, runIndexCommand },
): Promise<void> {
  if (argv[0] === 'indexes') return dependencies.runIndexCommand(argv.slice(1));
  if (argv.length === 0 || argv[0] === 'serve' || argv[0]?.startsWith('--')) {
    return dependencies.bootstrapHttp();
  }
  throw new Error(`Unknown command: ${argv[0]}`);
}
```

Keep `main.ts` as `void bootstrapHttp()` for Nest development scripts. Make the npm wrapper import `dist/src/cli.js` and pass `process.argv.slice(2)`; retain its existing configuration flag validation before forwarding arguments.

- [ ] **Step 4: Run focused CLI and existing startup tests**

Run: `npm run test --workspace backend -- --runInBand test/cli/cli.spec.ts test/config/node-config.service.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit the CLI foundation**

```bash
git add backend/src/bootstrap-http.ts backend/src/cli.ts backend/src/main.ts backend/bin/canton-explorer.js backend/test/cli/cli.spec.ts
git commit -m "feat: add Explorer command dispatcher"
```

### Task 2: Build a testable, partition-aware index migration engine

**Files:**
- Create: `backend/src/indexes/pqs-index-sql.ts`
- Create: `backend/src/indexes/pqs-index-installer.ts`
- Test: `backend/test/indexes/pqs-index-sql.spec.ts`
- Test: `backend/test/indexes/pqs-index-installer.spec.ts`

**Interfaces:**
- Produces `type IndexMigration = { version: string; name: string; apply(context: PqsIndexContext): readonly string[] }`.
- Produces `inspectPqsIndexes(executor, schema): Promise<PqsIndexInspection>`.
- Produces `applyPqsIndexes(executor, schema): Promise<PqsIndexApplyResult>`.
- Consumes `PqsRawExecutor` from `src/pqs/pqs-manager.factory.ts`.

- [ ] **Step 1: Write failing SQL-builder tests for schema safety and DDL**

```ts
it('creates a concurrent GIN index for each discovered contracts partition', () => {
  expect(contractWitnessIndexSql('public', '__contracts_42')).toBe(
    'create index concurrently if not exists "canton_explorer_contracts_42_witnesses_gin" on "public"."__contracts_42" using gin (witnesses)',
  );
});

it('rejects a non-identifier schema rather than interpolating it', () => {
  expect(() => quoteIdentifier('public; drop table x')).toThrow('Invalid PostgreSQL identifier');
});
```

- [ ] **Step 2: Run the SQL-builder test to verify it fails**

Run: `npm run test --workspace backend -- --runInBand test/indexes/pqs-index-sql.spec.ts`

Expected: FAIL because the index SQL module does not exist.

- [ ] **Step 3: Implement the migration manifest and pure SQL builders**

Define the migration table and catalog query as single statements:

```ts
export const migrationTableSql = (schema: string) => `
  create table if not exists ${qualified(schema, 'canton_explorer_index_migrations')} (
    version text primary key,
    applied_at timestamptz not null default current_timestamp
  )`;

export const contractPartitionsSql = (schema: string) => `
  select child.relname as table_name
  from pg_inherits inheritance
  join pg_class parent on parent.oid = inheritance.inhparent
  join pg_namespace parent_schema on parent_schema.oid = parent.relnamespace
  join pg_class child on child.oid = inheritance.inhrelid
  where parent_schema.nspname = $1 and parent.relname = '__contracts'
  order by child.relname`;
```

Use a validated `quoteIdentifier` for catalog-derived relation names. Migration `001` creates GIN witness indexes for each contracts partition and `__exercises` if it exists. Migration `002` creates a partial B-tree `(created_at_ix desc) where archived_at_ix is null` for each contracts partition. Migration `003` adds a `text_pattern_ops` transaction-ID B-tree only after catalog inspection proves `__transactions.transaction_id` is `text`.

- [ ] **Step 4: Write the failing installer orchestration tests**

```ts
it('does not mark a migration complete when one concurrent index statement fails', async () => {
  const executor = fakeExecutor({ failSql: /__contracts_43/ });
  await expect(applyPqsIndexes(executor, 'public')).rejects.toThrow('contracts_43');
  expect(executor.sql).not.toContainEqual(expect.stringMatching(/insert into .*canton_explorer_index_migrations/));
});

it('uses one advisory lock and records an already-complete migration without rebuilding indexes', async () => {
  const executor = fakeExecutor({ appliedVersions: ['001-witnesses'] });
  await applyPqsIndexes(executor, 'public');
  expect(executor.sql).toContain('select pg_advisory_lock(hashtext($1))');
  expect(executor.sql.join('\n')).not.toMatch(/witnesses_gin/);
});
```

- [ ] **Step 5: Implement lock, inspect, and apply semantics**

Acquire `pg_advisory_lock(hashtext($1))` using the stable key
`canton-explorer-indexes:<schema>` and release it in `finally`. Query and
create the migration table first, discover existing migration versions, then
issue each `CREATE INDEX CONCURRENTLY` as a separate `executor.query` call.
Insert the migration version only after all its index statements resolve.
`inspect` must execute only catalog and `EXPLAIN (FORMAT JSON)` queries and
return proposed SQL without DDL.

- [ ] **Step 6: Run index-engine tests**

Run: `npm run test --workspace backend -- --runInBand test/indexes/pqs-index-sql.spec.ts test/indexes/pqs-index-installer.spec.ts`

Expected: PASS.

- [ ] **Step 7: Commit the migration engine**

```bash
git add backend/src/indexes backend/test/indexes
git commit -m "feat: add PQS index migration engine"
```

### Task 3: Wire the installer into configured nodes and the npm command

**Files:**
- Create: `backend/src/indexes/index-command.ts`
- Test: `backend/test/indexes/index-command.spec.ts`
- Test: `scripts/pqs-index-installer.test.mjs`
- Modify: `backend/src/cli.ts`
- Modify: `backend/src/pqs/pqs-manager.factory.ts`
- Test: `backend/test/pqs/pqs-manager.factory.spec.ts`

**Interfaces:**
- Produces `runIndexCommand(args, dependencies?): Promise<IndexCommandResult>`.
- Supports `inspect`, `apply`, `--node <id>`, `--dry-run`, and `--config <path>`.
- Consumes `NodeConfigService.list()` and `PqsManagerFactory.getRawExecutor(node)`.

- [ ] **Step 1: Write failing command tests**

```ts
it('invokes only the requested configured PQS node', async () => {
  const result = await runIndexCommand(['inspect', '--node', 'pqs-node'], dependenciesWithNodes([pqsNode, secondPqsNode]));
  expect(result.inspectedNodeIds).toEqual(['pqs-node']);
});

it('dry-run never calls applyPqsIndexes', async () => {
  await runIndexCommand(['apply', '--dry-run'], dependencies);
  expect(dependencies.applyPqsIndexes).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run command tests to verify they fail**

Run: `npm run test --workspace backend -- --runInBand test/indexes/index-command.spec.ts`

Expected: FAIL because `runIndexCommand` does not exist.

- [ ] **Step 3: Write the failing PostgreSQL partition integration test**

Create a temporary PostgreSQL 14 Docker container, create a `public.__contracts`
partitioned table with `__contracts_17` and `__contracts_29` child tables plus
`public.__exercises` and `public.__transactions`, then invoke the compiled
`indexes apply` command with a temporary Explorer node config. Assert:

```js
assert.match(await psql('\\di public.canton_explorer_contracts_17_witnesses_gin'), /GIN/);
assert.match(await psql('\\di public.canton_explorer_contracts_29_active_created_ix'), /btree/);
assert.match(await psql('select version from canton_explorer_index_migrations'), /001-witnesses/);
await runInstallerAgain();
assert.equal(await migrationRowCount(), '3');
```

Run: `npm run build --workspace backend && node --test scripts/pqs-index-installer.test.mjs`

Expected: FAIL before `runIndexCommand` is wired to the compiled CLI.

- [ ] **Step 4: Implement argument validation and lifecycle cleanup**

Parse only the documented command/flags. For `--config`, set
`NODE_CONFIG_PATH` before constructing `NodeConfigService`; reject a missing
flag value, duplicate node IDs, unknown commands, and an unknown requested
node. Construct one `PqsManagerFactory`, process selected PQS nodes in
sequence, print a compact per-node result, and always call
`factory.onModuleDestroy()` in `finally`.

Extend `PqsRawExecutor` only if the SDK requires a distinct non-row-returning
method; otherwise keep the existing `$queryRaw` path and assert DDL yields an
empty row list in the factory test.

- [ ] **Step 5: Run command and PostgreSQL integration tests**

Start the test database with a unique container name and disposable volume;
wait for `pg_isready`; pass only the temporary PQS URL through an environment
variable; and remove the container in the test cleanup even after assertion
failure. Run the command again:

Run: `npm run test --workspace backend -- --runInBand test/cli/cli.spec.ts test/indexes/index-command.spec.ts test/pqs/pqs-manager.factory.spec.ts && npm run build --workspace backend && node --test scripts/pqs-index-installer.test.mjs`

Expected: PASS; every existing partition has the expected index and rerunning
does not create duplicate indexes or migration rows.

- [ ] **Step 6: Commit command integration**

```bash
git add backend/src/cli.ts backend/src/indexes/index-command.ts backend/src/pqs/pqs-manager.factory.ts backend/test/cli/cli.spec.ts backend/test/indexes/index-command.spec.ts backend/test/pqs/pqs-manager.factory.spec.ts scripts/pqs-index-installer.test.mjs
git commit -m "feat: expose PQS index commands"
```

### Task 4: Make generic Explorer queries use the scalable access paths

**Files:**
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Modify: `backend/test/pqs/pqs-summary.service.spec.ts`

**Interfaces:**
- Template-filtered builders consume resolved `readonly bigint[]` template PKs.
- Offset detail builders consume validated numeric offset strings and generate `tx.offset = <integer>` predicates.
- Party-update and active-contract builders preserve their current response shapes and cursor contracts.

- [ ] **Step 1: Add failing query-shape regression tests**

```ts
it('looks up an update through the numeric offset index', () => {
  expect(singleUpdateQuery(node, '3322')).toContain('where tx.offset = 3322');
  expect(singleUpdateQuery(node, '3322')).not.toContain('tx.offset::text');
});

it('prunes contracts partitions for template filters', async () => {
  await service.fetchNodeContracts(node, { templates: ['Splice.Amulet:Amulet'] });
  expect(rawQuery).toHaveBeenLastCalledWith(expect.stringContaining('contract_row.tpe_pk in (17, 29)'));
});

it('uses active contract creation order for cursor paging', () => {
  expect(pqsActiveContractsQuery(node, 30, '3322')).toContain('contract_row.created_at_ix < 3322');
  expect(pqsActiveContractsQuery(node, 30)).toContain('order by contract_row.created_at_ix desc');
});
```

- [ ] **Step 2: Run these regressions to verify they fail**

Run: `npm run test --workspace backend -- --runInBand test/pqs/pqs-summary.service.spec.ts`

Expected: FAIL on the old text-cast and transaction-order SQL assertions.

- [ ] **Step 3: Implement numeric/template/party query rewrites**

Reuse the token-query template lookup pattern to resolve template identifiers
to a static, validated `tpe_pk in (...)` clause before issuing contracts or
updates queries. Reject malformed offsets before SQL generation and interpolate
only the normalized integer literal. Change active-contract keyset predicates
and ordering to `created_at_ix`, then join the bounded contract page to
`__transactions` for response timestamps/offsets. Replace correlated
party-update `exists` branches with a `union` of contract/exercise event
indexes filtered by `witnesses && array[...]::text[]`, joined back to
transactions and deduplicated before the bounded ordered page.

Keep the old API fields (`nextBefore`, `nextAfter`, update ID, record time,
and node ID) byte-for-byte compatible.

- [ ] **Step 4: Run full PQS service tests**

Run: `npm run test --workspace backend -- --runInBand test/pqs/pqs-summary.service.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit query optimization**

```bash
git add backend/src/pqs/pqs-summary.service.ts backend/test/pqs/pqs-summary.service.spec.ts
git commit -m "perf: use indexed PQS query paths"
```

### Task 5: Ship Docker/Compose support and operator documentation

**Files:**
- Modify: `Dockerfile`
- Modify: `compose.yaml`
- Modify: `README.md`
- Modify: `scripts/docker-image.test.mjs`
- Modify: `scripts/docker-compose.test.mjs`
- Modify: `backend/package.json`
- Test: `backend/test/cli/cli.spec.ts`

**Interfaces:**
- Docker image entrypoint is `node dist/src/cli.js`; default command is `serve`.
- Compose service `canton-explorer-indexes` has `profiles: ["indexes"]` and command `indexes apply`.
- npm package’s `canton-explorer` binary exposes the same commands.

- [ ] **Step 1: Write failing packaging assertions**

```js
assert.deepEqual(Object.keys(rendered.services).sort(), ['canton-explorer', 'canton-explorer-indexes']);
assert.deepEqual(rendered.services['canton-explorer-indexes'].profiles, ['indexes']);
assert.deepEqual(rendered.services['canton-explorer-indexes'].command, ['indexes', 'apply']);

const inspect = await docker('run', '--rm', imageTag, 'indexes', 'inspect', '--help');
assert.match(inspect.stdout, /canton-explorer indexes inspect/);
```

- [ ] **Step 2: Run distribution tests to verify they fail**

Run: `node --test scripts/docker-compose.test.mjs scripts/docker-image.test.mjs`

Expected: FAIL because the image entrypoint and Compose index service do not exist.

- [ ] **Step 3: Update distribution artifacts**

Set Docker `ENTRYPOINT` to `node dist/src/cli.js` and `CMD` to `serve`, while
retaining the HTTP health check. Add the profile-gated service with the same
`env_file` and read-only config/debug-DAR mounts as the server, but no ports,
restart policy, or data volume. Update README with exact commands:

```bash
npx @distrohelena/canton-explorer indexes inspect --config ./config/nodes.local.json
npx @distrohelena/canton-explorer indexes apply --config ./config/nodes.local.json --node participant-1
docker compose --profile indexes run --rm canton-explorer-indexes inspect
docker compose --profile indexes run --rm canton-explorer-indexes apply
```

Document `CREATE`/ownership requirements, concurrent-build disk/I/O impact,
one-node staging, `--dry-run`, and that the tool never changes PQS filters or
PQS Flyway history.

- [ ] **Step 4: Build, package, and run all relevant tests**

Run: `npm run build:package && npm run pack:dry-run && npm run test --workspace backend && npm run test --workspace frontend && node --test scripts/pqs-index-installer.test.mjs scripts/docker-compose.test.mjs scripts/docker-image.test.mjs`

Expected: all commands PASS; `npm pack --dry-run` lists `dist/src/cli.js` and the updated bin wrapper.

- [ ] **Step 5: Commit the distribution and documentation changes**

```bash
git add Dockerfile compose.yaml README.md scripts/docker-image.test.mjs scripts/docker-compose.test.mjs backend/package.json backend/bin/canton-explorer.js backend/src/cli.ts backend/test/cli/cli.spec.ts
git commit -m "feat: distribute PQS index installer"
```

## Final verification

- [ ] Run `git diff --check` and `git status --short`.
- [ ] Run the full command from Task 5, Step 4 after the final commit.
- [ ] Run `canton-explorer indexes inspect --help` from the packed package in a temporary directory.
- [ ] Run `docker compose --profile indexes config --quiet` using the client fixture.
- [ ] Record the before/after local query plans in `docs/performance/` without claiming localnet timings represent a client testnet.
