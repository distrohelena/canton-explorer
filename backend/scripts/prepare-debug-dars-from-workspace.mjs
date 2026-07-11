import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..', '..')

function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  validateOptions(options)

  const tempDir = mkdtempSync(path.join(tmpdir(), 'canton-explorer-debug-dars-'))

  try {
    mkdirSync(options.outputDir, { recursive: true })

    const inputDars = listInputDars(options.workspaceRoot)
    for (const inputDar of inputDars) {
      const packageDir = resolvePackageDir(inputDar)
      if (packageDir === null) {
        continue
      }
      const sourceMapPath = path.join(
        tempDir,
        `${path.basename(inputDar, '.dar')}-source-map.json`,
      )
      const outputDarPath = path.join(
        options.outputDir,
        `${path.basename(inputDar, '.dar')}-debug.dar`,
      )

      runNodeScript('generate-daml-source-map.mjs', [
        '--input',
        inputDar,
        '--workspace-root',
        options.workspaceRoot,
        '--output',
        sourceMapPath,
        '--workspace-imports-only',
      ])

      runNodeScript('build-debug-dar.mjs', [
        '--input',
        inputDar,
        '--source-map',
        sourceMapPath,
        '--source-root',
        `${path.join(packageDir, 'daml')}=daml`,
        '--output',
        outputDarPath,
        '--overwrite',
      ])
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

function parseArgs(argv) {
  const options = {
    help: false,
    workspaceRoot: '',
    outputDir: path.resolve(repoRoot, 'debug-dars'),
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    switch (argument) {
      case '--help':
      case '-h':
        options.help = true
        break
      case '--workspace-root':
        options.workspaceRoot = requireValue(argv, ++index, '--workspace-root')
        break
      case '--output-dir':
        options.outputDir = path.resolve(repoRoot, requireValue(argv, ++index, '--output-dir'))
        break
      default:
        throw new Error(`Unknown argument: ${argument}`)
    }
  }

  return options
}

function validateOptions(options) {
  if (!options.workspaceRoot) {
    throw new Error('--workspace-root is required')
  }

  const resolvedWorkspaceRoot = path.resolve(options.workspaceRoot)
  if (!existsSync(resolvedWorkspaceRoot) || !statSync(resolvedWorkspaceRoot).isDirectory()) {
    throw new Error(`Workspace root not found: ${resolvedWorkspaceRoot}`)
  }

  options.workspaceRoot = resolvedWorkspaceRoot
}

function listInputDars(workspaceRoot) {
  const dars = []
  walkFiles(workspaceRoot, (filePath) => {
    if (!filePath.endsWith('.dar')) {
      return
    }
    if (filePath.endsWith('-debug.dar')) {
      return
    }
    if (!filePath.includes(`${path.sep}.daml${path.sep}dist${path.sep}`)) {
      return
    }
    dars.push(filePath)
  })
  return dars.sort()
}

function resolvePackageDir(inputDar) {
  const candidate = path.dirname(path.dirname(path.dirname(inputDar)))
  const damlYamlPath = path.join(candidate, 'daml.yaml')
  if (existsSync(damlYamlPath) && statSync(damlYamlPath).isFile()) {
    return candidate
  }
  return null
}

function walkFiles(rootDir, visitor) {
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const absolutePath = path.join(rootDir, entry.name)
    if (entry.isDirectory()) {
      walkFiles(absolutePath, visitor)
      continue
    }
    if (entry.isFile()) {
      visitor(absolutePath)
    }
  }
}

function runNodeScript(scriptName, args) {
  execFileSync(
    process.execPath,
    [path.resolve(__dirname, scriptName), ...args],
    {
      stdio: 'inherit',
      cwd: process.cwd(),
    },
  )
}

function requireValue(argv, index, flagName) {
  const value = argv[index]
  if (!value) {
    throw new Error(`${flagName} requires a value`)
  }
  return value
}

function printHelp() {
  console.log(`Usage:
  node ./scripts/prepare-debug-dars-from-workspace.mjs \\
    --workspace-root /path/to/daml/workspace \\
    [--output-dir /path/to/debug-dars]

Notes:
  - Scans workspace .daml/dist outputs.
  - Skips existing *-debug.dar files.
  - Generates source maps with workspace-local imports only.
  - Writes ready-to-use debug DARs into the target directory.`)
}

main()
