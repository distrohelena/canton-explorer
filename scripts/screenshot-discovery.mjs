import { createDefaultConfig } from './screenshot-config.mjs';

const DEFAULT_API_ORIGIN = 'http://localhost:4600';

export class ScreenshotDiscoveryError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'ScreenshotDiscoveryError';
    this.kind = options.kind;
  }
}

function asUrl(value) {
  if (value instanceof URL) return new URL(value.href);
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ScreenshotDiscoveryError('API base URL must be a non-empty URL');
  }
  try {
    return new URL(value, DEFAULT_API_ORIGIN);
  } catch (error) {
    throw new ScreenshotDiscoveryError(`Invalid API base URL: ${value}`, { cause: error });
  }
}

function normalizeApiPath(pathname) {
  const withoutTrailingSlash = pathname.replace(/\/+$/, '');
  const apiSuffix = /(?:\/api)+$/i;
  if (apiSuffix.test(withoutTrailingSlash)) {
    return withoutTrailingSlash.replace(apiSuffix, '/api') || '/api';
  }
  return `${withoutTrailingSlash || ''}/api`;
}

function ensureApiPath(pathname) {
  if (/(?:^|\/)api(?:\/|$)/i.test(pathname)) {
    return pathname.replace(/(?:\/api)+(?=\/|$)/gi, '/api');
  }
  return normalizeApiPath(pathname);
}

export function normalizeApiBaseUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ScreenshotDiscoveryError('API base URL must be a non-empty string');
  }
  const original = value;
  const isRelative = !/^[a-z][a-z\d+.-]*:/i.test(original);
  const url = asUrl(original);
  url.pathname = normalizeApiPath(url.pathname);
  if (isRelative) {
    return `${url.pathname}${url.search}${url.hash}`;
  }
  return url.href.replace(/\/$/, '');
}

function baseParts(value) {
  const normalized = normalizeApiBaseUrl(value);
  const isRelative = normalized.startsWith('/');
  const url = new URL(normalized, DEFAULT_API_ORIGIN);
  return { normalized, isRelative, url };
}

function stripLeadingApi(pathname) {
  return pathname.replace(/^\/api(?:\/|$)/i, '/');
}

