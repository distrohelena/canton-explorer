# Static Token gRPC Authentication Design

## Goal

Add support for Canton gRPC authentication with a pre-issued static bearer
token, alongside the existing `shared_secret_jwt` and `self_signed_es256`
authentication modes.

## Configuration

The gRPC auth discriminated union gains this variant:

```json
{
  "kind": "static_token",
  "tokenEnv": "CANTON_STATIC_TOKEN"
}
```

`tokenEnv` is a non-empty, non-whitespace string naming an environment
variable. The variant is strict: unknown fields are rejected. The token is
kept out of the node configuration so deployments can provide it through
secret management and avoid committing a bearer credential.

The static token variant has no configured user identity. Static tokens may be
opaque and cannot safely be decoded to infer a Canton user.

## Authentication flow

When a `pqs_with_grpc` node uses `static_token`, the gRPC client factory reads
`process.env[node.grpc.auth.tokenEnv]` and passes the value unchanged to the
SDK's existing `BearerTokenAuthProvider`: it must not trim, prefix, decode, or
otherwise transform the token. If the environment variable is missing or its
value is empty, factory creation fails with an error naming the configured
environment variable. The token itself is never included in that error or in
logs.

Existing authentication modes retain their current behavior.

## Debugger authorization

The debugger's granted-rights lookup continues to resolve identities only for
auth modes that explicitly configure one: `shared_secret_jwt.user` and
`self_signed_es256.sub`. `static_token` supplies no identity, so the debugger
must not issue a user-rights lookup for it. It returns the fail-closed result
`{ parties: [], canReadAsAnyParty: false }`; downstream replay filtering then
grants no token-derived party access or any-party access. The token is still
used for gRPC calls through the shared client auth provider.

## Components

- `backend/src/config/node-config.schema.ts`: validate the new strict auth
  variant.
- `backend/src/grpc/grpc-client.factory.ts`: read `tokenEnv` and construct the
  bearer provider.
- `backend/src/debugger/debugger.service.ts`: preserve the no-user behavior
  for static tokens explicitly in the identity selection logic if needed.
- Configuration and factory tests: cover parsing, token forwarding, and the
  missing environment variable error.
- `README.md` and `backend/config/nodes.example.json`: document the new
  environment-backed configuration.

## Error handling

An empty or missing `tokenEnv` is rejected during configuration parsing. A
missing or empty environment value is rejected while creating the gRPC client,
with the environment variable name included in the error. No token value is
included in errors or logs.

## Testing

- Parse a valid `static_token` configuration.
- Reject a missing, non-string, empty, or whitespace-only `tokenEnv`, and
  reject unknown fields in the strict variant.
- Verify the exact environment-provided token—including unusual characters—is
  passed to `BearerTokenAuthProvider` without trimming, prefixing, decoding, or
  other transformation.
- Verify missing and empty token environment values fail clearly, without
  exposing the token value.
- Verify static-token debugger access performs no user-rights lookup and
  returns `{ parties: [], canReadAsAnyParty: false }`.
- Retain existing shared-secret and self-signed behavior tests.
- Run the backend focused tests and type/build checks.

## Alternatives considered

Adding a separate `user` field would enable debugger rights lookup, but would
duplicate identity configuration and could be wrong for an opaque token. Token
decoding is also unsuitable because a static token need not be a JWT and an
unverified claim must not drive authorization. Therefore the initial design
supports only `tokenEnv` and treats static-token debugger access as having no
resolved user identity.
