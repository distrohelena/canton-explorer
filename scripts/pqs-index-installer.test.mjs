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
    create table public.__contract_tpe (
      pk bigint primary key,
      module_name text not null,
      entity_name text not null
    );
    insert into public.__contract_tpe (pk, module_name, entity_name)
      values (17, 'Main', 'Asset'), (29, 'Other', 'Bulk');
    create table public.__exercises (
      tpe_pk bigint not null,
      contract_tpe_pk bigint not null,
      witnesses text[] not null,
      exercised_at_ix bigint not null
    ) partition by list (tpe_pk);
    create table public.__exercises_17 partition of public.__exercises for values in (17);
    create table public.__exercises_29 partition of public.__exercises for values in (29);
    create table public.__exercise_tpe (
      pk bigint primary key,
      module_name text not null,
      entity_name text not null
    );
    insert into public.__exercise_tpe (pk, module_name, entity_name)
      values (17, 'Main', 'Asset'), (29, 'Other', 'Bulk');
    insert into public.__contracts_17
      (tpe_pk, witnesses, create_event_pk, created_at_ix, archived_at_ix, contract_id)
      values
        (17, array['Alice'], 5, 100, null, 'contract-1'),
        (17, array['Bob'], 5, 100, null, 'contract-2'),
        (17, array['Alice'], 30001, 30001, null, 'alice-new-1'),
        (17, array['Alice'], 30002, 30002, null, 'alice-new-2'),
        (17, array['Alice'], 30003, 30003, null, 'alice-new-3'),
        (17, array['Alice', 'Bob'], 30000, 30000, null, 'shared-new-desc'),
        (17, array['Alice', 'Bob'], 29001, 100, 29001, 'shared-old-desc-1'),
        (17, array['Alice', 'Bob'], 29002, 100, 29002, 'shared-old-desc-2'),
        (17, array['Alice', 'Bob'], 29003, 100, 29003, 'shared-old-desc-3'),
        (17, array['Alice'], 40001, 40001, null, 'alice-early-asc-1'),
        (17, array['Alice'], 40002, 40002, null, 'alice-early-asc-2'),
        (17, array['Alice'], 40003, 40003, null, 'alice-early-asc-3'),
        (17, array['Alice', 'Bob'], 40004, 40004, null, 'shared-early-asc'),
        (17, array['Alice', 'Bob'], 41001, 100, 41001, 'shared-late-asc-1'),
        (17, array['Alice', 'Bob'], 41002, 100, 41002, 'shared-late-asc-2'),
        (17, array['Alice', 'Bob'], 41003, 100, 41003, 'shared-late-asc-3');
    insert into public.__contracts_29
      (tpe_pk, witnesses, create_event_pk, created_at_ix, archived_at_ix, contract_id)
      select 29, array['Alice'], 1000 + value, 1000 + value, null, 'bulk-' || value::text
      from generate_series(1, 20000) value;
    insert into public.__contracts_29
      (tpe_pk, witnesses, create_event_pk, created_at_ix, archived_at_ix, contract_id)
      values (29, array['Alice'], 50001, 1001, null, 'bulk-duplicate-1001');
    analyze public.__contracts_17;
    analyze public.__contracts_29;
    create table public.__transactions (
      ix bigint not null,
      "offset" bigint not null,
      transaction_id text not null,
      effective_at timestamptz not null,
      paid_traffic_cost numeric
    );
    create unique index __transactions_ix_idx on public.__transactions (ix);
    create unique index __transactions_offset_idx on public.__transactions ("offset");
    insert into public.__transactions
      (ix, "offset", transaction_id, effective_at, paid_traffic_cost)
      values (100, 1000, 'update-100', '2026-08-14T00:00:00Z', null);
    insert into public.__transactions
      (ix, "offset", transaction_id, effective_at, paid_traffic_cost)
      select
        1000 + value,
        100000 + value,
        'bulk-update-' || value::text,
        '2026-08-14T00:00:00Z'::timestamptz + value * interval '1 second',
        null
      from generate_series(1, 20000) value;
    insert into public.__transactions
      (ix, "offset", transaction_id, effective_at, paid_traffic_cost)
      values
        (29001, 129001, 'shared-old-desc-update-1', '2026-08-14T05:00:01Z', null),
        (29002, 129002, 'shared-old-desc-update-2', '2026-08-14T05:00:02Z', null),
        (29003, 129003, 'shared-old-desc-update-3', '2026-08-14T05:00:03Z', null),
        (30000, 130000, 'shared-new-desc-update', '2026-08-14T06:00:00Z', null),
        (30001, 130001, 'alice-new-update-1', '2026-08-14T06:00:01Z', null),
        (30002, 130002, 'alice-new-update-2', '2026-08-14T06:00:02Z', null),
        (30003, 130003, 'alice-new-update-3', '2026-08-14T06:00:03Z', null),
        (40001, 140001, 'alice-early-asc-update-1', '2026-08-14T07:00:01Z', null),
        (40002, 140002, 'alice-early-asc-update-2', '2026-08-14T07:00:02Z', null),
        (40003, 140003, 'alice-early-asc-update-3', '2026-08-14T07:00:03Z', null),
        (40004, 140004, 'shared-early-asc-update', '2026-08-14T07:00:04Z', null),
        (41001, 141001, 'shared-late-asc-update-1', '2026-08-14T08:00:01Z', null),
        (41002, 141002, 'shared-late-asc-update-2', '2026-08-14T08:00:02Z', null),
        (41003, 141003, 'shared-late-asc-update-3', '2026-08-14T08:00:03Z', null);
    analyze public.__transactions;
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
  assert.match(applyWithInvalidIndex.stderr, /Conflicting Explorer index/i);
  const repairWithInvalidConflict = runInstallerResult("repair");
  assert.notEqual(repairWithInvalidConflict.status, 0);
  assert.match(repairWithInvalidConflict.stderr, /Conflicting Explorer index/i);
  assert.match(
    psql(
      "select indisvalid from pg_index join pg_class on pg_class.oid = pg_index.indexrelid where pg_class.relname = 'canton_explorer_contracts_17_active_created_ix'",
    ),
    /f/,
  );
  psql("drop index public.canton_explorer_contracts_17_active_created_ix");

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
    /created_at_ix DESC, create_event_pk DESC, contract_id DESC/i,
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
  assert.match(
    psql(
      "select indexdef from pg_indexes where schemaname = 'public' and indexname = 'canton_explorer_contracts_29_created_at_ix_order'",
    ),
    /created_at_ix DESC/i,
  );
  assert.match(
    psql(
      "select indexdef from pg_indexes where schemaname = 'public' and indexname = 'canton_explorer_contracts_29_archived_at_ix_order'",
    ),
    /archived_at_ix DESC/i,
  );
  assert.match(
    psql(
      "select indexdef from pg_indexes where schemaname = 'public' and indexname = 'canton_explorer_exercises_29_exercised_at_ix_order'",
    ),
    /exercised_at_ix DESC/i,
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
  assert.match(inspection, /canton_explorer_contracts_29_active_created_ix/);
  assert.match(
    psql(`
      explain (format json)
      select created_at_ix
      from public.__contracts_29
      where witnesses && array['Alice']::text[]
        and created_at_ix < 25000
      order by created_at_ix desc
      limit 31
    `),
    /canton_explorer_contracts_29_created_at_ix_order/,
  );

  runInstaller("apply");

  assert.equal(
    psql("select count(*) from public.canton_explorer_index_migrations")
      .split("\n")
      .find((line) => /^\s*\d+\s*$/.test(line))
      ?.trim(),
    "4",
  );
  assert.equal(
    psql(
      `select count(*) from pg_indexes where schemaname = 'public' and indexname like 'canton_explorer_%' and tablename <> 'canton_explorer_index_migrations'`,
    )
      .split("\n")
      .find((line) => /^\s*\d+\s*$/.test(line))
      ?.trim(),
    "13",
  );
});

