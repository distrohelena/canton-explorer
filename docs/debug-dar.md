# Debug DAR

This helper script creates a sibling `-debug.dar` from an existing DAR by:

- preserving the original archive payloads, including `.dalf`
- injecting `debug/source-map.json`
- optionally copying `.daml` source files into the archive

The explorer debugger can use this alongside the normal DAR as long as both DARs
contain the same compiled `.dalf` bytes and therefore produce the same package IDs.

## Generate Source Maps From A DAML Workspace

For workspaces that still do not emit debugger metadata, generate a companion
`source-map.json` from the built DAR plus the original DAML package sources:

```bash
npm run dar:source-map --workspace backend -- \
  --input /path/to/package.dar \
  --workspace-root /path/to/workspace
```

This writes `<input>-source-map.json` by default.

For the local OZ DAML workspace under `~/env/daml-ops/oz-research`, a real
example looks like this:

```bash
npm run dar:source-map --workspace backend -- \
  --input ~/env/daml-ops/oz-research/vault-base/.daml/dist/vault-base-0.0.1.dar \
  --workspace-root ~/env/daml-ops/oz-research \
  --workspace-imports-only
```

Then inject the generated metadata and the package source tree into a sibling
debug DAR:

```bash
npm run dar:debug --workspace backend -- \
  --input ~/env/daml-ops/oz-research/vault-base/.daml/dist/vault-base-0.0.1.dar \
  --source-map ~/env/daml-ops/oz-research/vault-base/.daml/dist/vault-base-0.0.1-source-map.json \
  --source-root ~/env/daml-ops/oz-research/vault-base/daml=daml
```

That produces:

- `vault-base-0.0.1-debug.dar`
- identical compiled `.dalf` payloads
- embedded `debug/source-map.json`
- embedded `.daml` source files under `daml/...`

## Current Fidelity

The generated source map is strongest for:

- top-level value definitions
- templates
- choices
- record fields

Compiler-generated LF helper definitions still receive source mappings, but they
may fall back to the containing module span when the original source location
cannot be inferred precisely from the built DAR alone.

## Prepare Explorer Debug DARs From `daml-ops`

To fill explorer's local `debug-dars/` directory directly from an entire DAML
workspace:

```bash
npm run dar:prepare-workspace --workspace backend -- \
  --workspace-root ~/env/daml-ops/oz-research \
  --output-dir ./debug-dars
```

This command:

- scans `**/.daml/dist/*.dar`
- skips existing `*-debug.dar` files
- generates `debug/source-map.json`
- limits recursive imported package metadata to packages built from the same workspace
- writes ready-to-use debug DARs into explorer's `debug-dars/` folder

## Usage

```bash
npm run dar:debug --workspace backend -- \
  --input /path/to/package.dar \
  --source-map /path/to/source-map.json \
  --source-root /path/to/project \
  --output /path/to/package-debug.dar
```

If `--output` is omitted, the script writes `<input>-debug.dar`.

## Source Copy Rules

`--source-root /path/to/project`

- copies every `.daml` file under that directory
- preserves the relative path inside the DAR

Example:

- local file: `/repo/src/Main.daml`
- archive path: `src/Main.daml`

You can also override the archive prefix:

```bash
--source-root /repo/daml=src
```

You may add individual files too:

```bash
--source /repo/app/Main.daml=src/Main.daml
```

## Important Constraint

Do not rebuild the compiled package differently for the debug DAR.

The `-debug.dar` must contain the same `.dalf` payloads as the production DAR.
Only the extra debug artifacts should differ:

- `debug/source-map.json`
- embedded `.daml` source files
