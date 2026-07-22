# Static Token gRPC Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an environment-backed `static_token` gRPC authentication mode that forwards an opaque bearer token unchanged while preserving existing auth and debugger authorization behavior.

**Architecture:** Extend the existing strict discriminated auth schema with `{ kind: 'static_token', tokenEnv }`. The gRPC client factory reads the configured environment variable and passes its exact value to the SDK's existing `BearerTokenAuthProvider`; missing or empty values fail before client construction. Static tokens have no configured user identity, so debugger replay-rights lookup remains fail-closed and performs no user-rights request.

**Tech Stack:** TypeScript, NestJS, Zod, Jest, the Canton TypeScript SDK's `BearerTokenAuthProvider`, Markdown/JSON configuration documentation.

---

## File map

- Modify `backend/src/config/node-config.schema.ts`: add and validate the strict `static_token` discriminated-union branch.
- Modify `backend/test/config/node-config.spec.ts`: cover valid parsing and all `tokenEnv` validation/strictness cases.
- Modify `backend/src/grpc/grpc-client.factory.ts`: read the environment-backed token and construct the SDK bearer provider.
- Modify `backend/test/grpc/grpc-client.factory.spec.ts`: cover exact token forwarding and missing/empty environment values.
- Modify `backend/src/debugger/debugger.service.spec.ts`: prove static-token replay access is fail-closed without a rights lookup. No production debugger change is expected because the existing undefined-user branch already has the required behavior.
- Modify `README.md`: document `tokenEnv`, secret handling, and the opaque-token contract.
- Modify `backend/config/nodes.example.json`: show the new auth shape in the publishable example.

Before Task 1, run `git rev-parse HEAD` and retain the result as
`BASE_COMMIT`. The final verification uses this commit—not an assumed number
of feature commits—as the left side of complete-range checks.

### Task 1: Add schema coverage for static-token configuration

**Files:**
- Test: `backend/test/config/node-config.spec.ts`
- Modify: `backend/src/config/node-config.schema.ts`

- [ ] **Step 1: Write the failing valid-config test.**

Add a `parseNodeConfigFile` test using a `pqs_with_grpc` node whose auth is:

```ts
{
  kind: 'static_token',
  tokenEnv: 'CANTON_STATIC_TOKEN',
}
```

Assert that the parsed auth object is exactly the same object and that no
other auth fields are introduced.

- [ ] **Step 2: Run the focused test and confirm it fails.**

Run:

```bash
npm test --workspace backend -- --runInBand test/config/node-config.spec.ts -t "static-token"
```

Expected: FAIL because the discriminated union currently does not recognize
`static_token`.

- [ ] **Step 3: Add the minimal strict schema branch.**

Add this branch to `grpcAuthSchema` alongside the existing modes:

```ts
z
  .object({
    kind: z.literal('static_token'),
    tokenEnv: z.string().min(1).refine((value) => value.trim().length > 0),
  })
  .strict(),
```

Keep the original `shared_secret_jwt` and `self_signed_es256` branches
unchanged.

- [ ] **Step 4: Add validation and strictness tests.**

Add table-driven cases proving parsing rejects a missing `tokenEnv`, a
non-string value, `''`, and a whitespace-only string. Add a case with an
unexpected field such as `token` and assert the strict branch rejects it.
Ensure the assertions identify `tokenEnv` or the unrecognized field rather
than relying only on a generic parse failure.

- [ ] **Step 5: Run the schema tests.**

Run the full config spec:

```bash
npm test --workspace backend -- --runInBand test/config/node-config.spec.ts
```

Expected: PASS, including all pre-existing auth-mode tests.

- [ ] **Step 6: Commit the schema change.**

```bash
git add backend/src/config/node-config.schema.ts backend/test/config/node-config.spec.ts
git commit -m "feat: accept static token auth configuration"
```

### Task 2: Forward the environment token through the gRPC factory

**Files:**
- Test: `backend/test/grpc/grpc-client.factory.spec.ts`
- Modify: `backend/src/grpc/grpc-client.factory.ts`

- [ ] **Step 1: Write the exact-token forwarding test.**

Use the existing `TestGrpcClientFactory` SDK stub pattern and capture the
constructor argument passed to `BearerTokenAuthProvider`. Set the configured
environment variable to a token containing punctuation plus leading and
trailing whitespace, for example `  opaque.token/+==  `, then create a node
using `static_token`. Assert the captured value equals the exact environment
value, including the whitespace, and assert the provider/client are each
constructed once.

- [ ] **Step 2: Run the focused factory test and confirm it fails.**

```bash
npm test --workspace backend -- --runInBand test/grpc/grpc-client.factory.spec.ts -t "static token"
```

Expected: FAIL because the factory has no `static_token` switch branch.

- [ ] **Step 3: Write missing/empty environment tests.**

Add tests for an unset environment variable and an explicitly empty value.
Use `try/finally` to restore each original `process.env` value. Add constructor
spies/counters for both `BearerTokenAuthProvider` and `CantonClient`, and
assert neither constructor is called when the environment value is missing or
empty. Also assert that creation rejects with an error containing the
environment variable name and that the token value, when applicable, is not
present in the error message.

