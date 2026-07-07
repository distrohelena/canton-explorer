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
          mode: 'pqs_with_grpc',
          ledgerLabel: 'Retail Ledger',
          pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
          grpc: {
            ledgerTarget: 'localhost:5012',
            ledgerAdminTarget: 'localhost:5013',
            participantAdminTarget: 'localhost:5014',
            useTls: false,
            connectTimeoutMs: 5000,
            auth: {
              kind: 'shared_secret_jwt',
              user: 'ledger-api-user',
              audience: 'https://canton.network.global',
              secret: 'unsafe',
            },
          },
          polling: { intervalMs: 15000, staleAfterMs: 45000 },
        },
      ],
    });

    expect(result.nodes[0].id).toBe('participant-1');
    expect(result.nodes[0].pqs.connectionUriEnv).toBe('PARTICIPANT_1_PQS_URL');
    expect(result.nodes[0].mode).toBe('pqs_with_grpc');
    expect(result.nodes[0].grpc.auth).toEqual({
      kind: 'shared_secret_jwt',
      user: 'ledger-api-user',
      audience: 'https://canton.network.global',
      secret: 'unsafe',
    });
  });

  it('rejects a config with no node id', () => {
    expect(() =>
      parseNodeConfigFile({
        nodes: [
          {
            id: '',
            label: 'Broken',
            role: 'participant',
            mode: 'pqs_only',
            pqs: { connectionUriEnv: 'BROKEN_URL' },
          },
        ],
      }),
    ).toThrow(/id/i);
  });

  it('rejects a config with no node mode', () => {
    expect(() =>
      parseNodeConfigFile({
        nodes: [
          {
            id: 'participant-1',
            label: 'Participant 1',
            role: 'participant',
            pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
          },
        ],
      }),
    ).toThrow(/mode/i);
  });

  it('rejects grpc settings for pqs_only nodes', () => {
    expect(() =>
      parseNodeConfigFile({
        nodes: [
          {
            id: 'participant-1',
            label: 'Participant 1',
            role: 'participant',
            mode: 'pqs_only',
            pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
            grpc: {
              ledgerTarget: 'localhost:5012',
              ledgerAdminTarget: 'localhost:5013',
              participantAdminTarget: 'localhost:5014',
              useTls: false,
              connectTimeoutMs: 5000,
            },
          },
        ],
      }),
    ).toThrow(/grpc/i);
  });

  it('requires grpc settings for pqs_with_grpc nodes', () => {
    expect(() =>
      parseNodeConfigFile({
        nodes: [
          {
            id: 'participant-1',
            label: 'Participant 1',
            role: 'participant',
            mode: 'pqs_with_grpc',
            pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
          },
        ],
      }),
    ).toThrow(/grpc/i);
  });

  it('rejects incomplete shared-secret grpc auth settings', () => {
    expect(() =>
      parseNodeConfigFile({
        nodes: [
          {
            id: 'participant-1',
            label: 'Participant 1',
            role: 'participant',
            mode: 'pqs_with_grpc',
            pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
            grpc: {
              ledgerTarget: 'localhost:5012',
              ledgerAdminTarget: 'localhost:5013',
              participantAdminTarget: 'localhost:5014',
              useTls: false,
              connectTimeoutMs: 5000,
              auth: {
                kind: 'shared_secret_jwt',
                user: 'ledger-api-user',
                audience: '',
                secret: 'unsafe',
              },
            },
          },
        ],
      }),
    ).toThrow(/audience/i);
  });

  it('requires separate ledger admin and participant admin targets for grpc-enabled nodes', () => {
    expect(() =>
      parseNodeConfigFile({
        nodes: [
          {
            id: 'participant-1',
            label: 'Participant 1',
            role: 'participant',
            mode: 'pqs_with_grpc',
            pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
            grpc: {
              ledgerTarget: 'localhost:5012',
              useTls: false,
              connectTimeoutMs: 5000,
            },
          },
        ],
      }),
    ).toThrow(/ledgerAdminTarget|participantAdminTarget/i);
  });
});
