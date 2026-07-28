import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { chromium } from 'playwright';

import executeScreenshotActions from './screenshot-actions.mjs';
import {
  apiUrlForPath,
  discoverScreenshotManifest,
  normalizeApiBaseUrl,
} from './screenshot-discovery.mjs';
import {
  captureId,
  stableScreenshotName,
  stableScreenshotPath,
} from './screenshot-config.mjs';

export { normalizeApiBaseUrl };

const RETRY_DELAY_MS = 250;
const RESPONSE_DRAIN_TIMEOUT_MS = 5_000;
const CLEANUP_TIMEOUT_MS = 1_000;
const LOADING_QUIET_MS = 50;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_SETTLE_MS = 300;
const ERROR_STATE_SELECTOR = [
  '[role="alert"]',
  '[data-error]',
  '[data-error-state]',
  '.node-detail__message--error',
  '.dashboard__message--error',
  '.search-results-view__error',
  '.debugger-view__session-state--error',
  '.debugger-template-picker__state--error',
  '.monaco-surface__state--error',
  '.party-topology__state--error',
].join(', ');

export class ScreenshotRunnerError extends Error {
  constructor(message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'ScreenshotRunnerError';
    this.exitCode = options.exitCode;
    this.kind = options.kind;
    this.code = options.code;
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function asError(value) {
  return value instanceof Error ? value : new Error(String(value));
}

function errorMessage(value) {
  return asError(value).message;
}

function apiPath(urlValue) {
  const parsed = new URL(urlValue);
  return parsed.pathname;
}

function isApiRequest(urlValue) {
  const pathname = apiPath(urlValue);
  return pathname === '/api' || pathname.startsWith('/api/');
}

export function rewriteApiRequestUrl(requestUrl, configuredApiUrl) {
  const request = new URL(requestUrl);
  if (!isApiRequest(request.href)) return null;
  const normalized = normalizeApiBaseUrl(configuredApiUrl);
  const suffix = request.pathname.slice('/api'.length) || '/';
  return apiUrlForPath(normalized, `${suffix}${request.search}`);
}

export function createApiRouteHandler(configuredApiUrl) {
  return async (route) => {
    const request = route.request();
    const rewrittenUrl = rewriteApiRequestUrl(request.url(), configuredApiUrl);
    if (rewrittenUrl === null) {
      await route.continue();
      return;
    }
    const postData = typeof request.postDataBuffer === 'function'
      ? request.postDataBuffer()
      : request.postData();
    await route.continue({
      url: rewrittenUrl,
      method: request.method(),
      headers: request.headers(),
      ...(postData === null || postData === undefined ? {} : { postData }),
    });
  };
}

function timeoutFor(route) {
  return route?.readiness?.timeoutMs ?? route?.validation?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
}

function readinessValue(route, key) {
  return route?.readiness?.[key] ?? route?.validation?.[key];
}

async function waitForLocator(locator, timeoutMs) {
  await locator.waitFor({ state: 'visible', timeout: timeoutMs });
}

async function waitForLandmark(page, route, timeoutMs) {
  const heading = readinessValue(route, 'heading');
  const selector = readinessValue(route, 'selector');
  const landmark = readinessValue(route, 'landmark');
  if (heading) {
    await waitForLocator(page.getByRole('heading', { name: heading, exact: true }), timeoutMs);
    return;
  }
  if (selector) {
    await waitForLocator(page.locator(selector), timeoutMs);
    return;
  }
  if (landmark === 'main' || landmark === undefined) {
    await waitForLocator(page.locator('main'), timeoutMs);
    return;
  }
  if (/^[.#\[a-z]/i.test(landmark) && !/^[A-Z][^.#\[]*$/.test(landmark)) {
    await waitForLocator(page.locator(landmark), timeoutMs);
    return;
  }
  await waitForLocator(page.getByRole('heading', { name: landmark, exact: true }), timeoutMs);
}

export async function waitForLoadingToDisappear(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let quietSince = null;
  while (Date.now() < deadline) {
    const hasVisibleIndicator = await page.evaluate(() => {
      const visible = (element) => {
        const style = getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
      };
      const loading = [...document.querySelectorAll('body, body *')].some((element) => (
        /^Loading/i.test((element.textContent ?? '').trim()) && visible(element)
      ));
      const status = [...document.querySelectorAll('[aria-busy="true"], [role="status"][data-loading="true"], [role="status"][aria-label^="Loading" i]')]
        .some((element) => visible(element));
      return loading || status;
    });
    if (hasVisibleIndicator) {
      quietSince = null;
    } else if (quietSince === null) {
      quietSince = Date.now();
    } else if (Date.now() - quietSince >= LOADING_QUIET_MS) {
      return;
    }
    await delay(Math.min(25, Math.max(1, deadline - Date.now())));
  }
  throw new ScreenshotRunnerError('Loading indicators did not disappear before the readiness timeout', {
    kind: 'readiness',
  });
}

async function visibleCount(locator) {
  let count = 0;
  try {
    count = await locator.count();
  } catch {
    return 0;
  }
  let visible = 0;
  for (let index = 0; index < count; index += 1) {
    try {
      if (await locator.nth(index).isVisible()) visible += 1;
    } catch {
      // The page may remove a transient element while validation is running.
    }
  }
  return visible;
}

async function validatePage(page, route, expectedUrl, sessionIds, options = {}) {
  const actual = new URL(page.url());
  const expected = new URL(expectedUrl);
  const actualPath = `${actual.pathname}${actual.search}`;
  const expectedPath = `${expected.pathname}${expected.search}`;
  if (actual.pathname !== expected.pathname || (!options.allowQueryChanges && actual.search !== expected.search)) {
    throw new ScreenshotRunnerError(`Expected final path ${expectedPath}, got ${actualPath}`, {
      kind: 'validation',
      code: 'final-path',
    });
  }

  if (await visibleCount(page.locator(ERROR_STATE_SELECTOR)) > 0) {
    throw new ScreenshotRunnerError(`Route ${route.name} rendered an error state`, {
      kind: 'validation',
      code: 'error-state',
    });
  }

  const validation = route.validation ?? {};
  if (validation.heading && validation.heading !== readinessValue(route, 'heading')) {
    await waitForLocator(page.getByRole('heading', { name: validation.heading, exact: true }), timeoutFor(route));
  }
  const stateCandidates = validation.states ?? [];
  let hasValidationState = stateCandidates.length === 0;
  for (const state of stateCandidates) {
    let stateLocator = page.locator(state);
    if (await visibleCount(stateLocator) === 0) {
      stateLocator = page.locator(`[data-testid="${String(state).replaceAll('"', '\\"')}"]`);
    }
    if (await visibleCount(stateLocator) === 0) {
      stateLocator = page.locator(`#${String(state).replaceAll('"', '\\"')}`);
    }
    if (await visibleCount(stateLocator) > 0) hasValidationState = true;
  }
  if (!hasValidationState) {
    throw new ScreenshotRunnerError(`Route ${route.name} is missing validation state alternatives`, {
      kind: 'validation',
      code: 'content-state',
    });
  }
  if (validation.sessionRequired && sessionIds.length === 0) {
    throw new ScreenshotRunnerError(`Route ${route.name} did not create a debugger session`, {
      kind: 'validation',
      code: 'missing-session',
    });
  }
}

export async function waitForReadiness(page, route, expectedUrl, options = {}) {
  const timeoutMs = timeoutFor(route);
  await waitForLandmark(page, route, timeoutMs);
  await waitForLoadingToDisappear(page, timeoutMs);
  const settleMs = route?.readiness?.settleMs ?? options.settleMs ?? DEFAULT_SETTLE_MS;
  if (settleMs > 0) await delay(settleMs);
  await validatePage(page, route, expectedUrl, options.sessionIds ?? [], options);
}

async function extractSessionId(response) {
  if (!response.ok()) return null;
  let body;
  try {
    body = await response.json();
  } catch {
    return null;
  }
  return body?.sessionId ?? body?.id ?? body?.session?.id ?? null;
}

function isDebuggerSessionResponse(response) {
  const request = response.request();
  return request.method() === 'POST' && apiPath(response.url()) === '/api/debugger/sessions';
}

async function deleteDebuggerSession(apiUrl, sessionId, fetchImpl) {
  const endpoint = apiUrlForPath(apiUrl, `/debugger/sessions/${encodeURIComponent(sessionId)}`);
  const controller = new AbortController();
  let timeoutId;
  const request = Promise.resolve().then(() => fetchImpl(endpoint, {
    method: 'DELETE',
    signal: controller.signal,
  }));
  try {
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new ScreenshotRunnerError(`DELETE ${endpoint} timed out after ${CLEANUP_TIMEOUT_MS}ms`, {
          kind: 'cleanup',
          code: 'timeout',
        }));
      }, CLEANUP_TIMEOUT_MS);
    });
    const response = await Promise.race([request, timeout]);
    if (!response?.ok) {
      throw new ScreenshotRunnerError(`DELETE ${endpoint} returned ${response?.status ?? 'unknown'}`, { kind: 'cleanup' });
    }
    return endpoint;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new ScreenshotRunnerError(`DELETE ${endpoint} timed out after ${CLEANUP_TIMEOUT_MS}ms`, {
        kind: 'cleanup',
        code: 'timeout',
        cause: error,
      });
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function stateRequired(route, state) {
  return route.required !== false && state.required !== false;
}

