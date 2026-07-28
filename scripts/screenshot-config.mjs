import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const EXIT_CODES = Object.freeze({
  SUCCESS: 0,
  FAILURE: 1,
  INVALID_INPUT: 2,
  ALLOWED_SKIP: 0,
  SERVICE_FAILURE: 1,
  CAPTURE_FAILURE: 1,
  STRICT_FAILURE: 1,
  MISSING_BROWSER: 2,
});

export class ScreenshotConfigError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'ScreenshotConfigError';
    this.exitCode = EXIT_CODES.INVALID_INPUT;
  }
}

export const CONFIG_TOP_LEVEL_KEYS = Object.freeze([
  'baseUrl',
  'apiUrl',
  'output',
  'strict',
  'headed',
  'settleMs',
  'discovery',
  'viewports',
  'routes',
]);

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONTEXT_NAMES = new Set([
  'party',
  'template',
  'nodeId',
  'publicKey',
  'updateId',
  'contractId',
  'tokenId',
  'transferId',
  'namespace',
  'packageId',
  'packageName',
  'issuer',
  'tokenName',
  'movementType',
  'search',
]);

const DEFAULT_READINESS = Object.freeze({ timeoutMs: 10_000, settleMs: 300 });
const DEFAULT_DISCOVERY = Object.freeze({
  maxNodes: 4,
  maxNodesPerType: 4,
  maxPackages: 4,
});

function clone(value) {
  return structuredClone(value);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertObject(value, label) {
  if (!isObject(value)) {
    throw new ScreenshotConfigError(`${label} must be an object`);
  }
}

function assertId(value, label) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new ScreenshotConfigError(`${label} must be a lower-kebab-case identifier`);
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ScreenshotConfigError(`${label} must be a non-empty string`);
  }
}

function assertPositiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ScreenshotConfigError(`${label} must be a positive integer`);
  }
}

function actionScope(action, label) {
  if (action.scope === undefined) return;
  if (typeof action.scope === 'string') {
    assertNonEmptyString(action.scope, `${label}.scope`);
    return;
  }
  assertObject(action.scope, `${label}.scope`);
  const keys = ['id', 'ariaControls', 'aria-controls', 'region', 'regionName', 'selector', 'role', 'name'];
  if (!keys.some((key) => action.scope[key] !== undefined)) {
    throw new ScreenshotConfigError(`${label}.scope must identify an id, aria-controls, region, or selector`);
  }
  for (const key of keys) {
    if (action.scope[key] !== undefined) assertNonEmptyString(action.scope[key], `${label}.scope.${key}`);
  }
}

function validateLookupFields(action, label, keys) {
  if (!keys.some((key) => action[key] !== undefined)) {
    throw new ScreenshotConfigError(`${label} needs a ${keys.join(', ')} target`);
  }
  for (const key of keys) {
    if (action[key] !== undefined) assertNonEmptyString(action[key], `${label}.${key}`);
  }
}

function validateAction(action, label) {
  assertObject(action, label);
  assertNonEmptyString(action.kind, `${label}.kind`);
  actionScope(action, label);

  switch (action.kind) {
    case 'click':
      assertNonEmptyString(action.role, `${label}.role`);
      assertNonEmptyString(action.name, `${label}.name`);
      if (action.controls !== undefined) assertNonEmptyString(action.controls, `${label}.controls`);
      if (action.selector !== undefined) assertNonEmptyString(action.selector, `${label}.selector`);
      break;
    case 'fill':
      validateLookupFields(action, label, ['label', 'placeholder', 'selector']);
      if ((action.value === undefined) === (action.valueFrom === undefined)) {
        throw new ScreenshotConfigError(`${label} needs value or valueFrom`);
      }
      if (action.value !== undefined) assertNonEmptyString(action.value, `${label}.value`);
      if (action.valueFrom !== undefined) validateValueFrom(action.valueFrom, `${label}.valueFrom`);
      break;
    case 'select':
      validateLookupFields(action, label, ['label', 'placeholder', 'selector']);
      if ((action.value === undefined) === (action.valueFrom === undefined)) {
        throw new ScreenshotConfigError(`${label} needs value or valueFrom`);
      }
      if (action.value !== undefined) assertNonEmptyString(action.value, `${label}.value`);
      if (action.valueFrom !== undefined) validateValueFrom(action.valueFrom, `${label}.valueFrom`);
      break;
    case 'check':
      validateLookupFields(action, label, ['label', 'placeholder', 'selector']);
      if (action.checked !== true && action.checked !== false) {
        throw new ScreenshotConfigError(`${label}.checked must be boolean`);
      }
      break;
    case 'waitFor':
      assertNonEmptyString(action.selector, `${label}.selector`);
      if (action.timeoutMs !== undefined) assertPositiveInteger(action.timeoutMs, `${label}.timeoutMs`);
      break;
    default:
      throw new ScreenshotConfigError(`${label} has unknown action kind ${action.kind}`);
  }
}

