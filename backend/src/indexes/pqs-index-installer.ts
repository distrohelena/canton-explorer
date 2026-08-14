import type { PqsRawExecutor } from '../pqs/pqs-manager.factory';
import {
  advisoryLockSql,
  advisoryUnlockSql,
  contractPartitionsSql,
  exercisesExistsSql,
  existingExplorerIndexesSql,
  inspectionExplainSql,
  insertMigrationSql,
  migrationTableSql,
  migrationVersionsSql,
  pqsIndexMigrations,
  transactionIdTypeSql,
  type PqsIndexContext,
} from './pqs-index-sql';

type PartitionRow = { table_name: string };
type ExistsRow = { exists: boolean };
type TransactionIdTypeRow = { column_type: string };
type MigrationVersionRow = { version: string };
type IndexNameRow = { indexname: string };

export type PqsIndexInspection = {
  schema: string;
  contractPartitions: readonly string[];
  hasExercises: boolean;
  transactionIdIsText: boolean;
  existingIndexes: readonly string[];
  proposedSql: readonly string[];
  explainResults: readonly unknown[];
};

export type PqsIndexApplyResult = {
  schema: string;
  appliedVersions: readonly string[];
  newlyAppliedVersions: readonly string[];
  skippedVersions: readonly string[];
  appliedStatements: number;
};

function indexNameFromStatement(statement: string): string {
  const match = statement.match(/if not exists "([^"]+)"/);
  if (!match) {
    throw new Error(`Unable to identify index in migration statement: ${statement}`);
  }
  return match[1];
}

async function inspectSchema(
  executor: PqsRawExecutor,
  schema: string,
): Promise<PqsIndexContext> {
  const [partitionsResult, exercisesResult, transactionIdTypeResult] = await Promise.all([
    executor.query<PartitionRow>(contractPartitionsSql(schema), [schema]),
    executor.query<ExistsRow>(exercisesExistsSql(), [schema]),
    executor.query<TransactionIdTypeRow>(transactionIdTypeSql(), [schema]),
  ]);

  return {
    schema,
    contractPartitions: partitionsResult.rows.map((row) => row.table_name),
    hasExercises: exercisesResult.rows[0]?.exists === true,
    transactionIdIsText: transactionIdTypeResult.rows[0]?.column_type === 'text',
  };
}

function plannedStatements(context: PqsIndexContext): readonly string[] {
  return pqsIndexMigrations.flatMap((migration) => migration.apply(context));
}

export async function inspectPqsIndexes(
  executor: PqsRawExecutor,
  schema: string,
): Promise<PqsIndexInspection> {
  const [context, existingIndexesResult] = await Promise.all([
    inspectSchema(executor, schema),
    executor.query<IndexNameRow>(existingExplorerIndexesSql(), [schema]),
  ]);
  const existingIndexes = existingIndexesResult.rows.map((row) => row.indexname);
  const existingIndexNames = new Set(existingIndexes);
  const proposedSql = plannedStatements(context).filter(
    (statement) => !existingIndexNames.has(indexNameFromStatement(statement)),
  );
  const explainResults = await Promise.all(
    context.contractPartitions.map(async (relation) => {
      const result = await executor.query<unknown>(inspectionExplainSql(schema, relation));
      return result.rows;
    }),
  );

  return {
    schema,
    contractPartitions: context.contractPartitions,
    hasExercises: context.hasExercises,
    transactionIdIsText: context.transactionIdIsText,
    existingIndexes,
    proposedSql,
    explainResults,
  };
}

export async function applyPqsIndexes(
  executor: PqsRawExecutor,
  schema: string,
): Promise<PqsIndexApplyResult> {
  const lockKey = `canton-explorer-indexes:${schema}`;
  let lockAcquired = false;

  try {
    await executor.query(advisoryLockSql, [lockKey]);
    lockAcquired = true;

    await executor.query(migrationTableSql(schema));
    const [appliedResult, context] = await Promise.all([
      executor.query<MigrationVersionRow>(migrationVersionsSql(schema)),
      inspectSchema(executor, schema),
    ]);
    const appliedVersions = new Set(appliedResult.rows.map((row) => row.version));
    const newlyAppliedVersions: string[] = [];
    const skippedVersions: string[] = [];
    let appliedStatements = 0;

    for (const migration of pqsIndexMigrations) {
      if (appliedVersions.has(migration.version)) {
        skippedVersions.push(migration.version);
        continue;
      }

      const statements = migration.apply(context);
      if (statements.length === 0) {
        skippedVersions.push(migration.version);
        continue;
      }

      for (const statement of statements) {
        await executor.query(statement);
        appliedStatements += 1;
      }

      await executor.query(insertMigrationSql(schema), [migration.version]);
      appliedVersions.add(migration.version);
      newlyAppliedVersions.push(migration.version);
    }

    return {
      schema,
      appliedVersions: [...appliedVersions].sort(),
      newlyAppliedVersions,
      skippedVersions,
      appliedStatements,
    };
  } finally {
    if (lockAcquired) {
      await executor.query(advisoryUnlockSql, [lockKey]);
    }
  }
}