- [ ] **Step 4: Implement the factory branch.**

Add this behavior to `createAuthProvider`:

```ts
case 'static_token': {
  const token = process.env[node.grpc.auth.tokenEnv];
  if (!token) {
    throw new Error(`Missing static token environment variable: ${node.grpc.auth.tokenEnv}`);
  }
  return new sdk.BearerTokenAuthProvider(token);
}
```

Do not trim, prefix with `Bearer`, decode, parse, log, or otherwise transform
the token. The SDK provider is responsible for applying bearer authentication.

- [ ] **Step 5: Run all gRPC factory tests.**

```bash
npm test --workspace backend -- --runInBand test/grpc/grpc-client.factory.spec.ts
```

Expected: PASS for static tokens, shared-secret JWTs, self-signed ES256, and
the existing endpoint behavior.

- [ ] **Step 6: Commit the factory change.**

```bash
git add backend/src/grpc/grpc-client.factory.ts backend/test/grpc/grpc-client.factory.spec.ts
git commit -m "feat: forward static token grpc credentials"
```

### Task 3: Lock down debugger fail-closed behavior

**Files:**
- Test: `backend/src/debugger/debugger.service.spec.ts`
- Inspect/modify only if required: `backend/src/debugger/debugger.service.ts`

- [ ] **Step 1: Add a static-token rights test.**

Call the private `fetchGrantedReplayAccess` method through the established
test cast with a node whose auth is `{ kind: 'static_token', tokenEnv: ... }`.
Provide a `listUserRightsAsync` Jest mock that would return elevated rights if
called. Assert the result is exactly:

```ts
{ parties: [], canReadAsAnyParty: false }
```

Also assert `listUserRightsAsync` was not called. This proves the opaque token
does not get decoded or treated as a user identity.

- [ ] **Step 2: Run the focused debugger test and confirm the existing behavior.**

```bash
npm test --workspace backend -- --runInBand src/debugger/debugger.service.spec.ts -t "static-token"
```

Expected: PASS without a production change. If the test exposes a type or
control-flow issue after adding the schema variant, make the smallest explicit
production adjustment that preserves the same fail-closed result.

- [ ] **Step 3: Run the full debugger spec.**

```bash
npm test --workspace backend -- --runInBand src/debugger/debugger.service.spec.ts
```

Expected: PASS, including existing shared-secret and self-signed rights tests.

- [ ] **Step 4: Commit the authorization-coverage change.**

```bash
git add backend/src/debugger/debugger.service.spec.ts backend/src/debugger/debugger.service.ts
git commit -m "test: keep static token debugger access fail closed"
```

Only include `backend/src/debugger/debugger.service.ts` if the implementation
was actually changed.

### Task 4: Document deployment configuration

**Files:**
- Modify: `README.md`
- Modify: `backend/config/nodes.example.json`

- [ ] **Step 1: Add README guidance.**

Explain that `static_token` reads an opaque pre-issued token from the
environment variable named by `tokenEnv`, show:

```json
{
  "kind": "static_token",
  "tokenEnv": "CANTON_STATIC_TOKEN"
}
```

State that the token is passed unchanged to the SDK bearer provider, should be
managed as a deployment secret, and does not provide a configured debugger
user identity. Keep the existing auth-mode documentation intact.

- [ ] **Step 2: Update the example config.**

Change the example auth block to the environment-backed static-token shape, or
add a clearly labeled alternative block if retaining self-signed ES256 as the
primary example is important. Do not add a real token value.

- [ ] **Step 3: Inspect the documentation diff.**

```bash
git diff -- README.md backend/config/nodes.example.json
```

Expected: no credential values, no implication that `token` is a config field,
and clear distinction between `tokenEnv` and the token itself.

- [ ] **Step 4: Commit the documentation change.**

```bash
git add README.md backend/config/nodes.example.json
git commit -m "docs: describe static token grpc auth"
```

### Task 5: Run final verification

**Files:**
- No new files; verify all modified implementation, test, and documentation files.

- [ ] **Step 1: Run focused backend tests together.**

```bash
npm test --workspace backend -- --runInBand \
  test/config/node-config.spec.ts \
  test/grpc/grpc-client.factory.spec.ts \
  src/debugger/debugger.service.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run the backend type/build check.**

```bash
npm run build --workspace backend
```

Expected: successful NestJS/TypeScript build with the new discriminated-union
variant fully type-checked.

- [ ] **Step 3: Run backend lint/format verification.**

```bash
npm run lint --workspace backend
```

Expected: PASS. If lint modifies files because the repository script includes
`--fix`, inspect the resulting diff and keep only formatting required by the
feature.

- [ ] **Step 4: Review the final diff and status.**

```bash
git diff --check
git status --short
git log -6 --oneline
```

Run the complete-range check from the retained base commit as well:

```bash
git diff --check "$BASE_COMMIT..HEAD"
git diff "$BASE_COMMIT..HEAD" --stat
```

Confirm only intended static-token changes are present in that range and
preserve any pre-existing unrelated modification in
`backend/package.json`/`tsconfig.base.json`.