function validateValueFrom(value, label) {
  assertNonEmptyString(value, label);
  if (!CONTEXT_NAMES.has(value)) {
    throw new ScreenshotConfigError(`${label} must name a supported discovery context value`);
  }
}

function panelClick(panelId, name) {
  return { kind: 'click', role: 'button', name, scope: { id: panelId } };
}

function openPanel(panelId, name = 'Advanced Filter') {
  return { kind: 'click', role: 'button', name, controls: panelId };
}

function fillFrom(panelId, lookup, valueFrom) {
  return { kind: 'fill', ...lookup, valueFrom, scope: { id: panelId } };
}

function filterActions(panelId, options = {}) {
  const actions = [openPanel(panelId, options.panelName)];
  if (options.party) {
    actions.push(fillFrom(panelId, { placeholder: 'Party ID' }, 'party'));
    actions.push(panelClick(panelId, 'Add party filter'));
  }
  if (options.template) {
    actions.push(fillFrom(panelId, { placeholder: 'Template ID' }, 'template'));
    actions.push(panelClick(panelId, 'Add template filter'));
  }
  if (options.name) {
    actions.push(fillFrom(panelId, { placeholder: 'Name' }, 'tokenName'));
    actions.push(panelClick(panelId, 'Add name filter'));
  }
  if (options.issuer) {
    actions.push(fillFrom(panelId, { placeholder: 'Issuer' }, 'issuer'));
    actions.push(panelClick(panelId, 'Add issuer filter'));
  }
  if (options.fromParty) {
    actions.push(fillFrom(panelId, { placeholder: 'From Party ID' }, 'party'));
    actions.push(panelClick(panelId, 'Add from party filter'));
  }
  if (options.toParty) {
    actions.push(fillFrom(panelId, { placeholder: 'To Party ID' }, 'party'));
    actions.push(panelClick(panelId, 'Add to party filter'));
  }
  if (options.movementType) {
    actions.push({
      kind: 'select',
      label: 'Movement Type',
      value: 'Transfer',
      scope: { id: panelId },
    });
    actions.push(panelClick(panelId, 'Add movement type filter'));
  }
  return actions;
}

function namespaceFilterActions() {
  const panelId = 'namespace-advanced-filter';
  return [
    { kind: 'click', role: 'button', name: 'Namespaces' },
    openPanel(panelId),
    fillFrom(panelId, { label: 'Public Key' }, 'publicKey'),
    panelClick(panelId, 'Search Namespaces'),
  ];
}

function trafficFilterActions() {
  const panelId = 'traffic-purchases-advanced-search';
  return [
    openPanel(panelId, 'Advanced Search'),
    { kind: 'fill', label: 'Minimum date', value: '2024-01-01', scope: { id: panelId } },
    { kind: 'fill', label: 'Maximum date', value: '2024-12-31', scope: { id: panelId } },
    { kind: 'fill', label: 'Minimum purchased traffic', value: '1', scope: { id: panelId } },
    { kind: 'fill', label: 'Minimum paid amount', value: '0.01', scope: { id: panelId } },
    panelClick(panelId, 'Apply filters'),
  ];
}

