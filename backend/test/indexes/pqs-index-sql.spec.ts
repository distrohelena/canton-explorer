import { describe, expect, it } from '@jest/globals';
import {
  activeContractsIndexSql,
  contractWitnessIndexSql,
  migrationTableSql,
  quoteIdentifier,
  transactionIdPatternIndexSql,
} from '../../src/indexes/pqs-index-sql';

describe('PQS index SQL', () => {
  it('creates a concurrent GIN index for each discovered contracts partition', () => {
    expect(contractWitnessIndexSql('public', '__contracts_42')).toBe(
      'create index concurrently if not exists "canton_explorer_contracts_42_witnesses_gin" on "public"."__contracts_42" using gin (witnesses)',
    );
  });

  it('creates the same witness index shape for an exercises child partition', () => {
    expect(contractWitnessIndexSql('public', '__exercises_29')).toBe(
      'create index concurrently if not exists "canton_explorer_exercises_29_witnesses_gin" on "public"."__exercises_29" using gin (witnesses)',
    );
  });

  it('creates the active-contract and transaction-id access paths concurrently', () => {
    expect(activeContractsIndexSql('public', '__contracts_42')).toBe(
      'create index concurrently if not exists "canton_explorer_contracts_42_active_created_ix" on "public"."__contracts_42" (created_at_ix desc) where archived_at_ix is null',
    );
    expect(transactionIdPatternIndexSql('public')).toBe(
      'create index concurrently if not exists "canton_explorer_transactions_transaction_id_pattern_ops" on "public"."__transactions" (transaction_id text_pattern_ops)',
    );
  });

  it('creates the Explorer-owned migration table in the requested schema', () => {
    expect(migrationTableSql('public')).toBe(
      'create table if not exists "public"."canton_explorer_index_migrations" (version text primary key, applied_at timestamptz not null default current_timestamp)',
    );
  });

  it('rejects a non-identifier schema rather than interpolating it', () => {
    expect(() => quoteIdentifier('public; drop table x')).toThrow(
      'Invalid PostgreSQL identifier',
    );
  });
});
