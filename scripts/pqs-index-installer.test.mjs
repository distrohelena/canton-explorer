import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";

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

async function waitForPostgres() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const ready = spawnSync(
      "docker",
      ["exec", containerName, "pg_isready", "-U", "postgres", "-d", database],
      { stdio: "ignore" },
    );
    if (ready.status === 0) return;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error("PostgreSQL test container did not become ready");
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
    "postgres:14",
  );
  await waitForPostgres();

  const publishedPort = docker("port", containerName, "5432/tcp").match(
    /:(\d+)$/,
  )?.[1];
  assert.ok(publishedPort, "Docker did not publish the PostgreSQL port");
  connectionString = `postgresql://postgres:${password}@127.0.0.1:${publishedPort}/${database}`;

  psql(`
    create table public.__contracts (
      tpe_pk bigint not null,
      witnesses text[] not null,
      created_at_ix bigint not null,
      archived_at_ix bigint
    ) partition by list (tpe_pk);
    create table public.__contracts_17 partition of public.__contracts for values in (17);
    create table public.__contracts_29 partition of public.__contracts for values in (29);
    create table public.__exercises (witnesses text[] not null);
    create table public.__transactions (transaction_id text not null);
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
});

test("indexes apply installs every partition index and is idempotent", () => {
  runInstaller("apply");

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
      "select version from public.canton_explorer_index_migrations order by version",
    ),
    /001-witnesses/,
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
    "6",
  );
});