function route(name, pathValue, options = {}) {
  return {
    name,
    ...(pathValue === undefined ? {} : { path: pathValue }),
    required: options.required ?? true,
    ...(options.dynamic === undefined ? {} : { dynamic: options.dynamic }),
    ...(options.discoveryKey === undefined ? {} : { discoveryKey: options.discoveryKey }),
    ...(options.view === undefined ? {} : { view: options.view }),
    readiness: { ...DEFAULT_READINESS, ...(options.readiness ?? {}) },
    states: options.states ?? [{ name: 'default', actions: [] }],
  };
}

const FILTER_STATES = {
  updates: filterActions('home-updates-advanced-filter', { party: true, template: true }),
  contracts: filterActions('contracts-advanced-filter', { party: true, template: true }),
  parties: namespaceFilterActions(),
  'party-detail-updates': filterActions('party-updates-advanced-filter', { template: true }),
  'party-detail-contracts': filterActions('party-contracts-advanced-filter', { template: true }),
  'tokens-known': filterActions('tokens-advanced-filter', { name: true, issuer: true }),
  'tokens-transfers': filterActions('token-transfers-advanced-filter', { fromParty: true, toParty: true, movementType: true }),
  'token-detail-transfers': filterActions('token-transfers-advanced-filter', { fromParty: true, toParty: true, movementType: true }),
  traffic: trafficFilterActions(),
};

function withFilterState(name, actions) {
  return [
    { name: 'default', actions: [] },
    { name: 'filters', required: false, actions },
  ];
}

const DEFAULT_ROUTES = [
  route('updates', '/', { states: withFilterState('updates', FILTER_STATES.updates) }),
  route('contracts', '/contracts', { states: withFilterState('contracts', FILTER_STATES.contracts) }),
  route('parties', '/parties', { states: withFilterState('parties', FILTER_STATES.parties) }),
  route('nodes', '/nodes'),
  route('tokens', '/tokens'),
  route('canton-coin', '/canton-coin'),
  route('traffic', '/traffic', { states: withFilterState('traffic', FILTER_STATES.traffic) }),
  route('settings', '/settings'),
  route('search-results', undefined, { required: false, dynamic: true, discoveryKey: 'search' }),
  route('node-detail-01', undefined, { required: false, dynamic: true, discoveryKey: 'node-detail' }),
  route('node-detail-02', undefined, { required: false, dynamic: true, discoveryKey: 'node-detail' }),
  route('update-detail', undefined, { required: false, dynamic: true, discoveryKey: 'update-detail' }),
  route('contract-detail', undefined, { required: false, dynamic: true, discoveryKey: 'contract-detail' }),
  route('party-detail', undefined, { required: false, dynamic: true, discoveryKey: 'party-detail' }),
  route('namespace-detail', undefined, { required: false, dynamic: true, discoveryKey: 'namespace-detail' }),
  route('package-family', undefined, { required: false, dynamic: true, discoveryKey: 'package-family' }),
  route('package-detail', undefined, { required: false, dynamic: true, discoveryKey: 'package-detail' }),
  route('token-detail', undefined, { required: false, dynamic: true, discoveryKey: 'token-detail' }),
  route('token-transfer-detail', undefined, { required: false, dynamic: true, discoveryKey: 'token-transfer-detail' }),
  route('debugger', undefined, { required: false, dynamic: true, discoveryKey: 'debugger' }),
  route('legacy-update-redirect', undefined, { required: false, dynamic: true, discoveryKey: 'legacy-update-redirect' }),
  route('party-detail-updates', undefined, {
    required: false,
    dynamic: true,
    discoveryKey: 'party-detail',
    view: 'updates',
    states: withFilterState('party-detail-updates', FILTER_STATES['party-detail-updates']),
  }),
  route('party-detail-contracts', undefined, {
    required: false,
    dynamic: true,
    discoveryKey: 'party-detail',
    view: 'contracts',
    states: withFilterState('party-detail-contracts', FILTER_STATES['party-detail-contracts']),
  }),
  route('tokens-known', '/tokens', {
    required: false,
    view: 'known',
    states: withFilterState('tokens-known', FILTER_STATES['tokens-known']),
  }),
  route('tokens-transfers', '/tokens', {
    required: false,
    view: 'transfers',
    states: withFilterState('tokens-transfers', FILTER_STATES['tokens-transfers']),
  }),
  route('token-detail-transfers', undefined, {
    required: false,
    dynamic: true,
    discoveryKey: 'token-detail',
    view: 'transfers',
    states: withFilterState('token-detail-transfers', FILTER_STATES['token-detail-transfers']),
  }),
];

