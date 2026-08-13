import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('client Compose configuration renders the published image and persistent cache volume', (t) => {
  const clientDirectory = mkdtempSync(path.join(os.tmpdir(), 'canton-explorer-client-'));
  t.after(() => rmSync(clientDirectory, { force: true, recursive: true }));

  cpSync(path.join(projectRoot, 'compose.yaml'), path.join(clientDirectory, 'compose.yaml'));
  cpSync(path.join(projectRoot, 'docker', '.env.example'), path.join(clientDirectory, '.env'));
  mkdirSync(path.join(clientDirectory, 'config'));
  cpSync(
    path.join(projectRoot, 'docker', 'test', 'nodes.local.json'),
    path.join(clientDirectory, 'config', 'nodes.local.json'),
  );
  mkdirSync(path.join(clientDirectory, 'debug-dars'));

  execFileSync('docker', ['compose', '-f', 'compose.yaml', 'config', '--quiet'], {
    cwd: clientDirectory,
    stdio: 'inherit',
  });
  const rendered = execFileSync('docker', ['compose', '-f', 'compose.yaml', 'config'], {
    cwd: clientDirectory,
    encoding: 'utf8',
  });
  assert.match(rendered, /ghcr\.io\/distrohelena\/canton-explorer/);
  assert.match(rendered, /explorer-data/);
});
