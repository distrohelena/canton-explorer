import { describe, expect, it, jest } from '@jest/globals';
import {
  applyPqsIndexes,
  createPqsIndexDatabase,
  inspectPqsIndexes,
  repairPqsIndexes,
  type PqsIndexDatabase,
} from '../../src/indexes/pqs-index-installer';

type FakeExecutorOptions = {
  appliedVersions?: readonly string[];
  failSql?: RegExp;
  contractPartitions?: readonly string[];
  exercisePartitions?: readonly string[];
  schemaSupported?: boolean;
  transactionIdType?: string | null;
  indexStatuses?: Record<
    string,
    {
      is_valid: boolean;
      is_ready: boolean;
      table_name?: string;
      access_method?: string;
      is_unique?: boolean;
      key_expressions?: string[];
      included_expressions?: string[];
      operator_classes?: string[];
      sort_options?: number[];
      predicate?: string | null;
      index_definition?: string;
      size_bytes?: string;
    }
  >;
};

function supportedSchemaRows() {
  return [
    ['__contracts', 'p', 'LIST (tpe_pk)', 'tpe_pk', 'bigint'],
    ['__contracts', 'p', 'LIST (tpe_pk)', 'create_event_pk', 'bigint'],
    ['__contracts', 'p', 'LIST (tpe_pk)', 'created_at_ix', 'bigint'],
    ['__contracts', 'p', 'LIST (tpe_pk)', 'archived_at_ix', 'bigint'],
    ['__contracts', 'p', 'LIST (tpe_pk)', 'contract_id', 'text'],
    ['__contracts', 'p', 'LIST (tpe_pk)', 'witnesses', 'text[]'],
    ['__exercises', 'p', 'LIST (tpe_pk)', 'tpe_pk', 'bigint'],
    ['__exercises', 'p', 'LIST (tpe_pk)', 'witnesses', 'text[]'],
    ['__exercises', 'p', 'LIST (tpe_pk)', 'exercised_at_ix', 'bigint'],
    ['__transactions', 'r', null, 'ix', 'bigint'],
    ['__transactions', 'r', null, 'offset', 'bigint'],
    ['__transactions', 'r', null, 'transaction_id', 'text'],
    ['flyway_schema_history', 'r', null, 'installed_rank', 'integer'],
    [
      'flyway_schema_history',
      'r',
      null,
      'version',
      'character varying(50)',
    ],
    ['flyway_schema_history', 'r', null, 'success', 'boolean'],
  ].map(
    ([relation_name, relation_kind, partition_key, column_name, column_type]) => ({
      relation_name,
      relation_kind,
      partition_key,
      column_name,
      column_type,
    }),
  );
}

function inferredIndexStatus(
  indexName: string,
  status: NonNullable<FakeExecutorOptions['indexStatuses']>[string],
) {
  const witness = indexName.match(
    /^canton_explorer_(contracts|exercises)_(\d+)_witnesses_gin$/,
  );
  const active = indexName.match(
    /^canton_explorer_contracts_(\d+)_(active|all)_created_ix$/,
  );
  const eventOrder = indexName.match(
    /^canton_explorer_(contracts|exercises)_(\d+)_(created_at_ix|archived_at_ix|exercised_at_ix)_order$/,
  );
  const isTransaction =
    indexName === 'canton_explorer_transactions_transaction_id_pattern_ops';
  const tableName = witness
    ? `__${witness[1]}_${witness[2]}`
    : active
      ? `__contracts_${active[1]}`
      : eventOrder
        ? `__${eventOrder[1]}_${eventOrder[2]}`
        : '__transactions';
  const accessMethod = witness ? 'gin' : 'btree';
  const keyExpressions = witness
    ? ['witnesses']
    : active
      ? ['created_at_ix', 'create_event_pk', 'contract_id']
      : eventOrder
        ? [eventOrder[3]]
        : ['transaction_id'];
  const operatorClasses = witness
    ? ['array_ops']
    : active
      ? ['int8_ops', 'int8_ops', 'text_ops']
      : eventOrder
        ? ['int8_ops']
        : ['text_pattern_ops'];
  const predicate =
    active && active[2] === 'active' ? 'archived_at_ix IS NULL' : null;
  const sortOptions = active ? [3, 3, 3] : eventOrder ? [3] : [0];

  return {
    index_name: indexName,
    table_schema: 'public',
    table_name: status.table_name ?? tableName,
    access_method: status.access_method ?? accessMethod,
    is_unique: status.is_unique ?? false,
    key_expressions: status.key_expressions ?? keyExpressions,
    included_expressions: status.included_expressions ?? [],
    operator_classes: status.operator_classes ?? operatorClasses,
    sort_options: status.sort_options ?? sortOptions,
    predicate: status.predicate === undefined ? predicate : status.predicate,
    index_definition:
      status.index_definition ?? `CREATE INDEX ${indexName} ON public.${tableName}`,
    size_bytes: status.size_bytes ?? '8192',
    is_valid: status.is_valid,
    is_ready: status.is_ready,
  };
}

