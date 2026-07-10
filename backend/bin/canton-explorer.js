#!/usr/bin/env node

const { existsSync } = require('node:fs');
const { resolve } = require('node:path');

function printHelp() {
  process.stdout.write(`Canton Explorer\n\n`);
  process.stdout.write(`Usage: canton-explorer [--config <path>] [--port <number>] [--host <host>]\n\n`);
  process.stdout.write(`Options:\n`);
  process.stdout.write(`  --config <path>  Path to the node config JSON file\n`);
  process.stdout.write(`  --port <number>  HTTP port to bind (default: 4600)\n`);
  process.stdout.write(`  --host <host>    HTTP host to bind (default: 0.0.0.0)\n`);
  process.stdout.write(`  --help           Show this message\n`);
}

function readFlagValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }

  return value;
}

async function main() {
  const args = process.argv.slice(2);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--help') {
      printHelp();
      return;
    }

    if (arg === '--config') {
      process.env.NODE_CONFIG_PATH = resolve(process.cwd(), readFlagValue(args, index, arg));
      index += 1;
      continue;
    }

    if (arg === '--port') {
      process.env.PORT = readFlagValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--host') {
      process.env.HOST = readFlagValue(args, index, arg);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  const entrypoint = resolve(__dirname, '..', 'dist', 'src', 'main.js');
  if (!existsSync(entrypoint)) {
    throw new Error('Built backend entrypoint not found. Reinstall or rebuild the package.');
  }

  await import(entrypoint);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