export function apiUrlForPath(apiBaseUrl, pathValue) {
  const { normalized, isRelative, url: base } = baseParts(apiBaseUrl);
  const rawPath = pathValue instanceof URL ? pathValue.href : String(pathValue);
  let candidate;
  try {
    candidate = new URL(rawPath, base);
  } catch (error) {
    throw new ScreenshotDiscoveryError(`Invalid API path: ${rawPath}`, { cause: error });
  }

  if (/^[a-z][a-z\d+.-]*:/i.test(rawPath)) {
    candidate.pathname = ensureApiPath(candidate.pathname);
    return candidate.href.replace(/\/$/, '');
  }

  const pathOnly = rawPath.split(/[?#]/, 1)[0] || '/';
  const suffixPath = stripLeadingApi(pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`);
  const joined = `${base.pathname.replace(/\/$/, '')}${suffixPath === '/' ? '' : suffixPath}`;
  const output = new URL(joined || '/', base);
  output.search = rawPath.includes('?')
    ? `?${rawPath.split('?')[1].split('#', 1)[0]}`
    : '';
  output.hash = rawPath.includes('#') ? `#${rawPath.split('#')[1]}` : '';
  if (isRelative) {
    return `${output.pathname}${output.search}${output.hash}`;
  }
  return output.href;
}

function requestPathForError(pathValue) {
  if (pathValue instanceof URL) return `${pathValue.pathname}${pathValue.search}`;
  return String(pathValue);
}

function splitRequestOptions(options = {}) {
  const { fetchImpl, ...init } = options ?? {};
  return { fetchImpl: fetchImpl ?? globalThis.fetch, init };
}

export async function requestJson(apiBaseUrl, pathValue, options = {}) {
  const { fetchImpl, init } = splitRequestOptions(options);
  const endpointUrl = apiUrlForPath(apiBaseUrl, pathValue);
  const method = init.method ?? 'GET';
  if (typeof fetchImpl !== 'function') {
    throw new ScreenshotDiscoveryError(
      `${method} ${requestPathForError(pathValue)} failed for ${endpointUrl}: A fetch implementation is required`,
      { kind: 'transport' },
    );
  }
  let response;
  try {
    response = await fetchImpl(endpointUrl, init);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new ScreenshotDiscoveryError(
      `${method} ${requestPathForError(pathValue)} failed for ${endpointUrl}: ${reason}`,
      { cause: error, kind: 'transport' },
    );
  }
  if (!response?.ok) {
    const status = response?.status ?? 'unknown';
    const statusText = response?.statusText ? ` ${response.statusText}` : '';
    throw new ScreenshotDiscoveryError(
      `${method} ${requestPathForError(pathValue)} returned ${status}${statusText}`,
      { kind: 'http' },
    );
  }
  try {
    return await response.json();
  } catch (error) {
    throw new ScreenshotDiscoveryError(
      `${method} ${requestPathForError(pathValue)} returned invalid JSON`,
      { cause: error, kind: 'json' },
    );
  }
}

export function request(...args) {
  if (args.length === 1 && args[0] && typeof args[0] === 'object' && !(args[0] instanceof URL)) {
    const { apiUrl, apiBaseUrl, path, fetchImpl, ...options } = args[0];
    return requestJson(apiUrl ?? apiBaseUrl, path, { ...options, fetchImpl });
  }
  return requestJson(...args);
}

export const apiRequest = request;
export const fetchJson = requestJson;

const COLLECTION_KEYS = {
  nodes: ['nodes'],
  updates: ['updates'],
  contracts: ['contracts'],
  parties: ['nodes', 'parties'],
  fingerprints: ['fingerprints'],
  tokens: ['tokens'],
  transfers: ['transfers'],
  templates: ['templates'],
  purchases: ['purchases'],
  packagesByName: ['packagesByName'],
};

function collection(value, key) {
  if (Array.isArray(value)) return value;
  for (const candidate of COLLECTION_KEYS[key] ?? [key]) {
    if (Array.isArray(value?.[candidate])) return value[candidate];
  }
  return [];
}

function firstString(...values) {
  return values.find((value) => typeof value === 'string' && value.trim() !== '');
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim() !== ''))];
}

function routeLandmark(name) {
  if (name === 'search-results') return 'Search Results';
  if (name === 'debugger') return 'Debugger';
  return 'main';
}

function routeRecord({
  name,
  dedupeKey = name,
  url = null,
  source,
  required = false,
  dynamic = false,
  expectedPath,
  metadata = {},
  skipReason,
  validation = {},
  readiness = {},
  discoveryError = false,
}) {
  const landmark = validation.landmark ?? routeLandmark(name);
  const record = {
    name,
    dedupeKey,
    url,
    source,
    required,
    dynamic,
    expectedPath,
    expectedFinalPath: expectedPath,
    readiness: { landmark, ...readiness },
    validation: { finalPath: expectedPath, landmark, ...validation },
    metadata,
  };
  if (skipReason) record.skipReason = skipReason;
  if (discoveryError) record.discoveryError = true;
  return record;
}

function endpointError(error) {
  return error instanceof Error ? error.message : String(error);
}

function emptyReason(pathValue, key) {
  return `GET ${pathValue} returned an empty ${key} collection`;
}

function routePath(...segments) {
  return `/${segments.map((segment) => encodeURIComponent(String(segment))).join('/')}`;
}

function routeDedupeKey(route) {
  return JSON.stringify({ category: route.dedupeKey ?? route.name, url: route.url });
}

function addRouteRecord(routes, skips, route) {
  if (routes.some((candidate) => routeDedupeKey(candidate) === routeDedupeKey(route))) return false;
  routes.push(route);
  if (route.skipReason) skips.push({ name: route.name, source: route.source, reason: route.skipReason });
  return true;
}

function routeConfigByName(config) {
  return new Map((config?.routes ?? []).map((route) => [route.name, route]));
}

function isDynamicRouteConfig(route) {
  return route?.dynamic === true || (route?.path === undefined && route?.discoveryKey !== undefined);
}

function addUnavailableRouteRecord(routes, skips, options) {
  addRouteRecord(routes, skips, routeRecord({
    ...options,
    url: null,
    required: options.required ?? false,
    dynamic: true,
  }));
}

