import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from '@jest/globals';
import { resolveDescriptorPath } from '../../src/packages/daml-lf-loader';

describe('resolveDescriptorPath', () => {
  const tempFiles: string[] = [];

  afterEach(() => {
    for (const filePath of tempFiles.splice(0, tempFiles.length)) {
      rmSync(filePath, { force: true });
    }
  });

  it('falls back to the source packages directory when dist does not contain the descriptor', () => {
    const tempFilename = `daml-lf-value-${mkdtempSync(join(tmpdir(), 'descriptor-fallback-')).split('/').at(-1)}.descriptor.pb`;
    const sourcePath = resolve(process.cwd(), 'src', 'packages', tempFilename);
    writeFileSync(sourcePath, 'descriptor', 'utf8');
    tempFiles.push(sourcePath);

    const baseDir = resolve(process.cwd(), 'dist', 'src', 'packages', '__missing__');
    const path = resolveDescriptorPath(tempFilename, baseDir);

    expect(path).toBe(sourcePath);
  });
});
