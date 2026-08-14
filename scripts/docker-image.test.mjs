import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { promisify } from 'node:util';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const execFile = promisify(execFileCallback);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixturePath = path.join(projectRoot, 'docker', 'test', 'nodes.local.json');
const imageTag = `canton-explorer:test-${process.pid}`;
const containerName = `canton-explorer-test-${process.pid}`;

async function docker(...args) {
  return execFile('docker', args, { cwd: projectRoot, maxBuffer: 10 * 1024 * 1024 });
}

async function waitForBranding(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response.json();
      }
      lastError = new Error(`GET ${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw lastError ?? new Error(`Timed out waiting for ${url}`);
}

test('production image serves mounted branding as the node user', { timeout: 300_000 }, async (t) => {
  t.after(async () => {
    try {
      await docker('rm', '--force', containerName);
    } catch {
      // The container may not have been created when the image build fails.
    }
  });

  await docker('build', '--tag', imageTag, '.');
  await docker(
    'run',
    '--detach',
    '--name',
    containerName,
    '--mount',
    `type=bind,src=${fixturePath},dst=/app/config/nodes.local.json,readonly`,
    '--publish',
    '127.0.0.1::4600',
    imageTag,
  );

  const { stdout: portOutput } = await docker('port', containerName, '4600/tcp');
  const port = portOutput.match(/:(\d+)\s*$/)?.[1];
  assert.ok(port, `Docker did not publish port 4600: ${portOutput}`);

  const branding = await waitForBranding(`http://127.0.0.1:${port}/api/branding`);
  assert.deepEqual(branding, {
    applicationTitle: 'Docker Test Explorer',
    headerTitle: 'Docker Test Explorer',
  });

  const { stdout: uid } = await docker('exec', containerName, 'id', '-u');
  assert.equal(uid.trim(), '1000');
});

test('production image exposes the explicit index command', { timeout: 300_000 }, async () => {
  await docker('build', '--tag', imageTag, '.');

  const inspect = await docker('run', '--rm', imageTag, 'indexes', 'inspect', '--help');

  assert.match(inspect.stdout, /canton-explorer indexes inspect/);
  assert.match(inspect.stdout, /canton-explorer indexes repair/);
});

test('Docker build context excludes local dotenv files but retains the packaged frontend config', { timeout: 300_000 }, async (t) => {
  const contextDirectory = mkdtempSync(path.join(os.tmpdir(), 'canton-explorer-dockerignore-'));
  const dockerfilePath = path.join(contextDirectory, 'Dockerfile');
  const image = `canton-explorer-dockerignore:test-${process.pid}`;

  t.after(async () => {
    try {
      await docker('image', 'rm', '--force', image);
    } catch {
      // The image may not have been created when the build-context assertion fails.
    }
    rmSync(contextDirectory, { force: true, recursive: true });
  });

  cpSync(path.join(projectRoot, '.dockerignore'), path.join(contextDirectory, '.dockerignore'));
  mkdirSync(path.join(contextDirectory, 'backend'));
  mkdirSync(path.join(contextDirectory, 'frontend'));
  mkdirSync(path.join(contextDirectory, 'workspace', 'nested'), { recursive: true });
  writeFileSync(path.join(contextDirectory, '.env'), 'ROOT_SECRET=must-not-be-copied\n');
  writeFileSync(path.join(contextDirectory, 'backend', '.env'), 'BACKEND_SECRET=must-not-be-copied\n');
  writeFileSync(
    path.join(contextDirectory, 'frontend', '.env.packaged.local'),
    'VITE_API_BASE_URL=https://must-not-be-copied.invalid\n',
  );
  writeFileSync(path.join(contextDirectory, 'frontend', '.env.packaged'), 'VITE_API_BASE_URL=/api\n');
  writeFileSync(path.join(contextDirectory, 'workspace', 'nested', '.env.local'), 'NESTED_SECRET=must-not-be-copied\n');
  writeFileSync(
    dockerfilePath,
    `FROM node:22-bookworm-slim
WORKDIR /app
COPY . .
RUN test ! -e .env \\
  && test ! -e backend/.env \\
  && test ! -e frontend/.env.packaged.local \\
  && test ! -e workspace/nested/.env.local \\
  && test -f frontend/.env.packaged
`,
  );

  await docker('build', '--file', dockerfilePath, '--tag', image, contextDirectory);
});