function fakeDatabase(options: FakeExecutorOptions = {}): PqsIndexDatabase & {
  sql: string[];
  ended: boolean;
} {
  const sql: string[] = [];
  const appliedVersions = options.appliedVersions ?? [];
  const indexStatuses = new Map(Object.entries(options.indexStatuses ?? {}));

  const database: PqsIndexDatabase & { sql: string[]; ended: boolean } = {
    sql,
    ended: false,
    query: async <TRow>(statement: string, values: readonly unknown[] = []) => {
      sql.push(statement);
      if (options.failSql?.test(statement)) {
        throw new Error(`Failed statement: ${statement}`);
      }
      if (statement.includes('canton-explorer:schema-shape')) {
        return {
          rows: (options.schemaSupported === false
            ? []
            : supportedSchemaRows()) as TRow[],
        };
      }
      if (statement.includes('canton-explorer:pqs-version')) {
        return { rows: [{ version: '041' }] as TRow[] };
      }
      if (statement.includes('canton-explorer:relation-stats')) {
        return {
          rows: [
            {
              relation_name: '__contracts',
              partition_count: '2',
              estimated_rows: '2000',
              table_size_bytes: '131072',
              index_size_bytes: '65536',
              total_size_bytes: '196608',
            },
            {
              relation_name: '__exercises',
              partition_count: '2',
              estimated_rows: '1000',
              table_size_bytes: '65536',
              index_size_bytes: '32768',
              total_size_bytes: '98304',
            },
            {
              relation_name: '__transactions',
              partition_count: '0',
              estimated_rows: '500',
              table_size_bytes: '32768',
              index_size_bytes: '16384',
              total_size_bytes: '49152',
            },
          ] as TRow[],
        };
      }
      if (statement.includes('from pg_inherits')) {
        return {
          rows: (
            values[1] === '__exercises'
              ? (options.exercisePartitions ?? ['__exercises_42', '__exercises_43'])
              : (options.contractPartitions ?? ['__contracts_42', '__contracts_43'])
          ).map((table_name) => ({ table_name })) as TRow[],
        };
      }
      if (statement.includes("attname = 'transaction_id'")) {
        return {
          rows:
            options.transactionIdType === null
              ? []
              : ([
                  { column_type: options.transactionIdType ?? 'text' },
                ] as TRow[]),
        };
      }
      if (statement.includes('select version from')) {
        return {
          rows: appliedVersions.map((version) => ({ version })) as TRow[],
        };
      }
      if (statement.includes('from pg_index')) {
        return {
          rows: [...indexStatuses.entries()].map(([indexName, status]) =>
            inferredIndexStatus(indexName, status) as TRow,
          ),
        };
      }
      if (statement.trimStart().startsWith('explain (format json)')) {
        return {
          rows: [{ 'QUERY PLAN': [{ Plan: { 'Node Type': 'Limit' } }] }] as TRow[],
        };
      }
      if (statement.startsWith('create index concurrently')) {
        const indexName = statement.match(/if not exists "([^"]+)"/)?.[1];
        if (indexName) {
          indexStatuses.set(indexName, { is_valid: true, is_ready: true });
        }
      }
      if (statement.startsWith('drop index concurrently')) {
        const indexName = statement.match(/if exists "[^"]+"\."([^"]+)"/)?.[1];
        if (indexName) {
          indexStatuses.delete(indexName);
        }
      }
      return { rows: [] };
    },
    end: async () => {
      database.ended = true;
    },
  };

  return database;
}

