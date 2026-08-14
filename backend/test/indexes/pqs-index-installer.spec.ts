import { describe, expect, it } from '@jest/globals';
import type { PqsRawExecutor } from '../../src/pqs/pqs-manager.factory';
import { applyPqsIndexes, inspectPqsIndexes } from '../../src/indexes/pqs-index-installer';

type FakeExecutorOptions = {
  appliedVersions?: readonly string[];
  failSql?: RegExp;
  partitions?: readonly string[];
  hasExercises?: boolean;
  transactionIdType?: string | null;
};

function fakeExecutor(options: FakeExecutorOptions = {}): PqsRawExecutor & { sql: string[] } {
  const sql: string[] = [];
  const appliedVersions = options.appliedVersions ?? [];

  return {
    sql,
    query: async <TRow>(statement: string) => {
      sql.push(statement);
      if (options.failSql?.test(statement)) {
        throw new Error(`Failed statement: ${statement}`);
      }
      if (statement.includes('from pg_inherits')) {
        return { rows: (options.partitions ?? ['__contracts_42', '__contracts_43']).map((table_name) => ({ table_name })) as TRow[] };
      }
      if (statement.includes("relname = '__exercises'")) {
        return { rows: [{ exists: options.hasExercises ?? true }] as TRow[] };
      }
      if (statement.includes("attname = 'transaction_id'")) {
        return { rows: options.transactionIdType === null ? [] : [{ column_type: options.transactionIdType ?? 'text' }] as TRow[] };
      }
      if (statement.includes('select version from')) {
        return { rows: appliedVersions.map((version) => ({ version })) as TRow[] };
      }
      return { rows: [] };
    },
  };
}

describe('PQS index installer', () => {
  it('does not mark a migration complete when one concurrent index statement fails', async () => {
    const executor = fakeExecutor({ failSql: /__contracts_43/ });

    await expect(applyPqsIndexes(executor, 'public')).rejects.toThrow('contracts_43');

    expect(executor.sql.join('\n')).not.toMatch(
      /insert into .*canton_explorer_index_migrations/,
    );
  });

  it('uses one advisory lock and records an already-complete migration without rebuilding indexes', async () => {
    const executor = fakeExecutor({ appliedVersions: ['001-witnesses'] });

    await applyPqsIndexes(executor, 'public');

    expect(executor.sql).toContain('select pg_advisory_lock(hashtext($1))');
    expect(executor.sql.join('\n')).not.toMatch(/witnesses_gin/);
    expect(executor.sql).toContain('select pg_advisory_unlock(hashtext($1))');
  });

  it('inspects with catalog and explain queries without issuing DDL', async () => {
    const executor = fakeExecutor({ appliedVersions: ['001-witnesses'] });

    const inspection = await inspectPqsIndexes(executor, 'public');

    expect(inspection.proposedSql.join('\n')).toMatch(/active_created_ix/);
    expect(executor.sql.join('\n')).toMatch(/explain \(format json\)/);
    expect(executor.sql.join('\n')).not.toMatch(/create index|create table|insert into/i);
  });
});
