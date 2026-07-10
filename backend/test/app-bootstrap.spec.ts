import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, jest } from '@jest/globals';
import {
  DEFAULT_HOST,
  DEFAULT_PORT,
  configureFrontendAssets,
  resolveHost,
  resolvePort,
  startApp,
} from '../src/app-bootstrap';

describe('startApp', () => {
  it('binds the Nest app to 0.0.0.0', async () => {
    process.env.PORT = '4600';
    process.env.HOST = '';

    const enableCors = jest.fn();
    const listen = jest.fn().mockResolvedValue(undefined);
    const createApp = jest.fn().mockResolvedValue({
      enableCors,
      listen,
    });

    await startApp(createApp);

    expect(createApp).toHaveBeenCalledTimes(1);
    expect(enableCors).toHaveBeenCalledTimes(1);
    expect(listen).toHaveBeenCalledWith(DEFAULT_PORT, DEFAULT_HOST);
  });

  it('resolves host and port from the environment with defaults', () => {
    expect(resolveHost('127.0.0.1')).toBe('127.0.0.1');
    expect(resolveHost('')).toBe(DEFAULT_HOST);
    expect(resolvePort('4700')).toBe(4700);
    expect(resolvePort('invalid')).toBe(DEFAULT_PORT);
  });

  it('serves built frontend assets when index.html is present', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'canton-explorer-static-'));
    writeFileSync(join(tempDir, 'index.html'), '<html></html>', 'utf8');

    const useStaticAssets = jest.fn();
    const registerGet = jest.fn();

    configureFrontendAssets(
      {
        enableCors: jest.fn(),
        listen: jest.fn().mockResolvedValue(undefined),
        useStaticAssets,
        getHttpAdapter: () => ({
          getInstance: () => ({
            get: registerGet,
          }),
        }),
      },
      tempDir,
    );

    expect(useStaticAssets).toHaveBeenCalledWith(tempDir);
    expect(registerGet).toHaveBeenCalledTimes(1);

    rmSync(tempDir, { recursive: true, force: true });
  });
});
