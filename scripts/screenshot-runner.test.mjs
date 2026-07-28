import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, readdir, stat } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { chromium } from 'playwright';

import {
  captureScreenshotMatrix,
  normalizeApiBaseUrl,
  resolveExitCode,
  rewriteApiRequestUrl,
  waitForLoadingToDisappear,
} from './screenshot-runner.mjs';

async function startServer(handler) {
  const server = http.createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  return {
    server,
    url: `http://127.0.0.1:${port}`,
    async close() {
      server.close();
      await once(server, 'close');
    },
  };
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', ...headers });
  res.end(body);
}

function json(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(value));
}

async function bodyOf(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString();
}

function configFor(baseUrl, output, overrides = {}) {
  return {
    baseUrl,
    apiUrl: overrides.apiUrl,
    output,
    strict: overrides.strict ?? false,
    settleMs: overrides.settleMs ?? 1,
    viewports: overrides.viewports ?? [{ name: 'desktop', width: 640, height: 480, deviceScaleFactor: 1 }],
    routes: overrides.routes ?? [{
      name: 'fixture',
      path: '/fixture',
      required: true,
      readiness: { heading: 'Fixture Ready', timeoutMs: 500, settleMs: 1 },
      states: [{ name: 'default', actions: [] }],
    }],
  };
}

function manifestFor(config, routes = config.routes) {
  return {
    generatedAt: '2026-07-28T00:00:00.000Z',
    apiUrl: config.apiUrl,
    context: { updateId: 'update-1', nodeId: 'node-1' },
    routes: routes.map((route) => ({
      name: route.name,
      url: route.path ?? route.url ?? null,
      required: route.required ?? true,
      source: 'fixture',
      expectedPath: route.expectedPath ?? route.path ?? route.url,
      readiness: route.readiness,
      validation: route.validation,
    })),
    skips: [],
  };
}

async function makeOutput() {
  return mkdtemp(path.join(os.tmpdir(), 'screenshot-runner-test-'));
}

test('normalizes API targets and rewrites exact and prefixed API paths', () => {
  assert.equal(normalizeApiBaseUrl('http://127.0.0.1:1234'), 'http://127.0.0.1:1234/api');
  assert.equal(normalizeApiBaseUrl('http://127.0.0.1:1234/api'), 'http://127.0.0.1:1234/api');
  assert.equal(normalizeApiBaseUrl('http://127.0.0.1:1234/api/'), 'http://127.0.0.1:1234/api');
  assert.equal(normalizeApiBaseUrl('http://127.0.0.1:1234/api/api/'), 'http://127.0.0.1:1234/api');

  const target = 'http://127.0.0.1:1234/api/';
  assert.equal(rewriteApiRequestUrl('http://frontend.test/api', target), 'http://127.0.0.1:1234/api');
  assert.equal(
    rewriteApiRequestUrl('http://frontend.test/api/items?one=1&two=2', target),
    'http://127.0.0.1:1234/api/items?one=1&two=2',
  );
  assert.equal(
    rewriteApiRequestUrl('http://frontend.test/api/api/items?one=1', 'http://127.0.0.1:1234/api/api/'),
    'http://127.0.0.1:1234/api/items?one=1',
  );
  assert.equal(rewriteApiRequestUrl('http://frontend.test/assets/app.js', target), null);
});

