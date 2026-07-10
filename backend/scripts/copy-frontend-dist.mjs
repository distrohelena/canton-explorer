import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(scriptDir, '..');
const frontendDistDir = resolve(backendRoot, '..', 'frontend', 'dist');
const targetDir = resolve(backendRoot, 'dist', 'public');

if (!existsSync(frontendDistDir)) {
  throw new Error(`Frontend build output not found at ${frontendDistDir}`);
}

rmSync(targetDir, { recursive: true, force: true });
mkdirSync(targetDir, { recursive: true });
cpSync(frontendDistDir, targetDir, { recursive: true });