function databaseFactory(database: PqsIndexDatabase) {
  return async () => database;
}

describe('PQS index installer', () => {
  it('does not mark a migration complete when one concurrent index statement fails', async () => {
    const database = fakeDatabase({ failSql: /__contracts_43/ });

    await expect(
      applyPqsIndexes('postgres://pqs', 'public', {
        createDatabase: databaseFactory(database),
      }),
    ).rejects.toThrow('contracts_43');

    expect(database.sql.join('\n')).not.toMatch(
      /insert into .*canton_explorer_index_migrations/,
    );
    expect(database.ended).toBe(true);
  });

  it('rejects an empty or unsupported schema before creating the migration table', async () => {
    const database = fakeDatabase({ schemaSupported: false });

    await expect(
      applyPqsIndexes('postgres://pqs', 'public', {
        createDatabase: databaseFactory(database),
      }),
    ).rejects.toThrow(/unsupported PQS schema/i);

    expect(database.sql.join('\n')).not.toMatch(
      /create table|create index|drop index|insert into/i,
    );
  });

  it('uses one dedicated connection for the advisory lock lifecycle and closes it', async () => {
    const database = fakeDatabase({ appliedVersions: ['001-witnesses'] });

    await applyPqsIndexes('postgres://pqs', 'public', {
      createDatabase: databaseFactory(database),
    });

    expect(database.sql).toContain('select pg_advisory_lock(hashtext($1))');
    expect(database.sql).toContain('select pg_advisory_unlock(hashtext($1))');
    expect(database.ended).toBe(true);
  });

  it('serializes queries issued through the dedicated PostgreSQL client', async () => {
    const database = fakeDatabase();
    const query = database.query.bind(database);
    let queryInFlight = false;
    database.query = async <TRow>(
      sql: string,
      values: readonly unknown[] = [],
    ) => {
      if (queryInFlight) {
        throw new Error('Concurrent query on pinned PostgreSQL client');
      }
      queryInFlight = true;
      await new Promise<void>((resolve) => setImmediate(resolve));
      try {
        return await query<TRow>(sql, values);
      } finally {
        queryInFlight = false;
      }
    };

    await expect(
      applyPqsIndexes('postgres://pqs', 'public', {
        createDatabase: databaseFactory(database),
      }),
    ).resolves.toMatchObject({ appliedStatements: 15 });
  });

  it('reconciles a later contracts partition even when the migration is recorded', async () => {
    const database = fakeDatabase({
      appliedVersions: [
        '001-witnesses',
        '002-active-contracts',
        '003-transaction-id-pattern',
        '004-update-event-order',
        '005-all-contracts',
      ],
      contractPartitions: ['__contracts_42', '__contracts_77'],
    });

    await applyPqsIndexes('postgres://pqs', 'public', {
      createDatabase: databaseFactory(database),
    });

    expect(database.sql.join('\n')).toMatch(/contracts_77_witnesses_gin/);
    expect(database.sql.join('\n')).toMatch(/contracts_77_active_created_ix/);
    expect(database.sql.join('\n')).toMatch(/contracts_77_all_created_ix/);
    expect(database.sql.join('\n')).toMatch(/contracts_77_created_at_ix_order/);
    expect(database.sql.join('\n')).toMatch(
      /contracts_77_archived_at_ix_order/,
    );
  });

  it('reconciles individual exercises partitions without indexing their parent', async () => {
    const database = fakeDatabase({
      appliedVersions: [
        '001-witnesses',
        '002-active-contracts',
        '003-transaction-id-pattern',
        '004-update-event-order',
        '005-all-contracts',
      ],
      exercisePartitions: ['__exercises_42', '__exercises_77'],
    });

    await applyPqsIndexes('postgres://pqs', 'public', {
      createDatabase: databaseFactory(database),
    });

    const sql = database.sql.join('\n');
    expect(sql).toMatch(/exercises_42_witnesses_gin/);
    expect(sql).toMatch(/exercises_77_witnesses_gin/);
    expect(sql).toMatch(/exercises_42_exercised_at_ix_order/);
    expect(sql).toMatch(/exercises_77_exercised_at_ix_order/);
    expect(sql).not.toMatch(/on "public"\."__exercises" using gin/);
  });

  it('reports a valid same-name index with a different definition as a conflict', async () => {
    const database = fakeDatabase({
      indexStatuses: {
        canton_explorer_contracts_42_witnesses_gin: {
          is_valid: true,
          is_ready: true,
          table_name: '__contracts_43',
          access_method: 'btree',
          is_unique: true,
          key_expressions: ['contract_id'],
          included_expressions: ['witnesses'],
          operator_classes: ['text_ops'],
          sort_options: [1],
          predicate: 'contract_id IS NOT NULL',
        },
      },
    });

    const inspection = await inspectPqsIndexes('postgres://pqs', 'public', {
      createDatabase: databaseFactory(database),
    });
    expect(inspection.conflicts).toEqual([
      expect.objectContaining({
        name: 'canton_explorer_contracts_42_witnesses_gin',
        reasons: expect.arrayContaining([
          expect.stringContaining('target table'),
          expect.stringContaining('access method'),
          expect.stringContaining('uniqueness'),
          expect.stringContaining('indexed expressions'),
          expect.stringContaining('included expressions'),
          expect.stringContaining('operator classes'),
          expect.stringContaining('sort options'),
          expect.stringContaining('predicate'),
        ]),
      }),
    ]);

    await expect(
      applyPqsIndexes('postgres://pqs', 'public', {
        createDatabase: databaseFactory(database),
      }),
    ).rejects.toThrow(/conflicting Explorer index/i);
    expect(database.sql.join('\n')).not.toMatch(
      /create table|create index|drop index|insert into/i,
    );
  });

  it('rejects an invalid same-name definition mismatch from apply and repair without DDL', async () => {
    const database = fakeDatabase({
      indexStatuses: {
        canton_explorer_contracts_42_witnesses_gin: {
          is_valid: false,
          is_ready: false,
          table_name: '__contracts_43',
          access_method: 'btree',
          is_unique: true,
          key_expressions: ['contract_id'],
          included_expressions: ['witnesses'],
          operator_classes: ['text_ops'],
          sort_options: [1],
          predicate: 'contract_id IS NOT NULL',
        },
      },
    });

    await expect(
      applyPqsIndexes('postgres://pqs', 'public', {
        createDatabase: databaseFactory(database),
      }),
    ).rejects.toThrow(/conflicting Explorer index/i);
    expect(database.sql.join('\n')).not.toMatch(
      /create table|create index|drop index|insert into/i,
    );

    database.sql.length = 0;

    await expect(
      repairPqsIndexes('postgres://pqs', 'public', {
        createDatabase: databaseFactory(database),
      }),
    ).rejects.toThrow(/conflicting Explorer index/i);
    expect(database.sql.join('\n')).not.toMatch(
      /create table|create index|drop index|insert into/i,
    );
  });

  it('makes apply fail safely on an invalid index and repairs it only through repair', async () => {
    const database = fakeDatabase({
      indexStatuses: {
        canton_explorer_contracts_42_witnesses_gin: {
          is_valid: false,
          is_ready: false,
        },
      },
    });

    await expect(
      applyPqsIndexes('postgres://pqs', 'public', {
        createDatabase: databaseFactory(database),
      }),
    ).rejects.toThrow(/indexes repair/i);

    expect(database.sql.join('\n')).not.toMatch(/drop index concurrently/i);
    database.sql.length = 0;

    await repairPqsIndexes('postgres://pqs', 'public', {
      createDatabase: databaseFactory(database),
    });

    const sql = database.sql.join('\n');
    expect(sql).toMatch(
      /drop index concurrently if exists "public"\."canton_explorer_contracts_42_witnesses_gin"/,
    );
    expect(sql).toMatch(
      /create index concurrently if not exists "canton_explorer_contracts_42_witnesses_gin"/,
    );
  });

  it('separates safe apply SQL from explicit invalid-index repair SQL', async () => {
    const database = fakeDatabase({
      indexStatuses: {
        canton_explorer_contracts_42_witnesses_gin: {
          is_valid: false,
          is_ready: false,
        },
      },
    });

    const inspection = await inspectPqsIndexes('postgres://pqs', 'public', {
      createDatabase: databaseFactory(database),
    });

    const drop =
      'drop index concurrently if exists "public"."canton_explorer_contracts_42_witnesses_gin"';
    const create =
      'create index concurrently if not exists "canton_explorer_contracts_42_witnesses_gin" on "public"."__contracts_42" using gin (witnesses)';
    expect(inspection.proposedSql).not.toContain(drop);
    expect(inspection.proposedSql).not.toContain(create);
    expect(inspection.repairSql).toContain(drop);
    expect(inspection.repairSql).toContain(create);
    expect(inspection.repairSql.indexOf(drop)).toBeLessThan(
      inspection.repairSql.indexOf(create),
    );
    expect(database.sql.join('\n')).not.toMatch(/drop index|create index/i);
  });

  it('reports schema version, definitions, relation sizes, and one bounded plan read-only', async () => {
    const database = fakeDatabase();

    const inspection = await inspectPqsIndexes('postgres://pqs', 'public', {
      createDatabase: databaseFactory(database),
    });

    expect(inspection.schemaValidation).toEqual(
      expect.objectContaining({ supported: true, pqsVersion: '041' }),
    );
    expect(inspection.relationStats).toContainEqual(
      expect.objectContaining({
        relationName: '__contracts',
        partitionCount: 2,
        totalSizeBytes: '196608',
      }),
    );
    expect(inspection.representativeExplain).toEqual(
      expect.objectContaining({ relation: '__contracts_42' }),
    );
    expect(
      database.sql.filter((statement) =>
        statement.trimStart().startsWith('explain (format json)'),
      ),
    ).toHaveLength(1);
    expect(database.sql.join('\n')).not.toMatch(
      /create index|create table|drop index|insert into/i,
    );
    expect(database.ended).toBe(true);
  });

  it('creates the dedicated database through the direct PostgreSQL client contract', async () => {
    const connect = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const end = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const query = jest.fn().mockResolvedValue({ rows: [{ value: 'ok' }] });

    const database = await createPqsIndexDatabase('postgres://pqs', () => ({
      connect,
      end,
      query,
    }));
    await expect(
      database.query<{ value: string }>('select 1'),
    ).resolves.toEqual({
      rows: [{ value: 'ok' }],
    });
    await database.end();

    expect(connect).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith('select 1', []);
    expect(end).toHaveBeenCalledTimes(1);
  });

  it('closes the direct client when connecting fails', async () => {
    const connect = jest
      .fn<() => Promise<void>>()
      .mockRejectedValue(new Error('unreachable'));
    const end = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);

    await expect(
      createPqsIndexDatabase('postgres://pqs', () => ({
        connect,
        end,
        query: jest.fn(),
      })),
    ).rejects.toThrow('unreachable');

    expect(end).toHaveBeenCalledTimes(1);
  });
});
