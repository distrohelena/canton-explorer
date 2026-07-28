import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  formatCliHelp,
  parseCliOptions,
} from './screenshot-cli-options.mjs';
import { loadScreenshotConfig } from './screenshot-config.mjs';
import {
  apiUrlForPath,
  normalizeApiBaseUrl,
} from './screenshot-discovery.mjs';
import {
  captureScreenshotMatrix,
  isMissingBrowserError,
} from './screenshot-runner.mjs';

const SERVICE_STARTUP_GUIDANCE = 'Start the frontend with `npm run dev:frontend`, the backend with `npm run dev:backend`, and ensure the configured Canton localnet/PQS services are running.';

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function writeLine(stream, line) {
  stream.write(`${line}\n`);
}

function counts(report) {
  return (report.entries ?? []).reduce((result, entry) => {
    if (entry.status === 'captured') result.captured += 1;
    if (entry.status === 'skipped') result.skipped += 1;
    if (entry.status === 'failed') result.failed += 1;
    return result;
  }, { captured: 0, skipped: 0, failed: 0 });
}

function reportPath(config, cwd) {
  return path.resolve(cwd, config.output, 'report.json');
}

function printSummary(report, config, cwd, stdout) {
  const summary = counts(report);
  writeLine(stdout, `Screenshot capture: ${summary.captured} captured, ${summary.skipped} skipped, ${summary.failed} failed`);
  if (report.error) writeLine(stdout, `Reason: ${report.error}`);
  writeLine(stdout, `Report: ${reportPath(config, cwd)}`);
}

export async function checkServiceReachability(config, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required to check services');

  const checks = [
    { name: 'Frontend', url: config.baseUrl },
    { name: 'API', url: apiUrlForPath(normalizeApiBaseUrl(config.apiUrl), '/nodes?limit=1') },
  ];
  for (const check of checks) {
    let response;
    try {
      response = await fetchImpl(check.url, { method: 'GET' });
    } catch (error) {
      throw new Error(`${check.name} is unreachable at ${check.url}: ${errorMessage(error)} ${SERVICE_STARTUP_GUIDANCE}`, { cause: error });
    }
    if (!response?.ok) {
      throw new Error(`${check.name} is unreachable at ${check.url}: HTTP ${response?.status ?? 'unknown'}. ${SERVICE_STARTUP_GUIDANCE}`);
    }
  }
}

function exitCodeForError(error, phase) {
  if (phase === 'parse' || phase === 'config') return 2;
  if (error?.exitCode === 2 || isMissingBrowserError(error)) return 2;
  return 1;
}

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  const stdout = dependencies.stdout ?? process.stdout;
  const stderr = dependencies.stderr ?? process.stderr;
  const cwd = dependencies.cwd ?? process.cwd();
  const parse = dependencies.parseCliOptions ?? parseCliOptions;
  const help = dependencies.formatCliHelp ?? formatCliHelp;
  const loadConfig = dependencies.loadScreenshotConfig ?? loadScreenshotConfig;
  const checkServices = dependencies.checkServices ?? checkServiceReachability;
  const runMatrix = dependencies.captureScreenshotMatrix ?? captureScreenshotMatrix;
  const fetchImpl = dependencies.fetchImpl ?? globalThis.fetch;
  let phase = 'parse';

  try {
    const options = parse(argv);
    if (options.help) {
      writeLine(stdout, help());
      return 0;
    }

    phase = 'config';
    const config = await loadConfig(options.configPath, { cwd, cliOptions: options });

    phase = 'service';
    await checkServices(config, { fetchImpl });

    phase = 'capture';
    const report = await runMatrix({
      config,
      fetchImpl,
      ...(dependencies.manifest ? { manifest: dependencies.manifest } : {}),
      ...(dependencies.browserFactory ? { browserFactory: dependencies.browserFactory } : {}),
      ...(dependencies.contextFactory ? { contextFactory: dependencies.contextFactory } : {}),
      ...(dependencies.pageFactory ? { pageFactory: dependencies.pageFactory } : {}),
    });
    printSummary(report, config, cwd, stdout);
    return report.exitCode ?? 1;
  } catch (error) {
    writeLine(stderr, `Error: ${errorMessage(error)}`);
    return exitCodeForError(error, phase);
  }
}

const entrypointPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === entrypointPath) {
  process.exitCode = await main();
}

export default main;
