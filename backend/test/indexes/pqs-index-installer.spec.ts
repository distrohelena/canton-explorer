import { describe, expect, it, jest } from '@jest/globals';
import {
  applyPqsIndexes,
  createPqsIndexDatabase,
  inspectPqsIndexes,
  type PqsIndexDatabase,
} from '../../src/indexes/pqs-index-installer';

type FakeExecutorOptions = {
  appliedVersions?: readonly string[];
  failSql?: RegExp;
  partitions?: readonly string[];
  hasExercises?: boolean;
  transactionIdType?: string | null;
  indexStatuses?: Record<string, { is_valid: boolean; is_ready: boolean }>;
};

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
      if (statement.includes('from pg_inherits')) {
        return {
          rows: (
            options.partitions ?? ['__contracts_42', '__contracts_43']
          ).map((table_name) => ({ table_name })) as TRow[],
        };
      }
      if (statement.includes("relname = '__exercises'")) {
        return { rows: [{ exists: options.hasExercises ?? true }] as TRow[] };
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
        const expectedNames = (values[1] as readonly string[]) ?? [];
        return {
          rows: expectedNames
            .flatMap((index_name) => {
              const status = indexStatuses.get(index_name);
              return status ? [{ index_name, ...status }] : [];
            })
            .map((row) => row as TRow),
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
    ).resolves.toMatchObject({ appliedStatements: 6 });
  });

  it('reconciles a later contracts partition even when the migration is recorded', async () => {
    const database = fakeDatabase({
      appliedVersions: [
        '001-witnesses',
        '002-active-contracts',
        '003-transaction-id-pattern',
      ],
      partitions: ['__contracts_42', '__contracts_77'],
    });

    await applyPqsIndexes('postgres://pqs', 'public', {
      createDatabase: databaseFactory(database),
    });

    expect(database.sql.join('\n')).toMatch(/contracts_77_witnesses_gin/);
    expect(database.sql.join('\n')).toMatch(/contracts_77_active_created_ix/);
  });

  it('drops an invalid same-name index concurrently before rebuilding it', async () => {
    const database = fakeDatabase({
      indexStatuses: {
        canton_explorer_contracts_42_witnesses_gin: {
          is_valid: false,
          is_ready: false,
        },
      },
    });

    await applyPqsIndexes('postgres://pqs', 'public', {
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

  it('previews an invalid-index repair in the same drop-then-create order as apply', async () => {
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
    expect(inspection.proposedSql).toContain(drop);
    expect(inspection.proposedSql).toContain(create);
    expect(inspection.proposedSql.indexOf(drop)).toBeLessThan(
      inspection.proposedSql.indexOf(create),
    );
    expect(database.sql.join('\n')).not.toMatch(/drop index|create index/i);
  });

  it('inspects through a dedicated read connection using catalog queries only', async () => {
    const database = fakeDatabase();

    const inspection = await inspectPqsIndexes('postgres://pqs', 'public', {
      createDatabase: databaseFactory(database),
    });

    expect(inspection.proposedSql.join('\n')).toMatch(/active_created_ix/);
    expect(database.sql.join('\n')).not.toMatch(
      /explain|create index|create table|insert into/i,
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
