export type PqsIndexContext = {
  schema: string;
  contractPartitions: readonly string[];
  hasExercises: boolean;
  transactionIdIsText: boolean;
};

export type IndexMigration = {
  version: string;
  name: string;
  apply(context: PqsIndexContext): readonly string[];
};

const identifierPattern = /^[A-Za-z_][A-Za-z0-9_$]*$/;

export function quoteIdentifier(identifier: string): string {
  if (!identifierPattern.test(identifier)) {
    throw new Error(`Invalid PostgreSQL identifier: ${identifier}`);
  }

  return `"${identifier}"`;
}

export function qualified(schema: string, relation: string): string {
  return `${quoteIdentifier(schema)}.${quoteIdentifier(relation)}`;
}

function indexName(relation: string, suffix: string): string {
  return `canton_explorer_${relation.replace(/^__/, '')}_${suffix}`;
}

export const migrationTableSql = (schema: string): string =>
  `create table if not exists ${qualified(schema, 'canton_explorer_index_migrations')} (version text primary key, applied_at timestamptz not null default current_timestamp)`;

export const contractPartitionsSql = (_schema: string): string => `
  select child.relname as table_name
  from pg_inherits inheritance
  join pg_class parent on parent.oid = inheritance.inhparent
  join pg_namespace parent_schema on parent_schema.oid = parent.relnamespace
  join pg_class child on child.oid = inheritance.inhrelid
  where parent_schema.nspname = $1 and parent.relname = '__contracts'
  order by child.relname`;

export const exercisesExistsSql = (): string => `
  select exists (
    select 1
    from pg_class relation
    join pg_namespace relation_schema on relation_schema.oid = relation.relnamespace
    where relation_schema.nspname = $1 and relation.relname = '__exercises'
  ) as exists`;

export const transactionIdTypeSql = (): string => `
  select attribute.atttypid::regtype::text as column_type
  from pg_attribute attribute
  join pg_class relation on relation.oid = attribute.attrelid
  join pg_namespace relation_schema on relation_schema.oid = relation.relnamespace
  where relation_schema.nspname = $1
    and relation.relname = '__transactions'
    and attribute.attname = 'transaction_id'
    and attribute.attnum > 0
    and not attribute.attisdropped`;

export const expectedIndexStatusSql = (): string => `
  select index_relation.relname as index_name,
    index_metadata.indisvalid as is_valid,
    index_metadata.indisready as is_ready
  from pg_index index_metadata
  join pg_class index_relation on index_relation.oid = index_metadata.indexrelid
  join pg_namespace index_schema on index_schema.oid = index_relation.relnamespace
  where index_schema.nspname = $1 and index_relation.relname = any($2::text[])
  order by index_relation.relname`;

export const migrationVersionsSql = (schema: string): string =>
  `select version from ${qualified(schema, 'canton_explorer_index_migrations')} order by version`;

export const contractWitnessIndexSql = (schema: string, relation: string): string =>
  `create index concurrently if not exists ${quoteIdentifier(indexName(relation, 'witnesses_gin'))} on ${qualified(schema, relation)} using gin (witnesses)`;

export const activeContractsIndexSql = (schema: string, relation: string): string =>
  `create index concurrently if not exists ${quoteIdentifier(indexName(relation, 'active_created_ix'))} on ${qualified(schema, relation)} (created_at_ix desc) where archived_at_ix is null`;

export const transactionIdPatternIndexSql = (schema: string): string =>
  `create index concurrently if not exists ${quoteIdentifier('canton_explorer_transactions_transaction_id_pattern_ops')} on ${qualified(schema, '__transactions')} (transaction_id text_pattern_ops)`;

export const dropIndexSql = (schema: string, indexName: string): string =>
  `drop index concurrently if exists ${qualified(schema, indexName)}`;

export const insertMigrationSql = (schema: string): string =>
  `insert into ${qualified(schema, 'canton_explorer_index_migrations')} (version) values ($1) on conflict (version) do nothing`;

export const advisoryLockSql = 'select pg_advisory_lock(hashtext($1))';
export const advisoryUnlockSql = 'select pg_advisory_unlock(hashtext($1))';

export const pqsIndexMigrations: readonly IndexMigration[] = [
  {
    version: '001-witnesses',
    name: 'Witness lookup indexes',
    apply: (context) => [
      ...context.contractPartitions.map((relation) =>
        contractWitnessIndexSql(context.schema, relation),
      ),
      ...(context.hasExercises
        ? [contractWitnessIndexSql(context.schema, '__exercises')]
        : []),
    ],
  },
  {
    version: '002-active-contracts',
    name: 'Active contracts creation order indexes',
    apply: (context) =>
      context.contractPartitions.map((relation) =>
        activeContractsIndexSql(context.schema, relation),
      ),
  },
  {
    version: '003-transaction-id-pattern',
    name: 'Transaction ID prefix-search index',
    apply: (context) =>
      context.transactionIdIsText ? [transactionIdPatternIndexSql(context.schema)] : [],
  },
];
