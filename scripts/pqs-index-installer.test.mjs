import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";
import pg from "pg";

const { Client } = pg;

const repositoryRoot = resolve(import.meta.dirname, "..");
const suffix = `${process.pid}-${Date.now()}`;
const containerName = `canton-explorer-pqs-index-test-${suffix}`;
const volumeName = `canton-explorer-pqs-index-test-${suffix}`;
const password = "explorer-index-test";
const database = "postgres";
const temporaryDirectory = mkdtempSync(
  join(tmpdir(), "canton-explorer-indexes-"),
);
const configPath = join(temporaryDirectory, "nodes.json");
let connectionString;
let startupHealth;

function docker(...args) {
  return execFileSync("docker", args, { encoding: "utf8" }).trim();
}

function psql(command) {
  return docker(
    "exec",
    "-e",
    `PGPASSWORD=${password}`,
    containerName,
    "psql",
    "-U",
    "postgres",
    "-d",
    database,
    "-X",
    "-c",
    command,
  );
}

function psqlResult(command) {
  return spawnSync(
    "docker",
    [
      "exec",
      "-e",
      `PGPASSWORD=${password}`,
      containerName,
      "psql",
      "-U",
      "postgres",
      "-d",
      database,
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      command,
    ],
    { encoding: "utf8" },
  );
}

function postgresDiagnostics() {
  const inspect = spawnSync(
    "docker",
    ["inspect", "--format", "{{json .State}}", containerName],
    { encoding: "utf8" },
  );
  const logs = spawnSync("docker", ["logs", "--tail", "80", containerName], {
    encoding: "utf8",
  });
  return {
    state: `${inspect.stdout ?? ""}${inspect.stderr ?? ""}`.trim(),
    logs: `${logs.stdout ?? ""}${logs.stderr ?? ""}`.trim(),
  };
}

async function waitForPostgres(connectionUrl) {
  let lastSqlError;
  let lastHealth = "unknown";

  for (let attempt = 0; attempt < 120; attempt += 1) {
    const health = spawnSync(
      "docker",
      ["inspect", "--format", "{{.State.Health.Status}}", containerName],
      { encoding: "utf8" },
    );
    lastHealth = health.stdout?.trim() || health.stderr?.trim() || "unknown";

    const client = new Client({
      connectionString: connectionUrl,
      connectionTimeoutMillis: 500,
    });
    try {
      await client.connect();
      const result = await client.query("select 1::integer as ready");
      if (result.rows[0]?.ready === 1 && lastHealth === "healthy") {
        return lastHealth;
      }
    } catch (error) {
      lastSqlError = error;
    } finally {
      await client.end().catch(() => undefined);
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }

  const diagnostics = postgresDiagnostics();
  throw new Error(
    `PostgreSQL test container did not become SQL-ready (health=${lastHealth}, sql=${lastSqlError instanceof Error ? lastSqlError.message : String(lastSqlError)})\nstate=${diagnostics.state}\nlogs=${diagnostics.logs}`,
  );
}

function runInstaller(...args) {
  return execFileSync(
    process.execPath,
    [
      join(repositoryRoot, "backend", "bin", "canton-explorer.js"),
      "indexes",
      ...args,
      "--config",
      configPath,
    ],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        PQS_INDEX_TEST_URL: connectionString,
      },
    },
  );
}

function runInstallerResult(...args) {
  return spawnSync(
    process.execPath,
    [
      join(repositoryRoot, "backend", "bin", "canton-explorer.js"),
      "indexes",
      ...args,
      "--config",
      configPath,
    ],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        PQS_INDEX_TEST_URL: connectionString,
      },
    },
  );
}

