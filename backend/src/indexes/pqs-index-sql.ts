export type PqsIndexContext = {
  schema: string;
  contractPartitions: readonly string[];
  exercisePartitions: readonly string[];
  transactionIdIsText: boolean;
};

export type ExpectedPqsIndex = {
  name: string;
  schema: string;
  relation: string;
  accessMethod: 'btree' | 'gin';
  keyExpressions: readonly string[];
  includedExpressions: readonly string[];
  operatorClasses: readonly string[];
  sortOptions: readonly number[];
  predicate: string | null;
  isUnique: boolean;
  createSql: string;
};

export type IndexMigration = {
  version: string;
  name: string;
  indexes(context: PqsIndexContext): readonly ExpectedPqsIndex[];
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

export const schemaShapeSql = (): string => `
  /* canton-explorer:schema-shape */
  select relation.relname as relation_name,
    relation.relkind::text as relation_kind,
    pg_get_partkeydef(relation.oid) as partition_key,
    attribute.attname as column_name,
    format_type(attribute.atttypid, attribute.atttypmod) as column_type
  from pg_class relation
  join pg_namespace relation_schema on relation_schema.oid = relation.relnamespace
  join pg_attribute attribute on attribute.attrelid = relation.oid
  where relation_schema.nspname = $1
    and relation.relname = any($2::text[])
    and attribute.attnum > 0
    and not attribute.attisdropped
  order by relation.relname, attribute.attnum`;

export const pqsVersionSql = (schema: string): string => `
  /* canton-explorer:pqs-version */
  select version
  from ${qualified(schema, 'flyway_schema_history')}
  where success = true and version is not null
  order by installed_rank desc
  limit 1`;

export const relationPartitionsSql = (): string => `
  select child.relname as table_name,
    greatest(0, child.reltuples)::bigint::text as estimated_rows
  from pg_inherits inheritance
  join pg_class parent on parent.oid = inheritance.inhparent
  join pg_namespace parent_schema on parent_schema.oid = parent.relnamespace
  join pg_class child on child.oid = inheritance.inhrelid
  where parent_schema.nspname = $1 and parent.relname = $2
  order by child.relname`;

export const relationStatsSql = (): string => `
  /* canton-explorer:relation-stats */
  select parent.relname as relation_name,
    case
      when parent.relkind = 'p' then (
        select count(*)::text from pg_inherits where inhparent = parent.oid
      )
      else '0'
    end as partition_count,
    case
      when parent.relkind = 'p' then coalesce((
        select greatest(0, sum(child.reltuples))::bigint::text
        from pg_inherits inheritance
        join pg_class child on child.oid = inheritance.inhrelid
        where inheritance.inhparent = parent.oid
      ), '0')
      else greatest(0, parent.reltuples)::bigint::text
    end as estimated_rows,
    case
      when parent.relkind = 'p' then coalesce((
        select sum(pg_table_size(child.oid))::text
        from pg_inherits inheritance
        join pg_class child on child.oid = inheritance.inhrelid
        where inheritance.inhparent = parent.oid
      ), '0')
      else pg_table_size(parent.oid)::text
    end as table_size_bytes,
    case
      when parent.relkind = 'p' then coalesce((
        select sum(pg_indexes_size(child.oid))::text
        from pg_inherits inheritance
        join pg_class child on child.oid = inheritance.inhrelid
        where inheritance.inhparent = parent.oid
      ), '0')
      else pg_indexes_size(parent.oid)::text
    end as index_size_bytes,
    case
      when parent.relkind = 'p' then coalesce((
        select sum(pg_total_relation_size(child.oid))::text
        from pg_inherits inheritance
        join pg_class child on child.oid = inheritance.inhrelid
        where inheritance.inhparent = parent.oid
      ), '0')
      else pg_total_relation_size(parent.oid)::text
    end as total_size_bytes
  from pg_class parent
  join pg_namespace parent_schema on parent_schema.oid = parent.relnamespace
  where parent_schema.nspname = $1
    and parent.relname = any($2::text[])
  order by parent.relname`;

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

export const explorerIndexDefinitionsSql = (): string => `
  /* canton-explorer:index-definitions */
  select index_relation.relname as index_name,
    table_schema.nspname as table_schema,
    table_relation.relname as table_name,
    access_method.amname as access_method,
    index_metadata.indisunique as is_unique,
    index_metadata.indisvalid as is_valid,
    index_metadata.indisready as is_ready,
    index_metadata.indoption::int2[] as sort_options,
    array(
      select pg_get_indexdef(index_metadata.indexrelid, key_number, true)
      from generate_series(1, index_metadata.indnkeyatts) key_number
      order by key_number
    ) as key_expressions,
    array(
      select pg_get_indexdef(index_metadata.indexrelid, attribute_number, true)
      from generate_series(index_metadata.indnkeyatts + 1, index_metadata.indnatts) attribute_number
      order by attribute_number
    ) as included_expressions,
    array(
      select operator_class.opcname
      from unnest(index_metadata.indclass::oid[]) with ordinality class_oid(oid, position)
      join pg_opclass operator_class on operator_class.oid = class_oid.oid
      order by class_oid.position
    )::text[] as operator_classes,
    pg_get_expr(index_metadata.indpred, index_metadata.indrelid, true) as predicate,
    pg_get_indexdef(index_relation.oid) as index_definition,
    pg_relation_size(index_relation.oid)::text as size_bytes
  from pg_index index_metadata
  join pg_class index_relation on index_relation.oid = index_metadata.indexrelid
  join pg_namespace index_schema on index_schema.oid = index_relation.relnamespace
  join pg_class table_relation on table_relation.oid = index_metadata.indrelid
  join pg_namespace table_schema on table_schema.oid = table_relation.relnamespace
  join pg_am access_method on access_method.oid = index_relation.relam
  where index_schema.nspname = $1
    and index_relation.relname like 'canton_explorer_%'
  order by index_relation.relname`;

export const migrationVersionsSql = (schema: string): string =>
  `select version from ${qualified(schema, 'canton_explorer_index_migrations')} order by version`;

export const contractWitnessIndexSql = (
  schema: string,
  relation: string,
): string =>
  `create index concurrently if not exists ${quoteIdentifier(indexName(relation, 'witnesses_gin'))} on ${qualified(schema, relation)} using gin (witnesses)`;

export function contractWitnessIndex(
  schema: string,
  relation: string,
): ExpectedPqsIndex {
  return {
    name: indexName(relation, 'witnesses_gin'),
    schema,
    relation,
    accessMethod: 'gin',
    keyExpressions: ['witnesses'],
    includedExpressions: [],
    operatorClasses: ['array_ops'],
    sortOptions: [0],
    predicate: null,
    isUnique: false,
    createSql: contractWitnessIndexSql(schema, relation),
  };
}

export const activeContractsIndexSql = (
  schema: string,
  relation: string,
): string =>
  `create index concurrently if not exists ${quoteIdentifier(indexName(relation, 'active_created_ix'))} on ${qualified(schema, relation)} (created_at_ix desc, create_event_pk desc, contract_id desc) where archived_at_ix is null`;

export function activeContractsIndex(
  schema: string,
  relation: string,
): ExpectedPqsIndex {
  return {
    name: indexName(relation, 'active_created_ix'),
    schema,
    relation,
    accessMethod: 'btree',
    keyExpressions: ['created_at_ix', 'create_event_pk', 'contract_id'],
    includedExpressions: [],
    operatorClasses: ['int8_ops', 'int8_ops', 'text_ops'],
    sortOptions: [3, 3, 3],
    predicate: 'archived_at_ix IS NULL',
    isUnique: false,
    createSql: activeContractsIndexSql(schema, relation),
  };
}

export const transactionIdPatternIndexSql = (schema: string): string =>
  `create index concurrently if not exists ${quoteIdentifier('canton_explorer_transactions_transaction_id_pattern_ops')} on ${qualified(schema, '__transactions')} (transaction_id text_pattern_ops)`;

export function transactionIdPatternIndex(schema: string): ExpectedPqsIndex {
  return {
    name: 'canton_explorer_transactions_transaction_id_pattern_ops',
    schema,
    relation: '__transactions',
    accessMethod: 'btree',
    keyExpressions: ['transaction_id'],
    includedExpressions: [],
    operatorClasses: ['text_pattern_ops'],
    sortOptions: [0],
    predicate: null,
    isUnique: false,
    createSql: transactionIdPatternIndexSql(schema),
  };
}

export const dropIndexSql = (schema: string, indexName: string): string =>
  `drop index concurrently if exists ${qualified(schema, indexName)}`;

export const insertMigrationSql = (schema: string): string =>
  `insert into ${qualified(schema, 'canton_explorer_index_migrations')} (version) values ($1) on conflict (version) do nothing`;

export const representativeExplainSql = (
  schema: string,
  relation: string,
): string => `explain (format json)
  select create_event_pk
  from ${qualified(schema, relation)}
  where archived_at_ix is null and created_at_ix is not null and create_event_pk is not null
  order by created_at_ix desc, create_event_pk desc, contract_id desc
  limit 31`;

export const advisoryLockSql = 'select pg_advisory_lock(hashtext($1))';
export const advisoryUnlockSql = 'select pg_advisory_unlock(hashtext($1))';

export const pqsIndexMigrations: readonly IndexMigration[] = [
  {
    version: '001-witnesses',
    name: 'Witness lookup indexes',
    indexes: (context) => [
      ...context.contractPartitions.map((relation) =>
        contractWitnessIndex(context.schema, relation),
      ),
      ...context.exercisePartitions.map((relation) =>
        contractWitnessIndex(context.schema, relation),
      ),
    ],
  },
  {
    version: '002-active-contracts',
    name: 'Active contracts creation order indexes',
    indexes: (context) =>
      context.contractPartitions.map((relation) =>
        activeContractsIndex(context.schema, relation),
      ),
  },
  {
    version: '003-transaction-id-pattern',
    name: 'Transaction ID prefix-search index',
    indexes: (context) =>
      context.transactionIdIsText
        ? [transactionIdPatternIndex(context.schema)]
        : [],
  },
];
