import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  validateOptions(options);

  const tempRoot = mkdtempSync(path.join(tmpdir(), 'canton-debug-dar-'));
  const unpackedDir = path.join(tempRoot, 'unpacked');
  mkdirSync(unpackedDir, { recursive: true });

  try {
    unpackDar(options.inputDar, unpackedDir);

    const debugDir = path.join(unpackedDir, 'debug');
    mkdirSync(debugDir, { recursive: true });
    const sourceMapTarget = path.join(debugDir, 'source-map.json');
    writeFileSync(sourceMapTarget, JSON.stringify(loadJson(options.sourceMapPath), null, 2));

    for (const sourceRoot of options.sourceRoots) {
      copySourceRoot(unpackedDir, sourceRoot);
    }

    for (const sourceFile of options.sourceFiles) {
      copySourceFile(unpackedDir, sourceFile);
    }

    packDar(unpackedDir, options.outputDar);
    console.log(`Wrote debug DAR: ${options.outputDar}`);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  const options = {
    help: false,
    overwrite: false,
    inputDar: '',
    outputDar: '',
    sourceMapPath: '',
    sourceRoots: [],
    sourceFiles: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    switch (argument) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--overwrite':
        options.overwrite = true;
        break;
      case '--input':
        options.inputDar = requireValue(argv, ++index, '--input');
        break;
      case '--output':
        options.outputDar = requireValue(argv, ++index, '--output');
        break;
      case '--source-map':
        options.sourceMapPath = requireValue(argv, ++index, '--source-map');
        break;
      case '--source-root':
        options.sourceRoots.push(parseMappedPath(requireValue(argv, ++index, '--source-root')));
        break;
      case '--source':
        options.sourceFiles.push(parseMappedPath(requireValue(argv, ++index, '--source')));
        break;
      default:
        throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!options.outputDar && options.inputDar) {
    options.outputDar = defaultOutputPath(options.inputDar);
  }

  return options;
}

function validateOptions(options) {
  if (!options.inputDar) {
    throw new Error('--input is required');
  }
  if (!options.sourceMapPath) {
    throw new Error('--source-map is required');
  }
  if (!existsSync(options.inputDar)) {
    throw new Error(`Input DAR not found: ${options.inputDar}`);
  }
  if (!existsSync(options.sourceMapPath)) {
    throw new Error(`Source map file not found: ${options.sourceMapPath}`);
  }
  if (existsSync(options.outputDar) && !options.overwrite) {
    throw new Error(`Output DAR already exists: ${options.outputDar}. Use --overwrite to replace it.`);
  }

  for (const sourceRoot of options.sourceRoots) {
    if (!existsSync(sourceRoot.localPath)) {
      throw new Error(`Source root not found: ${sourceRoot.localPath}`);
    }
    if (!statSync(sourceRoot.localPath).isDirectory()) {
      throw new Error(`Source root is not a directory: ${sourceRoot.localPath}`);
    }
  }

  for (const sourceFile of options.sourceFiles) {
    if (!existsSync(sourceFile.localPath)) {
      throw new Error(`Source file not found: ${sourceFile.localPath}`);
    }
    if (!statSync(sourceFile.localPath).isFile()) {
      throw new Error(`Source file is not a file: ${sourceFile.localPath}`);
    }
  }

  loadJson(options.sourceMapPath);
}

function requireValue(argv, index, flagName) {
  const value = argv[index];
  if (!value) {
    throw new Error(`${flagName} requires a value`);
  }
  return value;
}

function parseMappedPath(value) {
  const separatorIndex = value.indexOf('=');
  if (separatorIndex < 0) {
    return {
      localPath: path.resolve(value),
      archivePrefix: '',
    };
  }

  return {
    localPath: path.resolve(value.slice(0, separatorIndex)),
    archivePrefix: normalizeArchivePath(value.slice(separatorIndex + 1)),
  };
}

function defaultOutputPath(inputDar) {
  const extension = path.extname(inputDar);
  const baseName = extension ? inputDar.slice(0, -extension.length) : inputDar;
  return `${baseName}-debug${extension || '.dar'}`;
}

function loadJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function unpackDar(inputDar, targetDir) {
  execFileSync('python3', [
    '-c',
    `
import sys, zipfile
archive_path = sys.argv[1]
target_dir = sys.argv[2]
with zipfile.ZipFile(archive_path, "r") as archive:
    archive.extractall(target_dir)
`,
    inputDar,
    targetDir,
  ], {
    stdio: 'inherit',
  });
}

function packDar(sourceDir, outputDar) {
  mkdirSync(path.dirname(path.resolve(outputDar)), { recursive: true });
  execFileSync('python3', [
    '-c',
    `
import os, sys, zipfile
source_dir = sys.argv[1]
output_path = sys.argv[2]
with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    for root, _, files in os.walk(source_dir):
        for file_name in files:
            absolute_path = os.path.join(root, file_name)
            archive_path = os.path.relpath(absolute_path, source_dir)
            archive.write(absolute_path, archive_path)
`,
    sourceDir,
    path.resolve(outputDar),
  ], {
    stdio: 'inherit',
  });
}

function copySourceRoot(unpackedDir, sourceRoot) {
  walkFiles(sourceRoot.localPath, (localFilePath) => {
    if (!localFilePath.endsWith('.daml')) {
      return;
    }

    const relativePath = path.relative(sourceRoot.localPath, localFilePath);
    const archivePath = joinArchivePath(sourceRoot.archivePrefix, relativePath);
    copyFileIntoArchive(unpackedDir, localFilePath, archivePath);
  });
}

function copySourceFile(unpackedDir, sourceFile) {
  const archivePath = sourceFile.archivePrefix
    ? sourceFile.archivePrefix
    : normalizeArchivePath(path.basename(sourceFile.localPath));
  copyFileIntoArchive(unpackedDir, sourceFile.localPath, archivePath);
}

function walkFiles(rootDir, visitor) {
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const absolutePath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(absolutePath, visitor);
      continue;
    }
    if (entry.isFile()) {
      visitor(absolutePath);
    }
  }
}

function copyFileIntoArchive(unpackedDir, localFilePath, archivePath) {
  const normalizedArchivePath = normalizeArchivePath(archivePath);
  const targetPath = path.join(unpackedDir, ...normalizedArchivePath.split('/'));
  mkdirSync(path.dirname(targetPath), { recursive: true });
  cpSync(localFilePath, targetPath);
}

function joinArchivePath(prefix, relativePath) {
  const normalizedRelativePath = normalizeArchivePath(relativePath);
  if (!prefix) {
    return normalizedRelativePath;
  }
  return `${normalizeArchivePath(prefix)}/${normalizedRelativePath}`;
}

function normalizeArchivePath(value) {
  return value
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '')
    .replace(/\/+/g, '/');
}

function printHelp() {
  console.log(`Usage:
  node ./scripts/build-debug-dar.mjs \\
    --input path/to/package.dar \\
    --source-map path/to/source-map.json \\
    [--output path/to/package-debug.dar] \\
    [--source-root /path/to/project] \\
    [--source-root /path/to/project=archive/prefix] \\
    [--source /path/to/File.daml] \\
    [--source /path/to/File.daml=src/File.daml] \\
    [--overwrite]

Notes:
  - The original DAR is unpacked and repacked without modifying its .dalf payloads.
  - The script writes debug/source-map.json into the output DAR.
  - --source-root copies every .daml file under the given directory.
  - Use =archive/prefix to control where copied sources land inside the DAR.
  - If --output is omitted, the script writes <input>-debug.dar beside the input DAR.`);
}

main();