function optionalActionSkip(error) {
  return error?.kind === 'optional-skip' || error?.code === 'missing-control' || error?.code === 'missing-selector';
}

function optionalDebuggerValidation(error, route, required) {
  return !required && route.name === 'debugger' &&
    ['missing-session', 'error-state'].includes(error?.code);
}

function infrastructureFailure(error) {
  return error?.kind !== 'validation' && error?.kind !== 'action' && error?.kind !== 'optional-skip';
}

function routeUrl(baseUrl, route) {
  if (!route.url) return null;
  return new URL(route.url, baseUrl).href;
}

export function mergeRouteMetadata(route = {}, manifestRoute = {}) {
  return {
    ...route,
    ...manifestRoute,
    readiness: {
      ...(route.readiness ?? {}),
      ...(manifestRoute.readiness ?? {}),
    },
    validation: {
      ...(route.validation ?? {}),
      ...(manifestRoute.validation ?? {}),
    },
  };
}

function reportOutputPath(outputRoot, filePath) {
  return path.relative(outputRoot, filePath).split(path.sep).join('/');
}

function configuredRoute(config, manifestRoute) {
  return config.routes?.find((candidate) => candidate.name === manifestRoute.name) ?? {
    ...manifestRoute,
    path: manifestRoute.url,
    states: [{ name: 'default', actions: [] }],
  };
}

