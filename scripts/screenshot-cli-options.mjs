import {
  EXIT_CODES,
  ScreenshotConfigError,
  parseViewportSpec,
} from './screenshot-config.mjs';

export const CLI_DEFAULTS = Object.freeze({
  baseUrl: 'http://localhost:46000',
  apiUrl: 'http://localhost:4600/api',
  output: 'screenshots',
  strict: false,
  headed: false,
});

export class CliOptionsError extends ScreenshotConfigError {
  constructor(message) {
    super(message);
    this.name = 'CliOptionsError';
    this.exitCode = EXIT_CODES.INVALID_INPUT;
  }
}

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('-')) {
    throw new CliOptionsError(`${flag} requires a value`);
  }
  return value;
}

function setProvided(options, key) {
  options.provided[key] = true;
}

export function parseCliOptions(argv = []) {
  if (!Array.isArray(argv)) throw new CliOptionsError('CLI arguments must be an array');
  const options = {
    ...CLI_DEFAULTS,
    routes: [],
    viewports: [],
    configPath: undefined,
    help: false,
  };
  const provided = {};
  Object.defineProperty(options, 'provided', { value: provided, enumerable: false });

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    switch (flag) {
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '--base-url':
        options.baseUrl = requireValue(argv, index, flag);
        setProvided(options, 'baseUrl');
        index += 1;
        break;
      case '--api-url':
        options.apiUrl = requireValue(argv, index, flag);
        setProvided(options, 'apiUrl');
        index += 1;
        break;
      case '--output':
        options.output = requireValue(argv, index, flag);
        setProvided(options, 'output');
        index += 1;
        break;
      case '--config':
        options.configPath = requireValue(argv, index, flag);
        setProvided(options, 'configPath');
        index += 1;
        break;
      case '--strict':
        options.strict = true;
        setProvided(options, 'strict');
        break;
      case '--headed':
        options.headed = true;
        setProvided(options, 'headed');
        break;
      case '--route': {
        const value = requireValue(argv, index, flag);
        options.routes.push(value);
        index += 1;
        break;
      }
      case '--viewport': {
        const value = requireValue(argv, index, flag);
        const viewport = parseViewportSpec(value);
        if (options.viewports.some((candidate) => candidate.width === viewport.width && candidate.height === viewport.height)) {
          throw new CliOptionsError(`Duplicate viewport ${value}`);
        }
        options.viewports.push(viewport);
        index += 1;
        break;
      }
      default:
        throw new CliOptionsError(`Unknown CLI option ${flag}`);
    }
  }
  return options;
}

export function formatCliHelp() {
  return [
    'Usage: npm run screenshots -- [options]',
    '',
    'Options:',
    '  --base-url <url>       Frontend base URL (default: http://localhost:46000)',
    '  --api-url <url>        API base URL (default: http://localhost:4600/api)',
    '  --output <directory>   Screenshot/report directory (default: screenshots)',
    '  --config <path>        ESM config path, relative to the current directory',
    '  --route <id>           Capture one route or route--state (repeatable)',
    '  --viewport <WxH>       Capture a custom viewport (repeatable)',
    '  --strict               Fail when an optional dynamic capture is skipped',
    '  --headed               Show the browser while capturing',
    '  -h, --help             Show this help',
  ].join('\n');
}

export const EXIT_SUCCESS = EXIT_CODES.SUCCESS;
export const EXIT_FAILURE = EXIT_CODES.FAILURE;
export const EXIT_INVALID_INPUT = EXIT_CODES.INVALID_INPUT;
export const EXIT_ALLOWED_SKIP = EXIT_CODES.ALLOWED_SKIP;
export { EXIT_CODES };

export const parseScreenshotCliOptions = parseCliOptions;
export const parseArgs = parseCliOptions;

export default parseCliOptions;
