# Self-Signed ES256 gRPC Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explorer-side `self_signed_es256` gRPC JWT authentication using a base64url-encoded private JWK from an environment variable, without changing the Canton TypeScript SDK.

**Architecture:** Add a focused Node-crypto JWT helper that decodes and imports the configured JWK, signs the compact JWT with P-256/SHA-256, and emits the JWT-required IEEE-P1363 signature. Extend the explorer config union and gRPC factory to create the token through the SDK's existing `BearerTokenAuthProvider`; update debugger rights lookup to use `sub` for this auth mode.

**Tech Stack:** TypeScript, NestJS, Zod, Node `crypto`, Jest, existing Canton TypeScript SDK bearer-token auth.

---

### Task 1: Add failing JWT helper tests

**Files:**
- Create: `backend/test/grpc/self-signed-es256-jwt.spec.ts`
- Reference: `backend/src/grpc/shared-secret-jwt.ts`

- [ ] **Step 1: Write the failing tests**

Add tests that generate a P-256 key pair with Node `generateKeyPairSync`, export the private key as JWK, base64url-encode the JSON JWK, and call the new helper contract. Verify:

- header is `{ alg: 'ES256', typ: 'JWT' }`;
- payload is `{ sub: 'ledger-api-user', aud: 'https://canton.network.global' }`;
- signature is 64 bytes after base64url decoding;
- the signature verifies with the generated public key using SHA-256 and IEEE-P1363 decoding;
- malformed base64url/JWK input throws without exposing the key value.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm run test --workspace backend -- --runInBand test/grpc/self-signed-es256-jwt.spec.ts`

Expected: FAIL because the helper does not exist yet.

### Task 2: Implement the ES256 JWT helper

**Files:**
- Create: `backend/src/grpc/self-signed-es256-jwt.ts`
- Test: `backend/test/grpc/self-signed-es256-jwt.spec.ts`

- [ ] **Step 1: Implement the minimal helper**

Implement `createSelfSignedEs256Jwt({ sub, aud, privateKeyJwkBase64Url })`:

1. Decode the base64url environment value and parse JSON.
2. Import the parsed JWK with `createPrivateKey({ key: jwk, format: 'jwk' })`.
3. Encode the fixed ES256 header and configured payload with base64url JSON.
4. Sign the encoded header/payload using SHA-256 and `dsaEncoding: 'ieee-p1363'`.
5. Return the three compact JWT segments.

Do not log or include the key material in errors. Use descriptive configuration errors for malformed input.

- [ ] **Step 2: Run the focused test to verify it passes**

Run: `npm run test --workspace backend -- --runInBand test/grpc/self-signed-es256-jwt.spec.ts`

Expected: PASS.

- [ ] **Step 3: Refactor only after green**

Keep encoding and JWK parsing private to the helper unless a small extraction clearly removes duplication. Re-run the focused test after any refactor.

### Task 3: Extend config parsing and factory auth wiring

**Files:**
- Modify: `backend/src/config/node-config.schema.ts`
- Modify: `backend/src/grpc/grpc-client.factory.ts`
- Modify: `backend/test/config/node-config.spec.ts`
- Modify: `backend/test/grpc/grpc-client.factory.spec.ts`

- [ ] **Step 1: Add failing config tests**

Add coverage for parsing:

```json
{
  "kind": "self_signed_es256",
  "sub": "ledger-api-user",
  "aud": "https://canton.network.global",
  "privateKeyEnv": "CANTON_ES256_PRIVATE_JWK"
}
```

Add rejection coverage for empty `sub`, empty `aud`, and empty `privateKeyEnv`.

- [ ] **Step 2: Run config tests to verify they fail**

Run: `npm run test --workspace backend -- --runInBand test/config/node-config.spec.ts`

Expected: FAIL because the discriminated union only accepts `shared_secret_jwt`.

- [ ] **Step 3: Extend the schema minimally**

Add a strict `self_signed_es256` branch alongside `shared_secret_jwt` with `sub`, `aud`, and `privateKeyEnv` as non-empty strings. Preserve the existing shared-secret branch unchanged.

- [ ] **Step 4: Add failing factory wiring coverage**

Extend the factory test SDK double so the test can inspect the token passed to `BearerTokenAuthProvider`. Set `process.env.CANTON_ES256_PRIVATE_JWK` to a generated base64url JWK, create an ES256-authenticated node, and assert that the provider receives a JWT whose claims and signature are valid. Add a missing-environment-value test.

- [ ] **Step 5: Run factory tests to verify they fail**

Run: `npm run test --workspace backend -- --runInBand test/grpc/grpc-client.factory.spec.ts`

Expected: FAIL because the factory does not yet handle `self_signed_es256`.

- [ ] **Step 6: Implement factory resolution**

Import the new helper. In `createAuthProvider`, resolve `process.env[node.grpc.auth.privateKeyEnv]`, throw a clear missing-variable error when absent, create the ES256 JWT with `sub` and `aud`, and wrap it with `new sdk.BearerTokenAuthProvider(token)`. Leave the shared-secret case unchanged.

- [ ] **Step 7: Run config and factory tests to verify they pass**

Run: `npm run test --workspace backend -- --runInBand test/config/node-config.spec.ts test/grpc/grpc-client.factory.spec.ts`

Expected: PASS.

### Task 4: Support ES256 subjects in debugger rights lookup

**Files:**
- Modify: `backend/src/debugger/debugger.service.ts`
- Modify: `backend/test/debugger/debugger.service.spec.ts`

- [ ] **Step 1: Add a failing debugger test**

Add an ES256-authenticated node fixture and assert that `listUserRightsAsync` receives the configured `sub` value and that the returned rights are used for replay access.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm run test --workspace backend -- --runInBand test/debugger/debugger.service.spec.ts`

Expected: FAIL because the current guard only accepts `shared_secret_jwt`.

- [ ] **Step 3: Implement subject selection**

Accept both auth kinds. Use `auth.user` for `shared_secret_jwt` and `auth.sub` for `self_signed_es256`; return the existing empty-rights result only when no supported authenticated user exists.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm run test --workspace backend -- --runInBand test/debugger/debugger.service.spec.ts`

Expected: PASS.

### Task 5: Update configuration examples and documentation

**Files:**
- Modify: `backend/config/nodes.example.json`
- Modify: `README.md` or `backend/README.md` where gRPC auth is documented
- Test: relevant config parsing tests if examples are parsed or asserted

- [ ] **Step 1: Add the ES256 example**

Document the `self_signed_es256` shape and explain that `privateKeyEnv` names an environment variable containing the base64url-encoded private JWK. Do not include a real private key.

- [ ] **Step 2: Check formatting and documentation references**

Run: `npm run format --workspace backend -- --check` if supported by the repository scripts, otherwise inspect the changed JSON/Markdown and run `git diff --check`.

### Task 6: Full verification and handoff

**Files:**
- Inspect all changed files and tests

- [ ] **Step 1: Run the backend test suite**

Run: `npm run test --workspace backend -- --runInBand`

Expected: PASS with zero failed tests.

- [ ] **Step 2: Run the backend build**

Run: `npm run build --workspace backend`

Expected: exit code 0.

- [ ] **Step 3: Run repository diff checks**

Run: `rtk git diff --check` and `rtk git status --short`.

Confirm the SDK source/package is untouched and only explorer files, tests, examples, and docs changed.

- [ ] **Step 4: Report verification evidence**

Summarize the exact test/build results and note any environment limitation, including the read-only `.git` limitation if it remains.
