import { createHmac } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { createSharedSecretJwt } from '../../src/grpc/shared-secret-jwt';

describe('createSharedSecretJwt', () => {
  it('builds a quickstart-compatible hs256 bearer token with sub, aud, iat and exp claims', () => {
    const beforeIssuedAt = Math.floor(Date.now() / 1000);
    const token = createSharedSecretJwt({
      user: 'ledger-api-user',
      audience: 'https://canton.network.global',
      secret: 'unsafe',
    });
    const afterIssuedAt = Math.floor(Date.now() / 1000);

    const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
    const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    const expectedSignature = createHmac('sha256', 'unsafe')
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    expect(header).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(payload.sub).toBe('ledger-api-user');
    expect(payload.aud).toBe('https://canton.network.global');
    expect(payload.iat).toBeGreaterThanOrEqual(beforeIssuedAt);
    expect(payload.iat).toBeLessThanOrEqual(afterIssuedAt);
    expect(payload.exp).toBe(payload.iat + 3600);
    expect(encodedSignature).toBe(expectedSignature);
  });

  it('honors a custom expiresInSeconds', () => {
    const token = createSharedSecretJwt({
      user: 'ledger-api-user',
      audience: 'https://canton.network.global',
      secret: 'unsafe',
      expiresInSeconds: 60,
    });

    const [, encodedPayload] = token.split('.');
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));

    expect(payload.exp).toBe(payload.iat + 60);
  });
});