test('captures with real Playwright, preserves API request details, waits for readiness, and retries once', async (t) => {
  const output = await makeOutput();
  const apiRequests = [];
  let fixtureRequests = 0;
  const api = await startServer(async (req, res) => {
    const requestBody = await bodyOf(req);
    apiRequests.push({
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: requestBody,
    });
    json(res, 200, { ok: true });
  });
  const frontend = await startServer((req, res) => {
    if (req.url?.startsWith('/fixture')) {
      fixtureRequests += 1;
      const ready = fixtureRequests > 1;
      const script = ready
        ? `<script>
             fetch('/api/relative?query=1');
             fetch(location.origin + '/api/absolute?query=2', {
               method: 'POST', headers: {'x-fixture': 'yes', 'content-type': 'text/plain'}, body: 'request-body'
             });
             fetch('/api');
             setTimeout(() => document.querySelector('#loading').remove(), 20);
           </script>`
        : '';
      send(res, 200, `<!doctype html><html><body><main><h1>${ready ? 'Fixture Ready' : 'Retrying'}</h1><div id="loading">${ready ? 'Loading data' : ''}</div></main>${script}</body></html>`);
      return;
    }
    send(res, 404, 'not found');
  });
  t.after(async () => {
    await frontend.close();
    await api.close();
  });

  const config = configFor(frontend.url, output, { apiUrl: `${api.url}/api/` });
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const report = await captureScreenshotMatrix({
    config,
    manifest: manifestFor(config),
    browser,
  });

  assert.equal(report.exitCode, 0);
  assert.equal(report.entries[0].status, 'captured');
  assert.ok(fixtureRequests >= 2, 'the readiness failure should have triggered one retry');
  assert.equal(apiRequests.some((request) => request.url === '/api/relative?query=1'), true);
  assert.equal(apiRequests.some((request) => request.url === '/api'), true);
  const post = apiRequests.find((request) => request.method === 'POST');
  assert.equal(post.url, '/api/absolute?query=2');
  assert.equal(post.body, 'request-body');
  assert.equal(post.headers['x-fixture'], 'yes');
  assert.equal(report.entries[0].output, 'desktop/fixture.png');
  await stat(path.join(output, report.entries[0].output));
});

test('accepts either a search result group or the explicit SearchResultsView empty state', async (t) => {
  const output = await makeOutput();
  const frontend = await startServer((req, res) => {
    send(res, 200, '<!doctype html><html><body><section class="search-results-view"><h2>Search Results</h2><div class="search-results-view__empty">No matches found.</div></section></body></html>');
  });
  t.after(() => frontend.close());
  const config = configFor(frontend.url, output, {
    apiUrl: `${frontend.url}/api`,
    routes: [{
      name: 'search-results',
      path: '/search?q=party',
      readiness: { heading: 'Search Results', timeoutMs: 100 },
      validation: { heading: 'Search Results', states: ['.search-results-group', '.search-results-view__empty'] },
      states: [{ name: 'default', actions: [] }],
    }],
  });
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const report = await captureScreenshotMatrix({ config, manifest: manifestFor(config), browser });

  assert.equal(report.entries[0].status, 'captured');
});

test('treats current route-specific error classes as capture failures', async (t) => {
  const output = await makeOutput();
  const frontend = await startServer((req, res) => {
    send(res, 200, `<!doctype html><html><body><main><h1>Fixture Ready</h1>
      <p class="debugger-view__session-state--error">session error</p>
      <p class="debugger-template-picker__state--error">template error</p>
      <p class="monaco-surface__state--error">source error</p>
      <p class="party-topology__state--error">topology error</p>
    </main></body></html>`);
  });
  t.after(() => frontend.close());
  const config = configFor(frontend.url, output, { apiUrl: `${frontend.url}/api` });
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const report = await captureScreenshotMatrix({ config, manifest: manifestFor(config), browser });

  assert.equal(report.entries[0].status, 'failed');
  assert.match(report.entries[0].error, /error state/);
});

test('records debugger validation failures as optional skips with their validation reason', async (t) => {
  const output = await makeOutput();
  const frontend = await startServer((req, res) => {
    send(res, 200, '<!doctype html><html><body><section><h2>Debugger</h2><p class="debugger-view__session-state--error">Replay failed</p></section></body></html>');
  });
  t.after(() => frontend.close());
  const config = configFor(frontend.url, output, {
    apiUrl: `${frontend.url}/api`,
    routes: [{
      name: 'debugger', path: '/debugger?updateId=update-1', required: false,
      readiness: { heading: 'Debugger', timeoutMs: 100, settleMs: 0 },
      validation: { sessionRequired: true },
      states: [{ name: 'default', actions: [] }],
    }],
  });
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const report = await captureScreenshotMatrix({ config, manifest: manifestFor(config), browser });

  assert.equal(report.entries[0].status, 'skipped');
  assert.match(report.entries[0].reason, /error state/);
});

