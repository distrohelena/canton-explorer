import { createHmac } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { createSharedSecretJwt } from '../../src/grpc/shared-secret-jwt';

describe('createSharedSecretJwt', () => {
  it('builds a quickstart-compatible hs256 bearer token with sub and aud claims', () => {
    const token = createSharedSecretJwt({
      user: 'ledger-api-user',
      audience: 'https://canton.network.global',
      secret: 'unsafe',
    });

    const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
    const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    const expectedSignature = createHmac('sha256', 'unsafe')
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    expect(header).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(payload).toEqual({
      sub: 'ledger-api-user',
      aud: 'https://canton.network.global',
    });
    expect(encodedSignature).toBe(expectedSignature);
  });
});
