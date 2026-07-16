import { generateKeyPairSync, verify } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { createSelfSignedEs256Jwt } from '../../src/grpc/self-signed-es256-jwt';

function createPrivateJwkBase64Url() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  });

  return {
    encoded: Buffer.from(
      JSON.stringify(privateKey.export({ format: 'jwk' })),
      'utf8',
    ).toString('base64url'),
    publicKey,
  };
}

describe('createSelfSignedEs256Jwt', () => {
  it('creates a verifiable ES256 JWT from a base64url-encoded private JWK', () => {
    const { encoded, publicKey } = createPrivateJwkBase64Url();

    const token = createSelfSignedEs256Jwt({
      sub: 'ledger-api-user',
      aud: 'https://canton.network.global',
      privateKeyJwkBase64Url: encoded,
    });

    const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
    const header = JSON.parse(
      Buffer.from(encodedHeader, 'base64url').toString('utf8'),
    ) as { alg: string; typ: string };
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as { sub: string; aud: string };
    const signature = Buffer.from(encodedSignature, 'base64url');

    expect(header).toEqual({ alg: 'ES256', typ: 'JWT' });
    expect(payload).toEqual({
      sub: 'ledger-api-user',
      aud: 'https://canton.network.global',
    });
    expect(signature).toHaveLength(64);
    expect(
      verify(
        'sha256',
        Buffer.from(`${encodedHeader}.${encodedPayload}`, 'utf8'),
        { key: publicKey, dsaEncoding: 'ieee-p1363' },
        signature,
      ),
    ).toBe(true);
  });

  it('rejects malformed JWK input without exposing the key value', () => {
    const secret = 'not-a-real-private-key';

    expect(() =>
      createSelfSignedEs256Jwt({
        sub: 'ledger-api-user',
        aud: 'https://canton.network.global',
        privateKeyJwkBase64Url: Buffer.from(secret, 'utf8').toString(
          'base64url',
        ),
      }),
    ).toThrow(/private JWK/i);
  });
});
