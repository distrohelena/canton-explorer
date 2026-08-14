import { describe, expect, it } from '@jest/globals';
import {
  activeContractsIndex,
  activeContractsIndexSql,
  contractWitnessIndex,
  contractWitnessIndexSql,
  migrationTableSql,
  quoteIdentifier,
  transactionIdPatternIndex,
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
      'create index concurrently if not exists "canton_explorer_contracts_42_active_created_ix" on "public"."__contracts_42" (created_at_ix desc, create_event_pk desc) where archived_at_ix is null',
    );
    expect(transactionIdPatternIndexSql('public')).toBe(
      'create index concurrently if not exists "canton_explorer_transactions_transaction_id_pattern_ops" on "public"."__transactions" (transaction_id text_pattern_ops)',
    );
  });

  it('describes every expected index independently of PostgreSQL display formatting', () => {
    expect(contractWitnessIndex('public', '__contracts_42')).toMatchObject({
      name: 'canton_explorer_contracts_42_witnesses_gin',
      relation: '__contracts_42',
      accessMethod: 'gin',
      keyExpressions: ['witnesses'],
      operatorClasses: ['array_ops'],
      predicate: null,
    });
    expect(activeContractsIndex('public', '__contracts_42')).toMatchObject({
      name: 'canton_explorer_contracts_42_active_created_ix',
      relation: '__contracts_42',
      accessMethod: 'btree',
      keyExpressions: ['created_at_ix', 'create_event_pk'],
      operatorClasses: ['int8_ops', 'int8_ops'],
      predicate: 'archived_at_ix IS NULL',
    });
    expect(transactionIdPatternIndex('public')).toMatchObject({
      name: 'canton_explorer_transactions_transaction_id_pattern_ops',
      relation: '__transactions',
      accessMethod: 'btree',
      keyExpressions: ['transaction_id'],
      operatorClasses: ['text_pattern_ops'],
      predicate: null,
    });
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