test("bounded update candidates preserve OR/AND and combined filters across large history", async () => {
  const { PqsSummaryService } =
    await import("../backend/dist/src/pqs/pqs-summary.service.js");
  const client = new Client({ connectionString });
  await client.connect();
  const queries = [];
  const service = new PqsSummaryService({
    getRawExecutor: async () => ({
      query: async (sql) => {
        queries.push(sql);
        return client.query(sql);
      },
    }),
  });
  const node = {
    id: "postgresql-test",
    label: "PostgreSQL test",
    role: "participant",
    mode: "pqs_only",
    ledgerLabel: "PostgreSQL test ledger",
    pqs: { connectionUriEnv: "PQS_INDEX_TEST_URL", schema: "public" },
  };

  try {
    const forwardOr = await service.fetchRecentUpdates(node, {
      limit: 2,
      after: "1000",
      parties: ["Alice", "Bob"],
      partyMode: "or",
      templates: ["Other:Bulk"],
    });
    assert.deepEqual(
      forwardOr.updates.map((update) => update.eventOffset),
      ["100002", "100001"],
    );

    const filteredSql = queries.find((sql) =>
      sql.includes("filtered_update_ix as materialized"),
    );
    assert.ok(
      filteredSql,
      "fetchRecentUpdates should issue a filtered SQL query",
    );
    assert.match(filteredSql, /party_0_update_ix as materialized/);
    assert.match(filteredSql, /party_1_update_ix as materialized/);
    assert.match(filteredSql, /template_update_ix as materialized/);
    assert.match(
      filteredSql,
      /candidate_progress as \(\s*select min\(update_ix\) as frontier_update_ix/,
    );
    assert.match(filteredSql, /tx\.ix::text as update_ix/);
    assert.match(
      filteredSql,
      /candidate_progress\.frontier_update_ix::text as candidate_frontier_ix/,
    );
    assert.match(
      filteredSql,
      /from filtered_update_ix\s+join "public"\."__transactions" tx\s+on tx\.ix = filtered_update_ix\.update_ix/,
    );
    assert.doesNotMatch(filteredSql, /contract_row\.created_at_ix = tx\.ix/);
    assert.doesNotMatch(filteredSql, /contract_row\.archived_at_ix = tx\.ix/);
    assert.doesNotMatch(filteredSql, /exercise_row\.exercised_at_ix = tx\.ix/);
    for (const eventColumn of [
      "contract_row.created_at_ix",
      "contract_row.archived_at_ix",
      "exercise_row.exercised_at_ix",
    ]) {
      const escapedColumn = eventColumn.replace(".", "\\.");
      assert.equal(
        filteredSql.match(
          new RegExp(`order by ${escapedColumn} asc\\s+limit 3`, "g"),
        )?.length,
        3,
        `${eventColumn} must have one bounded candidate branch for each party/template filter`,
      );
      assert.equal(
        filteredSql.match(
          new RegExp(
            `order by ${escapedColumn} asc\\s+offset 3\\s+limit 1`,
            "g",
          ),
        )?.length,
        3,
        `${eventColumn} must have one first-unseen frontier probe for each party/template filter`,
      );
    }

    const explain = await client.query(
      `explain (analyze, format json) ${filteredSql}`,
    );
    const plan = explain.rows[0]?.["QUERY PLAN"]?.[0]?.Plan;
    assert.ok(plan, "EXPLAIN should return a JSON plan");
    const planNodes = [];
    const collectPlanNodes = (planNode, ancestors = []) => {
      planNodes.push({ planNode, ancestors });
      for (const child of planNode.Plans ?? []) {
        collectPlanNodes(child, [...ancestors, planNode]);
      }
    };
    collectPlanNodes(plan);
    const eventOrderScans = planNodes.filter(
      ({ planNode }) =>
        typeof planNode["Index Name"] === "string" &&
        planNode["Index Name"].includes(
          "canton_explorer_contracts_29_created_at_ix_order",
        ),
    );
    assert.ok(
      eventOrderScans.length >= 2,
      "the fixture must exercise candidate/frontier physical order scans",
    );
    const candidateBatchSize = 3;
    const duplicateEventRowsPerUpdateIx = 1;
    const physicalOrderWindowBound =
      candidateBatchSize + 1 + duplicateEventRowsPerUpdateIx;
    for (const { planNode, ancestors } of eventOrderScans) {
      const loops = Number(planNode["Actual Loops"] ?? 0);
      const actualRows = Number(planNode["Actual Rows"] ?? 0);
      const rowsRemovedByFilter = Number(
        planNode["Rows Removed by Filter"] ?? 0,
      );
      const rowsRemovedByIndexRecheck = Number(
        planNode["Rows Removed by Index Recheck"] ?? 0,
      );
      const rowsExaminedPerLoop =
        actualRows + rowsRemovedByFilter + rowsRemovedByIndexRecheck;

      assert.ok(
        ancestors.some((ancestor) => ancestor["Node Type"] === "Limit"),
        `${planNode["Index Name"]} must be bounded by a generated candidate/frontier limit`,
      );
      assert.ok(
        loops >= 1 && loops <= candidateBatchSize,
        `${planNode["Index Name"]} must execute a bounded number of candidate-source loops`,
      );
      assert.ok(
        rowsExaminedPerLoop <= physicalOrderWindowBound,
        `${planNode["Index Name"]} must examine at most the candidate batch, first unseen row, and duplicate event row per loop`,
      );
      assert.ok(
        rowsRemovedByFilter <= physicalOrderWindowBound,
        `${planNode["Index Name"]} filter removals must stay within the bounded physical order window`,
      );
      assert.ok(
        rowsRemovedByIndexRecheck <= physicalOrderWindowBound,
        `${planNode["Index Name"]} index rechecks must stay within the bounded physical order window`,
      );
      assert.ok(
        rowsExaminedPerLoop * loops <=
          physicalOrderWindowBound * candidateBatchSize,
        `${planNode["Index Name"]} total examined rows must remain bounded across every loop`,
      );
    }
    assert.ok(
      eventOrderScans.some(({ planNode }) => planNode["Actual Loops"] > 1),
      "the fixture must retain repeated candidate-source scans instead of discarding them",
    );
    assert.ok(
      eventOrderScans.some(
        ({ planNode }) => Number(planNode["Rows Removed by Filter"] ?? 0) > 0,
      ),
      "the fixture must account for bounded filter removals in repeated candidate-source scans",
    );
    const singlePassCandidateFrontierScans = eventOrderScans.filter(
      ({ planNode }) =>
        planNode["Actual Loops"] === 1 && planNode["Actual Rows"] > 0,
    );
    assert.ok(
      singlePassCandidateFrontierScans.length >= 2,
      "the fixture must execute both direct candidate/frontier physical order traversals",
    );
    assert.ok(
      singlePassCandidateFrontierScans.some(
        ({ planNode }) => planNode["Actual Rows"] > candidateBatchSize,
      ),
      "the fixture must physically examine beyond a candidate batch for the first-unseen frontier or duplicate event row",
    );
    const boundedLimitNodes = planNodes.filter(
      ({ planNode }) => planNode["Node Type"] === "Limit",
    );
    assert.ok(
      boundedLimitNodes.length >= 9,
      "EXPLAIN must account for all nine create/archive/exercise candidate branches",
    );
    assert.ok(
      boundedLimitNodes.every(
        ({ planNode }) => planNode["Actual Rows"] <= candidateBatchSize,
      ),
      "every planned candidate/frontier limit must remain bounded by the three-row batch",
    );

    const backwardAnd = await service.fetchRecentUpdates(node, {
      limit: 2,
      before: "120001",
      parties: ["Alice", "Bob"],
      partyMode: "and",
      templates: ["Main:Asset"],
    });
    assert.deepEqual(
      backwardAnd.updates.map((update) => ({
        eventOffset: update.eventOffset,
        parties: update.parties,
      })),
      [{ eventOffset: "1000", parties: ["Alice", "Bob"] }],
    );
  } finally {
    await client.end();
  }
});

test("candidate frontiers make intersected update pages complete in both directions", async () => {
  const { PqsSummaryService } =
    await import("../backend/dist/src/pqs/pqs-summary.service.js");
  const client = new Client({ connectionString });
  await client.connect();
  const queries = [];
  const service = new PqsSummaryService({
    getRawExecutor: async () => ({
      query: async (sql) => {
        queries.push(sql);
        return client.query(sql);
      },
    }),
  });
  const node = {
    id: "postgresql-test",
    label: "PostgreSQL test",
    role: "participant",
    mode: "pqs_only",
    ledgerLabel: "PostgreSQL test ledger",
    pqs: { connectionUriEnv: "PQS_INDEX_TEST_URL", schema: "public" },
  };

  try {
    const forward = await service.fetchRecentUpdates(node, {
      limit: 2,
      after: "140000",
      parties: ["Alice", "Bob"],
      partyMode: "and",
      templates: ["Main:Asset"],
    });
    const backward = await service.fetchRecentUpdates(node, {
      limit: 2,
      before: "130004",
      parties: ["Alice", "Bob"],
      partyMode: "and",
      templates: ["Main:Asset"],
    });
    const summarize = (response) =>
      response.updates.map((update) => ({
        eventOffset: update.eventOffset,
        parties: update.parties,
      }));

    assert.deepEqual(
      {
        forward: summarize(forward),
        backward: summarize(backward),
      },
      {
        forward: [
          { eventOffset: "141001", parties: ["Alice", "Bob"] },
          { eventOffset: "140004", parties: ["Alice", "Bob"] },
        ],
        backward: [
          { eventOffset: "130000", parties: ["Alice", "Bob"] },
          { eventOffset: "129003", parties: ["Alice", "Bob"] },
        ],
      },
      "both directions must include the shared create just beyond the first physical-branch frontier",
    );
    assert.equal(
      forward.updates.filter((update) => update.eventOffset === "140004")
        .length,
      1,
      "the forward page must include the frontier-crossing shared update exactly once",
    );
    assert.equal(
      backward.updates.filter((update) => update.eventOffset === "130000")
        .length,
      1,
      "the backward page must include the frontier-crossing shared update exactly once",
    );

    for (const { cursorLookup, direction } of [
      { cursorLookup: "cursor_tx.offset <= 140000", direction: "forward" },
      { cursorLookup: "cursor_tx.offset >= 130004", direction: "backward" },
    ]) {
      const candidateBatches = queries.filter(
        (sql) =>
          sql.includes(cursorLookup) && sql.includes("candidate_progress as"),
      );
      assert.equal(
        candidateBatches.length,
        2,
        `${direction} AND pagination should issue a second bounded candidate batch`,
      );
      assert.match(candidateBatches[0], /limit 3/);
      assert.match(candidateBatches[1], /limit 6/);
    }
  } finally {
    await client.end();
  }
});

test("visible candidate frontiers complete compound party/template/hide-splice pages", async () => {
  const { PqsSummaryService } =
    await import("../backend/dist/src/pqs/pqs-summary.service.js");
  const client = new Client({ connectionString });
  await client.connect();
  const queries = [];
  const service = new PqsSummaryService({
    getRawExecutor: async () => ({
      query: async (sql) => {
        queries.push(sql);
        return client.query(sql);
      },
    }),
  });
  const node = {
    id: "postgresql-test",
    label: "PostgreSQL test",
    role: "participant",
    mode: "pqs_only",
    ledgerLabel: "PostgreSQL test ledger",
    pqs: { connectionUriEnv: "PQS_INDEX_TEST_URL", schema: "public" },
  };

  try {
    psql(`
      create table public.__contracts_31 partition of public.__contracts for values in (31);
      insert into public.__contract_tpe (pk, module_name, entity_name)
        values (31, 'Splice.Hidden', 'Payload');
      insert into public.__contracts_31
        (tpe_pk, witnesses, create_event_pk, created_at_ix, archived_at_ix, contract_id)
        values
          (31, array['Alice'], 70006, 70006, null, 'hidden-splice-1'),
          (31, array['Alice'], 70005, 70005, null, 'hidden-splice-2'),
          (31, array['Alice'], 70004, 70004, null, 'hidden-splice-3');
      insert into public.__contracts_29
        (tpe_pk, witnesses, create_event_pk, created_at_ix, archived_at_ix, contract_id)
        values
          (29, array['Alice'], 70003, 70003, null, 'visible-other-1'),
          (29, array['Alice'], 70002, 70002, null, 'visible-other-2'),
          (29, array['Alice'], 70001, 70001, null, 'visible-other-3');
      insert into public.__contracts_17
        (tpe_pk, witnesses, create_event_pk, created_at_ix, archived_at_ix, contract_id)
        values
          (17, array['Alice', 'Bob'], 70000, 70000, null, 'visible-shared-frontier'),
          (17, array['Alice', 'Bob'], 69003, 100, 69003, 'visible-shared-old-1'),
          (17, array['Alice', 'Bob'], 69002, 100, 69002, 'visible-shared-old-2'),
          (17, array['Alice', 'Bob'], 69001, 100, 69001, 'visible-shared-old-3');
      insert into public.__transactions
        (ix, "offset", transaction_id, effective_at, paid_traffic_cost)
        values
          (70007, 170007, 'compound-cursor', '2026-08-14T09:00:07Z', null),
          (70006, 170006, 'hidden-splice-update-1', '2026-08-14T09:00:06Z', null),
          (70005, 170005, 'hidden-splice-update-2', '2026-08-14T09:00:05Z', null),
          (70004, 170004, 'hidden-splice-update-3', '2026-08-14T09:00:04Z', null),
          (70003, 170003, 'visible-other-update-1', '2026-08-14T09:00:03Z', null),
          (70002, 170002, 'visible-other-update-2', '2026-08-14T09:00:02Z', null),
          (70001, 170001, 'visible-other-update-3', '2026-08-14T09:00:01Z', null),
          (70000, 170000, 'visible-shared-frontier-update', '2026-08-14T09:00:00Z', null),
          (69003, 169003, 'visible-shared-old-update-1', '2026-08-14T08:59:03Z', null),
          (69002, 169002, 'visible-shared-old-update-2', '2026-08-14T08:59:02Z', null),
          (69001, 169001, 'visible-shared-old-update-3', '2026-08-14T08:59:01Z', null);
      analyze public.__contracts_17;
      analyze public.__contracts_29;
      analyze public.__contracts_31;
      analyze public.__transactions;
    `);

    const response = await service.fetchRecentUpdates(node, {
      limit: 2,
      before: "170007",
      parties: ["Alice", "Bob"],
      partyMode: "and",
      templates: ["Main:Asset"],
      hideSplice: true,
    });

    assert.deepEqual(
      response.updates.map((update) => update.eventOffset),
      ["170000", "169003"],
      "the visible branch first-unseen shared row must expand the page ahead of older intersected updates",
    );
    assert.ok(
      !response.updates.some(
        (update) =>
          update.eventOffset.startsWith("17000") &&
          update.eventOffset !== "170000",
      ),
      "hideSplice must keep hidden Splice updates out of the compound page",
    );

    const candidateBatches = queries.filter(
      (sql) =>
        sql.includes("cursor_tx.offset >= 170007") &&
        sql.includes("candidate_progress as"),
    );
    assert.equal(
      candidateBatches.length,
      2,
      "the visible frontier must force a second bounded candidate batch",
    );
    assert.match(candidateBatches[0], /limit 3/);
    assert.match(candidateBatches[1], /limit 6/);
    assert.match(candidateBatches[0], /visible_update_ix as materialized/);
    assert.match(candidateBatches[0], /not like 'Splice\.%'/);
  } finally {
    await client.end();
  }
});