test('records a missing optional debugger session as a validation skip', async (t) => {
  const output = await makeOutput();
  const frontend = await startServer((req, res) => {
    send(res, 200, '<!doctype html><html><body><section><h2>Debugger</h2><p>Debugger catalog</p></section></body></html>');
  });
  t.after(() => frontend.close());
  const config = configFor(frontend.url, output, {
    apiUrl: `${frontend.url}/api`,
    routes: [{
      name: 'debugger', path: '/debugger?updateId=update-1', required: false,
      readiness: { heading: 'Debugger', timeoutMs: 100, settleMs: 0 },
      validation: { sessionRequired: true },
      states: [{ name: 'default', actions: [] }],
    }],
  });
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const report = await captureScreenshotMatrix({ config, manifest: manifestFor(config), browser });

  assert.equal(report.entries[0].status, 'skipped');
  assert.match(report.entries[0].reason, /did not create a debugger session/);
});

test('keeps an optional debugger final-path mismatch as a failed validation', async (t) => {
  const output = await makeOutput();
  const frontend = await startServer((req, res) => {
    send(res, 200, '<!doctype html><html><body><section><h2>Debugger</h2></section></body></html>');
  });
  t.after(() => frontend.close());
  const config = configFor(frontend.url, output, {
    apiUrl: `${frontend.url}/api`,
    routes: [{
      name: 'debugger', path: '/debugger?updateId=update-1', required: false,
      readiness: { heading: 'Debugger', timeoutMs: 100, settleMs: 0 },
      states: [{ name: 'default', actions: [] }],
    }],
  });
  const manifest = manifestFor(config);
  manifest.routes[0].expectedPath = '/debugger?updateId=other';
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const report = await captureScreenshotMatrix({ config, manifest, browser });

  assert.equal(report.entries[0].status, 'failed');
  assert.equal(report.entries[0].required, false);
  assert.match(report.entries[0].error, /Expected final path/);
});

test('preserves configured readiness when discovery supplies only dynamic readiness metadata', async (t) => {
  const output = await makeOutput();
  const frontend = await startServer((req, res) => {
    send(res, 200, '<!doctype html><html><body><h1>Configured Ready</h1></body></html>');
  });
  t.after(() => frontend.close());
  const config = configFor(frontend.url, output, {
    apiUrl: `${frontend.url}/api`,
    routes: [{
      name: 'fixture',
      path: '/fixture',
      readiness: { heading: 'Configured Ready', timeoutMs: 80, settleMs: 0 },
      states: [{ name: 'default', actions: [] }],
    }],
  });
  const manifest = manifestFor(config);
  manifest.routes[0].readiness = { landmark: 'main' };
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const report = await captureScreenshotMatrix({ config, manifest, browser });

  assert.equal(report.entries[0].status, 'captured');
});

test('waits for loading indicators that mount after the first readiness scan', async (t) => {
  const frontend = await startServer((req, res) => {
    send(res, 200, `<!doctype html><html><body><h1>Fixture Ready</h1><script>
      setTimeout(() => document.body.insertAdjacentHTML('beforeend', '<div id="late-loading">Loading late data</div>'), 10);
      setTimeout(() => document.querySelector('#late-loading')?.remove(), 100);
    </script></body></html>`);
  });
  t.after(() => frontend.close());
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext();
  const page = await context.newPage();
  t.after(() => context.close());
  await page.goto(`${frontend.url}/fixture`, { waitUntil: 'domcontentloaded' });

  const started = Date.now();
  await waitForLoadingToDisappear(page, 500);
  assert.ok(Date.now() - started >= 70);
});

test('does not retry an action failure after readiness succeeds', async (t) => {
  const output = await makeOutput();
  let navigations = 0;
  const frontend = await startServer((req, res) => {
    if (req.url?.startsWith('/fixture')) navigations += 1;
    send(res, 200, '<!doctype html><html><body><main><h1>Fixture Ready</h1></main></body></html>');
  });
  t.after(() => frontend.close());
  const config = configFor(frontend.url, output, {
    apiUrl: `${frontend.url}/api`,
    routes: [{
      name: 'fixture', path: '/fixture', required: false,
      readiness: { heading: 'Fixture Ready', timeoutMs: 100, settleMs: 0 },
      states: [{ name: 'optional-action', actions: [{ kind: 'click', role: 'button', name: 'Missing' }] }],
    }],
  });
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const report = await captureScreenshotMatrix({ config, manifest: manifestFor(config), browser });

  assert.equal(report.entries[0].status, 'skipped');
  assert.equal(navigations, 1);
});

