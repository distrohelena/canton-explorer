import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  validateOptions(options)

  const tempDir = mkdtempSync(path.join(tmpdir(), 'canton-explorer-dar-debug-'))
  const sourceMapPath = path.join(tempDir, `${path.basename(options.inputDar, '.dar')}-source-map.json`)

  try {
    runNodeScript('generate-daml-source-map.mjs', [
      '--input',
      options.inputDar,
      '--source-from-dar',
      '--output',
      sourceMapPath,
    ])

    runNodeScript('build-debug-dar.mjs', [
      '--input',
      options.inputDar,
      '--source-map',
      sourceMapPath,
      '--output',
      options.outputDar,
      ...(options.overwrite ? ['--overwrite'] : []),
    ])
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

function parseArgs(argv) {
  const options = {
    help: false,
    overwrite: false,
    inputDar: '',
    outputDar: '',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    switch (argument) {
      case '--help':
      case '-h':
        options.help = true
        break
      case '--overwrite':
        options.overwrite = true
        break
      case '--input':
        options.inputDar = requireValue(argv, ++index, '--input')
        break
      case '--output':
        options.outputDar = requireValue(argv, ++index, '--output')
        break
      default:
        throw new Error(`Unknown argument: ${argument}`)
    }
  }

  if (!options.outputDar && options.inputDar) {
    const extension = path.extname(options.inputDar)
    const baseName = extension ? options.inputDar.slice(0, -extension.length) : options.inputDar
    options.outputDar = `${baseName}-debug${extension || '.dar'}`
  }

  return options
}

function validateOptions(options) {
  if (!options.inputDar) {
    throw new Error('--input is required')
  }
  if (!existsSync(options.inputDar)) {
    throw new Error(`Input DAR not found: ${options.inputDar}`)
  }
  if (existsSync(options.outputDar) && !options.overwrite) {
    throw new Error(`Output DAR already exists: ${options.outputDar}. Use --overwrite to replace it.`)
  }
}

function runNodeScript(scriptName, args) {
  execFileSync(process.execPath, [path.resolve(__dirname, scriptName), ...args], {
    stdio: 'inherit',
    cwd: process.cwd(),
  })
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
  node ./scripts/prepare-debug-dar-from-dar.mjs \\
    --input /path/to/package.dar \\
    [--output /path/to/package-debug.dar] \\
    [--overwrite]

Notes:
  - Reads DAML source files embedded in the input DAR.
  - Adds debug/source-map.json without changing compiled DALF payloads.
  - Writes a sibling *-debug.dar by default.`)
}

main()
