import 'dotenv/config';
import { bootstrapHttp } from './bootstrap-http';

type CliDependencies = {
  bootstrapHttp: () => Promise<void>;
  runIndexCommand: (args: readonly string[]) => Promise<void>;
};

export async function runIndexCommand(
  _args: readonly string[],
): Promise<void> {
  throw new Error('The indexes command is not available in this version.');
}

export async function runCli(
  argv: readonly string[],
  dependencies: CliDependencies = { bootstrapHttp, runIndexCommand },
): Promise<void> {
  if (argv[0] === 'indexes') {
    return dependencies.runIndexCommand(argv.slice(1));
  }

  if (argv.length === 0 || argv[0] === 'serve' || argv[0]?.startsWith('--')) {
    return dependencies.bootstrapHttp();
  }

  throw new Error(`Unknown command: ${argv[0]}`);
}