test('does not retry a screenshot failure and stops the matrix', async (t) => {
  const output = await makeOutput();
  const frontend = await startServer((req, res) => {
    send(res, 200, '<!doctype html><html><body><main><h1>Fixture Ready</h1></main></body></html>');
  });
  t.after(() => frontend.close());
  const config = configFor(frontend.url, output, {
    apiUrl: `${frontend.url}/api`,
    routes: [
      {
        name: 'first', path: '/first', required: false,
        readiness: { heading: 'Fixture Ready', timeoutMs: 100, settleMs: 0 },
        states: [{ name: 'default', actions: [] }],
      },
      {
        name: 'second', path: '/second', required: true,
        readiness: { heading: 'Fixture Ready', timeoutMs: 100, settleMs: 0 },
        states: [{ name: 'default', actions: [] }],
      },
    ],
  });
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  let screenshotCalls = 0;
  const report = await captureScreenshotMatrix({
    config,
    manifest: manifestFor(config),
    browser,
    pageFactory: async (context) => {
      const page = await context.newPage();
      page.screenshot = async () => {
        screenshotCalls += 1;
        throw new Error('screenshot write failed');
      };
      return page;
    },
  });

  assert.equal(screenshotCalls, 1);
  assert.equal(report.entries.length, 1);
  assert.equal(report.entries[0].status, 'failed');
});

test('uses a fresh browser context for every route/state/viewport and keeps state failures isolated', async (t) => {
  const output = await makeOutput();
  const contextObservations = [];
  const frontend = await startServer((req, res) => {
    if (req.url?.startsWith('/fixture')) {
      send(res, 200, `<!doctype html><html><body><main><h1>Fixture Ready</h1>
        <button id="works" type="button" onclick="document.body.dataset.clicked='yes'">Works</button>
        <script>
          const seen = localStorage.getItem('seen') || 'empty';
          fetch('/api/observed?seen=' + seen);
          localStorage.setItem('seen', 'set');
        </script></main></body></html>`);
      return;
    }
    send(res, 404, 'not found');
  });
  const apiObservations = await startServer(async (req, res) => {
    if (req.url?.startsWith('/api/observed')) contextObservations.push(new URL(req.url, 'http://fixture').searchParams.get('seen'));
    json(res, 200, { ok: true });
  });
  t.after(async () => {
    await frontend.close();
    await apiObservations.close();
  });

  const config = configFor(frontend.url, output, {
    apiUrl: apiObservations.url,
    routes: [{
      name: 'fixture', path: '/fixture', readiness: { heading: 'Fixture Ready', timeoutMs: 500, settleMs: 1 },
      states: [
        { name: 'default', actions: [] },
        { name: 'optional', required: false, actions: [{ kind: 'click', role: 'button', name: 'Missing' }] },
      ],
    }],
    viewports: [
      { name: 'small', width: 320, height: 240 },
      { name: 'large', width: 640, height: 480 },
    ],
  });
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const report = await captureScreenshotMatrix({
    config,
    manifest: manifestFor(config),
    browser,
    onContextCreated: (context) => contextObservations.push(`context:${context._guid ?? 'created'}`),
  });

  assert.equal(report.entries.filter((entry) => entry.status === 'captured').length, 2);
  assert.equal(report.entries.filter((entry) => entry.status === 'skipped').length, 2);
  assert.deepEqual(contextObservations.filter((value) => value === 'empty'), ['empty', 'empty', 'empty', 'empty']);
  assert.equal(new Set(report.entries.filter((entry) => entry.status === 'captured').map((entry) => entry.output)).size, report.entries.filter((entry) => entry.status === 'captured').length);
});