async function readEndpoint({ apiUrl, fetchImpl, path, key, errors, failures }) {
  try {
    const value = await requestJson(apiUrl, path, { fetchImpl });
    return { value, records: collection(value, key) };
  } catch (error) {
    if (error?.kind === 'transport') throw error;
    errors[key] = endpointError(error);
    failures[key] = true;
    return { value: null, records: null };
  }
}

function flattenParties(value) {
  const nodes = collection(value, 'parties');
  return uniqueStrings(nodes.flatMap((entry) => {
    if (typeof entry === 'string') return [entry];
    return Array.isArray(entry?.parties) ? entry.parties : [entry?.partyId];
  }));
}

function firstPackage(packageResponses) {
  for (const response of packageResponses) {
    for (const family of collection(response.value, 'packagesByName')) {
      const pkg = Array.isArray(family?.packages) ? family.packages[0] : null;
      const packageId = firstString(pkg?.packageId);
      const packageName = firstString(family?.packageName, pkg?.packageName);
      if (packageId || packageName) {
        return { packageId, packageName, nodeId: response.nodeId };
      }
    }
  }
  return null;
}

function routeFromConfig(config, name, url) {
  const configured = routeConfigByName(config).get(name);
  return routeRecord({
    name,
    url,
    source: 'config',
    required: configured?.required ?? true,
    dynamic: false,
    expectedPath: url,
    readiness: configured?.readiness,
  });
}

