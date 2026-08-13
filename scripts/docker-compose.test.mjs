import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('client Compose configuration renders one Explorer service with the required mounts and cache volume', (t) => {
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
  const rendered = JSON.parse(execFileSync('docker', ['compose', '-f', 'compose.yaml', 'config', '--format', 'json'], {
    cwd: clientDirectory,
    encoding: 'utf8',
  }));

  assert.deepEqual(Object.keys(rendered.services), ['canton-explorer']);
  assert.deepEqual(Object.keys(rendered.volumes), ['explorer-data']);
  assert.match(rendered.services['canton-explorer'].image, /^ghcr\.io\/distrohelena\/canton-explorer:/);
  assert.deepEqual(
    rendered.services['canton-explorer'].volumes.map(({ target }) => target).sort(),
    ['/app/config/nodes.local.json', '/app/data', '/app/debug-dars'],
  );
});

test('client environment example provides safe placeholders for the configured node credentials', () => {
  const environmentExample = readFileSync(path.join(projectRoot, 'docker', '.env.example'), 'utf8');

  assert.match(environmentExample, /^PARTICIPANT_1_PQS_URL=postgres:\/\//m);
  assert.match(environmentExample, /^CANTON_STATIC_TOKEN=<.+>$/m);
  assert.doesNotMatch(environmentExample, /^TEST_PQS_URL=/m);
  assert.doesNotMatch(environmentExample, /https:\/\//);
});
