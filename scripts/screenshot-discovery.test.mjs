import assert from 'node:assert/strict';
import test from 'node:test';

import {
  apiUrlForPath,
  discoverScreenshotManifest,
  normalizeApiBaseUrl,
  requestJson,
  ScreenshotDiscoveryError,
} from './screenshot-discovery.mjs';

const apiBase = 'http://localhost:4600';

function response(body, status = 200, statusText = 'OK') {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    async json() {
      return body;
    },
  };
}

function fixtureFetch(fixtures, calls = []) {
  const fetchImpl = async (url, init = {}) => {
    const parsed = new URL(url);
    const key = `${parsed.pathname}${parsed.search}`;
    calls.push({ url, init: { ...init } });
    const fixture = fixtures[key];
    if (fixture === undefined) {
      return response({ error: `Missing fixture for ${key}` }, 404, 'Not Found');
    }
    return typeof fixture === 'function' ? fixture({ url, init }) : response(fixture);
  };
  return fetchImpl;
}

const fullFixtures = {
  '/api/nodes': {
    nodes: [
      { id: 'node/one', label: 'One' },
      { id: 'node two', label: 'Two' },
    ],
  },
  '/api/updates?limit=1': {
    updates: [{
      nodeId: 'node/one',
      eventOffset: 'offset/1',
      updateId: 'update?one',
      parties: ['party::one'],
    }],
  },
  '/api/contracts?limit=1': {
    contracts: [{
      nodeId: 'node/one',
      contractId: 'contract/one',
      templateId: 'Module:Asset',
    }],
  },
  '/api/parties': {
    nodes: [{ nodeId: 'node/one', parties: ['party::one'] }],
  },
  '/api/parties/fingerprints?limit=1': {
    fingerprints: ['namespace/one'],
  },
  '/api/tokens?limit=1': {
    tokens: [{ tokenId: 'token/one', name: 'Token One', issuer: 'issuer::one' }],
  },
  '/api/tokens/transfers?limit=1': {
    transfers: [{
      tokenId: 'token/one',
      updateId: 'transfer/update',
      nodes: [{ nodeId: 'node/one', eventOffset: 'transfer/offset' }],
    }],
  },
  '/api/templates': {
    templates: [{ templateId: 'Module:Asset' }],
  },
  '/api/traffic-purchases?limit=1': {
    purchases: [{
      nodeId: 'node/one',
      updateId: 'traffic/update',
      eventOffset: 'traffic/offset',
    }],
    current: [{ nodeId: 'node/one' }],
  },
  '/api/nodes/node%2Fone/packages': {
    nodeId: 'node/one',
    packagesByName: [{
      packageName: 'package/name',
      packages: [{ packageId: 'package/id' }],
    }],
  },
  '/api/nodes/node%20two/packages': {
    nodeId: 'node two',
    packagesByName: [],
  },
};

test('normalizes API bases without double prefixes and preserves URL suffixes', () => {
  assert.equal(normalizeApiBaseUrl('http://localhost:4600'), 'http://localhost:4600/api');
  assert.equal(normalizeApiBaseUrl('http://localhost:4600/api'), 'http://localhost:4600/api');
  assert.equal(normalizeApiBaseUrl('http://localhost:4600/api/'), 'http://localhost:4600/api');
  assert.equal(
    normalizeApiBaseUrl('http://localhost:4600/proxy/api/api/?tenant=one#fragment'),
    'http://localhost:4600/proxy/api?tenant=one#fragment',
  );
});

test('rejects invalid API base values before URL construction', () => {
  for (const value of [undefined, null, '', '   ', 42, {}, [], new URL(apiBase)]) {
    assert.throws(() => normalizeApiBaseUrl(value), ScreenshotDiscoveryError);
  }
});

test('builds API URLs for relative and already-prefixed paths', () => {
  assert.equal(
    apiUrlForPath(apiBase, '/nodes?limit=1'),
    'http://localhost:4600/api/nodes?limit=1',
  );
  assert.equal(
    apiUrlForPath('http://localhost:4600/api/', '/api/updates?limit=1'),
    'http://localhost:4600/api/updates?limit=1',
  );
  assert.equal(
    apiUrlForPath(apiBase, 'http://localhost:4600/api/updates?limit=1'),
    'http://localhost:4600/api/updates?limit=1',
  );
  assert.equal(
    apiUrlForPath(apiBase, '/nodes/node%2Fone/packages'),
    'http://localhost:4600/api/nodes/node%2Fone/packages',
  );
});