test('deletes every debugger session after navigation/readiness failure', async (t) => {
  const output = await makeOutput();
  const sessionIds = [];
  const deletedIds = [];
  const debuggerRequests = [];
  const api = await startServer(async (req, res) => {
    const body = await bodyOf(req);
    debuggerRequests.push({ method: req.method, url: req.url, body, headers: req.headers });
    if (req.method === 'POST' && req.url === '/api/debugger/sessions') {
      const id = `session-${sessionIds.length + 1}`;
      sessionIds.push(id);
      json(res, 201, { sessionId: id });
      return;
    }
    if (req.method === 'DELETE' && req.url?.startsWith('/api/debugger/sessions/')) {
      deletedIds.push(req.url.split('/').pop());
      res.writeHead(204);
      res.end();
      return;
    }
    json(res, 200, { ok: true });
  });
  const frontend = await startServer((req, res) => {
    if (req.url?.startsWith('/debugger')) {
      send(res, 200, `<!doctype html><html><body><div id="loading">Loading debugger</div><script>
        fetch('/api/debugger/sessions', {method:'POST', headers:{'x-debug':'yes','content-type':'application/json'}, body:'{"one":1}'});
        fetch('/api/debugger/sessions', {method:'POST', headers:{'x-debug':'yes','content-type':'application/json'}, body:'{"two":2}'});
      </script></body></html>`);
      return;
    }
    send(res, 404, 'not found');
  });
  t.after(async () => {
    await frontend.close();
    await api.close();
  });

  const config = configFor(frontend.url, output, {
    apiUrl: `${api.url}/api/`,
    routes: [{
      name: 'debugger', path: '/debugger?updateId=update-1', required: false,
      readiness: { heading: 'Debugger', timeoutMs: 120, settleMs: 1 },
      states: [{ name: 'default', actions: [] }],
    }],
  });
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const report = await captureScreenshotMatrix({ config, manifest: manifestFor(config), browser });

  assert.equal(report.entries[0].status, 'failed');
  assert.deepEqual(deletedIds.sort(), sessionIds.sort());
  assert.ok(sessionIds.length >= 2);
  assert.ok(debuggerRequests.filter((request) => request.method === 'DELETE').every((request) => request.url.startsWith('/api/debugger/sessions/')));
  assert.ok(debuggerRequests.filter((request) => request.method === 'POST').every((request) => request.headers['x-debug'] === 'yes'));
  assert.equal(report.cleanup.length, sessionIds.length);
});

test('waits for a late debugger POST response before deleting sessions', async (t) => {
  const output = await makeOutput();
  const sessionIds = [];
  const deletedIds = [];
  const api = await startServer(async (req, res) => {
    await bodyOf(req);
    if (req.method === 'POST' && req.url === '/api/debugger/sessions') {
      const id = `late-session-${sessionIds.length + 1}`;
      sessionIds.push(id);
      setTimeout(() => json(res, 201, { sessionId: id }), 600);
      return;
    }
    if (req.method === 'DELETE' && req.url?.startsWith('/api/debugger/sessions/')) {
      deletedIds.push(req.url.split('/').pop());
      res.writeHead(204);
      res.end();
      return;
    }
    json(res, 200, { ok: true });
  });
  const frontend = await startServer((req, res) => {
    if (req.url?.startsWith('/debugger')) {
      send(res, 200, `<!doctype html><html><body><div id="loading">Loading debugger</div><script>
        fetch('/api/debugger/sessions', {method:'POST', body:'{"late":true}'});
      </script></body></html>`);
      return;
    }
    send(res, 404, 'not found');
  });
  t.after(async () => {
    await frontend.close();
    await api.close();
  });
  const config = configFor(frontend.url, output, {
    apiUrl: api.url,
    routes: [{
      name: 'debugger', path: '/debugger?updateId=update-1', required: false,
      readiness: { heading: 'Debugger', timeoutMs: 700, settleMs: 0 },
      states: [{ name: 'default', actions: [] }],
    }],
  });
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const report = await captureScreenshotMatrix({ config, manifest: manifestFor(config), browser });

  assert.equal(report.entries[0].status, 'failed');
  assert.ok(sessionIds.length >= 2);
  assert.deepEqual(deletedIds.sort(), sessionIds.sort());
});