before(async () => {
  docker("volume", "create", volumeName);
  docker(
    "run",
    "--detach",
    "--name",
    containerName,
    "--publish",
    "127.0.0.1::5432",
    "--mount",
    `type=volume,source=${volumeName},target=/var/lib/postgresql/data`,
    "--env",
    `POSTGRES_PASSWORD=${password}`,
    "--health-cmd",
    `pg_isready -U postgres -d ${database}`,
    "--health-interval",
    "250ms",
    "--health-timeout",
    "2s",
    "--health-retries",
    "120",
    "postgres:14",
  );

  const publishedPort = docker("port", containerName, "5432/tcp").match(
    /:(\d+)$/,
  )?.[1];
  assert.ok(publishedPort, "Docker did not publish the PostgreSQL port");
  connectionString = `postgresql://postgres:${password}@127.0.0.1:${publishedPort}/${database}`;
  startupHealth = await waitForPostgres(connectionString);

  psql(`
    create table public.flyway_schema_history (
      installed_rank integer not null,
      version varchar(50),
      success boolean not null
    );
    insert into public.flyway_schema_history (installed_rank, version, success)
      values (41, '041', true);
    create table public.__contracts (
      tpe_pk bigint not null,
      witnesses text[] not null,
      create_event_pk bigint not null,
      created_at_ix bigint not null,
      archived_at_ix bigint,
      contract_id text not null
    ) partition by list (tpe_pk);
    create table public.__contracts_17 partition of public.__contracts for values in (17);
    create table public.__contracts_29 partition of public.__contracts for values in (29);
    create table public.__exercises (
      tpe_pk bigint not null,
      witnesses text[] not null
    ) partition by list (tpe_pk);
    create table public.__exercises_17 partition of public.__exercises for values in (17);
    create table public.__exercises_29 partition of public.__exercises for values in (29);
    insert into public.__contracts_17
      (tpe_pk, witnesses, create_event_pk, created_at_ix, archived_at_ix, contract_id)
      values
        (17, array['Alice'], 5, 100, null, 'contract-1'),
        (17, array['Bob'], 5, 100, null, 'contract-2');
    insert into public.__contracts_29
      (tpe_pk, witnesses, create_event_pk, created_at_ix, archived_at_ix, contract_id)
      select 29, array['Alice'], 1000 + value, 1000 + value, null, 'bulk-' || value::text
      from generate_series(1, 20000) value;
    analyze public.__contracts_17;
    analyze public.__contracts_29;
    create table public.__transactions (
      ix bigint not null,
      "offset" bigint not null,
      transaction_id text not null
    );
    insert into public.__transactions (ix, "offset", transaction_id)
      values (100, 1000, 'update-100');
  `);

  writeFileSync(
    configPath,
    JSON.stringify({
      nodes: [
        {
          id: "postgresql-test",
          label: "PostgreSQL test",
          role: "participant",
          mode: "pqs_only",
          pqs: { connectionUriEnv: "PQS_INDEX_TEST_URL", schema: "public" },
        },
      ],
    }),
    "utf8",
  );
});

after(() => {
  spawnSync("docker", ["rm", "--force", containerName], { stdio: "ignore" });
  spawnSync("docker", ["volume", "rm", "--force", volumeName], {
    stdio: "ignore",
  });
  rmSync(temporaryDirectory, { recursive: true, force: true });
});

test("the npm wrapper forwards indexes help to the index command", () => {
  const output = execFileSync(
    process.execPath,
    [
      join(repositoryRoot, "backend", "bin", "canton-explorer.js"),
      "indexes",
      "--help",
    ],
    { cwd: repositoryRoot, encoding: "utf8" },
  );

  assert.match(output, /canton-explorer indexes inspect/);
  assert.match(output, /canton-explorer indexes repair/);
  assert.equal(startupHealth, "healthy");
});

