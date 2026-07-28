import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  DEFAULT_CONFIG,
  EXIT_CODES,
  applyCliFilters,
  captureId,
  createDefaultConfig,
  loadScreenshotConfig,
  parseViewportSpec,
  stableScreenshotName,
  validateScreenshotConfig,
} from './screenshot-config.mjs';
import {
  formatCliHelp,
  parseCliOptions,
} from './screenshot-cli-options.mjs';

const requiredRouteIds = [
  'updates',
  'contracts',
  'parties',
  'nodes',
  'tokens',
  'canton-coin',
  'traffic',
  'settings',
  'search-results',
  'node-detail-01',
  'node-detail-02',
  'update-detail',
  'contract-detail',
  'party-detail',
  'namespace-detail',
  'package-family',
  'package-detail',
  'token-detail',
  'token-transfer-detail',
  'debugger',
  'legacy-update-redirect',
];

const filterMatrix = new Map([
  ['updates--filters', [
    { kind: 'click', role: 'button', name: 'Advanced Filter', controls: 'home-updates-advanced-filter' },
    { kind: 'fill', placeholder: 'Party ID', valueFrom: 'party', scope: { id: 'home-updates-advanced-filter' } },
    { kind: 'click', role: 'button', name: 'Add party filter', scope: { id: 'home-updates-advanced-filter' } },
    { kind: 'fill', placeholder: 'Template ID', valueFrom: 'template', scope: { id: 'home-updates-advanced-filter' } },
    { kind: 'click', role: 'button', name: 'Add template filter', scope: { id: 'home-updates-advanced-filter' } },
  ]],
  ['contracts--filters', [
    { kind: 'click', role: 'button', name: 'Advanced Filter', controls: 'contracts-advanced-filter' },
    { kind: 'fill', placeholder: 'Party ID', valueFrom: 'party', scope: { id: 'contracts-advanced-filter' } },
    { kind: 'click', role: 'button', name: 'Add party filter', scope: { id: 'contracts-advanced-filter' } },
    { kind: 'fill', placeholder: 'Template ID', valueFrom: 'template', scope: { id: 'contracts-advanced-filter' } },
    { kind: 'click', role: 'button', name: 'Add template filter', scope: { id: 'contracts-advanced-filter' } },
  ]],
  ['parties--filters', [
    { kind: 'click', role: 'button', name: 'Namespaces' },
    { kind: 'click', role: 'button', name: 'Advanced Filter', controls: 'namespace-advanced-filter' },
    { kind: 'fill', label: 'Public Key', valueFrom: 'publicKey', scope: { id: 'namespace-advanced-filter' } },
    { kind: 'click', role: 'button', name: 'Search Namespaces', scope: { id: 'namespace-advanced-filter' } },
  ]],
  ['party-detail-updates--filters', [
    { kind: 'click', role: 'button', name: 'Advanced Filter', controls: 'party-updates-advanced-filter' },
    { kind: 'fill', placeholder: 'Template ID', valueFrom: 'template', scope: { id: 'party-updates-advanced-filter' } },
    { kind: 'click', role: 'button', name: 'Add template filter', scope: { id: 'party-updates-advanced-filter' } },
  ]],
  ['party-detail-contracts--filters', [
    { kind: 'click', role: 'button', name: 'Advanced Filter', controls: 'party-contracts-advanced-filter' },
    { kind: 'fill', placeholder: 'Template ID', valueFrom: 'template', scope: { id: 'party-contracts-advanced-filter' } },
    { kind: 'click', role: 'button', name: 'Add template filter', scope: { id: 'party-contracts-advanced-filter' } },
  ]],
  ['tokens-known--filters', [
    { kind: 'click', role: 'button', name: 'Advanced Filter', controls: 'tokens-advanced-filter' },
    { kind: 'fill', placeholder: 'Name', valueFrom: 'tokenName', scope: { id: 'tokens-advanced-filter' } },
    { kind: 'click', role: 'button', name: 'Add name filter', scope: { id: 'tokens-advanced-filter' } },
    { kind: 'fill', placeholder: 'Issuer', valueFrom: 'issuer', scope: { id: 'tokens-advanced-filter' } },
    { kind: 'click', role: 'button', name: 'Add issuer filter', scope: { id: 'tokens-advanced-filter' } },
  ]],
  ['tokens-transfers--filters', [
    { kind: 'click', role: 'button', name: 'Advanced Filter', controls: 'token-transfers-advanced-filter' },
    { kind: 'fill', placeholder: 'From Party ID', valueFrom: 'party', scope: { id: 'token-transfers-advanced-filter' } },
    { kind: 'click', role: 'button', name: 'Add from party filter', scope: { id: 'token-transfers-advanced-filter' } },
    { kind: 'fill', placeholder: 'To Party ID', valueFrom: 'party', scope: { id: 'token-transfers-advanced-filter' } },
    { kind: 'click', role: 'button', name: 'Add to party filter', scope: { id: 'token-transfers-advanced-filter' } },
    { kind: 'select', label: 'Movement Type', value: 'Transfer', scope: { id: 'token-transfers-advanced-filter' } },
    { kind: 'click', role: 'button', name: 'Add movement type filter', scope: { id: 'token-transfers-advanced-filter' } },
  ]],
  ['token-detail-transfers--filters', [
    { kind: 'click', role: 'button', name: 'Advanced Filter', controls: 'token-transfers-advanced-filter' },
    { kind: 'fill', placeholder: 'From Party ID', valueFrom: 'party', scope: { id: 'token-transfers-advanced-filter' } },
    { kind: 'click', role: 'button', name: 'Add from party filter', scope: { id: 'token-transfers-advanced-filter' } },
    { kind: 'fill', placeholder: 'To Party ID', valueFrom: 'party', scope: { id: 'token-transfers-advanced-filter' } },
    { kind: 'click', role: 'button', name: 'Add to party filter', scope: { id: 'token-transfers-advanced-filter' } },
    { kind: 'select', label: 'Movement Type', value: 'Transfer', scope: { id: 'token-transfers-advanced-filter' } },
    { kind: 'click', role: 'button', name: 'Add movement type filter', scope: { id: 'token-transfers-advanced-filter' } },
  ]],
  ['traffic--filters', [
    { kind: 'click', role: 'button', name: 'Advanced Search', controls: 'traffic-purchases-advanced-search' },
    { kind: 'fill', label: 'Minimum date', value: '2024-01-01', scope: { id: 'traffic-purchases-advanced-search' } },
    { kind: 'fill', label: 'Maximum date', value: '2024-12-31', scope: { id: 'traffic-purchases-advanced-search' } },
    { kind: 'fill', label: 'Minimum purchased traffic', value: '1', scope: { id: 'traffic-purchases-advanced-search' } },
    { kind: 'fill', label: 'Minimum paid amount', value: '0.01', scope: { id: 'traffic-purchases-advanced-search' } },
    { kind: 'click', role: 'button', name: 'Apply filters', scope: { id: 'traffic-purchases-advanced-search' } },
  ]],
]);

