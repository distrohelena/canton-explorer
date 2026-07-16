import {
  createPrivateKey,
  createSign,
  type JsonWebKey as NodeJsonWebKey,
} from 'node:crypto';

export interface SelfSignedEs256JwtConfig {
  sub: string;
  aud: string;
  privateKeyJwkBase64Url: string;
}

export function createSelfSignedEs256Jwt(
  config: SelfSignedEs256JwtConfig,
): string {
  const privateKey = importPrivateKey(config.privateKeyJwkBase64Url);
  const encodedHeader = encodeBase64Url(
    JSON.stringify({
      alg: 'ES256',
      typ: 'JWT',
    }),
  );
  const encodedPayload = encodeBase64Url(
    JSON.stringify({
      sub: config.sub,
      aud: config.aud,
    }),
  );
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signer = createSign('sha256');
  signer.update(signingInput);
  signer.end();

  const encodedSignature = signer
    .sign({ key: privateKey, dsaEncoding: 'ieee-p1363' })
    .toString('base64url');

  return `${signingInput}.${encodedSignature}`;
}

function importPrivateKey(encodedJwk: string) {
  try {
    const jwk = JSON.parse(
      Buffer.from(encodedJwk, 'base64url').toString('utf8'),
    ) as NodeJsonWebKey;

    if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || typeof jwk.d !== 'string') {
      throw new Error('JWK is not an EC P-256 private key');
    }

    return createPrivateKey({ key: jwk, format: 'jwk' });
  } catch (error) {
    throw new Error(
      'Invalid private JWK for self_signed_es256 authentication',
      { cause: error },
    );
  }
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}