test('drains a debugger POST response slower than the default review threshold', async (t) => {
  const output = await makeOutput();
  const sessionIds = [];
  const deletedIds = [];
  const api = await startServer(async (req, res) => {
    await bodyOf(req);
    if (req.method === 'POST' && req.url === '/api/debugger/sessions') {
      const id = 'slow-session-1';
      sessionIds.push(id);
      setTimeout(() => json(res, 201, { sessionId: id }), 1_500);
      return;
    }
    if (req.method === 'DELETE' && req.url?.startsWith('/api/debugger/sessions/')) {
      deletedIds.push(req.url.split('/').pop());
      res.writeHead(204);
      res.end();
      return;
    }
    json(res, 200, { ok: true });
  });
  let pageLoads = 0;
  const frontend = await startServer((req, res) => {
    if (req.url?.startsWith('/debugger')) {
      pageLoads += 1;
      const script = pageLoads >= 2
        ? '<script>fetch("/api/debugger/sessions", {method:"POST", body:"{}"});</script>'
        : '';
      send(res, 200, `<!doctype html><html><body><main><h1>Debugger</h1><div>Loading debugger</div>${script}</main></body></html>`);
      return;
    }
    send(res, 404, 'not found');
  });
  t.after(async () => {
    await frontend.close();
    await api.close();
  });
  const config = configFor(frontend.url, output, {
    apiUrl: api.url,
    routes: [{
      name: 'debugger', path: '/debugger?updateId=update-1', required: false,
      readiness: { heading: 'Debugger', timeoutMs: 40, settleMs: 0 },
      states: [{ name: 'default', actions: [] }],
    }],
  });
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const report = await captureScreenshotMatrix({ config, manifest: manifestFor(config), browser });

  assert.equal(report.entries[0].status, 'failed');
  assert.deepEqual(sessionIds, ['slow-session-1']);
  assert.deepEqual(deletedIds, sessionIds);
});

test('bounds cleanup when a debugger POST hangs forever', async (t) => {
  const output = await makeOutput();
  const api = await startServer(async (req, res) => {
    await bodyOf(req);
    if (req.method === 'POST' && req.url === '/api/debugger/sessions') {
      return;
    }
    json(res, 200, { ok: true });
  });
  const frontend = await startServer((req, res) => {
    if (req.url?.startsWith('/debugger')) {
      send(res, 200, '<!doctype html><html><body><div id="loading">Loading debugger</div><script>fetch("/api/debugger/sessions", {method:"POST", body:"{}"});</script></body></html>');
      return;
    }
    send(res, 404, 'not found');
  });
  t.after(async () => {
    await frontend.close();
    api.server.closeAllConnections?.();
    await api.close();
  });
  const config = configFor(frontend.url, output, {
    apiUrl: api.url,
    routes: [
      {
        name: 'debugger', path: '/debugger?updateId=update-1', required: false,
        readiness: { heading: 'Debugger', timeoutMs: 20, settleMs: 0 },
        states: [{ name: 'default', actions: [] }],
      },
      {
        name: 'fixture', path: '/fixture', required: true,
        readiness: { heading: 'Fixture Ready', timeoutMs: 100, settleMs: 0 },
        states: [{ name: 'default', actions: [] }],
      },
    ],
  });
  const manifest = manifestFor(config);
  const fixtureRoute = manifest.routes.find((route) => route.name === 'fixture');
  fixtureRoute.url = '/fixture';
  frontend.server.removeAllListeners('request');
  frontend.server.on('request', (req, res) => {
    if (req.url?.startsWith('/debugger')) {
      send(res, 200, '<!doctype html><html><body><div id="loading">Loading debugger</div><script>fetch("/api/debugger/sessions", {method:"POST", body:"{}"});</script></body></html>');
      return;
    }
    if (req.url?.startsWith('/fixture')) {
      send(res, 200, '<!doctype html><html><body><main><h1>Fixture Ready</h1></main></body></html>');
      return;
    }
    send(res, 404, 'not found');
  });
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const started = Date.now();
  const report = await captureScreenshotMatrix({
    config,
    manifest,
    browser,
    responseDrainTimeoutMs: 150,
  });

  assert.ok(Date.now() - started < 1600);
  assert.equal(report.entries[0].status, 'failed');
  assert.equal(report.entries.length, 1);
});

