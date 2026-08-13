import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
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
