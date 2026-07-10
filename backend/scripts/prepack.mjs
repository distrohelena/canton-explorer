import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(scriptDir, '..');
const repoRoot = resolve(backendRoot, '..');

execSync('npm run build:packaged --workspace frontend', {
  cwd: repoRoot,
  stdio: 'inherit',
});

execSync('npm run build', {
  cwd: backendRoot,
  stdio: 'inherit',
});

execSync('node ./scripts/copy-frontend-dist.mjs', {
  cwd: backendRoot,
  stdio: 'inherit',
});
