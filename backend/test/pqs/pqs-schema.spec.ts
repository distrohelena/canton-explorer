import { describe, expect, it } from '@jest/globals';
import type { NodeConfig } from '../../src/config/node-config.schema';
import { qualifyPqsRelation, pqsSchema } from '../../src/pqs/pqs-schema';

describe('pqs-schema helpers', () => {
  const publicNode = {
    id: 'participant-1',
    label: 'Participant 1',
    role: 'participant',
    mode: 'pqs_only',
    pqs: {
      connectionUriEnv: 'PARTICIPANT_1_PQS_URL',
      schema: 'public',
    },
  } as NodeConfig;

  const scribeNode = {
    id: 'participant-2',
    label: 'Participant 2',
    role: 'participant',
    mode: 'pqs_only',
    pqs: {
      connectionUriEnv: 'PARTICIPANT_2_PQS_URL',
      schema: 'scribe',
    },
  } as NodeConfig;

  it('returns the configured schema for a node', () => {
    expect(pqsSchema(publicNode)).toBe('public');
    expect(pqsSchema(scribeNode)).toBe('scribe');
  });

  it('qualifies __contracts in the public schema', () => {
    expect(qualifyPqsRelation(publicNode, '__contracts')).toBe('"public"."__contracts"');
  });

  it('qualifies __packages in the scribe schema', () => {
    expect(qualifyPqsRelation(scribeNode, '__packages')).toBe('"scribe"."__packages"');
  });

  it('rejects invalid relation names', () => {
    expect(() => qualifyPqsRelation(publicNode, '__not_real')).toThrow(/relation/i);
  });

  it('rejects invalid schema names when invoked directly', () => {
    const invalidNode = {
      ...publicNode,
      pqs: {
        ...publicNode.pqs,
        schema: 'public.schema',
      },
    } as NodeConfig;

    expect(() => pqsSchema(invalidNode)).toThrow(/schema/i);
    expect(() => qualifyPqsRelation(invalidNode, '__contracts')).toThrow(/schema/i);
  });
});