test('reports a bounded debugger DELETE timeout as cleanup failure', async (t) => {
  const output = await makeOutput();
  const api = await startServer(async (req, res) => {
    await bodyOf(req);
    if (req.method === 'POST' && req.url === '/api/debugger/sessions') {
      json(res, 201, { sessionId: 'cleanup-timeout-session' });
      return;
    }
    json(res, 200, { ok: true });
  });
  const frontend = await startServer((req, res) => {
    if (req.url?.startsWith('/debugger')) {
      send(res, 200, '<!doctype html><html><body><main><h1>Debugger</h1><script>fetch("/api/debugger/sessions", {method:"POST"});</script></main></body></html>');
      return;
    }
    send(res, 404, 'not found');
  });
  t.after(async () => {
    await frontend.close();
    await api.close();
  });
  const config = configFor(frontend.url, output, {
    apiUrl: api.url,
    routes: [{
      name: 'debugger', path: '/debugger', required: false,
      readiness: { heading: 'Debugger', timeoutMs: 100, settleMs: 0 },
      states: [{ name: 'default', actions: [] }],
    }],
  });
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const started = Date.now();
  const report = await captureScreenshotMatrix({
    config,
    manifest: manifestFor(config),
    browser,
    fetchImpl: async (_url, init) => {
      if (init?.method === 'DELETE') return new Promise(() => {});
      return { ok: true, status: 200 };
    },
  });

  assert.ok(Date.now() - started < 1600);
  assert.equal(report.cleanup[0].status, 'failed');
  assert.match(report.cleanup[0].error, /timed out/);
});

test('persists manifest and report atomically after entries and cleanup', async (t) => {
  const output = await makeOutput();
  const frontend = await startServer((req, res) => {
    send(res, 200, '<!doctype html><html><body><main><h1>Fixture Ready</h1></main></body></html>');
  });
  t.after(() => frontend.close());
  const config = configFor(frontend.url, output, {
    apiUrl: `${frontend.url}/api`,
    routes: [{ name: 'fixture', path: '/fixture', required: true, readiness: { heading: 'Fixture Ready', timeoutMs: 500 }, states: [{ name: 'default', actions: [] }] }],
  });
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const writes = [];
  const report = await captureScreenshotMatrix({
    config,
    manifest: manifestFor(config),
    browser,
    onReportWrite: (snapshot) => writes.push(snapshot),
  });

  const manifest = JSON.parse(await readFile(path.join(output, 'manifest.json'), 'utf8'));
  const persisted = JSON.parse(await readFile(path.join(output, 'report.json'), 'utf8'));
  assert.deepEqual(persisted, report);
  assert.equal(manifest.apiUrl, normalizeApiBaseUrl(config.apiUrl));
  assert.deepEqual(Object.keys(manifest.routes[0]).sort(), ['name', 'required', 'source', 'url'].sort());
  assert.equal(persisted.status, 'passed');
  assert.equal(writes.length, 3, 'initial, per-entry, and final atomic report writes');
  assert.equal((await readdir(output)).some((name) => name.includes('.tmp')), false);
});

test('resolves the required, optional, strict, invalid, and service exit matrix', () => {
  const entries = (values) => values.map(([status, required]) => ({ status, required }));
  assert.equal(resolveExitCode({ entries: entries([['captured', true]]) }), 0);
  assert.equal(resolveExitCode({ entries: entries([['skipped', false]]) }), 0);
  assert.equal(resolveExitCode({ entries: entries([['failed', false]]) }), 0);
  assert.equal(resolveExitCode({ strict: true, entries: entries([['skipped', false]]) }), 1);
  assert.equal(resolveExitCode({ strict: true, entries: entries([['failed', false]]) }), 1);
  assert.equal(resolveExitCode({ entries: entries([['failed', true]]) }), 1);
  assert.equal(resolveExitCode({ strict: true, entries: entries([['captured', true], ['skipped', false]]) }), 1);
  assert.equal(resolveExitCode({ error: { exitCode: 2 }, entries: [] }), 2);
  assert.equal(resolveExitCode({ error: new Error('service failed'), entries: [] }), 1);
});

test('records an unavailable debugger route so strict mode fails on its runner entry', async () => {
  const output = await makeOutput();
  const config = configFor('http://127.0.0.1:1', output, {
    apiUrl: 'http://127.0.0.1:1/api',
    strict: true,
    routes: [{
      name: 'debugger',
      path: '/debugger',
      required: false,
      states: [{ name: 'default', actions: [] }],
    }],
  });
  const manifest = {
    ...manifestFor(config),
    routes: [{
      name: 'debugger',
      url: null,
      required: false,
      source: '/updates?limit=1',
      skipReason: 'GET /updates?limit=1 returned an empty updates collection',
    }],
  };
  const report = await captureScreenshotMatrix({
    config,
    manifest,
    browser: { close() {} },
  });

  assert.equal(report.entries[0].route, 'debugger');
  assert.equal(report.entries[0].status, 'skipped');
  assert.equal(report.exitCode, 1);
});
