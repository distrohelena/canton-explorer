import { describe, expect, it } from '@jest/globals';
import { resolve } from 'node:path';
import { resolveDescriptorPath } from '../../src/packages/daml-lf-loader';

describe('resolveDescriptorPath', () => {
  it('falls back to the source packages directory when running from dist/src/packages', () => {
    const baseDir = resolve(process.cwd(), 'dist', 'src', 'packages');

    const path = resolveDescriptorPath('daml-lf-value.descriptor.pb', baseDir);

    expect(path).toBe(resolve(process.cwd(), 'src', 'packages', 'daml-lf-value.descriptor.pb'));
  });
});
