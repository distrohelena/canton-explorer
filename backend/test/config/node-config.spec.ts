import { describe, expect, it } from '@jest/globals';
import type { PackageDetailResponse } from '../../src/domain/node.types';
import { parseNodeConfigFile } from '../../src/config/node-config.schema';

const notAvailablePackageDetailFixture = {
  packageId: 'splice-amulet',
  name: 'splice-amulet',
  version: '0.1.24',
  uploadedAt: null,
  packageSize: null,
  status: 'not_available',
  seenOnNodes: [],
  moduleCount: 0,
  templateCount: 0,
  dataTypeCount: 0,
  modules: [],
  templates: [],
  dataTypes: [],
} satisfies PackageDetailResponse;

describe('parseNodeConfigFile', () => {
  it('parses a valid participant-node config', () => {
    const result = parseNodeConfigFile({
      tokenMetadata: {
        nameKeys: ['display_name'],
        symbolKeys: ['ticker'],
      },
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
    expect(result.tokenMetadata).toEqual({
      nameKeys: ['display_name'],
      symbolKeys: ['ticker'],
    });
    expect(result.nodes[0].grpc.auth).toEqual({
      kind: 'shared_secret_jwt',
      user: 'ledger-api-user',
      audience: 'https://canton.network.global',
      secret: 'unsafe',
    });
  });

  it('parses self-signed es256 grpc auth settings', () => {
    const result = parseNodeConfigFile({
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
              kind: 'self_signed_es256',
              sub: 'ledger-api-user',
              aud: 'https://canton.network.global',
              privateKeyEnv: 'CANTON_ES256_PRIVATE_JWK',
            },
          },
        },
      ],
    });

    expect(result.nodes[0].grpc.auth).toEqual({
      kind: 'self_signed_es256',
      sub: 'ledger-api-user',
      aud: 'https://canton.network.global',
      privateKeyEnv: 'CANTON_ES256_PRIVATE_JWK',
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

  it.each(['sub', 'aud', 'privateKeyEnv'] as const)(
    'rejects an empty self-signed es256 %s setting',
    (field) => {
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
                  kind: 'self_signed_es256',
                  sub: 'ledger-api-user',
                  aud: 'https://canton.network.global',
                  privateKeyEnv: 'CANTON_ES256_PRIVATE_JWK',
                  [field]: '',
                },
              },
            },
          ],
        }),
      ).toThrow(new RegExp(field));
    },
  );

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

  it('defaults token metadata keys when omitted', () => {
    const result = parseNodeConfigFile({
      nodes: [
        {
          id: 'participant-1',
          label: 'Participant 1',
          role: 'participant',
          mode: 'pqs_only',
          pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
        },
      ],
    });

    expect(result.tokenMetadata).toEqual({
      nameKeys: ['name'],
      symbolKeys: ['symbol'],
    });
  });

  it('defaults PQS schema to public when omitted', () => {
    const result = parseNodeConfigFile({
      nodes: [
        {
          id: 'participant-1',
          label: 'Participant 1',
          role: 'participant',
          mode: 'pqs_only',
          pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
        },
      ],
    });

    expect(result.nodes[0].pqs.schema).toBe('public');
  });

  it('parses an explicit PQS schema override', () => {
    const result = parseNodeConfigFile({
      nodes: [
        {
          id: 'participant-1',
          label: 'Participant 1',
          role: 'participant',
          mode: 'pqs_only',
          pqs: {
            connectionUriEnv: 'PARTICIPANT_1_PQS_URL',
            schema: 'scribe',
          },
        },
      ],
    });

    expect(result.nodes[0].pqs.schema).toBe('scribe');
  });

  it('rejects invalid PQS schema identifiers', () => {
    expect(() =>
      parseNodeConfigFile({
        nodes: [
          {
            id: 'participant-1',
            label: 'Participant 1',
            role: 'participant',
            mode: 'pqs_only',
            pqs: {
              connectionUriEnv: 'PARTICIPANT_1_PQS_URL',
              schema: 'public.schema',
            },
          },
        ],
      }),
    ).toThrow(/schema/i);

    expect(() =>
      parseNodeConfigFile({
        nodes: [
          {
            id: 'participant-1',
            label: 'Participant 1',
            role: 'participant',
            mode: 'pqs_only',
            pqs: {
              connectionUriEnv: 'PARTICIPANT_1_PQS_URL',
              schema: 'public;drop',
            },
          },
        ],
      }),
    ).toThrow(/schema/i);
  });

  it('accepts package detail responses with not-available status', () => {
    expect(notAvailablePackageDetailFixture.status).toBe('not_available');
  });
});
