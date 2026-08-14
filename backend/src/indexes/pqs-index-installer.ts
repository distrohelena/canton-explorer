import {
  advisoryLockSql,
  advisoryUnlockSql,
  dropIndexSql,
  explorerIndexDefinitionsSql,
  insertMigrationSql,
  migrationTableSql,
  migrationVersionsSql,
  pqsIndexMigrations,
  pqsVersionSql,
  relationPartitionsSql,
  relationStatsSql,
  representativeExplainSql,
  schemaShapeSql,
  type ExpectedPqsIndex,
  type PqsIndexContext,
} from './pqs-index-sql';

type PartitionRow = { table_name: string; estimated_rows?: string };
type MigrationVersionRow = { version: string };
type PqsVersionRow = { version: string };
type SchemaShapeRow = {
  relation_name: string;
  relation_kind: string;
  partition_key: string | null;
  column_name: string;
  column_type: string;
};
type RelationStatsRow = {
  relation_name: string;
  partition_count: string;
  estimated_rows: string;
  table_size_bytes: string;
  index_size_bytes: string;
  total_size_bytes: string;
};
type IndexDefinitionRow = {
  index_name: string;
  table_schema: string;
  table_name: string;
  access_method: string;
  is_unique: boolean;
  is_valid: boolean;
  is_ready: boolean;
  key_expressions: string[];
  included_expressions: string[];
  operator_classes: string[];
  sort_options: number[];
  predicate: string | null;
  index_definition: string;
  size_bytes: string;
};
type ExplainRow = { 'QUERY PLAN': unknown };

