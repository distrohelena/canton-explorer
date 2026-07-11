import { existsSync, lstatSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');

const localSdkPath = process.env.CANTON_TYPESCRIPT_SDK_PATH ?? '/home/helena/env/daml/typescript-sdk';
const localSdkPackageJson = path.join(localSdkPath, 'package.json');
const scopedDirectory = path.join(backendRoot, 'node_modules', '@distrohelena');
const linkPath = path.join(scopedDirectory, 'canton-typescript-sdk');

if (!existsSync(localSdkPackageJson)) {
  console.log(`Local SDK not linked. Set CANTON_TYPESCRIPT_SDK_PATH or create ${localSdkPackageJson}.`);
  process.exit(0);
}

mkdirSync(scopedDirectory, { recursive: true });

if (existsSync(linkPath) || isBrokenSymlink(linkPath)) {
  rmSync(linkPath, { recursive: true, force: true });
}

symlinkSync(localSdkPath, linkPath, 'dir');
console.log(`Linked @distrohelena/canton-typescript-sdk -> ${localSdkPath}`);

function isBrokenSymlink(candidatePath) {
  try {
    return lstatSync(candidatePath).isSymbolicLink();
  } catch {
    return false;
  }
}
