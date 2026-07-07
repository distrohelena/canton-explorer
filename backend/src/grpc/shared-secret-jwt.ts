import { createHmac } from 'node:crypto';

export interface SharedSecretJwtConfig {
  user: string;
  audience: string;
  secret: string;
}

export function createSharedSecretJwt(config: SharedSecretJwtConfig): string {
  const encodedHeader = encodeBase64Url(
    JSON.stringify({
      alg: 'HS256',
      typ: 'JWT',
    }),
  );
  const encodedPayload = encodeBase64Url(
    JSON.stringify({
      sub: config.user,
      aud: config.audience,
    }),
  );
  const encodedSignature = createHmac('sha256', config.secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}