test('default config exposes stable route and exact scoped filter ids', () => {
  const config = createDefaultConfig();
  const routes = new Map(config.routes.map((route) => [route.name, route]));

  for (const routeId of requiredRouteIds) {
    assert.ok(routes.has(routeId), `missing route ${routeId}`);
  }
  assert.notEqual(routes.get('debugger').required, true);
  assert.equal(routes.get('debugger').dynamic, true);
  assert.equal(routes.has('search'), false);
  assert.deepEqual(
    {
      name: routes.get('search-results').name,
      path: routes.get('search-results').path,
      dynamic: routes.get('search-results').dynamic,
      discoveryKey: routes.get('search-results').discoveryKey,
    },
    { name: 'search-results', path: undefined, dynamic: true, discoveryKey: 'search' },
  );

  const captures = new Map(
    config.routes.flatMap((route) =>
      route.states.map((state) => [captureId(route, state), { route, state }]),
    ),
  );
  assert.deepEqual(
    [...filterMatrix.keys()].sort(),
    [...captures.keys()].filter((id) => id.endsWith('--filters')).sort(),
  );

  for (const [id, expectedActions] of filterMatrix) {
    const { state } = captures.get(id);
    assert.deepEqual(state.actions, expectedActions, id);
  }
});

test('traffic filter actions avoid ambiguous node checkbox selectors', () => {
  const config = createDefaultConfig();
  const trafficRoute = config.routes.find((route) => route.name === 'traffic');
  const trafficActions = trafficRoute.states.find((state) => state.name === 'filters').actions;

  assert.equal(
    trafficActions.some((action) => action.kind === 'check' && action.selector === 'input[type="checkbox"]'),
    false,
  );
  assert.deepEqual(
    trafficActions.filter((action) => action.kind === 'fill').map((action) => action.label),
    ['Minimum date', 'Maximum date', 'Minimum purchased traffic', 'Minimum paid amount'],
  );
  assert.deepEqual(trafficActions.at(-1), {
    kind: 'click',
    role: 'button',
    name: 'Apply filters',
    scope: { id: 'traffic-purchases-advanced-search' },
  });
});