type DirectPostgresClient = {
  connect(): Promise<void>;
  end(): Promise<void>;
  query(sql: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
};

type DirectPostgresClientFactory = (
  connectionString: string,
) => DirectPostgresClient;

export interface PqsIndexDatabase {
  query<TRow>(
    sql: string,
    values?: readonly unknown[],
  ): Promise<{ rows: TRow[] }>;
  end(): Promise<void>;
}

export type PqsIndexDatabaseFactory = (
  connectionString: string,
) => Promise<PqsIndexDatabase>;

export type PqsIndexInstallerDependencies = {
  createDatabase?: PqsIndexDatabaseFactory;
};

export type PqsIndexState = 'ready' | 'invalid' | 'conflict' | 'unexpected';

export type PqsIndexStatus = {
  name: string;
  tableSchema: string;
  tableName: string;
  accessMethod: string;
  keyExpressions: readonly string[];
  includedExpressions: readonly string[];
  operatorClasses: readonly string[];
  sortOptions: readonly number[];
  predicate: string | null;
  definition: string;
  sizeBytes: string;
  isUnique: boolean;
  isValid: boolean;
  isReady: boolean;
  state: PqsIndexState;
  definitionMatches: boolean;
  mismatchReasons: readonly string[];
};

export type PqsIndexConflict = {
  name: string;
  reasons: readonly string[];
  actualDefinition: string;
};

export type PqsRelationStats = {
  relationName: string;
  partitionCount: number;
  estimatedRows: string;
  tableSizeBytes: string;
  indexSizeBytes: string;
  totalSizeBytes: string;
};

export type PqsIndexInspection = {
  schema: string;
  schemaValidation: {
    supported: true;
    pqsVersion: string | null;
    checkedRelations: readonly string[];
  };
  contractPartitions: readonly string[];
  exercisePartitions: readonly string[];
  hasExercises: boolean;
  transactionIdIsText: boolean;
  indexStatuses: readonly PqsIndexStatus[];
  conflicts: readonly PqsIndexConflict[];
  relationStats: readonly PqsRelationStats[];
  representativeExplain: {
    relation: string;
    sql: string;
    plan: unknown;
  };
  proposedSql: readonly string[];
  repairSql: readonly string[];
};

export type PqsIndexApplyResult = {
  schema: string;
  appliedVersions: readonly string[];
  newlyAppliedVersions: readonly string[];
  skippedVersions: readonly string[];
  appliedStatements: number;
  repairedIndexes: readonly string[];
};

type ValidatedPqsSchema = {
  context: PqsIndexContext;
  checkedRelations: readonly string[];
  representativeContractPartition: string | null;
};

const checkedRelations = [
  '__contracts',
  '__exercises',
  '__transactions',
  'flyway_schema_history',
] as const;

const requiredColumns: Readonly<
  Record<string, Readonly<Record<string, string | RegExp>>>
> = {
  __contracts: {
    tpe_pk: 'bigint',
    create_event_pk: 'bigint',
    created_at_ix: 'bigint',
    archived_at_ix: 'bigint',
    witnesses: 'text[]',
  },
  __exercises: {
    tpe_pk: 'bigint',
    witnesses: 'text[]',
  },
  __transactions: {
    ix: 'bigint',
    offset: 'bigint',
    transaction_id: /.+/,
  },
  flyway_schema_history: {
    installed_rank: 'integer',
    version: /^character varying/,
    success: 'boolean',
  },
};

function directPostgresClientFactory(
  connectionString: string,
): DirectPostgresClient {
  // The Explorer SDK intentionally blocks mutations in $queryRaw. The installer
  // owns this narrowly scoped direct connection so ordinary Explorer reads stay
  // on the SDK's read-only path.
  const { Client } = require('pg') as {
    Client: new (options: { connectionString: string }) => DirectPostgresClient;
  };
  return new Client({ connectionString });
}

export async function createPqsIndexDatabase(
  connectionString: string,
  createClient: DirectPostgresClientFactory = directPostgresClientFactory,
): Promise<PqsIndexDatabase> {
  const client = createClient(connectionString);
  try {
    await client.connect();
  } catch (error) {
    await client.end();
    throw error;
  }

  return {
    query: async <TRow>(sql: string, values: readonly unknown[] = []) => {
      const result = await client.query(sql, [...values]);
      return { rows: result.rows as TRow[] };
    },
    end: () => client.end(),
  };
}

function normalizeSqlFragment(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  return value.replaceAll('"', '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function arraysEqual<T>(left: readonly T[], right: readonly T[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function definitionMismatchReasons(
  actual: IndexDefinitionRow,
  expected: ExpectedPqsIndex,
): string[] {
  const reasons: string[] = [];
  if (
    actual.table_schema !== expected.schema ||
    actual.table_name !== expected.relation
  ) {
    reasons.push(
      `target table is ${actual.table_schema}.${actual.table_name}, expected ${expected.schema}.${expected.relation}`,
    );
  }
  if (actual.access_method !== expected.accessMethod) {
    reasons.push(
      `access method is ${actual.access_method}, expected ${expected.accessMethod}`,
    );
  }
  if (actual.is_unique !== expected.isUnique) {
    reasons.push(
      `uniqueness is ${actual.is_unique}, expected ${expected.isUnique}`,
    );
  }

  const actualExpressions = actual.key_expressions.map(normalizeSqlFragment);
  const expectedExpressions = expected.keyExpressions.map(normalizeSqlFragment);
  if (!arraysEqual(actualExpressions, expectedExpressions)) {
    reasons.push(
      `indexed expressions are [${actual.key_expressions.join(', ')}], expected [${expected.keyExpressions.join(', ')}]`,
    );
  }
  const actualIncluded = actual.included_expressions.map(normalizeSqlFragment);
  const expectedIncluded = expected.includedExpressions.map(
    normalizeSqlFragment,
  );
  if (!arraysEqual(actualIncluded, expectedIncluded)) {
    reasons.push(
      `included expressions are [${actual.included_expressions.join(', ')}], expected [${expected.includedExpressions.join(', ')}]`,
    );
  }
  if (!arraysEqual(actual.operator_classes, expected.operatorClasses)) {
    reasons.push(
      `operator classes are [${actual.operator_classes.join(', ')}], expected [${expected.operatorClasses.join(', ')}]`,
    );
  }
  if (!arraysEqual(actual.sort_options, expected.sortOptions)) {
    reasons.push(
      `sort options are [${actual.sort_options.join(', ')}], expected [${expected.sortOptions.join(', ')}]`,
    );
  }
  if (
    normalizeSqlFragment(actual.predicate) !==
    normalizeSqlFragment(expected.predicate)
  ) {
    reasons.push(
      `predicate is ${actual.predicate ?? '<none>'}, expected ${expected.predicate ?? '<none>'}`,
    );
  }
  return reasons;
}

function toIndexStatus(
  actual: IndexDefinitionRow,
  expected?: ExpectedPqsIndex,
): PqsIndexStatus {
  const mismatchReasons = expected
    ? definitionMismatchReasons(actual, expected)
    : [];
  const state: PqsIndexState = !expected
    ? 'unexpected'
    : !actual.is_valid || !actual.is_ready
      ? 'invalid'
      : mismatchReasons.length > 0
        ? 'conflict'
        : 'ready';

  return {
    name: actual.index_name,
    tableSchema: actual.table_schema,
    tableName: actual.table_name,
    accessMethod: actual.access_method,
    keyExpressions: actual.key_expressions,
    includedExpressions: actual.included_expressions,
    operatorClasses: actual.operator_classes,
    sortOptions: actual.sort_options,
    predicate: actual.predicate,
    definition: actual.index_definition,
    sizeBytes: actual.size_bytes,
    isUnique: actual.is_unique,
    isValid: actual.is_valid,
    isReady: actual.is_ready,
    state,
    definitionMatches: Boolean(expected) && mismatchReasons.length === 0,
    mismatchReasons,
  };
}

function validateSchemaShape(schema: string, rows: readonly SchemaShapeRow[]): void {
  const failures: string[] = [];
  const byRelation = new Map<string, SchemaShapeRow[]>();
  for (const row of rows) {
    const existing = byRelation.get(row.relation_name) ?? [];
    existing.push(row);
    byRelation.set(row.relation_name, existing);
  }

  for (const relationName of checkedRelations) {
    const relationRows = byRelation.get(relationName);
    if (!relationRows || relationRows.length === 0) {
      failures.push(`missing relation ${relationName}`);
      continue;
    }

    const expectedKind =
      relationName === '__contracts' || relationName === '__exercises'
        ? 'p'
        : 'r';
    if (relationRows[0]?.relation_kind !== expectedKind) {
      failures.push(
        `${relationName} has relkind ${relationRows[0]?.relation_kind}, expected ${expectedKind}`,
      );
    }
    if (
      expectedKind === 'p' &&
      normalizeSqlFragment(relationRows[0]?.partition_key ?? null) !==
        'list (tpe_pk)'
    ) {
      failures.push(
        `${relationName} is not LIST partitioned by tpe_pk`,
      );
    }

    const columns = new Map(
      relationRows.map((row) => [row.column_name, row.column_type]),
    );
    for (const [columnName, expectedType] of Object.entries(
      requiredColumns[relationName] ?? {},
    )) {
      const actualType = columns.get(columnName);
      const matches =
        typeof expectedType === 'string'
          ? actualType === expectedType
          : actualType !== undefined && expectedType.test(actualType);
      if (!matches) {
        failures.push(
          `${relationName}.${columnName} has type ${actualType ?? '<missing>'}, expected ${String(expectedType)}`,
        );
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Unsupported PQS schema ${schema}: ${failures.join('; ')}`,
    );
  }
}

async function inspectValidatedSchema(
  database: PqsIndexDatabase,
  schema: string,
): Promise<ValidatedPqsSchema> {
  const shapeResult = await database.query<SchemaShapeRow>(schemaShapeSql(), [
    schema,
    checkedRelations,
  ]);
  validateSchemaShape(schema, shapeResult.rows);

  const contractPartitionsResult = await database.query<PartitionRow>(
    relationPartitionsSql(),
    [schema, '__contracts'],
  );
  const exercisePartitionsResult = await database.query<PartitionRow>(
    relationPartitionsSql(),
    [schema, '__exercises'],
  );
  const transactionIdType = shapeResult.rows.find(
    (row) =>
      row.relation_name === '__transactions' &&
      row.column_name === 'transaction_id',
  )?.column_type;

  return {
    context: {
      schema,
      contractPartitions: contractPartitionsResult.rows.map(
        (row) => row.table_name,
      ),
      exercisePartitions: exercisePartitionsResult.rows.map(
        (row) => row.table_name,
      ),
      transactionIdIsText: transactionIdType === 'text',
    },
    checkedRelations,
    representativeContractPartition:
      [...contractPartitionsResult.rows].sort(
        (left, right) =>
          Number(right.estimated_rows ?? 0) -
            Number(left.estimated_rows ?? 0) ||
          left.table_name.localeCompare(right.table_name),
      )[0]?.table_name ?? null,
  };
}

function plannedIndexes(context: PqsIndexContext): readonly ExpectedPqsIndex[] {
  return pqsIndexMigrations.flatMap((migration) =>
    migration.indexes(context),
  );
}

async function actualIndexRows(
  database: PqsIndexDatabase,
  schema: string,
): Promise<readonly IndexDefinitionRow[]> {
  const result = await database.query<IndexDefinitionRow>(
    explorerIndexDefinitionsSql(),
    [schema],
  );
  return result.rows;
}

function inspectIndexDefinitions(
  actualRows: readonly IndexDefinitionRow[],
  expectedIndexes: readonly ExpectedPqsIndex[],
): {
  statuses: readonly PqsIndexStatus[];
  conflicts: readonly PqsIndexConflict[];
  proposedSql: readonly string[];
  repairSql: readonly string[];
} {
  const expectedByName = new Map(
    expectedIndexes.map((index) => [index.name, index]),
  );
  const actualNames = new Set(actualRows.map((row) => row.index_name));
  const statuses = actualRows.map((row) =>
    toIndexStatus(row, expectedByName.get(row.index_name)),
  );
  const conflicts = statuses
    .filter((status) => status.state === 'conflict')
    .map((status) => ({
      name: status.name,
      reasons: status.mismatchReasons,
      actualDefinition: status.definition,
    }));
  const proposedSql = expectedIndexes
    .filter((index) => !actualNames.has(index.name))
    .map((index) => index.createSql);
  const repairSql = statuses
    .filter((status) => status.state === 'invalid')
    .flatMap((status) => {
      const expected = expectedByName.get(status.name);
      return expected
        ? [dropIndexSql(expected.schema, expected.name), expected.createSql]
        : [];
    });

  return { statuses, conflicts, proposedSql, repairSql };
}

async function withPqsIndexDatabase<TResult>(
  connectionString: string,
  dependencies: PqsIndexInstallerDependencies,
  operation: (database: PqsIndexDatabase) => Promise<TResult>,
): Promise<TResult> {
  const database = await (
    dependencies.createDatabase ?? createPqsIndexDatabase
  )(connectionString);
  try {
    return await operation(database);
  } finally {
    await database.end();
  }
}

export async function inspectPqsIndexes(
  connectionString: string,
  schema: string,
  dependencies: PqsIndexInstallerDependencies = {},
): Promise<PqsIndexInspection> {
  return withPqsIndexDatabase(
    connectionString,
    dependencies,
    async (database) => {
      const validated = await inspectValidatedSchema(database, schema);
      const expectedIndexes = plannedIndexes(validated.context);
      const indexes = inspectIndexDefinitions(
        await actualIndexRows(database, schema),
        expectedIndexes,
      );
      const versionResult = await database.query<PqsVersionRow>(
        pqsVersionSql(schema),
      );
      const statsResult = await database.query<RelationStatsRow>(
        relationStatsSql(),
        [schema, ['__contracts', '__exercises', '__transactions']],
      );
      const explainRelation =
        validated.representativeContractPartition ?? '__contracts';
      const explainSql = representativeExplainSql(schema, explainRelation);
      const explainResult = await database.query<ExplainRow>(explainSql);

      return {
        schema,
        schemaValidation: {
          supported: true,
          pqsVersion: versionResult.rows[0]?.version ?? null,
          checkedRelations: validated.checkedRelations,
        },
        contractPartitions: validated.context.contractPartitions,
        exercisePartitions: validated.context.exercisePartitions,
        hasExercises: validated.context.exercisePartitions.length > 0,
        transactionIdIsText: validated.context.transactionIdIsText,
        indexStatuses: indexes.statuses,
        conflicts: indexes.conflicts,
        relationStats: statsResult.rows.map((row) => ({
          relationName: row.relation_name,
          partitionCount: Number(row.partition_count),
          estimatedRows: row.estimated_rows,
          tableSizeBytes: row.table_size_bytes,
          indexSizeBytes: row.index_size_bytes,
          totalSizeBytes: row.total_size_bytes,
        })),
        representativeExplain: {
          relation: explainRelation,
          sql: explainSql,
          plan: explainResult.rows[0]?.['QUERY PLAN'] ?? null,
        },
        proposedSql: indexes.proposedSql,
        repairSql: indexes.repairSql,
      };
    },
  );
}

async function reconcilePqsIndexes(
  connectionString: string,
  schema: string,
  mode: 'apply' | 'repair',
  dependencies: PqsIndexInstallerDependencies,
): Promise<PqsIndexApplyResult> {
  return withPqsIndexDatabase(
    connectionString,
    dependencies,
    async (database) => {
      const lockKey = `canton-explorer-indexes:${schema}`;
      let lockAcquired = false;

      try {
        await database.query(advisoryLockSql, [lockKey]);
        lockAcquired = true;

        // This shape check must precede every persistent write, including the
        // Explorer-owned migration table.
        const validated = await inspectValidatedSchema(database, schema);
        const allExpectedIndexes = plannedIndexes(validated.context);
        const initialRows = await actualIndexRows(database, schema);
        const initialInspection = inspectIndexDefinitions(
          initialRows,
          allExpectedIndexes,
        );
        if (initialInspection.conflicts.length > 0) {
          throw new Error(
            `Conflicting Explorer index definitions: ${initialInspection.conflicts
              .map((conflict) => `${conflict.name} (${conflict.reasons.join(', ')})`)
              .join('; ')}`,
          );
        }
        const invalidIndexes = initialInspection.statuses.filter(
          (status) => status.state === 'invalid',
        );
        if (mode === 'apply' && invalidIndexes.length > 0) {
          throw new Error(
            `Invalid Explorer indexes require explicit indexes repair: ${invalidIndexes
              .map((status) => status.name)
              .join(', ')}`,
          );
        }

        await database.query(migrationTableSql(schema));
        const appliedResult = await database.query<MigrationVersionRow>(
          migrationVersionsSql(schema),
        );
        const appliedVersions = new Set(
          appliedResult.rows.map((row) => row.version),
        );
        const newlyAppliedVersions: string[] = [];
        const skippedVersions: string[] = [];
        const repairedIndexes: string[] = [];
        let appliedStatements = 0;

        for (const migration of pqsIndexMigrations) {
          const expectedIndexes = migration.indexes(validated.context);
          if (expectedIndexes.length === 0) {
            skippedVersions.push(migration.version);
            continue;
          }

          const currentRows = await actualIndexRows(database, schema);
          const currentByName = new Map(
            currentRows.map((row) => [row.index_name, row]),
          );
          for (const expected of expectedIndexes) {
            const current = currentByName.get(expected.name);
            if (!current) {
              await database.query(expected.createSql);
              appliedStatements += 1;
              continue;
            }

            const status = toIndexStatus(current, expected);
            if (status.state === 'ready') {
              continue;
            }
            if (status.state === 'conflict') {
              throw new Error(
                `Conflicting Explorer index ${status.name}: ${status.mismatchReasons.join(', ')}`,
              );
            }
            if (mode !== 'repair') {
              throw new Error(
                `Invalid Explorer index ${status.name} requires explicit indexes repair`,
              );
            }

            await database.query(dropIndexSql(schema, expected.name));
            appliedStatements += 1;
            await database.query(expected.createSql);
            appliedStatements += 1;
            repairedIndexes.push(expected.name);
          }

          const reconciledRows = await actualIndexRows(database, schema);
          const reconciledByName = new Map(
            reconciledRows.map((row) => [row.index_name, row]),
          );
          const incomplete = expectedIndexes
            .map((expected) => {
              const actual = reconciledByName.get(expected.name);
              return actual ? toIndexStatus(actual, expected) : null;
            })
            .find((status) => status?.state !== 'ready');
          if (incomplete !== undefined) {
            throw new Error(
              incomplete === null
                ? `Expected Explorer index is missing after reconciliation`
                : `Index ${incomplete.name} is ${incomplete.state} after reconciliation`,
            );
          }

          if (!appliedVersions.has(migration.version)) {
            await database.query(insertMigrationSql(schema), [
              migration.version,
            ]);
            appliedVersions.add(migration.version);
            newlyAppliedVersions.push(migration.version);
          }
        }

        return {
          schema,
          appliedVersions: [...appliedVersions].sort(),
          newlyAppliedVersions,
          skippedVersions,
          appliedStatements,
          repairedIndexes,
        };
      } finally {
        if (lockAcquired) {
          await database.query(advisoryUnlockSql, [lockKey]);
        }
      }
    },
  );
}

export async function applyPqsIndexes(
  connectionString: string,
  schema: string,
  dependencies: PqsIndexInstallerDependencies = {},
): Promise<PqsIndexApplyResult> {
  return reconcilePqsIndexes(connectionString, schema, 'apply', dependencies);
}

export async function repairPqsIndexes(
  connectionString: string,
  schema: string,
  dependencies: PqsIndexInstallerDependencies = {},
): Promise<PqsIndexApplyResult> {
  return reconcilePqsIndexes(connectionString, schema, 'repair', dependencies);
}
