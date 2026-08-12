import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const monacoDompurifyPath = resolve(
  repositoryRoot,
  'node_modules/monaco-editor/esm/vs/base/browser/dompurify/dompurify.js',
);
const dompurifyPackagePath = resolve(repositoryRoot, 'node_modules/dompurify/package.json');
const dompurifyModulePath = resolve(repositoryRoot, 'node_modules/dompurify/dist/purify.es.mjs');

// Monaco ships its own DOMPurify module, so npm overrides alone do not update
// the sanitizer used by Monaco's markdown hover renderer.
for (const path of [monacoDompurifyPath, dompurifyPackagePath, dompurifyModulePath]) {
  if (!existsSync(path)) {
    throw new Error(`Expected Monaco DOMPurify asset is missing: ${path}`);
  }
}

const installedVersion = JSON.parse(readFileSync(dompurifyPackagePath, 'utf8')).version;
if (installedVersion !== '3.4.13') {
  throw new Error(`Expected DOMPurify 3.4.13, found ${installedVersion}`);
}

const bundledModule = readFileSync(monacoDompurifyPath, 'utf8');
const fixedModule = readFileSync(dompurifyModulePath, 'utf8');
if (bundledModule !== fixedModule) {
  writeFileSync(monacoDompurifyPath, fixedModule);
}
