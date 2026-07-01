import { describe, expect, it } from '@jest/globals';
import { parseNodeConfigFile } from '../../src/config/node-config.schema';

describe('parseNodeConfigFile', () => {
  it('parses a valid participant-node config', () => {
    const result = parseNodeConfigFile({
      nodes: [
        {
          id: 'participant-1',
          label: 'Participant 1',
          role: 'participant',
          ledgerLabel: 'Retail Ledger',
          pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
          grpc: { target: 'localhost:5012', useTls: false, connectTimeoutMs: 5000 },
          polling: { intervalMs: 15000, staleAfterMs: 45000 },
        },
      ],
    });

    expect(result.nodes[0].id).toBe('participant-1');
    expect(result.nodes[0].pqs.connectionUriEnv).toBe('PARTICIPANT_1_PQS_URL');
  });

  it('rejects a config with no node id', () => {
    expect(() =>
      parseNodeConfigFile({
        nodes: [
          {
            id: '',
            label: 'Broken',
            role: 'participant',
            pqs: { connectionUriEnv: 'BROKEN_URL' },
          },
        ],
      }),
    ).toThrow(/id/i);
  });
});