export const DEFAULT_CONFIG = {
  baseUrl: 'http://localhost:46000',
  apiUrl: 'http://localhost:4600/api',
  output: 'screenshots',
  strict: false,
  headed: false,
  settleMs: 300,
  discovery: clone(DEFAULT_DISCOVERY),
  viewports: [{ name: 'desktop', width: 1440, height: 900 }],
  routes: DEFAULT_ROUTES,
};

export const defaultConfig = DEFAULT_CONFIG;

export function createDefaultConfig() {
  return clone(DEFAULT_CONFIG);
}

export function parseViewportSpec(spec) {
  if (typeof spec !== 'string' || !/^\d+x\d+$/.test(spec)) {
    throw new ScreenshotConfigError(`Invalid viewport ${spec}; expected positive WxH`);
  }
  const [width, height] = spec.split('x').map(Number);
  assertPositiveInteger(width, 'viewport width');
  assertPositiveInteger(height, 'viewport height');
  return { name: `custom-${spec}`, width, height };
}

function normalizeRoute(routeValue) {
  return {
    ...routeValue,
    required: routeValue.required ?? true,
    dynamic: routeValue.dynamic ?? false,
    readiness: { ...DEFAULT_READINESS, ...(routeValue.readiness ?? {}) },
    states: (routeValue.states ?? [{ name: 'default', actions: [] }]).map((state) => ({
      ...state,
      required: state.required ?? state.name === 'default',
      actions: state.actions ?? [],
    })),
  };
}

function normalizeConfig(config) {
  return {
    ...config,
    discovery: { ...DEFAULT_DISCOVERY, ...(config.discovery ?? {}) },
    viewports: config.viewports.map((viewport) => ({ ...viewport })),
    routes: config.routes.map(normalizeRoute),
  };
}

