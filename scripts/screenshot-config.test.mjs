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
  'search',
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
  ['updates--filters', 'home-updates-advanced-filter'],
  ['contracts--filters', 'contracts-advanced-filter'],
  ['parties--filters', 'namespace-advanced-filter'],
  ['party-detail-updates--filters', 'party-updates-advanced-filter'],
  ['party-detail-contracts--filters', 'party-contracts-advanced-filter'],
  ['tokens-known--filters', 'tokens-advanced-filter'],
  ['tokens-transfers--filters', 'token-transfers-advanced-filter'],
  ['token-detail-transfers--filters', 'token-transfers-advanced-filter'],
  ['traffic--filters', 'traffic-purchases-advanced-search'],
]);

test('default config exposes stable route and exact scoped filter ids', () => {
  const config = createDefaultConfig();
  const routes = new Map(config.routes.map((route) => [route.name, route]));

  for (const routeId of requiredRouteIds) {
    assert.ok(routes.has(routeId), `missing route ${routeId}`);
  }
  assert.notEqual(routes.get('debugger').required, true);
  assert.equal(routes.get('debugger').dynamic, true);

  const captures = new Map(
    config.routes.flatMap((route) =>
      route.states.map((state) => [captureId(route, state), { route, state }]),
    ),
  );
  assert.deepEqual(
    [...filterMatrix.keys()].sort(),
    [...captures.keys()].filter((id) => id.endsWith('--filters')).sort(),
  );

  for (const [id, controls] of filterMatrix) {
    const { state } = captures.get(id);
    const action = state.actions.find((candidate) => candidate.kind === 'click' && candidate.controls);
    assert.equal(action.controls, controls, id);
    assert.ok(state.actions.some((candidate) => candidate.kind === 'fill'), id);
    const submitIndex = state.actions.findIndex(
      (candidate) => candidate.kind === 'click' && ['Apply filters', 'Search Namespaces'].includes(candidate.name),
    );
    assert.ok(
      state.actions.findIndex((candidate) => candidate.kind === 'fill') < submitIndex,
      `${id} should fill before applying`,
    );
  }

  const partiesFilter = captures.get('parties--filters').state.actions;
  assert.ok(partiesFilter.some((action) => action.kind === 'click' && action.name === 'Namespaces'));
  assert.ok(partiesFilter.some((action) => action.kind === 'click' && action.name === 'Add filter'));
  assert.ok(partiesFilter.some((action) => action.kind === 'click' && action.name === 'Search Namespaces'));
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
      routes: [{ name: 'route', path: '/', states: [{ name: 'default', actions: [{ kind: 'click' }] }] }],
    }),
    /target|name|selector|controls/i,
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
