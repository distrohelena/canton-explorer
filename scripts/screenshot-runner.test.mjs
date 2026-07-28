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