export function validateScreenshotConfig(input) {
  assertObject(input, 'config');
  const unknownKeys = Object.keys(input).filter((key) => !CONFIG_TOP_LEVEL_KEYS.includes(key));
  if (unknownKeys.length > 0) {
    throw new ScreenshotConfigError(`Unknown top-level config key: ${unknownKeys[0]}`);
  }
  assertNonEmptyString(input.baseUrl, 'baseUrl');
  assertNonEmptyString(input.apiUrl, 'apiUrl');
  assertNonEmptyString(input.output, 'output');
  if (typeof input.strict !== 'boolean') throw new ScreenshotConfigError('strict must be boolean');
  if (typeof input.headed !== 'boolean') throw new ScreenshotConfigError('headed must be boolean');
  assertPositiveInteger(input.settleMs, 'settleMs');
  assertObject(input.discovery, 'discovery');
  for (const key of Object.keys(DEFAULT_DISCOVERY)) {
    if (input.discovery[key] !== undefined) {
      if (!Number.isInteger(input.discovery[key]) || input.discovery[key] <= 0) {
        throw new ScreenshotConfigError(`discovery.${key} must be positive`);
      }
    }
  }

  if (!Array.isArray(input.viewports) || input.viewports.length === 0) {
    throw new ScreenshotConfigError('viewports must be a non-empty array');
  }
  const viewportNames = new Set();
  const viewportDimensions = new Set();
  input.viewports.forEach((viewport, index) => {
    const label = `viewports[${index}]`;
    assertObject(viewport, label);
    assertId(viewport.name, `${label}.name`);
    assertPositiveInteger(viewport.width, `${label}.width`);
    assertPositiveInteger(viewport.height, `${label}.height`);
    if (viewport.deviceScaleFactor !== undefined &&
        (typeof viewport.deviceScaleFactor !== 'number' || viewport.deviceScaleFactor <= 0)) {
      throw new ScreenshotConfigError(`${label}.deviceScaleFactor must be positive`);
    }
    if (viewportNames.has(viewport.name)) throw new ScreenshotConfigError(`Duplicate viewport name ${viewport.name}`);
    const dimensions = `${viewport.width}x${viewport.height}`;
    if (viewportDimensions.has(dimensions)) throw new ScreenshotConfigError(`Duplicate viewport dimensions ${dimensions}`);
    viewportNames.add(viewport.name);
    viewportDimensions.add(dimensions);
  });

  if (!Array.isArray(input.routes) || input.routes.length === 0) {
    throw new ScreenshotConfigError('routes must be a non-empty array');
  }
  const routeNames = new Set();
  const combinations = new Set();
  input.routes.forEach((routeValue, routeIndex) => {
    const routeLabel = `routes[${routeIndex}]`;
    assertObject(routeValue, routeLabel);
    assertId(routeValue.name, `${routeLabel}.name`);
    if (routeNames.has(routeValue.name)) throw new ScreenshotConfigError(`Duplicate route name ${routeValue.name}`);
    routeNames.add(routeValue.name);
    if (routeValue.path === undefined && routeValue.discoveryKey === undefined) {
      throw new ScreenshotConfigError(`${routeLabel} needs path or discoveryKey`);
    }
    if (routeValue.path !== undefined) assertNonEmptyString(routeValue.path, `${routeLabel}.path`);
    if (routeValue.discoveryKey !== undefined) assertNonEmptyString(routeValue.discoveryKey, `${routeLabel}.discoveryKey`);
    if (routeValue.required !== undefined && typeof routeValue.required !== 'boolean') {
      throw new ScreenshotConfigError(`${routeLabel}.required must be boolean`);
    }
    if (routeValue.dynamic !== undefined && typeof routeValue.dynamic !== 'boolean') {
      throw new ScreenshotConfigError(`${routeLabel}.dynamic must be boolean`);
    }
    if (routeValue.readiness !== undefined) {
      assertObject(routeValue.readiness, `${routeLabel}.readiness`);
      if (routeValue.readiness.timeoutMs !== undefined) assertPositiveInteger(routeValue.readiness.timeoutMs, `${routeLabel}.readiness.timeoutMs`);
      if (routeValue.readiness.settleMs !== undefined) assertPositiveInteger(routeValue.readiness.settleMs, `${routeLabel}.readiness.settleMs`);
    }
    if (!Array.isArray(routeValue.states) || routeValue.states.length === 0) throw new ScreenshotConfigError(`${routeLabel}.states must be non-empty`);
    const stateNames = new Set();
    routeValue.states.forEach((state, stateIndex) => {
      const stateLabel = `${routeLabel}.states[${stateIndex}]`;
      assertObject(state, stateLabel);
      assertId(state.name, `${stateLabel}.name`);
      if (stateNames.has(state.name)) throw new ScreenshotConfigError(`Duplicate state ${routeValue.name}--${state.name}`);
      stateNames.add(state.name);
      if (state.required !== undefined && typeof state.required !== 'boolean') throw new ScreenshotConfigError(`${stateLabel}.required must be boolean`);
      if (!Array.isArray(state.actions)) throw new ScreenshotConfigError(`${stateLabel}.actions must be an array`);
      state.actions.forEach((action, actionIndex) => validateAction(action, `${stateLabel}.actions[${actionIndex}]`));
      const combination = `${routeValue.name}--${state.name}`;
      if (combinations.has(combination)) throw new ScreenshotConfigError(`Duplicate route/state combination ${combination}`);
      combinations.add(combination);
    });
  });
  return true;
}

function mergeConfig(custom) {
  const unknownKeys = Object.keys(custom).filter((key) => !CONFIG_TOP_LEVEL_KEYS.includes(key));
  if (unknownKeys.length > 0) throw new ScreenshotConfigError(`Unknown top-level config key: ${unknownKeys[0]}`);
  const merged = { ...createDefaultConfig(), ...custom };
  merged.discovery = { ...DEFAULT_CONFIG.discovery, ...(custom.discovery ?? {}) };
  if (custom.viewports === undefined) merged.viewports = clone(DEFAULT_CONFIG.viewports);
  if (custom.routes === undefined) merged.routes = clone(DEFAULT_CONFIG.routes);
  return normalizeConfig(merged);
}

