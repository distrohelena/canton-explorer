# Zero npm audit findings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the frontend and backend npm workspaces and shared lockfile until both workspace audits report zero vulnerabilities.

**Architecture:** Keep the existing npm workspace layout and dependency boundaries. Upgrade direct dependencies with known fixed releases, let npm resolve compatible transitive fixes in the shared lockfile, and add only narrowly scoped overrides when normal resolution cannot remove a finding.

**Tech Stack:** npm workspaces, `package.json`, `package-lock.json`, Vue/Vite frontend, NestJS backend, npm audit.

## Global Constraints

- Preserve the `backend` version bump from `1.0.1` to `1.0.2`.
- Preserve the root workspace layout, package names, scripts, and runtime behavior.
- `npm audit --workspace frontend --include=dev` must report zero vulnerabilities.
- `npm audit --workspace backend --include=dev` must report zero vulnerabilities.
- Do not use `--force`, audit exclusions, or vulnerability suppressions.
- Use compatible fixed dependency releases; do not refactor application code.

---

### Task 1: Resolve fixed dependency versions and update direct manifests

**Files:**
- Modify: `frontend/package.json`
- Modify: `backend/package.json`

**Interfaces:**
- Consumes: The advisory ranges from the baseline audits and npm registry package metadata.
- Produces: Direct dependency ranges whose resolved versions are outside the vulnerable ranges, while retaining the existing package APIs.

- [ ] **Step 1: Confirm registry versions and peer compatibility**

Run:

```bash
rtk npm view monaco-editor@0.56.0 version
rtk npm view @nestjs/platform-express versions --json
rtk npm view protobufjs versions --json
```

Use the first stable versions that are at or above the audit fixes: Monaco `0.56.0`, Nest platform-express above `11.1.27`, and protobufjs above `7.6.4`. Keep all direct Nest packages on the same compatible 11.x patch line if npm reports peer incompatibility.

- [ ] **Step 2: Update only the direct dependency declarations**

Change the frontend Monaco range to begin at `0.56.0`, the backend Nest HTTP adapter range to begin above `11.1.27`, and the backend protobufjs range to begin above `7.6.4`. Leave unrelated dependency declarations unchanged, including the existing backend package version `1.0.2`.

- [ ] **Step 3: Check the manifest diff**

Run:

```bash
rtk git diff -- frontend/package.json backend/package.json
rtk git diff --check -- frontend/package.json backend/package.json
```

Expected: only the intended dependency ranges differ, and the command exits successfully.

- [ ] **Step 4: Commit the direct dependency changes**

```bash
git add frontend/package.json backend/package.json
git commit -m "fix: update vulnerable direct dependencies"
```

### Task 2: Refresh the shared npm lockfile

**Files:**
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: The updated workspace manifests from Task 1.
- Produces: A reproducible lockfile containing fixed versions for direct and compatible transitive dependencies.

- [ ] **Step 1: Refresh lockfile resolution**

Run:

```bash
rtk npm install --package-lock-only
```

If the sandbox blocks registry access, rerun the same command with the approved network escalation. Do not use `--force`.

- [ ] **Step 2: Inspect vulnerable package resolutions**

Run:

```bash
rtk npm ls --all --parseable | rtk rg '/(brace-expansion|dompurify|fast-uri|js-yaml|multer|nanoid|postcss|protobufjs)$' || true
rtk npm audit --workspace frontend --include=dev --json
rtk npm audit --workspace backend --include=dev --json
```

Record any remaining advisory package, resolved version, and dependency path before making further changes.

- [ ] **Step 3: Commit the lockfile refresh**

```bash
git add package-lock.json
git commit -m "chore: refresh npm audit dependency tree"
```

### Task 3: Remove any remaining transitive findings without suppressions

**Files:**
- Modify: `package.json` only if a compatible root `overrides` entry is required
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: The remaining advisory paths identified in Task 2.
- Produces: A lockfile with every resolved package outside the npm advisory ranges, without changing application code or hiding findings.

- [ ] **Step 1: Prefer compatible parent upgrades**

For any remaining `brace-expansion`, `dompurify`, `fast-uri`, `js-yaml`, `multer`, `nanoid`, `postcss`, or `protobufjs` advisory, run `rtk npm explain brace-expansion`, `rtk npm explain dompurify`, `rtk npm explain fast-uri`, `rtk npm explain js-yaml`, `rtk npm explain multer`, `rtk npm explain nanoid`, `rtk npm explain postcss`, or `rtk npm explain protobufjs` as applicable to identify its parent. Update the parent dependency only when its declared range already permits the fixed release, then rerun `rtk npm install --package-lock-only`.

- [ ] **Step 2: Add a narrowly scoped override only when a parent cannot move**

When a vulnerable transitive package remains after its compatible parent has been updated as far as its declared range allows, add one root `overrides` entry for that package using the fixed version reported by npm. Keep the override limited to the affected package and verify that `rtk npm install` completes without peer or engine errors.

- [ ] **Step 3: Re-run both audits**

Run:

```bash
rtk npm audit --workspace frontend --include=dev
rtk npm audit --workspace backend --include=dev
```

Expected: both commands exit with code 0 and report `found 0 vulnerabilities`.

- [ ] **Step 4: Commit any transitive remediation**

```bash
git add package.json package-lock.json
git commit -m "fix: eliminate remaining npm audit findings"
```

### Task 4: Verify builds, tests, and final repository scope

**Files:**
- Read: `package.json`
- Read: `frontend/package.json`
- Read: `backend/package.json`
- Read: `package-lock.json`

**Interfaces:**
- Consumes: The completed dependency manifests and lockfile.
- Produces: Fresh verification evidence that the security requirement and application checks hold.

- [ ] **Step 1: Run both audits with JSON summaries**

```bash
rtk npm audit --workspace frontend --include=dev --json
rtk npm audit --workspace backend --include=dev --json
```

Expected: exit code 0 and metadata total `0` for each workspace.

- [ ] **Step 2: Build both workspaces**

```bash
rtk npm run build --workspace backend
rtk npm run build --workspace frontend
```

Expected: both commands exit 0.

- [ ] **Step 3: Run both workspace test suites**

```bash
rtk npm test --workspace backend
rtk npm test --workspace frontend -- --run
```

Expected: both commands exit 0 with no failed tests.

- [ ] **Step 4: Check final diff and status**

```bash
rtk git diff --check
rtk git status --short
rtk git diff HEAD~3 --stat
```

Expected: no whitespace errors; only dependency manifests, the shared lockfile, and the approved security design/plan commits are part of this work. Preserve unrelated user changes if present.
