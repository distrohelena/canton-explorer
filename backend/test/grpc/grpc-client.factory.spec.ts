import { generateKeyPairSync, verify } from 'node:crypto';
import { describe, expect, it, jest } from '@jest/globals';
import { GrpcClientFactory } from '../../src/grpc/grpc-client.factory';

function createPrivateJwkBase64Url() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  });

  return {
    encoded: Buffer.from(JSON.stringify(privateKey.export({ format: 'jwk' })), 'utf8').toString(
      'base64url',
    ),
    publicKey,
  };
}

const grpcNode = {
  id: 'participant-1',
  label: 'Participant 1',
  role: 'participant' as const,
  mode: 'pqs_with_grpc' as const,
  pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
  grpc: {
    ledgerTarget: 'localhost:5012',
    ledgerAdminTarget: 'localhost:5013',
    participantAdminTarget: 'localhost:5014',
    useTls: false,
    connectTimeoutMs: 5000,
  },
};

describe('GrpcClientFactory', () => {
  it('passes separate ledger admin and participant admin endpoints to the SDK', async () => {
    const optionsSpy = jest.fn((options: unknown) => options);
    const clientSpy = jest.fn((options: unknown) => ({ options }));

    class TestGrpcClientFactory extends GrpcClientFactory {
      protected override async loadSdk() {
        return {
          BearerTokenAuthProvider: class {
            constructor(_token: string) {}

            async getHeadersAsync() {
              return {};
            }
          },
          CantonClient: clientSpy as never,
          CantonClientOptions: optionsSpy as never,
          TransportKind: { grpc: 'grpc' },
          GrpcChannelSecurity: { tls: 'tls', insecure: 'insecure' },
        };
      }
    }

    const factory = new TestGrpcClientFactory();

    await factory.create(grpcNode);

    expect(optionsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        ledgerEndpoint: 'localhost:5012',
        ledgerAdminEndpoint: 'localhost:5013',
        participantAdminEndpoint: 'localhost:5014',
      }),
    );
    expect(clientSpy).toHaveBeenCalledTimes(1);
  });

  it('creates an ES256 bearer token from the configured JWK environment variable', async () => {
    const envName = 'CANTON_ES256_JWT_TEST_KEY';
    const originalEnv = process.env[envName];
    const { encoded, publicKey } = createPrivateJwkBase64Url();
    const tokens: string[] = [];
    const optionsSpy = jest.fn((options: unknown) => options);
    const clientSpy = jest.fn((options: unknown) => ({ options }));

    class TestGrpcClientFactory extends GrpcClientFactory {
      protected override async loadSdk() {
        return {
          BearerTokenAuthProvider: class {
            constructor(token: string) {
              tokens.push(token);
            }

            async getHeadersAsync() {
              return {};
            }
          },
          CantonClient: clientSpy as never,
          CantonClientOptions: optionsSpy as never,
          TransportKind: { grpc: 'grpc' },
          GrpcChannelSecurity: { tls: 'tls', insecure: 'insecure' },
        };
      }
    }

    process.env[envName] = encoded;

    try {
      await new TestGrpcClientFactory().create({
        ...grpcNode,
        grpc: {
          ...grpcNode.grpc,
          auth: {
            kind: 'self_signed_es256',
            sub: 'ledger-api-user',
            aud: 'https://canton.network.global',
            privateKeyEnv: envName,
          },
        },
      });
    } finally {
      if (originalEnv === undefined) {
        delete process.env[envName];
      } else {
        process.env[envName] = originalEnv;
      }
    }

    expect(tokens).toHaveLength(1);
    const [encodedHeader, encodedPayload, encodedSignature] = tokens[0].split('.');
    expect(JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'))).toEqual({
      alg: 'ES256',
      typ: 'JWT',
    });
    expect(JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))).toEqual({
      sub: 'ledger-api-user',
      aud: 'https://canton.network.global',
    });
    expect(
      verify(
        'sha256',
        Buffer.from(`${encodedHeader}.${encodedPayload}`, 'utf8'),
        { key: publicKey, dsaEncoding: 'ieee-p1363' },
        Buffer.from(encodedSignature, 'base64url'),
      ),
    ).toBe(true);
  });

  it('rejects an ES256 auth configuration when its key environment variable is missing', async () => {
    const envName = 'CANTON_ES256_JWT_MISSING_KEY';
    const originalEnv = process.env[envName];
    delete process.env[envName];

    class TestGrpcClientFactory extends GrpcClientFactory {
      protected override async loadSdk() {
        return {
          BearerTokenAuthProvider: class {
            constructor(_token: string) {}

            async getHeadersAsync() {
              return {};
            }
          },
          CantonClient: class {
            constructor(_options: unknown) {}
          },
          CantonClientOptions: class {
            constructor(_options: unknown) {}
          },
          TransportKind: { grpc: 'grpc' },
          GrpcChannelSecurity: { tls: 'tls', insecure: 'insecure' },
        };
      }
    }

    try {
      await expect(
        new TestGrpcClientFactory().create({
          ...grpcNode,
          grpc: {
            ...grpcNode.grpc,
            auth: {
              kind: 'self_signed_es256',
              sub: 'ledger-api-user',
              aud: 'https://canton.network.global',
              privateKeyEnv: envName,
            },
          },
        }),
      ).rejects.toThrow(envName);
    } finally {
      if (originalEnv === undefined) {
        delete process.env[envName];
      } else {
        process.env[envName] = originalEnv;
      }
    }
  });
});
