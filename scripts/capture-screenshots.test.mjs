import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { ScreenshotConfigError } from './screenshot-config.mjs';
import { checkServiceReachability, main } from './capture-screenshots.mjs';

function stream() {
  const chunks = [];
  return {
    write(chunk) {
      chunks.push(String(chunk));
    },
    text() {
      return chunks.join('');
    },
  };
}

function configModule() {
  return `export default ${JSON.stringify({
    baseUrl: 'http://config-frontend.test',
    apiUrl: 'http://config-api.test/api',
    output: 'config-output',
    strict: false,
    headed: false,
    settleMs: 1,
    responseDrainTimeoutMs: 1,
    discovery: { maxNodes: 1, maxNodesPerType: 1, maxPackages: 1 },
    viewports: [{ name: 'configured', width: 800, height: 600 }],
    routes: [
      { name: 'updates', path: '/', states: [{ name: 'default', actions: [] }] },
      { name: 'tokens', path: '/tokens', states: [{ name: 'default', actions: [] }] },
    ],
  })};\n`;
}

test('executable --help prints usage and exits without service or browser work', () => {
  const entrypoint = fileURLToPath(new URL('./capture-screenshots.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [entrypoint, '--help'], { encoding: 'utf8' });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage: npm run screenshots/);
  assert.equal(result.stderr, '');
});

test('checks the configured frontend and normalized API before capture work', async () => {
  const calls = [];
  await checkServiceReachability({
    baseUrl: 'http://frontend.test',
    apiUrl: 'http://api.test/api/',
  }, {
    fetchImpl: async (url, init) => {
      calls.push({ url, method: init.method });
      return { ok: true, status: 200 };
    },
  });

  assert.deepEqual(calls, [
    { url: 'http://frontend.test', method: 'GET' },
    { url: 'http://api.test/api/nodes?limit=1', method: 'GET' },
  ]);
});

test('includes approved startup guidance in service connectivity failures', async () => {
  await assert.rejects(
    checkServiceReachability({
      baseUrl: 'http://frontend.test',
      apiUrl: 'http://api.test/api',
    }, {
      fetchImpl: async () => ({ ok: false, status: 503 }),
    }),
    (error) => {
      assert.match(error.message, /npm run dev:frontend/);
      assert.match(error.message, /npm run dev:backend/);
      assert.match(error.message, /Canton localnet/);
      return true;
    },
  );
});

test('loads cwd-relative ESM config, applies CLI filters, and prints a concise success summary', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'capture-screenshots-cli-'));
  const stdout = stream();
  const stderr = stream();
  let checkedConfig;
  let capturedOptions;
  try {
    await writeFile(path.join(cwd, 'fixture-config.mjs'), configModule());
    const exitCode = await main([
      '--config', 'fixture-config.mjs',
      '--route', 'updates',
      '--viewport', '1280x720',
      '--output', 'captures',
      '--base-url', 'http://cli-frontend.test',
      '--api-url', 'http://cli-api.test/api',
      '--strict',
    ], {
      cwd,
      stdout,
      stderr,
      checkServices: async (config) => {
        checkedConfig = config;
      },
      captureScreenshotMatrix: async (options) => {
        capturedOptions = options;
        return {
          status: 'passed',
          exitCode: 0,
          entries: [{ status: 'captured' }, { status: 'skipped' }],
        };
      },
    });

    assert.equal(exitCode, 0);
    assert.deepEqual(checkedConfig.routes.map((route) => route.name), ['updates']);
    assert.deepEqual(checkedConfig.viewports, [{ name: 'custom-1280x720', width: 1280, height: 720 }]);
    assert.equal(checkedConfig.output, 'captures');
    assert.equal(checkedConfig.baseUrl, 'http://cli-frontend.test');
    assert.equal(checkedConfig.apiUrl, 'http://cli-api.test/api');
    assert.equal(checkedConfig.strict, true);
    assert.equal(capturedOptions.config, checkedConfig);
    assert.match(stdout.text(), /1 captured, 1 skipped, 0 failed/);
    assert.match(stdout.text(), new RegExp(`${path.join(cwd, 'captures', 'report.json')}`));
    assert.equal(stderr.text(), '');
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('returns 2 for malformed service URLs before checking services', async () => {
  for (const flag of ['--base-url', '--api-url']) {
    const stdout = stream();
    const stderr = stream();
    let serviceChecked = false;

    const exitCode = await main([flag, 'not-a-url'], {
      stdout,
      stderr,
      checkServices: async () => {
        serviceChecked = true;
      },
      captureScreenshotMatrix: async () => ({ exitCode: 0, entries: [] }),
    });

    assert.equal(exitCode, 2, flag);
    const label = flag === '--base-url' ? 'baseUrl' : 'apiUrl';
    assert.match(stderr.text(), new RegExp(`Error: ${label} must be a valid http\\(s\\) URL`));
    assert.equal(stdout.text(), '');
    assert.equal(serviceChecked, false);
  }
});

test('public main path persists manifest, report, and screenshot with an in-process fixture', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'capture-screenshots-cli-fixture-'));
  const stdout = stream();
  const stderr = stream();
  try {
    await writeFile(path.join(cwd, 'fixture-config.mjs'), configModule());

    let currentUrl = 'about:blank';
    const locator = () => ({
      count: async () => 0,
      isVisible: async () => false,
      nth: () => ({ isVisible: async () => false }),
      waitFor: async () => {},
    });
    const page = {
      on: () => {},
      route: async () => {},
      goto: async (url) => {
        currentUrl = url;
      },
      url: () => currentUrl,
      evaluate: async () => false,
      locator,
      getByRole: locator,
      screenshot: async ({ path: screenshotPath }) => {
        await mkdir(path.dirname(screenshotPath), { recursive: true });
        await writeFile(screenshotPath, 'fixture screenshot');
      },
    };
    const context = {
      newPage: async () => page,
      close: async () => {},
    };
    const browser = {
      newContext: async () => context,
      close: async () => {},
    };

    const exitCode = await main([
      '--config', 'fixture-config.mjs',
      '--route', 'updates',
      '--output', path.join(cwd, 'captures'),
    ], {
      cwd,
      stdout,
      stderr,
      checkServices: async () => {},
      manifest: {
        generatedAt: 'fixture-time',
        context: {},
        routes: [{ name: 'updates', url: '/', required: true, source: 'fixture' }],
      },
      browserFactory: async () => browser,
    });

    const output = path.join(cwd, 'captures');
    const manifest = JSON.parse(await readFile(path.join(output, 'manifest.json'), 'utf8'));
    const report = JSON.parse(await readFile(path.join(output, 'report.json'), 'utf8'));
    assert.equal(exitCode, 0, `${stdout.text()}${stderr.text()}${JSON.stringify(report)}`);
    assert.match(stdout.text(), /1 captured, 0 skipped, 0 failed/);
    assert.equal(stderr.text(), '');
    assert.equal(manifest.routes[0].source, 'fixture');
    assert.equal(report.status, 'passed');
    assert.equal(report.entries[0].status, 'captured');
    assert.equal(await readFile(path.join(output, 'configured', 'updates.png'), 'utf8'), 'fixture screenshot');
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('returns 2 for invalid CLI/config input before service or browser work', async () => {
  const stdout = stream();
  const stderr = stream();
  let serviceChecked = false;
  let matrixRun = false;

  const exitCode = await main(['--unknown'], {
    stdout,
    stderr,
    checkServices: async () => {
      serviceChecked = true;
    },
    captureScreenshotMatrix: async () => {
      matrixRun = true;
      return { exitCode: 0, entries: [] };
    },
  });

  assert.equal(exitCode, 2);
  assert.match(stderr.text(), /^Error: Unknown CLI option --unknown\n$/);
  assert.doesNotMatch(stderr.text(), /capture-screenshots\.mjs:/);
  assert.equal(stdout.text(), '');
  assert.equal(serviceChecked, false);
  assert.equal(matrixRun, false);

  const configError = await main([], {
    stdout: stream(),
    stderr,
    loadScreenshotConfig: async () => {
      throw new ScreenshotConfigError('invalid fixture config');
    },
    checkServices: async () => {
      throw new Error('must not check services');
    },
  });

  assert.equal(configError, 2);
  assert.match(stderr.text(), /Error: invalid fixture config/);
});

test('maps service and capture failures to documented exit codes without stack noise', async () => {
  const serviceStderr = stream();
  let matrixRun = false;
  const serviceExitCode = await main([], {
    stdout: stream(),
    stderr: serviceStderr,
    checkServices: async () => {
      throw new Error('frontend is unreachable');
    },
    captureScreenshotMatrix: async () => {
      matrixRun = true;
      return { exitCode: 0, entries: [] };
    },
  });

  assert.equal(serviceExitCode, 1);
  assert.match(serviceStderr.text(), /^Error: frontend is unreachable\n$/);
  assert.equal(matrixRun, false);

  const captureStdout = stream();
  const captureStderr = stream();
  const captureExitCode = await main([], {
    stdout: captureStdout,
    stderr: captureStderr,
    checkServices: async () => {},
    captureScreenshotMatrix: async () => ({
      status: 'failed',
      exitCode: 2,
      error: 'Chromium executable does not exist; run npx playwright install chromium',
      entries: [],
    }),
  });

  assert.equal(captureExitCode, 2);
  assert.match(captureStdout.text(), /0 captured, 0 skipped, 0 failed/);
  assert.match(captureStdout.text(), /Chromium executable does not exist/);
  assert.equal(captureStderr.text(), '');
});
