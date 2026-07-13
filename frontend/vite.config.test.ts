import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import config from './vite.config';

const configDirectory = dirname(fileURLToPath(import.meta.url));
const packageMetadata = JSON.parse(
  readFileSync(resolve(configDirectory, '../backend/package.json'), 'utf8'),
) as { version: string };

describe('vite host allowlist', () => {
  it('allows the public canton explorer hostname in dev and preview', () => {
    expect(config.server?.allowedHosts).toContain('canton.sweetsquare.io');
    expect(config.preview?.allowedHosts).toContain('canton.sweetsquare.io');
  });
});

describe('Vite configuration', () => {
  it('injects the backend package version into the frontend build', () => {
    expect(config.define).toMatchObject({
      __CANTON_EXPLORER_VERSION__: JSON.stringify(packageMetadata.version),
    });
  });
});
