import { describe, expect, it } from 'vitest';
import config from './vite.config';

describe('vite host allowlist', () => {
  it('allows the public canton explorer hostname in dev and preview', () => {
    expect(config.server?.allowedHosts).toContain('canton.sweetsquare.io');
    expect(config.preview?.allowedHosts).toContain('canton.sweetsquare.io');
  });
});