function routeEntries(config, manifest) {
  const entries = [];
  const outputPaths = new Set();
  for (const viewport of config.viewports ?? []) {
    for (const manifestRoute of manifest.routes ?? []) {
      const route = configuredRoute(config, manifestRoute);
      const states = route.states?.length ? route.states : [{ name: 'default', actions: [] }];
      for (const state of states) {
        const filePath = stableScreenshotPath(config.output, viewport.name, route.name, state.name);
        if (outputPaths.has(filePath)) {
          throw new ScreenshotRunnerError(`Screenshot output collision at ${filePath}`, { exitCode: 2, kind: 'config' });
        }
        outputPaths.add(filePath);
        entries.push({ manifestRoute, route, state, viewport, filePath });
      }
    }
  }
  return entries;
}

export async function writeJsonAtomically(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, filePath);
}

function manifestForOutput(manifest, apiUrl) {
  return {
    generatedAt: manifest.generatedAt ?? new Date().toISOString(),
    apiUrl,
    context: manifest.context ?? {},
    routes: (manifest.routes ?? []).map((route) => ({
      name: route.name,
      url: route.url ?? null,
      required: route.required !== false,
      source: route.source ?? 'discovery',
      ...(route.discoveryError ? { discoveryError: true } : {}),
    })),
  };
}

export function resolveExitCode({ entries = [], strict = false, error = null } = {}) {
  if (error) return error.exitCode === 2 || error.kind === 'config' || error.name === 'ScreenshotConfigError' ? 2 : 1;
  if (entries.some((entry) => entry.fatal === true)) return 1;
  if (entries.some((entry) => entry.status === 'failed' && entry.required !== false)) return 1;
  if (strict && entries.some((entry) => entry.status === 'failed' || entry.status === 'skipped')) return 1;
  return 0;
}