test('viewport specs parse positive dimensions and deterministic custom names', () => {
  assert.deepEqual(parseViewportSpec('1440x900'), {
    name: 'custom-1440x900',
    width: 1440,
    height: 900,
  });
  assert.deepEqual(parseCliOptions(['--viewport', '1280x720', '--viewport', '1920x1080']).viewports, [
    { name: 'custom-1280x720', width: 1280, height: 720 },
    { name: 'custom-1920x1080', width: 1920, height: 1080 },
  ]);
  assert.throws(() => parseViewportSpec('1280X720'), /viewport/i);
  assert.throws(() => parseViewportSpec('0x720'), /positive/i);
  assert.throws(() => parseViewportSpec('1280x0'), /positive/i);
  assert.throws(
    () => parseCliOptions(['--viewport', '1280x720', '--viewport', '1280x720']),
    /duplicate/i,
  );
});

test('config loading resolves custom ESM paths from cwd and merges by top-level policy', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'screenshot-config-'));
  try {
    await writeFile(
      path.join(directory, 'custom.mjs'),
      `export default ${JSON.stringify({
        output: 'artifacts',
        settleMs: 42,
        discovery: { maxNodes: 2 },
        viewports: [{ name: 'tablet', width: 800, height: 600 }],
        routes: [{ name: 'custom-route', path: '/custom', required: true, states: [{ name: 'default', actions: [] }] }],
      })};\n`,
    );

    const config = await loadScreenshotConfig('custom.mjs', { cwd: directory });
    assert.equal(config.output, 'artifacts');
    assert.equal(config.settleMs, 42);
    assert.equal(config.discovery.maxNodes, 2);
    assert.equal(config.discovery.maxNodesPerType, DEFAULT_CONFIG.discovery.maxNodesPerType);
    assert.deepEqual(config.viewports, [{ name: 'tablet', width: 800, height: 600 }]);
    assert.deepEqual(config.routes.map((route) => route.name), ['custom-route']);
    assert.equal(config.baseUrl, DEFAULT_CONFIG.baseUrl);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('config rejects unknown keys, invalid ids, duplicate combinations, and invalid actions', () => {
  assert.throws(
    () => validateScreenshotConfig({ ...createDefaultConfig(), unexpected: true }),
    /unknown top-level/i,
  );
  assert.throws(
    () => validateScreenshotConfig({
      ...createDefaultConfig(),
      routes: [{ name: 'Not Safe', path: '/', states: [{ name: 'default', actions: [] }] }],
    }),
    /lower-kebab/i,
  );
  assert.throws(
    () => validateScreenshotConfig({
      ...createDefaultConfig(),
      routes: [
        { name: 'same', path: '/', states: [{ name: 'default', actions: [] }] },
        { name: 'same', path: '/other', states: [{ name: 'default', actions: [] }] },
      ],
    }),
    /duplicate route/i,
  );
  assert.throws(
    () => validateScreenshotConfig({
      ...createDefaultConfig(),
      viewports: [
        { name: 'one', width: 800, height: 600 },
        { name: 'two', width: 800, height: 600 },
      ],
    }),
    /duplicate viewport/i,
  );
  assert.throws(
    () => validateScreenshotConfig({
      ...createDefaultConfig(),
      routes: [{ name: 'route', path: '/', states: [{ name: 'default', actions: [{ kind: 'explode' }] }] }],
    }),
    /unknown action/i,
  );
  assert.throws(
    () => validateScreenshotConfig({
      ...createDefaultConfig(),
      routes: [{ name: 'route', path: '/', states: [{ name: 'default', actions: [{ kind: 'fill', label: 'Party' }] }] }],
    }),
    /valueFrom/i,
  );
  assert.throws(
    () => validateScreenshotConfig({
      ...createDefaultConfig(),
      routes: [{ name: 'route', path: '/', states: [{ name: 'default', actions: [{ kind: 'click', name: 'Advanced Filter' }] }] }],
    }),
    /role/i,
  );
  assert.throws(
    () => validateScreenshotConfig({
      ...createDefaultConfig(),
      routes: [{ name: 'route', path: '/', states: [{ name: 'default', actions: [{ kind: 'click', role: 'button' }] }] }],
    }),
    /name/i,
  );
});

test('config accepts every scoped action kind and supported lookup form', () => {
  const config = createDefaultConfig();
  config.routes = [{
    name: 'action-route',
    path: '/actions',
    states: [{
      name: 'default',
      actions: [
        { kind: 'click', role: 'button', name: 'Add filter', scope: { id: 'panel' } },
        { kind: 'fill', placeholder: 'Party ID', valueFrom: 'party', scope: { region: 'Filters' } },
        { kind: 'select', selector: '#movement', value: 'created' },
        { kind: 'check', label: 'Include archived', checked: false, scope: { ariaControls: 'panel' } },
        { kind: 'waitFor', selector: '[role="status"]' },
      ],
    }],
  }];
  assert.equal(validateScreenshotConfig(config), true);
});

test('CLI parser normalizes defaults, filters, help, and invalid flags', () => {
  assert.deepEqual(parseCliOptions([]), {
    baseUrl: 'http://localhost:46000',
    apiUrl: 'http://localhost:4600/api',
    output: 'screenshots',
    strict: false,
    headed: false,
    routes: [],
    viewports: [],
    configPath: undefined,
    help: false,
  });
  assert.deepEqual(parseCliOptions([
    '--base-url', 'http://example.test',
    '--api-url', 'http://api.test/api',
    '--output', 'out',
    '--strict',
    '--headed',
    '--route', 'updates',
    '--route', 'traffic',
    '--config', 'capture.mjs',
  ]), {
    baseUrl: 'http://example.test',
    apiUrl: 'http://api.test/api',
    output: 'out',
    strict: true,
    headed: true,
    routes: ['updates', 'traffic'],
    viewports: [],
    configPath: 'capture.mjs',
    help: false,
  });
  assert.equal(parseCliOptions(['--help']).help, true);
  assert.match(formatCliHelp(), /--viewport <WxH>/);
  assert.throws(() => parseCliOptions(['--unknown']), /invalid|unknown/i);
  assert.throws(() => parseCliOptions(['--output']), /requires.*value/i);
});

test('CLI filters replace requested viewport set and select route/state captures', () => {
  const config = createDefaultConfig();
  const filtered = applyCliFilters(config, parseCliOptions([
    '--route', 'updates--filters',
    '--viewport', '1024x768',
    '--output', 'selected',
  ]));
  assert.equal(filtered.output, 'selected');
  assert.deepEqual(filtered.viewports, [{ name: 'custom-1024x768', width: 1024, height: 768 }]);
  assert.deepEqual(filtered.routes.map((route) => route.name), ['updates']);
  assert.deepEqual(filtered.routes[0].states.map((state) => state.name), ['filters']);
  assert.throws(
    () => applyCliFilters(config, parseCliOptions(['--route', 'missing'])),
    /unknown route/i,
  );
});

test('exit constants and deterministic filesystem-safe names are stable', () => {
  assert.deepEqual(EXIT_CODES, {
    SUCCESS: 0,
    FAILURE: 1,
    INVALID_INPUT: 2,
    ALLOWED_SKIP: 0,
    SERVICE_FAILURE: 1,
    CAPTURE_FAILURE: 1,
    STRICT_FAILURE: 1,
    MISSING_BROWSER: 2,
  });
  assert.equal(stableScreenshotName('updates', 'default'), 'updates.png');
  assert.equal(stableScreenshotName('updates', 'filters'), 'updates--filters.png');
  assert.equal(stableScreenshotName('node-detail-01', 'default'), 'node-detail-01.png');
  assert.equal(stableScreenshotName('route', 'state'), 'route--state.png');
  assert.throws(() => stableScreenshotName('../unsafe', 'default'), /lower-kebab|safe/i);
});
