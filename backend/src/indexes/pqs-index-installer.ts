import {
  advisoryLockSql,
  advisoryUnlockSql,
  dropIndexSql,
  expectedIndexStatusSql,
  insertMigrationSql,
  migrationTableSql,
  migrationVersionsSql,
  pqsIndexMigrations,
  relationPartitionsSql,
  transactionIdTypeSql,
  type PqsIndexContext,
} from './pqs-index-sql';

type PartitionRow = { table_name: string };
type TransactionIdTypeRow = { column_type: string };
type MigrationVersionRow = { version: string };
type IndexStatusRow = {
  index_name: string;
  is_valid: boolean;
  is_ready: boolean;
};

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

export type PqsIndexStatus = {
  name: string;
  isValid: boolean;
  isReady: boolean;
};

export type PqsIndexInspection = {
  schema: string;
  contractPartitions: readonly string[];
  exercisePartitions: readonly string[];
  hasExercises: boolean;
  transactionIdIsText: boolean;
  indexStatuses: readonly PqsIndexStatus[];
  proposedSql: readonly string[];
};

export type PqsIndexApplyResult = {
  schema: string;
  appliedVersions: readonly string[];
  newlyAppliedVersions: readonly string[];
  skippedVersions: readonly string[];
  appliedStatements: number;
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

function indexNameFromStatement(statement: string): string {
  const match = statement.match(/if not exists "([^"]+)"/);
  if (!match) {
    throw new Error(
      `Unable to identify index in migration statement: ${statement}`,
    );
  }
  return match[1];
}

async function inspectSchema(
  database: PqsIndexDatabase,
  schema: string,
): Promise<PqsIndexContext> {
  const partitionsResult = await database.query<PartitionRow>(
    relationPartitionsSql(),
    [schema, '__contracts'],
  );
  const exercisesPartitionsResult = await database.query<PartitionRow>(
    relationPartitionsSql(),
    [schema, '__exercises'],
  );
  const transactionIdTypeResult = await database.query<TransactionIdTypeRow>(
    transactionIdTypeSql(),
    [schema],
  );

  return {
    schema,
    contractPartitions: partitionsResult.rows.map((row) => row.table_name),
    exercisePartitions: exercisesPartitionsResult.rows.map(
      (row) => row.table_name,
    ),
    transactionIdIsText:
      transactionIdTypeResult.rows[0]?.column_type === 'text',
  };
}

function plannedStatements(context: PqsIndexContext): readonly string[] {
  return pqsIndexMigrations.flatMap((migration) => migration.apply(context));
}

async function indexStatuses(
  database: PqsIndexDatabase,
  schema: string,
  expectedIndexNames: readonly string[],
): Promise<Map<string, PqsIndexStatus>> {
  if (expectedIndexNames.length === 0) {
    return new Map();
  }

  const result = await database.query<IndexStatusRow>(
    expectedIndexStatusSql(),
    [schema, expectedIndexNames],
  );
  return new Map(
    result.rows.map((row) => [
      row.index_name,
      { name: row.index_name, isValid: row.is_valid, isReady: row.is_ready },
    ]),
  );
}

function reconciliationStatements(
  schema: string,
  statements: readonly string[],
  statuses: ReadonlyMap<string, PqsIndexStatus>,
): readonly string[] {
  return statements.flatMap((statement) => {
    const indexName = indexNameFromStatement(statement);
    const status = statuses.get(indexName);
    if (status?.isValid === true && status.isReady === true) {
      return [];
    }
    return status ? [dropIndexSql(schema, indexName), statement] : [statement];
  });
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
      const context = await inspectSchema(database, schema);
      const statements = plannedStatements(context);
      const statuses = await indexStatuses(
        database,
        schema,
        statements.map(indexNameFromStatement),
      );

      return {
        schema,
        contractPartitions: context.contractPartitions,
        exercisePartitions: context.exercisePartitions,
        hasExercises: context.exercisePartitions.length > 0,
        transactionIdIsText: context.transactionIdIsText,
        indexStatuses: [...statuses.values()],
        proposedSql: reconciliationStatements(schema, statements, statuses),
      };
    },
  );
}

export async function applyPqsIndexes(
  connectionString: string,
  schema: string,
  dependencies: PqsIndexInstallerDependencies = {},
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

        await database.query(migrationTableSql(schema));
        const appliedResult = await database.query<MigrationVersionRow>(
          migrationVersionsSql(schema),
        );
        const context = await inspectSchema(database, schema);
        const appliedVersions = new Set(
          appliedResult.rows.map((row) => row.version),
        );
        const newlyAppliedVersions: string[] = [];
        const skippedVersions: string[] = [];
        let appliedStatements = 0;

        for (const migration of pqsIndexMigrations) {
          const statements = migration.apply(context);
          if (statements.length === 0) {
            skippedVersions.push(migration.version);
            continue;
          }

          const expectedIndexNames = statements.map(indexNameFromStatement);
          const currentStatuses = await indexStatuses(
            database,
            schema,
            expectedIndexNames,
          );

          for (const statement of reconciliationStatements(
            schema,
            statements,
            currentStatuses,
          )) {
            await database.query(statement);
            appliedStatements += 1;
          }

          const reconciledStatuses = await indexStatuses(
            database,
            schema,
            expectedIndexNames,
          );
          const invalidIndex = expectedIndexNames.find((indexName) => {
            const status = reconciledStatuses.get(indexName);
            return status?.isValid !== true || status.isReady !== true;
          });
          if (invalidIndex) {
            throw new Error(
              `Index ${invalidIndex} is not valid and ready after reconciliation`,
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
        };
      } finally {
        if (lockAcquired) {
          await database.query(advisoryUnlockSql, [lockKey]);
        }
      }
    },
  );
}
