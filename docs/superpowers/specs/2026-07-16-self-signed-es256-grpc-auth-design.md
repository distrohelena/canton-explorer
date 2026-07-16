# Self-Signed ES256 gRPC Authentication Design

**Date:** 2026-07-16

**Status:** Approved for implementation

## Goal

Add explorer-side support for Canton gRPC authentication using a self-signed ES256 JWT, without changing the Canton TypeScript SDK.

## Contract

The gRPC auth configuration gains a `self_signed_es256` variant:

```json
{
  "kind": "self_signed_es256",
  "sub": "ledger-api-user",
  "aud": "https://canton.network.global",
  "privateKeyEnv": "CANTON_ES256_PRIVATE_JWK"
}
```

`privateKeyEnv` is the name of an environment variable. The environment variable contains the base64url encoding of the JSON private EC JWK. The key is not stored in the node configuration JSON.

The generated JWT contains only these fields:

- Header: `alg: ES256`, `typ: JWT`
- Payload: `sub` and `aud` from configuration

No `iss`, `kid`, `iat`, `exp`, or other claims are added by this feature.

## Architecture

The explorer owns JWT creation because it owns the authentication configuration and key material lookup. The SDK remains unchanged: the explorer creates the signed token and passes it to the SDK's existing `BearerTokenAuthProvider`, which emits the standard `authorization: Bearer <token>` gRPC metadata.

JWT generation will live in a focused explorer helper. It will:

1. Decode the environment value from base64url and parse the JSON JWK.
2. Import the JWK as a Node `KeyObject` using the JWK key format.
3. Sign the encoded JWT header and payload with SHA-256 using P-256.
4. Request IEEE-P1363 output so the signature is the JWT-required 64-byte `r || s` value rather than ASN.1 DER.
5. Return the compact JWT string.

The gRPC client factory will resolve `privateKeyEnv`, fail clearly when it is missing or malformed, and wrap the resulting JWT with the SDK bearer provider.

## Debugger behavior

The debugger's granted-rights lookup currently recognizes `shared_secret_jwt` and uses its `user` field. It will also recognize `self_signed_es256` and use its `sub` field as the Canton user ID. This keeps debugger authorization behavior consistent across both JWT modes.

## Failure behavior

- A missing configured environment variable throws an error naming the expected environment variable.
- Invalid base64url, invalid JSON, or an unusable JWK throws a descriptive authentication configuration error.
- The private key value is never included in error messages or logs.
- Existing `shared_secret_jwt` behavior remains unchanged.

## Testing

Tests will cover:

- Parsing valid ES256 configuration and rejecting incomplete configuration.
- Generating an ES256 JWT from a generated P-256 JWK and verifying its signature with the matching public key.
- Correct `alg`, `typ`, `sub`, and `aud` values.
- Missing and invalid key environment values.
- gRPC factory wiring through the SDK bearer provider.
- Debugger rights lookup using `sub` for ES256 auth.
- Existing shared-secret JWT regression coverage.

## Alternatives considered

### Node built-in crypto — selected

Uses the runtime's JWK import and ECDSA signing support, avoids a new dependency, and makes the JWT signature encoding explicit.

### `jose` dependency

Would provide a convenient JWT API, but adds a dependency for a small operation already supported by Node.

### WebCrypto

Can import JWKs and sign, but its ECDSA signature encoding is less explicit for this Node/JWT integration than Node's `ieee-p1363` option.