test("apply is non-destructive, repair is explicit, and reruns are idempotent", () => {
  const beforeInspection = runInstaller("inspect");
  assert.match(beforeInspection, /explain-relation=__contracts_29/);
  assert.match(beforeInspection, /"Node Type":"Seq Scan"/);

  psql(
    "create index canton_explorer_contracts_17_witnesses_gin on public.__contracts_17 (contract_id)",
  );
  const conflict = runInstallerResult("apply");
  assert.notEqual(conflict.status, 0);
  assert.match(conflict.stderr, /Conflicting Explorer index definitions/i);
  assert.match(
    psql(
      "select indexdef from pg_indexes where schemaname = 'public' and indexname = 'canton_explorer_contracts_17_witnesses_gin'",
    ),
    /contract_id/i,
  );
  assert.match(
    psql(
      "select to_regclass('public.canton_explorer_index_migrations') is null",
    ),
    /t/,
  );
  psql("drop index public.canton_explorer_contracts_17_witnesses_gin");

  const invalidBuild = psqlResult(
    "create unique index concurrently canton_explorer_contracts_17_active_created_ix on public.__contracts_17 (created_at_ix desc, create_event_pk desc) where archived_at_ix is null",
  );
  assert.notEqual(invalidBuild.status, 0);
  assert.match(invalidBuild.stderr, /could not create unique index/i);

  const applyWithInvalidIndex = runInstallerResult("apply");
  assert.notEqual(applyWithInvalidIndex.status, 0);
  assert.match(applyWithInvalidIndex.stderr, /indexes repair/i);
  assert.match(
    psql(
      "select indisvalid from pg_index join pg_class on pg_class.oid = pg_index.indexrelid where pg_class.relname = 'canton_explorer_contracts_17_active_created_ix'",
    ),
    /f/,
  );

  runInstaller("repair");

  assert.match(
    psql(
      "select indexdef from pg_indexes where schemaname = 'public' and indexname = 'canton_explorer_contracts_17_witnesses_gin'",
    ),
    /gin/i,
  );
  assert.match(
    psql(
      "select indexdef from pg_indexes where schemaname = 'public' and indexname = 'canton_explorer_contracts_29_active_created_ix'",
    ),
    /btree/i,
  );
  assert.match(
    psql(
      "select indexdef from pg_indexes where schemaname = 'public' and indexname = 'canton_explorer_contracts_29_active_created_ix'",
    ),
    /created_at_ix DESC, create_event_pk DESC/i,
  );
  assert.match(
    psql(
      "select indexdef from pg_indexes where schemaname = 'public' and indexname = 'canton_explorer_exercises_17_witnesses_gin'",
    ),
    /gin/i,
  );
  assert.match(
    psql(
      "select indexdef from pg_indexes where schemaname = 'public' and indexname = 'canton_explorer_exercises_29_witnesses_gin'",
    ),
    /gin/i,
  );
  assert.equal(
    psql(
      "select count(*) from pg_indexes where schemaname = 'public' and tablename = '__exercises' and indexname like 'canton_explorer_%'",
    )
      .split("\n")
      .find((line) => /^\s*\d+\s*$/.test(line))
      ?.trim(),
    "0",
  );
  assert.match(
    psql(
      "select version from public.canton_explorer_index_migrations order by version",
    ),
    /001-witnesses/,
  );

  const inspection = runInstaller("inspect");
  assert.match(inspection, /schema-supported=true/);
  assert.match(inspection, /pqs-version=041/);
  assert.match(inspection, /relation=__contracts/);
  assert.match(inspection, /index=canton_explorer_contracts_17_witnesses_gin/);
  assert.match(inspection, /explain-relation=__contracts_29/);
  assert.match(inspection, /"Node Type":"Index Only Scan"/);
  assert.match(
    inspection,
    /canton_explorer_contracts_29_active_created_ix/,
  );

  runInstaller("apply");

  assert.equal(
    psql("select count(*) from public.canton_explorer_index_migrations")
      .split("\n")
      .find((line) => /^\s*\d+\s*$/.test(line))
      ?.trim(),
    "3",
  );
  assert.equal(
    psql(
      `select count(*) from pg_indexes where schemaname = 'public' and indexname like 'canton_explorer_%' and tablename <> 'canton_explorer_index_migrations'`,
    )
      .split("\n")
      .find((line) => /^\s*\d+\s*$/.test(line))
      ?.trim(),
    "7",
  );
});
