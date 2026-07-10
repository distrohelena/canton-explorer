import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from '@jest/globals';
import { resolveDescriptorPath } from '../src/packages/daml-lf-loader';

describe('resolveDescriptorPath', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const directory of tempDirs.splice(0, tempDirs.length)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('finds descriptor files copied into dist/src/packages for packaged builds', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'canton-explorer-descriptor-'));
    tempDirs.push(tempDir);

    const baseDir = join(tempDir, 'dist', 'src', 'packages');
    const packagedDir = join(tempDir, 'dist', 'packages');
    const descriptorPath = join(packagedDir, 'example.descriptor.pb');

    mkdirSync(packagedDir, { recursive: true });
    writeFileSync(descriptorPath, 'descriptor', 'utf8');

    expect(resolveDescriptorPath('example.descriptor.pb', baseDir)).toBe(descriptorPath);
  });
});
