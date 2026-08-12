# Zero npm audit findings design

## Goal

Bring both npm workspaces, `frontend` and `backend`, to zero reported npm audit findings while preserving the existing application behavior and the pre-existing backend version change.

## Current state

The root npm workspace audit reports six vulnerabilities for each workspace when development dependencies are included:

- Frontend: `monaco-editor` through vulnerable `dompurify`, plus vulnerable `brace-expansion`, `fast-uri`, `nanoid`, and `postcss` transitive paths.
- Backend: `@nestjs/platform-express` through vulnerable `multer`, direct `protobufjs`, plus vulnerable `brace-expansion`, `fast-uri`, and `js-yaml` transitive paths.

The findings are represented in the shared root `package-lock.json`. The only unrelated working-tree change is the backend package version bump from `1.0.1` to `1.0.2`; it must remain intact.

## Remediation design

1. Update direct dependency ranges whose resolved dependency trees contain advisories, selecting fixed releases compatible with the current application APIs. This includes the frontend Monaco dependency, the backend NestJS HTTP adapter dependency, and backend `protobufjs`.
2. Refresh the shared lockfile through npm using the normal workspace dependency resolution. Allow compatible transitive upgrades for the shared vulnerable packages (`brace-expansion`, `fast-uri`, `nanoid`, `postcss`, and `js-yaml`).
3. Add narrowly scoped npm `overrides` only if a vulnerable transitive package remains after normal resolution and the override is compatible with all consumers. Do not use `--force`, suppressions, or audit exclusions.
4. Preserve the existing package names, scripts, workspace layout, and backend version bump.

## Verification

The implementation is complete only when all of the following hold:

- `npm audit --workspace frontend --include=dev` exits successfully and reports zero vulnerabilities.
- `npm audit --workspace backend --include=dev` exits successfully and reports zero vulnerabilities.
- The frontend and backend build successfully.
- Existing frontend and backend tests pass.
- `git diff --check` reports no whitespace errors, and the final diff contains only dependency remediation plus any required lockfile changes and the design document.

## Out of scope

This change does not refactor application code, alter runtime security policy, remove development tooling, or replace npm with another package manager.