export function isMissingBrowserError(error) {
  const message = errorMessage(error);
  return /executable (?:doesn't|does not) exist/i.test(message) ||
    /please run .*playwright install/i.test(message) ||
    /npx playwright install(?:\s|$)/i.test(message);
}

async function captureEntry({ entry, config, manifest, browser, apiUrl, report, writeReport, fetchImpl, pageFactory, contextFactory, onContextCreated, responseDrainTimeoutMs }) {
  const { manifestRoute, route, state, viewport, filePath } = entry;
  const required = stateRequired({ ...route, required: manifestRoute.required ?? route.required }, state);
  const started = Date.now();
  const url = routeUrl(config.baseUrl, manifestRoute);
  const expectedUrl = routeUrl(config.baseUrl, {
    url: manifestRoute.expectedPath ?? route.expectedPath ?? manifestRoute.url,
  }) ?? url;
  if (!url) {
    const discoveryError = manifestRoute.discoveryError === true;
    const status = discoveryError || required ? 'failed' : 'skipped';
    const result = {
      route: route.name,
      state: state.name,
      viewport: viewport.name,
      url: null,
      status,
      ...(status === 'skipped' ? { reason: manifestRoute.skipReason ?? 'No discovered route URL' } : { error: manifestRoute.skipReason ?? 'No route URL' }),
      durationMs: Date.now() - started,
      required,
      ...(discoveryError ? { fatal: true } : {}),
    };
    report.entries.push(result);
    await writeReport();
    return result;
  }

  let context;
  let page;
  const sessionIds = [];
  const responseTasks = new Set();
  const pendingDebuggerRequests = new Map();
  const captureRoute = mergeRouteMetadata(route, manifestRoute);
  const configuredDrainTimeoutMs = responseDrainTimeoutMs ?? config.responseDrainTimeoutMs;
  const drainTimeoutMs = Number.isFinite(configuredDrainTimeoutMs) && configuredDrainTimeoutMs > 0
    ? Math.floor(configuredDrainTimeoutMs)
    : RESPONSE_DRAIN_TIMEOUT_MS;
  const isDebuggerSessionRequest = (request) => request.method() === 'POST' && apiPath(request.url()) === '/api/debugger/sessions';
  const createPendingRequest = (request) => {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    const pending = { promise, resolve };
    pendingDebuggerRequests.set(request, pending);
    return pending;
  };
  const drainResponseTasks = async () => {
    await delay(0);
    const deadline = Date.now() + drainTimeoutMs;
    while ((pendingDebuggerRequests.size > 0 || responseTasks.size > 0) && Date.now() < deadline) {
      const remaining = deadline - Date.now();
      await Promise.race([
        Promise.allSettled([
          ...[...pendingDebuggerRequests.values()].map((pending) => pending.promise),
          ...responseTasks,
        ]),
        delay(remaining),
      ]);
      await delay(0);
    }
  };
  const onRequest = (request) => {
    if (isDebuggerSessionRequest(request)) createPendingRequest(request);
  };
  const onRequestFailed = (request) => {
    const pending = pendingDebuggerRequests.get(request);
    if (!pending) return;
    pendingDebuggerRequests.delete(request);
    pending.resolve();
  };
  const onResponse = (response) => {
    if (!isDebuggerSessionResponse(response)) return;
    const request = response.request();
    const pending = pendingDebuggerRequests.get(request) ?? createPendingRequest(request);
    const task = (async () => {
      try {
        const sessionId = await extractSessionId(response);
        if (sessionId !== null && sessionId !== undefined) sessionIds.push(String(sessionId));
      } finally {
        pendingDebuggerRequests.delete(request);
        pending.resolve();
      }
    })();
    responseTasks.add(task);
    task.then(() => responseTasks.delete(task), () => responseTasks.delete(task));
  };
  let result;
  try {
    const createContext = contextFactory ?? ((options) => browser.newContext(options));
    context = await createContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.deviceScaleFactor ?? 1,
    });
    onContextCreated?.(context);
    page = pageFactory ? await pageFactory(context) : await context.newPage();
    page.on('request', onRequest);
    page.on('requestfailed', onRequestFailed);
    page.on('response', onResponse);
    await page.route('**/*', createApiRouteHandler(apiUrl));

    const failureResult = (error) => {
      const isActionSkip = !required && optionalActionSkip(error);
      const isDebuggerValidationSkip = optionalDebuggerValidation(error, captureRoute, required);
      const status = isActionSkip || isDebuggerValidationSkip ? 'skipped' : 'failed';
      return {
        route: route.name,
        state: state.name,
        viewport: viewport.name,
        url,
        status,
        ...(status === 'skipped' ? { reason: errorMessage(error) } : { error: errorMessage(error) }),
        durationMs: Date.now() - started,
        required,
        ...(status === 'failed' && (required || infrastructureFailure(error)) ? { fatal: true } : {}),
      };
    };

    let lastError;
    let readinessComplete = false;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (attempt > 0) await delay(RETRY_DELAY_MS);
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutFor(captureRoute) });
        await waitForReadiness(page, captureRoute, expectedUrl, { settleMs: config.settleMs, sessionIds });
        readinessComplete = true;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!readinessComplete) {
      result = failureResult(lastError);
    } else {
      try {
        if (state.actions?.length) {
          await executeScreenshotActions(page, state.actions, {
            discoveryContext: manifest.context ?? {},
            metadata: { route: route.name, state: state.name, required },
            required,
          });
          await waitForReadiness(page, captureRoute, expectedUrl, {
            settleMs: config.settleMs,
            sessionIds,
            allowQueryChanges: true,
          });
        }
        await page.screenshot({ path: filePath, fullPage: true });
        result = {
          route: route.name,
          state: state.name,
          viewport: viewport.name,
          url,
          status: 'captured',
          output: reportOutputPath(config.output, filePath),
          durationMs: Date.now() - started,
          required,
        };
      } catch (error) {
        result = failureResult(error);
      }
    }
  } catch (error) {
    result = {
      route: route.name,
      state: state.name,
      viewport: viewport.name,
      url,
      status: 'failed',
      error: errorMessage(error),
      durationMs: Date.now() - started,
      required,
      fatal: true,
    };
  } finally {
    await drainResponseTasks();
    try {
      await context?.close();
    } catch (error) {
      if (result?.status === 'captured') {
        result.status = required ? 'failed' : 'failed';
        delete result.output;
        result.error = `Failed to close browser context: ${errorMessage(error)}`;
        result.fatal = true;
      }
    }
    for (const sessionId of sessionIds) {
      try {
        await deleteDebuggerSession(apiUrl, sessionId, fetchImpl);
        report.cleanup.push({ sessionId, status: 'deleted' });
      } catch (error) {
        report.cleanup.push({ sessionId, status: 'failed', error: errorMessage(error) });
      }
      await writeReport();
    }
  }
  report.entries.push(result);
  await writeReport();
  return result;
}

