import { describe, expect, it } from '@jest/globals';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NodeConfigService } from '../../src/config/node-config.service';

describe('NodeConfigService', () => {
  it('returns custom branding without exposing the rest of the config', () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), 'canton-explorer-'));
    const configPath = join(temporaryDirectory, 'nodes.json');
    const originalConfigPath = process.env.NODE_CONFIG_PATH;

    writeFileSync(
      configPath,
      JSON.stringify({
        branding: {
          applicationTitle: 'Canton Operations',
          headerTitle: 'Operations Console',
        },
        frontend: {
          basePath: '/canton-explorer/',
        },
        nodes: [
          {
            id: 'participant-1',
            label: 'Participant 1',
            role: 'participant',
            mode: 'pqs_only',
            pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
          },
        ],
      }),
      'utf8',
    );

    process.env.NODE_CONFIG_PATH = configPath;

    try {
      const service = new NodeConfigService();
      const branding = service.getBranding();

      expect(branding).toEqual({
        applicationTitle: 'Canton Operations',
        headerTitle: 'Operations Console',
      });
      expect(branding).not.toHaveProperty('nodes');
      expect(branding).not.toHaveProperty('debugger');
      expect(branding).not.toHaveProperty('tokenMetadata');
      expect(service.getFrontendConfig()).toEqual({
        basePath: '/canton-explorer/',
      });
    } finally {
      if (originalConfigPath === undefined) {
        delete process.env.NODE_CONFIG_PATH;
      } else {
        process.env.NODE_CONFIG_PATH = originalConfigPath;
      }
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