test('requestJson uses injected fetch and preserves method, query, headers, and body', async () => {
  const calls = [];
  const fetchImpl = fixtureFetch({ '/api/custom?one=1&two=2': { ok: true } }, calls);
  const body = JSON.stringify({ hello: 'world' });
  const result = await requestJson(apiBase, '/custom?one=1&two=2', {
    fetchImpl,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(calls, [{
    url: 'http://localhost:4600/api/custom?one=1&two=2',
    init: {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    },
  }]);
});

test('requestJson reports precise HTTP response errors', async () => {
  const fetchImpl = fixtureFetch({
    '/api/updates?limit=1': () => response({ message: 'unavailable' }, 503, 'Service Unavailable'),
  });

  await assert.rejects(
    requestJson(apiBase, '/updates?limit=1', { fetchImpl }),
    (error) => error.message === 'GET /updates?limit=1 returned 503 Service Unavailable',
  );
});

test('requestJson wraps fetch transport failures with method, endpoint, and cause', async () => {
  const cause = new Error('connect ECONNREFUSED');
  const fetchImpl = async () => {
    throw cause;
  };

  await assert.rejects(
    requestJson(apiBase, '/nodes?limit=1', { fetchImpl, method: 'POST' }),
    (error) => {
      assert.ok(error instanceof ScreenshotDiscoveryError);
      assert.equal(
        error.message,
        'POST /nodes?limit=1 failed for http://localhost:4600/api/nodes?limit=1: connect ECONNREFUSED',
      );
      assert.equal(error.cause, cause);
      return true;
    },
  );
});

test('discoverScreenshotManifest propagates API transport failures', async () => {
  const cause = new Error('socket hang up');
  const fetchImpl = async () => {
    throw cause;
  };

  await assert.rejects(
    discoverScreenshotManifest({ apiUrl: apiBase, fetchImpl }),
    (error) => {
      assert.ok(error instanceof ScreenshotDiscoveryError);
      assert.match(error.message, /GET \/nodes/);
      assert.match(error.message, /http:\/\/localhost:4600\/api\/nodes/);
      assert.equal(error.cause, cause);
      return true;
    },
  );
});

test('discovers static and dynamic screenshot routes from every approved endpoint', async () => {
  const calls = [];
  const manifest = await discoverScreenshotManifest({
    apiUrl: apiBase,
    fetchImpl: fixtureFetch(fullFixtures, calls),
  });
  const routes = new Map(manifest.routes.map((route) => [route.name, route]));

  assert.deepEqual(
    ['updates', 'nodes', 'parties', 'contracts', 'tokens', 'canton-coin', 'traffic', 'settings']
      .map((name) => routes.get(name).url),
    ['/', '/nodes', '/parties', '/contracts', '/tokens', '/canton-coin', '/traffic', '/settings'],
  );
  assert.equal(routes.get('updates').required, true);
  assert.equal(routes.get('updates').source, 'config');

  assert.equal(routes.get('node-detail-01').url, '/nodes/node%2Fone');
  assert.equal(routes.get('node-detail-02').url, '/nodes/node%20two');
  assert.equal(routes.get('update-detail').url, '/nodes/node%2Fone/updates/offset%2F1');
  assert.equal(routes.get('legacy-update-redirect').url, '/tx/update%3Fone');
  assert.equal(routes.get('debugger').url, '/debugger?updateId=update%3Fone');
  assert.equal(routes.get('contract-detail').url, '/nodes/node%2Fone/contracts/contract%2Fone');
  assert.equal(routes.get('party-detail').url, '/parties/party%3A%3Aone');
  assert.equal(routes.get('party-detail-updates').url, '/parties/party%3A%3Aone');
  assert.equal(routes.get('party-detail-contracts').url, '/parties/party%3A%3Aone');
  assert.equal(routes.get('namespace-detail').url, '/namespaces/namespace%2Fone');
  assert.equal(routes.get('token-detail').url, '/tokens/token%2Fone');
  assert.equal(routes.get('token-detail-transfers').url, '/tokens/token%2Fone');
  assert.equal(routes.get('tokens-known').url, '/tokens');
  assert.equal(routes.get('tokens-transfers').url, '/tokens');
  assert.equal(routes.get('token-transfer-detail').url, '/tokens/transfers/transfer%2Fupdate');
  assert.equal(routes.get('package-family').url, '/packages/by-name/package%2Fname');
  assert.equal(routes.get('package-detail').url, '/packages/package%2Fid');
  assert.equal(routes.get('search-results').url, '/search?q=party%3A%3Aone');

  assert.equal(routes.get('update-detail').metadata.nodeId, 'node/one');
  assert.equal(routes.get('update-detail').metadata.eventOffset, 'offset/1');
  assert.equal(routes.get('traffic').metadata.nodeIds[0], 'node/one');
  assert.equal(routes.get('search-results').validation.heading, 'Search Results');
  assert.deepEqual(routes.get('search-results').validation.states, [
    '.search-results-group',
    '.search-results-view__empty',
  ]);

  for (const route of manifest.routes) {
    assert.ok(route.source, `${route.name} source`);
    assert.equal(typeof route.required, 'boolean');
    assert.ok(route.expectedPath, `${route.name} expected path`);
    assert.ok(route.readiness.landmark, `${route.name} readiness landmark`);
  }
  assert.equal(manifest.context.nodeId, 'node/one');
  assert.equal(manifest.context.eventOffset, 'offset/1');
  assert.equal(manifest.context.updateId, 'update?one');
  assert.equal(manifest.context.namespaceId, 'namespace/one');
  assert.equal(manifest.context.namespace, undefined);
  assert.equal(manifest.context.issuer, 'issuer::one');
  assert.equal(manifest.context.tokenName, 'Token One');
  assert.deepEqual(manifest.context.nodes, [
    { id: 'node/one', label: 'One' },
    { id: 'node two', label: 'Two' },
  ]);
  assert.equal(manifest.context.trafficNodeIds[0], 'node/one');
  assert.deepEqual(manifest.skips, []);
  assert.deepEqual(
    calls.map(({ url }) => new URL(url).pathname + new URL(url).search),
    [
      '/api/nodes',
      '/api/updates?limit=1',
      '/api/contracts?limit=1',
      '/api/parties',
      '/api/parties/fingerprints?limit=1',
      '/api/tokens?limit=1',
      '/api/tokens/transfers?limit=1',
      '/api/templates',
      '/api/traffic-purchases?limit=1',
      '/api/nodes/node%2Fone/packages',
      '/api/nodes/node%20two/packages',
    ],
  );
});

test('keeps labels for every traffic node when bounded node routes use maxNodes', async () => {
  const fixtures = structuredClone(fullFixtures);
  const nodes = Array.from({ length: 6 }, (_, index) => ({
    id: `node/${index + 1}`,
    label: `Node ${index + 1}`,
  }));
  fixtures['/api/nodes'] = { nodes };
  fixtures['/api/traffic-purchases?limit=1'] = {
    purchases: nodes.map((node) => ({ nodeId: node.id })),
    current: nodes.map((node) => ({ nodeId: node.id })),
  };
  fixtures['/api/nodes/node%2F3/packages'] = { packagesByName: [] };
  fixtures['/api/nodes/node%2F4/packages'] = { packagesByName: [] };
  const calls = [];

  const manifest = await discoverScreenshotManifest({
    apiUrl: apiBase,
    fetchImpl: fixtureFetch(fixtures, calls),
  });
  const routes = new Map(manifest.routes.map((route) => [route.name, route]));

  assert.deepEqual(manifest.context.nodes, nodes);
  assert.deepEqual(manifest.context.trafficNodeIds, nodes.map((node) => node.id));
  assert.equal(routes.has('node-detail-04'), false);
  assert.equal(routes.has('node-detail-05'), false);
  assert.equal(calls.some(({ url }) => url.endsWith('/api/nodes/node%2F5/packages')), false);
  assert.equal(calls.some(({ url }) => url.endsWith('/api/nodes/node%2F6/packages')), false);
});

test('records empty collections and endpoint failures as precise optional skips', async () => {
  const fixtures = {
    '/api/nodes': { nodes: [{ id: 'node-1', label: 'One' }] },
    '/api/updates?limit=1': { updates: [] },
    '/api/contracts?limit=1': { contracts: [] },
    '/api/parties': { nodes: [{ nodeId: 'node-1', parties: [] }] },
    '/api/parties/fingerprints?limit=1': () => response({ error: 'offline' }, 502, 'Bad Gateway'),
    '/api/tokens?limit=1': { tokens: [] },
    '/api/tokens/transfers?limit=1': { transfers: [] },
    '/api/templates': { templates: [] },
    '/api/traffic-purchases?limit=1': { purchases: [], current: [] },
    '/api/nodes/node-1/packages': { packagesByName: [] },
  };
  const manifest = await discoverScreenshotManifest({
    apiUrl: apiBase,
    fetchImpl: fixtureFetch(fixtures),
  });
  const routes = new Map(manifest.routes.map((route) => [route.name, route]));
  const skipReasons = new Map(manifest.skips.map((skip) => [skip.name, skip.reason]));

  assert.equal(routes.has('debugger'), true);
  assert.equal(routes.get('debugger').url, null);
  assert.equal(routes.get('debugger').skipReason, 'GET /updates?limit=1 returned an empty updates collection');
  assert.equal(routes.has('update-detail'), true);
  assert.equal(routes.get('update-detail').url, null);
  assert.equal(routes.get('update-detail').required, false);
  assert.equal(routes.get('update-detail').skipReason, 'GET /updates?limit=1 returned an empty updates collection');
  assert.equal(routes.get('contract-detail').skipReason, 'GET /contracts?limit=1 returned an empty contracts collection');
  assert.equal(routes.get('namespace-detail').skipReason, 'GET /parties/fingerprints?limit=1 returned 502 Bad Gateway');
  assert.equal(routes.get('namespace-detail').discoveryError, true);
  assert.equal(routes.get('package-family').skipReason, 'GET /nodes/node-1/packages returned an empty packagesByName collection');
  assert.equal(routes.get('token-detail').skipReason, 'GET /tokens?limit=1 returned an empty tokens collection');
  assert.equal(routes.get('token-detail-transfers').skipReason, 'GET /tokens?limit=1 returned an empty tokens collection');
  assert.equal(routes.get('token-transfer-detail').skipReason, 'GET /tokens/transfers?limit=1 returned an empty transfers collection');
  assert.equal(routes.get('search-results').skipReason, 'No discovered party or update ID for search query');
  assert.equal(skipReasons.get('debugger'), 'GET /updates?limit=1 returned an empty updates collection');
  assert.ok(manifest.context.discoveryErrors.fingerprints);
});

test('deduplicates exact logical entries while preserving scoped routes sharing a URL', async () => {
  const fixtures = structuredClone(fullFixtures);
  fixtures['/api/nodes'] = {
    nodes: [
      { id: 'same/id', label: 'One' },
      { id: 'same/id', label: 'Duplicate' },
      { id: 'unique/id', label: 'Unique' },
    ],
  };
  fixtures['/api/updates?limit=1'] = {
    updates: [{ nodeId: 'same/id', eventOffset: 'same/offset', updateId: 'same/update' }],
  };
  fixtures['/api/contracts?limit=1'] = {
    contracts: [{ nodeId: 'same/id', contractId: 'same/id' }],
  };
  fixtures['/api/parties'] = { nodes: [{ parties: ['same/id'] }] };
  fixtures['/api/parties/fingerprints?limit=1'] = { fingerprints: ['same/id'] };
  fixtures['/api/tokens?limit=1'] = { tokens: [{ tokenId: 'same/id' }] };
  fixtures['/api/tokens/transfers?limit=1'] = { transfers: [{ updateId: 'same/update' }] };
  fixtures['/api/nodes/same%2Fid/packages'] = {
    packagesByName: [{ packageName: 'same/id', packages: [{ packageId: 'same/id' }] }],
  };
  fixtures['/api/nodes/unique%2Fid/packages'] = { packagesByName: [] };

  const manifest = await discoverScreenshotManifest({
    apiUrl: apiBase,
    fetchImpl: fixtureFetch(fixtures),
  });
  const routes = new Map(manifest.routes.map((route) => [route.name, route]));
  assert.equal(routes.get('party-detail').url, '/parties/same%2Fid');
  assert.equal(routes.get('party-detail-updates').url, '/parties/same%2Fid');
  assert.equal(routes.get('party-detail-contracts').url, '/parties/same%2Fid');
  assert.equal(routes.get('token-detail').url, '/tokens/same%2Fid');
  assert.equal(routes.get('token-detail-transfers').url, '/tokens/same%2Fid');
  assert.equal(routes.get('node-detail-01').url, '/nodes/same%2Fid');
  assert.equal(routes.get('node-detail-02').url, '/nodes/unique%2Fid');
  assert.equal(manifest.routes.filter((route) => route.dedupeKey === 'node-detail').length, 2);
  assert.equal(routes.has('node-detail-03'), false);
  assert.equal(manifest.context.nodeId, 'same/id');
  assert.equal(manifest.context.eventOffset, 'same/offset');
});

test('scopes discovery routes and endpoint work to configured route categories', async () => {
  const calls = [];
  const manifest = await discoverScreenshotManifest({
    apiUrl: apiBase,
    config: {
      routes: [{
        name: 'tokens-known',
        path: '/tokens',
        required: false,
        states: [{ name: 'default', actions: [] }],
      }],
      discovery: { maxNodes: 1 },
    },
    fetchImpl: fixtureFetch(fullFixtures, calls),
  });

  assert.deepEqual(manifest.routes.map((route) => route.name), ['tokens-known']);
  assert.deepEqual(calls, []);
});

test('emits only the selected node-detail route while sharing the discovery endpoint', async () => {
  const manifest = await discoverScreenshotManifest({
    apiUrl: apiBase,
    config: {
      routes: [{
        name: 'node-detail-02',
        required: false,
        dynamic: true,
        discoveryKey: 'node-detail',
        states: [{ name: 'default', actions: [] }],
      }],
    },
    fetchImpl: fixtureFetch(fullFixtures),
  });

  assert.deepEqual(manifest.routes.map((route) => route.name), ['node-detail-02']);
  assert.equal(manifest.routes[0].url, '/nodes/node%20two');
});

test('emits only the selected party-detail view while sharing the discovery endpoint', async () => {
  const manifest = await discoverScreenshotManifest({
    apiUrl: apiBase,
    config: {
      routes: [{
        name: 'party-detail-updates',
        required: false,
        dynamic: true,
        discoveryKey: 'party-detail',
        states: [{ name: 'default', actions: [] }],
      }],
    },
    fetchImpl: fixtureFetch(fullFixtures),
  });

  assert.deepEqual(manifest.routes.map((route) => route.name), ['party-detail-updates']);
});

test('emits an unavailable selected node-detail ordinal when nodes are missing', async () => {
  const config = {
    routes: [{
      name: 'node-detail-02',
      required: false,
      dynamic: true,
      discoveryKey: 'node-detail',
      states: [{ name: 'default', actions: [] }],
    }],
  };
  for (const nodes of [[], [{ id: 'node-1', label: 'One' }]]) {
    const fixtures = structuredClone(fullFixtures);
    fixtures['/api/nodes'] = { nodes };
    const manifest = await discoverScreenshotManifest({
      apiUrl: apiBase,
      config,
      fetchImpl: fixtureFetch(fixtures),
    });

    assert.deepEqual(manifest.routes.map((route) => route.name), ['node-detail-02']);
    if (nodes.length === 0) {
      assert.equal(manifest.routes[0].url, null);
      assert.match(manifest.routes[0].skipReason, /empty nodes collection/);
    } else {
      assert.equal(manifest.routes[0].url, null);
      assert.match(manifest.routes[0].skipReason, /Only 1 node discovered/);
    }
  }
});

test('preserves configured requiredness for generated and unavailable dynamic routes', async () => {
  const config = {
    routes: [{
      name: 'node-detail-02',
      required: true,
      dynamic: true,
      discoveryKey: 'node-detail',
      states: [{ name: 'default', actions: [] }],
    }],
  };

  const generated = await discoverScreenshotManifest({
    apiUrl: apiBase,
    config,
    fetchImpl: fixtureFetch(fullFixtures),
  });
  assert.equal(generated.routes[0].name, 'node-detail-02');
  assert.equal(generated.routes[0].required, true);

  const emptyFixtures = structuredClone(fullFixtures);
  emptyFixtures['/api/nodes'] = { nodes: [] };
  const unavailable = await discoverScreenshotManifest({
    apiUrl: apiBase,
    config,
    fetchImpl: fixtureFetch(emptyFixtures),
  });
  assert.equal(unavailable.routes[0].name, 'node-detail-02');
  assert.equal(unavailable.routes[0].required, true);
  assert.equal(unavailable.routes[0].url, null);
});
