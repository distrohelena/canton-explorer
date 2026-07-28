const ACTION_KINDS = new Set(['click', 'fill', 'select', 'check', 'waitFor']);

export class ActionExecutionError extends Error {
  constructor(message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'ActionExecutionError';
    this.code = options.code ?? 'action';
    this.kind = options.kind ?? 'action';
    this.action = options.action;
    this.metadata = { ...(options.metadata ?? {}) };
    if (options.valueFrom !== undefined) this.valueFrom = options.valueFrom;
    if (options.count !== undefined) this.count = options.count;
    if (options.target !== undefined) this.target = options.target;
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function quoteAttribute(value) {
  return JSON.stringify(String(value));
}

function attributeSelector(attribute, value) {
  return `[${attribute}=${quoteAttribute(value)}]`;
}

function normalizeOptions(options = {}) {
  if (!isObject(options)) return { discoveryContext: {}, metadata: {}, required: undefined };
  const hasOptionsShape = Object.hasOwn(options, 'discoveryContext') || Object.hasOwn(options, 'metadata');
  if (hasOptionsShape) {
    return {
      discoveryContext: options.discoveryContext ?? {},
      metadata: options.metadata ?? {},
      required: options.required,
    };
  }
  return {
    discoveryContext: {},
    metadata: options,
    required: undefined,
  };
}

function actionMetadata(action, options) {
  const metadata = { ...options.metadata };
  if (metadata.selector === undefined && action?.selector !== undefined) {
    metadata.selector = action.selector;
  }
  if (metadata.panel === undefined) {
    const scope = isObject(action.scope) ? action.scope : null;
    const panel = scope?.id ?? scope?.ariaControls ?? scope?.['aria-controls'] ??
      (typeof action.scope === 'string' ? action.scope : undefined) ?? action.controls;
    if (panel !== undefined) metadata.panel = panel;
  }
  return metadata;
}

function actionError(message, action, options, errorOptions = {}) {
  return new ActionExecutionError(message, {
    ...errorOptions,
    action,
    metadata: actionMetadata(action, options),
  });
}

function selectorError(message, action, options, selector, cause) {
  const error = actionError(message, action, options, {
    code: 'invalid-selector',
    kind: 'invalid-selector',
    cause,
  });
  error.metadata.selector = selector;
  return error;
}

function selectorLocator(root, selector, action, options, description = `selector ${selector}`) {
  try {
    return root.locator(selector);
  } catch (error) {
    throw selectorError(`Could not resolve ${description}: ${error.message}`, action, options, selector, error);
  }
}

function isOptionalAction(action, options) {
  return action?.optional === true || action?.required === false ||
    options.required === false || options.metadata.required === false || options.metadata.optional === true;
}

function missingTarget(action, description, count = 0) {
  return {
    description,
    count,
    kind: action?.kind,
    ...(action?.role === undefined ? {} : { role: action.role }),
    ...(action?.name === undefined ? {} : { name: action.name }),
    ...(action?.label === undefined ? {} : { label: action.label }),
    ...(action?.labelFrom === undefined ? {} : { labelFrom: action.labelFrom }),
    ...(action?.placeholder === undefined ? {} : { placeholder: action.placeholder }),
    ...(action?.selector === undefined ? {} : { selector: action.selector }),
    ...(action?.scope === undefined ? {} : { scope: action.scope }),
  };
}

function ensureAction(action) {
  if (!isObject(action) || !ACTION_KINDS.has(action.kind)) {
    throw new ActionExecutionError(`Unsupported screenshot action kind ${action?.kind ?? '<missing>'}`, {
      code: 'invalid-action',
      action,
      metadata: {},
    });
  }
}

async function count(locator) {
  try {
    return await locator.count();
  } catch (error) {
    throw error;
  }
}

async function requireUnique(locator, action, options, description) {
  let matches;
  try {
    matches = await count(locator);
  } catch (error) {
    throw selectorError(`Could not resolve ${description}: ${error.message}`, action, options, action.selector, error);
  }
  if (matches === 0) {
    throw actionError(`Could not find ${description}`, action, options, {
      code: 'missing-control',
      kind: isOptionalAction(action, options) ? 'optional-skip' : 'action',
      count: matches,
      target: missingTarget(action, description, matches),
    });
  }
  if (matches !== 1) {
    throw actionError(`Expected one ${description}, found ${matches}`, action, options, {
      code: 'ambiguous-control',
      count: matches,
    });
  }
  return locator;
}

async function tryCount(locator) {
  try {
    return await locator.count();
  } catch {
    return 0;
  }
}

async function resolveScope(root, scope, action, options) {
  if (scope === undefined) return root;

  if (typeof scope === 'string') {
    const idLocator = root.locator(attributeSelector('id', scope));
    if (await tryCount(idLocator) > 0) return requireUnique(idLocator, action, options, `scope #${scope}`);
    const regionLocator = root.getByRole('region', { name: scope, exact: true });
    return requireUnique(regionLocator, action, options, `region ${scope}`);
  }

  if (!isObject(scope)) {
    throw actionError('Action scope must be a string or object', action, options, { code: 'invalid-scope' });
  }

  const id = scope.id;
  if (id !== undefined) {
    return requireUnique(root.locator(attributeSelector('id', id)), action, options, `scope #${id}`);
  }

  const ariaControls = scope.ariaControls ?? scope['aria-controls'];
  if (ariaControls !== undefined) {
    const controlledPanel = root.locator(attributeSelector('id', ariaControls));
    if (await tryCount(controlledPanel) > 0) {
      return requireUnique(controlledPanel, action, options, `aria-controls scope ${ariaControls}`);
    }
    return requireUnique(
      root.locator(attributeSelector('aria-controls', ariaControls)),
      action,
      options,
      `aria-controls scope ${ariaControls}`,
    );
  }

  const regionName = scope.regionName ?? scope.region;
  if (regionName !== undefined) {
    return requireUnique(
      root.getByRole('region', { name: regionName, exact: true }),
      action,
      options,
      `region ${regionName}`,
    );
  }

  if (scope.selector !== undefined) {
    return requireUnique(
      selectorLocator(root, scope.selector, action, options, `scope selector ${scope.selector}`),
      action,
      options,
      `scope selector ${scope.selector}`,
    );
  }

  if (scope.role !== undefined || scope.name !== undefined) {
    if (scope.role === undefined || scope.name === undefined) {
      throw actionError('Accessible scope requires both role and name', action, options, { code: 'invalid-scope' });
    }
    return requireUnique(
      root.getByRole(scope.role, { name: scope.name, exact: true }),
      action,
      options,
      `${scope.role} ${scope.name}`,
    );
  }

  throw actionError('Action scope does not identify a target', action, options, { code: 'invalid-scope' });
}

function exactRoleLocator(root, action, options) {
  if (typeof action.role !== 'string' || action.role.trim() === '' ||
      typeof action.name !== 'string' || action.name.trim() === '') {
    throw actionError('Click actions require role and name', action, options, {
      code: 'invalid-action',
    });
  }
  return root.getByRole(action.role, { name: action.name, exact: true });
}

async function resolveClickLocator(root, action, options) {
  const scopeRoot = await resolveScope(root, action.scope, action, options);
  let locator = exactRoleLocator(scopeRoot, action, options);
  if (action.controls !== undefined) {
    locator = locator.and(root.locator(attributeSelector('aria-controls', action.controls)));
  }
  if (action.selector !== undefined) {
    locator = locator.and(selectorLocator(root, action.selector, action, options));
  }
  return requireUnique(locator, action, options, `${action.role} ${action.name}`);
}

async function resolveFieldLocator(root, action, options) {
  const scopeRoot = await resolveScope(root, action.scope, action, options);
  const lookups = [];
  if (action.label !== undefined) {
    lookups.push({ locator: scopeRoot.getByLabel(action.label, { exact: true }), description: `label ${action.label}` });
  }
  if (action.placeholder !== undefined) {
    lookups.push({ locator: scopeRoot.getByPlaceholder(action.placeholder, { exact: true }), description: `placeholder ${action.placeholder}` });
  }
  if (action.selector !== undefined) {
    lookups.push({
      locator: selectorLocator(scopeRoot, action.selector, action, options),
      description: `selector ${action.selector}`,
      selector: true,
    });
  }
  if (lookups.length === 0) {
    throw actionError('Field actions require label, placeholder, or selector', action, options, {
      code: 'invalid-action',
    });
  }

  for (const lookup of lookups) {
    let matches;
    try {
      matches = lookup.selector ? await count(lookup.locator) : await tryCount(lookup.locator);
    } catch (error) {
      throw selectorError(`Could not resolve ${lookup.description}: ${error.message}`, action, options, action.selector, error);
    }
    if (matches === 0) continue;
    return requireUnique(lookup.locator, action, options, lookup.description);
  }
  throw actionError(`Could not find field for ${lookups.map((lookup) => lookup.description).join(', ')}`, action, options, {
    code: 'missing-control',
    kind: isOptionalAction(action, options) ? 'optional-skip' : 'action',
    count: 0,
    target: missingTarget(action, lookups.map((lookup) => lookup.description).join(', '), 0),
  });
}

async function resolveWaitLocator(root, action, options) {
  if (typeof action.selector !== 'string' || action.selector.trim() === '') {
    throw actionError('waitFor actions require a selector', action, options, { code: 'invalid-action' });
  }
  return selectorLocator(root, action.selector, action, options);
}

export async function resolveActionLocator(pageOrLocator, action, options = {}) {
  const normalized = normalizeOptions(options);
  ensureAction(action);
  if (!pageOrLocator || typeof pageOrLocator.locator !== 'function') {
    throw actionError('A Playwright Page or Locator is required', action, normalized, { code: 'invalid-root' });
  }
  if (action.kind === 'click') return resolveClickLocator(pageOrLocator, action, normalized);
  if (action.kind === 'waitFor') return resolveWaitLocator(pageOrLocator, action, normalized);
  return resolveFieldLocator(pageOrLocator, action, normalized);
}

function valueIsMissing(value) {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
}

export function resolveActionValue(valueFrom, context = {}) {
  if (!isObject(context)) return undefined;
  if (!valueIsMissing(context[valueFrom])) return context[valueFrom];

  if (valueFrom === 'nodeId') {
    const node = context.nodes?.[0];
    return context.nodeIds?.[0] ?? node?.id ?? node?.nodeId;
  }
  if (valueFrom === 'nodes') return context.nodes ?? context.trafficNodeIds;
  if (valueFrom === 'trafficNodeIds') return context.trafficNodeIds ?? context.nodes;
  if (valueFrom === 'party') return context.party ?? context.partyId;
  if (valueFrom === 'template') return context.template ?? context.templateId;
  if (valueFrom === 'publicKey') return context.publicKey ?? context.namespaceId;
  if (valueFrom === 'namespace') return context.namespace ?? context.namespaceId ?? context.publicKey;
  if (valueFrom === 'issuer') return context.issuer;
  if (valueFrom === 'tokenName') return context.tokenName ?? context.name;
  if (valueFrom === 'updateId') return context.updateId ?? context.transferUpdateId;
  return undefined;
}

function actionValue(action, options) {
  if (action.valueFrom === undefined) return action.value;
  const value = resolveActionValue(action.valueFrom, options.discoveryContext);
  if (valueIsMissing(value)) {
    throw actionError(`Discovery context is missing ${action.valueFrom}`, action, options, {
      code: 'missing-value',
      kind: isOptionalAction(action, options) ? 'optional-skip' : 'action',
      valueFrom: action.valueFrom,
      target: missingTarget(action, `discovery context ${action.valueFrom}`, 0),
    });
  }
  if (typeof value === 'object') {
    throw actionError(`Discovery context value ${action.valueFrom} is not a scalar action value`, action, options, {
      code: 'invalid-value',
      valueFrom: action.valueFrom,
    });
  }
  return String(value);
}

function actionLabels(action, options) {
  const value = resolveActionValue(action.labelFrom, options.discoveryContext);
  if (valueIsMissing(value)) {
    throw actionError(`Discovery context is missing ${action.labelFrom}`, action, options, {
      code: 'missing-value',
      kind: isOptionalAction(action, options) ? 'optional-skip' : 'action',
      valueFrom: action.labelFrom,
      target: missingTarget(action, `discovery context ${action.labelFrom}`, 0),
    });
  }

  const entries = Array.isArray(value) ? value : [value];
  const nodes = Array.isArray(options.discoveryContext.nodes) ? options.discoveryContext.nodes : [];
  return entries.map((entry) => {
    const id = typeof entry === 'object' && entry !== null
      ? entry.id ?? entry.nodeId
      : entry;
    const matchingNode = nodes.find((node) => (node?.id ?? node?.nodeId) === id);
    return String(
      typeof entry === 'object' && entry !== null
        ? entry.label ?? entry.name ?? id
        : matchingNode?.label ?? entry,
    );
  });
}

async function perform(locator, operation, action, options, description) {
  try {
    return await operation(locator);
  } catch (error) {
    if (error instanceof ActionExecutionError) throw error;
    throw actionError(`Failed to ${description}: ${error.message}`, action, options, {
      code: 'action-failed',
      cause: error,
    });
  }
}

export async function executeClickAction(pageOrLocator, action, options = {}) {
  const normalized = normalizeOptions(options);
  const locator = await resolveActionLocator(pageOrLocator, action, normalized);
  return perform(locator, (target) => target.click(), action, normalized, 'click the target');
}

export async function executeFillAction(pageOrLocator, action, options = {}) {
  const normalized = normalizeOptions(options);
  const value = actionValue(action, normalized);
  const locator = await resolveActionLocator(pageOrLocator, action, normalized);
  return perform(locator, (target) => target.fill(value), action, normalized, 'fill the target');
}

export async function executeSelectAction(pageOrLocator, action, options = {}) {
  const normalized = normalizeOptions(options);
  const value = actionValue(action, normalized);
  const locator = await resolveActionLocator(pageOrLocator, action, normalized);
  return perform(locator, (target) => target.selectOption(value), action, normalized, 'select the target option');
}

export async function executeCheckAction(pageOrLocator, action, options = {}) {
  const normalized = normalizeOptions(options);
  if (action.labelFrom === undefined) {
    const locator = await resolveActionLocator(pageOrLocator, action, normalized);
    return perform(
      locator,
      (target) => action.checked ? target.check() : target.uncheck(),
      action,
      normalized,
      action.checked ? 'check the target' : 'uncheck the target',
    );
  }

  const results = [];
  for (const label of actionLabels(action, normalized)) {
    const labelAction = { ...action, label };
    delete labelAction.labelFrom;
    const locator = await resolveActionLocator(pageOrLocator, labelAction, normalized);
    results.push(await perform(
      locator,
      (target) => action.checked ? target.check() : target.uncheck(),
      labelAction,
      normalized,
      action.checked ? `check ${label}` : `uncheck ${label}`,
    ));
  }
  return results;
}

export async function executeWaitForAction(pageOrLocator, action, options = {}) {
  const normalized = normalizeOptions(options);
  const locator = await resolveActionLocator(pageOrLocator, action, normalized);
  try {
    await perform(
      locator,
      (target) => target.waitFor({ state: action.state ?? 'visible', timeout: action.timeoutMs }),
      action,
      normalized,
      'wait for the target',
    );
  } catch (error) {
    if (!isOptionalAction(action, normalized) || error.code !== 'action-failed') throw error;
    throw actionError(`Could not find selector ${action.selector}`, action, normalized, {
      code: 'missing-control',
      kind: 'optional-skip',
      target: missingTarget(action, `selector ${action.selector}`, 0),
    });
  }
  return requireUnique(locator, action, normalized, `selector ${action.selector}`);
}

export async function executeAction(pageOrLocator, action, options = {}) {
  ensureAction(action);
  switch (action.kind) {
    case 'click': return executeClickAction(pageOrLocator, action, options);
    case 'fill': return executeFillAction(pageOrLocator, action, options);
    case 'select': return executeSelectAction(pageOrLocator, action, options);
    case 'check': return executeCheckAction(pageOrLocator, action, options);
    case 'waitFor': return executeWaitForAction(pageOrLocator, action, options);
    default: throw new ActionExecutionError(`Unsupported screenshot action kind ${action.kind}`);
  }
}

export async function executeScreenshotActions(page, actions, options = {}) {
  if (!Array.isArray(actions)) {
    throw new ActionExecutionError('Screenshot actions must be an array', { code: 'invalid-actions' });
  }
  const normalized = normalizeOptions(options);
  for (const action of actions) {
    await executeAction(page, action, normalized);
  }
}

export default executeScreenshotActions;