export async function discoverScreenshotManifest(options = {}) {
  const config = options.config ?? createDefaultConfig();
  const apiUrl = normalizeApiBaseUrl(options.apiUrl ?? config.apiUrl);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const errors = {};
  const failures = {};
  const skips = [];
  const routes = [];
  const configuredRoutes = routeConfigByName(config);
  const configuredNames = new Set((config.routes ?? []).map((route) => route.name));
  const configuredKeys = new Set((config.routes ?? []).map((route) => route.discoveryKey).filter(Boolean));
  const routeIsConfigured = (name, discoveryKey = name) =>
    configuredNames.has(name) || configuredKeys.has(discoveryKey);
  const routeShouldEmit = (name) => configuredNames.has(name);
  const configuredNodeDetailOrdinals = [...configuredNames]
    .map((name) => /^node-detail-(\d+)$/.exec(name))
    .filter(Boolean)
    .map((match) => Number(match[1]))
    .filter((ordinal) => Number.isInteger(ordinal) && ordinal > 0)
    .sort((left, right) => left - right);
  const addRoute = (...args) => {
    const route = args.length === 1 ? args[0] : args[2];
    if (!routeShouldEmit(route.name)) return false;
    const configured = configuredRoutes.get(route.name);
    const generated = isDynamicRouteConfig(configured)
      ? { ...route, required: configured.required ?? false, dynamic: true }
      : route;
    return addRouteRecord(routes, skips, generated);
  };
  const addUnavailableRoute = (...args) => {
    const routeOptions = args.length === 1 ? args[0] : args[2];
    if (!routeShouldEmit(routeOptions.name)) return false;
    const discoveryError = routeOptions.discoveryError ?? Object.values(errors).includes(routeOptions.skipReason);
    const configured = configuredRoutes.get(routeOptions.name);
    const generated = isDynamicRouteConfig(configured)
      ? { ...routeOptions, required: configured.required ?? false, dynamic: true }
      : routeOptions;
    return addUnavailableRouteRecord(routes, skips, { ...generated, discoveryError });
  };
  const wants = (name, discoveryKey = name) => routeIsConfigured(name, discoveryKey);
  const configuredActions = (config.routes ?? []).flatMap((route) =>
    (route.states ?? []).flatMap((state) => state.actions ?? []));
  const actionValues = new Set(configuredActions.flatMap((action) =>
    [action.valueFrom, action.labelFrom].filter(Boolean)));
  const needs = {
    nodes: wants('nodes') || wants('node-detail-01', 'node-detail') || wants('update-detail') ||
      wants('contract-detail') || wants('package-family') || wants('package-detail') || wants('traffic') ||
      actionValues.has('nodeId') || actionValues.has('nodes'),
    updates: wants('update-detail') || wants('debugger') || wants('legacy-update-redirect') || wants('search') ||
      actionValues.has('updateId'),
    contracts: wants('contract-detail'),
    parties: wants('parties') || wants('party-detail', 'party-detail') || wants('search') || actionValues.has('party'),
    fingerprints: wants('namespace-detail') || actionValues.has('publicKey') || actionValues.has('namespace'),
    tokens: wants('token-detail', 'token-detail') || actionValues.has('tokenId') || actionValues.has('tokenName') || actionValues.has('issuer'),
    transfers: wants('token-transfer-detail') || actionValues.has('transferId'),
    templates: actionValues.has('template'),
    traffic: wants('traffic') || actionValues.has('trafficNodeIds'),
  };
  const needsPackages = wants('package-family') || wants('package-detail');
  const readEndpointIfNeeded = (needed, endpoint) => needed
    ? readEndpoint({ ...endpoint, errors, failures })
    : Promise.resolve({ value: null, records: null });
  for (const configured of config.routes ?? []) {
    if (configured.dynamic || configured.path === undefined) continue;
    addRoute(routes, skips, routeFromConfig(config, configured.name, configured.path));
  }

  const nodesResult = await readEndpointIfNeeded(needs.nodes, { apiUrl, fetchImpl, path: '/nodes', key: 'nodes' });
  const updateResult = await readEndpointIfNeeded(needs.updates, { apiUrl, fetchImpl, path: '/updates?limit=1', key: 'updates' });
  const contractResult = await readEndpointIfNeeded(needs.contracts, { apiUrl, fetchImpl, path: '/contracts?limit=1', key: 'contracts' });
  const partiesResult = await readEndpointIfNeeded(needs.parties, { apiUrl, fetchImpl, path: '/parties', key: 'parties' });
  const fingerprintResult = await readEndpointIfNeeded(needs.fingerprints, {
    apiUrl,
    fetchImpl,
    path: '/parties/fingerprints?limit=1',
    key: 'fingerprints',
  });
  const tokenResult = await readEndpointIfNeeded(needs.tokens, { apiUrl, fetchImpl, path: '/tokens?limit=1', key: 'tokens' });
  const transferResult = await readEndpointIfNeeded(needs.transfers, {
    apiUrl,
    fetchImpl,
    path: '/tokens/transfers?limit=1',
    key: 'transfers',
  });
  const templateResult = await readEndpointIfNeeded(needs.templates, { apiUrl, fetchImpl, path: '/templates', key: 'templates' });
  const trafficResult = await readEndpointIfNeeded(needs.traffic, {
    apiUrl,
    fetchImpl,
    path: '/traffic-purchases?limit=1',
    key: 'purchases',
  });

  const configuredMaxNodes = config.discovery?.maxNodes;
  const nodeRecords = nodesResult.records ?? [];
  const contextNodes = nodeRecords.flatMap((node) => {
    const id = firstString(node?.id, node?.nodeId);
    if (!id) return [];
    return [{ id, label: firstString(node?.label, node?.name, id) }];
  });
  const nodes = Number.isInteger(configuredMaxNodes) && configuredMaxNodes > 0
    ? nodeRecords.slice(0, configuredMaxNodes)
    : nodeRecords;
  const packageResults = [];
  for (const node of nodes) {
    const nodeId = firstString(node?.id, node?.nodeId);
    if (!nodeId) continue;
    const path = `/nodes/${encodeURIComponent(nodeId)}/packages`;
    const result = await readEndpointIfNeeded(needsPackages, {
      apiUrl,
      fetchImpl,
      path,
      key: 'packagesByName',
    });
    packageResults.push({ ...result, nodeId, path });
  }

  const updates = updateResult.records ?? [];
  const update = updates.find((candidate) =>
    firstString(candidate?.nodeId) && firstString(candidate?.eventOffset) && firstString(candidate?.updateId));
  const contract = (contractResult.records ?? []).find((candidate) =>
    firstString(candidate?.contractId));
  const party = flattenParties(partiesResult.value)[0];
  const namespaceId = firstString((fingerprintResult.records ?? [])[0]);
  const token = (tokenResult.records ?? []).find((candidate) => firstString(candidate?.tokenId));
  const transfer = (transferResult.records ?? []).find((candidate) => firstString(candidate?.updateId));
  const trafficPurchases = trafficResult.records ?? [];
  const trafficCurrent = Array.isArray(trafficResult.value?.current) ? trafficResult.value.current : [];
  const trafficNodeIds = uniqueStrings([
    ...trafficPurchases.map((purchase) => purchase?.nodeId),
    ...trafficCurrent.map((entry) => entry?.nodeId),
  ]);
  const packageContext = firstPackage(packageResults);
  const template = (templateResult.records ?? []).find((candidate) => firstString(candidate?.templateId));

  const context = {
    ...(firstString(update?.nodeId, nodes[0]?.id, nodes[0]?.nodeId)
      ? { nodeId: firstString(update?.nodeId, nodes[0]?.id, nodes[0]?.nodeId) }
      : {}),
    ...(firstString(update?.eventOffset) ? { eventOffset: update.eventOffset } : {}),
    ...(firstString(update?.updateId) ? { updateId: update.updateId } : {}),
    ...(firstString(contract?.contractId) ? { contractId: contract.contractId } : {}),
    ...(party ? { party } : {}),
    ...(namespaceId ? { namespaceId, publicKey: namespaceId } : {}),
    ...(firstString(token?.tokenId) ? { tokenId: token.tokenId } : {}),
    ...(firstString(token?.issuer) ? { issuer: token.issuer } : {}),
    ...(firstString(token?.name, token?.tokenName) ? { tokenName: firstString(token?.name, token?.tokenName) } : {}),
    ...(firstString(transfer?.updateId) ? { transferId: transfer.updateId, transferUpdateId: transfer.updateId } : {}),
    ...(packageContext?.packageId ? { packageId: packageContext.packageId } : {}),
    ...(packageContext?.packageName ? { packageName: packageContext.packageName } : {}),
    ...(template?.templateId ? { template: template.templateId } : {}),
    nodes: contextNodes,
    trafficNodeIds,
    discoveryErrors: errors,
    discoveryFailures: failures,
  };

  const nodeForUpdate = firstString(update?.nodeId, context.nodeId);
  let nodeOrdinal = 0;
  const seenNodeUrls = new Set();
  for (const node of nodes) {
    const nodeId = firstString(node?.id, node?.nodeId);
    if (!nodeId) continue;
    const url = routePath('nodes', nodeId);
    const routeName = `node-detail-${String(nodeOrdinal + 1).padStart(2, '0')}`;
    const route = routeRecord({
      name: routeName,
      dedupeKey: 'node-detail',
      url,
      source: '/nodes',
      expectedPath: url,
      metadata: { nodeId },
    });
    const duplicate = seenNodeUrls.has(url);
    seenNodeUrls.add(url);
    const retained = addRoute(routes, skips, route);
    if (retained || (!routeShouldEmit(routeName) && !duplicate)) nodeOrdinal += 1;
  }
  const skipReason = errors.nodes ?? (nodes.length === 0
    ? emptyReason('/nodes', 'nodes')
    : `Only ${nodes.length} node${nodes.length === 1 ? '' : 's'} discovered; requested node-detail ordinal is unavailable`);
  for (const ordinal of configuredNodeDetailOrdinals) {
    if (ordinal <= nodeOrdinal) continue;
    const routeName = `node-detail-${String(ordinal).padStart(2, '0')}`;
    addUnavailableRoute(routes, skips, {
      name: routeName,
      dedupeKey: routeName,
      source: '/nodes',
      expectedPath: '/nodes/:id',
      skipReason,
    });
  }

  if (update) {
    const updateUrl = routePath('nodes', nodeForUpdate, 'updates', update.eventOffset);
    addRoute(routes, skips, routeRecord({
      name: 'update-detail',
      url: updateUrl,
      source: '/updates?limit=1',
      expectedPath: updateUrl,
      metadata: { nodeId: update.nodeId, eventOffset: update.eventOffset, updateId: update.updateId },
    }));
    addRoute(routes, skips, routeRecord({
      name: 'legacy-update-redirect',
      url: routePath('tx', update.updateId),
      source: '/updates?limit=1',
      expectedPath: updateUrl,
      metadata: { updateId: update.updateId, finalPath: updateUrl },
    }));
    addRoute(routes, skips, routeRecord({
      name: 'debugger',
      url: `/debugger?updateId=${encodeURIComponent(update.updateId)}`,
      source: '/updates?limit=1',
      expectedPath: `/debugger?updateId=${encodeURIComponent(update.updateId)}`,
      validation: { landmark: 'Debugger', sessionRequired: true },
      metadata: { updateId: update.updateId },
    }));
  } else {
    const reason = errors.updates ?? emptyReason('/updates?limit=1', 'updates');
    addUnavailableRoute(routes, skips, {
      name: 'update-detail',
      source: '/updates?limit=1',
      expectedPath: '/nodes/:nodeId/updates/:eventOffset',
      skipReason: reason,
    });
    addUnavailableRoute(routes, skips, {
      name: 'debugger',
      source: '/updates?limit=1',
      expectedPath: '/debugger?updateId=:updateId',
      validation: { landmark: 'Debugger', sessionRequired: true },
      skipReason: reason,
    });
  }

  const contractNodeId = firstString(contract?.nodeId, context.nodeId);
  if (contract && contractNodeId) {
    const url = routePath('nodes', contractNodeId, 'contracts', contract.contractId);
    addRoute(routes, skips, routeRecord({
      name: 'contract-detail',
      url,
      source: '/contracts?limit=1',
      expectedPath: url,
      metadata: { nodeId: contractNodeId, contractId: contract.contractId, template: contract.templateId },
    }));
  } else {
    addUnavailableRoute(routes, skips, {
      name: 'contract-detail',
      source: '/contracts?limit=1',
      expectedPath: '/nodes/:nodeId/contracts/:contractId',
      skipReason: errors.contracts ?? emptyReason('/contracts?limit=1', 'contracts'),
    });
  }

  if (party) {
    const url = routePath('parties', party);
    addRoute(routes, skips, routeRecord({ name: 'party-detail', url, source: '/parties', expectedPath: url, metadata: { party } }));
    addRoute(routes, skips, routeRecord({
      name: 'party-detail-updates',
      url,
      source: '/parties',
      expectedPath: url,
      metadata: { party, view: 'updates' },
    }));
    addRoute(routes, skips, routeRecord({
      name: 'party-detail-contracts',
      url,
      source: '/parties',
      expectedPath: url,
      metadata: { party, view: 'contracts' },
    }));
  } else {
    const reason = errors.parties ?? emptyReason('/parties', 'parties');
    for (const name of ['party-detail', 'party-detail-updates', 'party-detail-contracts']) {
      addUnavailableRoute(routes, skips, { name, source: '/parties', expectedPath: '/parties/:partyId', skipReason: reason });
    }
  }

  if (namespaceId) {
    const url = routePath('namespaces', namespaceId);
    addRoute(routes, skips, routeRecord({ name: 'namespace-detail', url, source: '/parties/fingerprints?limit=1', expectedPath: url, metadata: { namespaceId, publicKey: namespaceId } }));
  } else {
    addUnavailableRoute(routes, skips, {
      name: 'namespace-detail',
      source: '/parties/fingerprints?limit=1',
      expectedPath: '/namespaces/:namespaceId',
      skipReason: errors.fingerprints ?? emptyReason('/parties/fingerprints?limit=1', 'fingerprints'),
    });
  }

  if (token) {
    const url = routePath('tokens', token.tokenId);
    addRoute(routes, skips, routeRecord({ name: 'token-detail', url, source: '/tokens?limit=1', expectedPath: url, metadata: { tokenId: token.tokenId, issuer: token.issuer, tokenName: token.name } }));
    addRoute(routes, skips, routeRecord({ name: 'token-detail-transfers', url, source: '/tokens?limit=1', expectedPath: url, metadata: { tokenId: token.tokenId, issuer: token.issuer, tokenName: token.name, view: 'transfers' } }));
  } else {
    addUnavailableRoute(routes, skips, { name: 'token-detail', source: '/tokens?limit=1', expectedPath: '/tokens/:tokenId', skipReason: errors.tokens ?? emptyReason('/tokens?limit=1', 'tokens') });
    addUnavailableRoute(routes, skips, { name: 'token-detail-transfers', source: '/tokens?limit=1', expectedPath: '/tokens/:tokenId', skipReason: errors.tokens ?? emptyReason('/tokens?limit=1', 'tokens') });
  }

  if (transfer) {
    const url = routePath('tokens', 'transfers', transfer.updateId);
    addRoute(routes, skips, routeRecord({ name: 'token-transfer-detail', url, source: '/tokens/transfers?limit=1', expectedPath: url, metadata: { transferId: transfer.updateId, updateId: transfer.updateId, nodeId: transfer.nodes?.[0]?.nodeId, eventOffset: transfer.nodes?.[0]?.eventOffset } }));
  } else {
    addUnavailableRoute(routes, skips, { name: 'token-transfer-detail', source: '/tokens/transfers?limit=1', expectedPath: '/tokens/transfers/:updateId', skipReason: errors.transfers ?? emptyReason('/tokens/transfers?limit=1', 'transfers') });
  }

  if (packageContext) {
    if (packageContext.packageName) {
      const url = routePath('packages', 'by-name', packageContext.packageName);
      addRoute(routes, skips, routeRecord({ name: 'package-family', url, source: packageResults.find((item) => item.nodeId === packageContext.nodeId)?.path ?? '/nodes/:id/packages', expectedPath: url, metadata: { packageName: packageContext.packageName, nodeId: packageContext.nodeId } }));
    }
    if (packageContext.packageId) {
      const url = routePath('packages', packageContext.packageId);
      addRoute(routes, skips, routeRecord({ name: 'package-detail', url, source: packageResults.find((item) => item.nodeId === packageContext.nodeId)?.path ?? '/nodes/:id/packages', expectedPath: url, metadata: { packageId: packageContext.packageId, nodeId: packageContext.nodeId } }));
    }
    if (!packageContext.packageName) {
      addUnavailableRoute(routes, skips, {
        name: 'package-family',
        source: '/nodes/:id/packages',
        expectedPath: '/packages/by-name/:packageName',
        skipReason: 'Discovered package has no package name',
      });
    }
    if (!packageContext.packageId) {
      addUnavailableRoute(routes, skips, {
        name: 'package-detail',
        source: '/nodes/:id/packages',
        expectedPath: '/packages/:packageId',
        skipReason: 'Discovered package has no package ID',
      });
    }
  } else {
    const packageError = Object.entries(errors).find(([key]) => key === 'packagesByName')?.[1];
    const reason = packageError ?? (packageResults.length > 0
      ? emptyReason(packageResults[0].path, 'packagesByName')
      : 'No discovered node for package lookup');
    addUnavailableRoute(routes, skips, { name: 'package-family', source: '/nodes/:id/packages', expectedPath: '/packages/by-name/:packageName', skipReason: reason });
    addUnavailableRoute(routes, skips, { name: 'package-detail', source: '/nodes/:id/packages', expectedPath: '/packages/:packageId', skipReason: reason });
  }

  const searchValue = party ?? context.updateId;
  if (searchValue) {
    const url = `/search?q=${encodeURIComponent(searchValue)}`;
    addRoute(routes, skips, routeRecord({
      name: 'search-results',
      url,
      source: party ? '/parties' : '/updates?limit=1',
      expectedPath: '/search',
      validation: {
        heading: 'Search Results',
        states: ['.search-results-group', '.search-results-view__empty'],
      },
      metadata: { query: searchValue },
    }));
  } else {
    const reason = errors.parties ?? errors.updates ?? 'No discovered party or update ID for search query';
    addUnavailableRoute(routes, skips, {
      name: 'search-results',
      source: '/parties',
      expectedPath: '/search',
      validation: {
        heading: 'Search Results',
        states: ['.search-results-group', '.search-results-view__empty'],
      },
      skipReason: reason,
    });
  }

  const trafficRoute = routes.find((route) => route.name === 'traffic');
  if (trafficRoute) {
    trafficRoute.metadata = { ...trafficRoute.metadata, nodeIds: trafficNodeIds };
  }

  return {
    generatedAt: new Date().toISOString(),
    apiUrl,
    context,
    routes,
    skips,
  };
}

export const discoverRoutes = discoverScreenshotManifest;
export const discoverScreenshotRoutes = discoverScreenshotManifest;
export const buildScreenshotManifest = discoverScreenshotManifest;

export default discoverScreenshotManifest;