export async function captureScreenshotMatrix(options = {}) {
  const config = options.config ?? {};
  const outputRoot = path.resolve(config.output ?? 'screenshots');
  const apiUrl = normalizeApiBaseUrl(config.apiUrl ?? options.apiUrl);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const manifest = options.manifest ?? await discoverScreenshotManifest({ config, apiUrl, fetchImpl });
  const reportPath = path.join(outputRoot, 'report.json');
  const manifestPath = path.join(outputRoot, 'manifest.json');
  const report = {
    generatedAt: new Date().toISOString(),
    status: 'running',
    exitCode: 1,
    baseUrl: config.baseUrl,
    apiUrl,
    cleanup: [],
    entries: [],
  };
  const writeReport = async () => {
    await writeJsonAtomically(reportPath, report);
    await options.onReportWrite?.(structuredClone(report));
  };

  try {
    await mkdir(outputRoot, { recursive: true });
    await writeJsonAtomically(manifestPath, manifestForOutput(manifest, apiUrl));
    await writeReport();
    const entries = routeEntries({ ...config, output: outputRoot }, manifest);
    let browser = options.browser;
    let ownsBrowser = false;
    if (!browser) {
      const browserFactory = options.browserFactory ?? ((launchOptions) => chromium.launch(launchOptions));
      browser = await browserFactory({ headless: !config.headed });
      ownsBrowser = true;
    }
    try {
      for (const entry of entries) {
        const result = await captureEntry({
          entry: { ...entry, filePath: stableScreenshotPath(outputRoot, entry.viewport.name, entry.route.name, entry.state.name) },
          config: { ...config, output: outputRoot },
          manifest,
          browser,
          apiUrl,
          report,
          writeReport,
          fetchImpl,
          pageFactory: options.pageFactory,
          contextFactory: options.contextFactory,
          onContextCreated: options.onContextCreated,
          responseDrainTimeoutMs: options.responseDrainTimeoutMs,
        });
        if (result.fatal === true) break;
      }
    } finally {
      if (ownsBrowser) await browser.close();
    }
    report.exitCode = resolveExitCode({ entries: report.entries, strict: config.strict });
    report.status = report.exitCode === 0 ? 'passed' : 'failed';
  } catch (error) {
    report.exitCode = error?.exitCode === 2 || isMissingBrowserError(error) ? 2 : 1;
    report.status = error?.name === 'AbortError' ? 'interrupted' : 'failed';
    report.error = errorMessage(error);
  }
  await writeReport();
  return report;
}

export const runScreenshotMatrix = captureScreenshotMatrix;
export const runCaptureMatrix = captureScreenshotMatrix;
export const captureScreenshots = captureScreenshotMatrix;
export const captureMatrix = captureScreenshotMatrix;
export const screenshotFileName = stableScreenshotName;
export const screenshotCaptureId = captureId;

export default captureScreenshotMatrix;