export async function loadScreenshotConfig(configPath, options = {}) {
  if (isObject(configPath) && configPath.configPath !== undefined) {
    options = configPath;
    configPath = options.configPath;
  }
  if (configPath === undefined && options.configPath !== undefined) configPath = options.configPath;
  let custom = {};
  if (configPath !== undefined && configPath !== null) {
    assertNonEmptyString(configPath, 'config path');
    const cwd = options.cwd ?? process.cwd();
    const absolutePath = path.resolve(cwd, configPath);
    const moduleUrl = `${pathToFileURL(absolutePath).href}?screenshotConfig=${Date.now()}-${Math.random()}`;
    const imported = await import(moduleUrl);
    if (!isObject(imported.default)) throw new ScreenshotConfigError('Custom config module must default-export an object');
    custom = imported.default;
  }
  const config = mergeConfig(custom);
  validateScreenshotConfig(config);
  return options.cliOptions ? applyCliFilters(config, options.cliOptions) : config;
}

export function captureId(routeValue, stateValue) {
  const routeName = typeof routeValue === 'string' ? routeValue : routeValue.name;
  const stateName = typeof stateValue === 'string' ? stateValue : stateValue.name;
  assertId(routeName, 'route name');
  assertId(stateName, 'state name');
  return stateName === 'default' ? routeName : `${routeName}--${stateName}`;
}

export function stableScreenshotName(routeName, stateName = 'default') {
  const id = captureId(routeName, stateName);
  return `${id}.png`;
}

export function stableScreenshotPath(output, viewportName, routeName, stateName = 'default') {
  assertNonEmptyString(output, 'output');
  assertId(viewportName, 'viewport name');
  return path.join(output, viewportName, stableScreenshotName(routeName, stateName));
}

export function applyCliFilters(inputConfig, options = {}) {
  const config = normalizeConfig(clone(inputConfig));
  const provided = options.provided ?? {};
  if (provided.baseUrl || (provided.baseUrl === undefined && options.baseUrl && options.baseUrl !== DEFAULT_CONFIG.baseUrl)) config.baseUrl = options.baseUrl;
  if (provided.apiUrl || (provided.apiUrl === undefined && options.apiUrl && options.apiUrl !== DEFAULT_CONFIG.apiUrl)) config.apiUrl = options.apiUrl;
  if (provided.output || (provided.output === undefined && options.output && options.output !== DEFAULT_CONFIG.output)) config.output = options.output;
  if (provided.strict || (provided.strict === undefined && options.strict === true)) config.strict = options.strict;
  if (provided.headed || (provided.headed === undefined && options.headed === true)) config.headed = options.headed;
  if (Array.isArray(options.viewports) && options.viewports.length > 0) config.viewports = clone(options.viewports);

  const selectors = options.routes ?? [];
  if (selectors.length > 0) {
    const selected = [];
    const selectedNames = new Set();
    for (const selector of selectors) {
      const direct = config.routes.find((candidate) => candidate.name === selector);
      if (direct) {
        if (selectedNames.has(direct.name)) throw new ScreenshotConfigError(`Duplicate route selection ${selector}`);
        selected.push(direct);
        selectedNames.add(direct.name);
        continue;
      }
      const separator = selector.lastIndexOf('--');
      const routeName = separator === -1 ? selector : selector.slice(0, separator);
      const stateName = separator === -1 ? undefined : selector.slice(separator + 2);
      const candidate = config.routes.find((item) => item.name === routeName);
      const state = candidate?.states.find((item) => item.name === stateName);
      if (!candidate || !state) throw new ScreenshotConfigError(`Unknown route or state selection ${selector}`);
      if (selectedNames.has(candidate.name)) throw new ScreenshotConfigError(`Duplicate route selection ${selector}`);
      selected.push({ ...candidate, states: [state] });
      selectedNames.add(candidate.name);
    }
    config.routes = selected;
  }
  validateScreenshotConfig(config);
  return config;
}

export const loadConfig = loadScreenshotConfig;
export const validateConfig = validateScreenshotConfig;
export const parseViewport = parseViewportSpec;
export const applyCliOptions = applyCliFilters;
export const getCaptureId = captureId;
export const getScreenshotFileName = stableScreenshotName;

export default DEFAULT_CONFIG;
