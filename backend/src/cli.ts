import 'dotenv/config';
import { bootstrapHttp } from './bootstrap-http';
import { runIndexCommand } from './indexes/index-command';

type CliDependencies = {
  bootstrapHttp: () => Promise<void>;
  runIndexCommand: (args: readonly string[]) => Promise<unknown>;
};

export async function runCli(
  argv: readonly string[],
  dependencies: CliDependencies = { bootstrapHttp, runIndexCommand },
): Promise<void> {
  if (argv[0] === 'indexes') {
    await dependencies.runIndexCommand(argv.slice(1));
    return;
  }

  if (argv.length === 0 || argv[0] === 'serve' || argv[0]?.startsWith('--')) {
    return dependencies.bootstrapHttp();
  }

  throw new Error(`Unknown command: ${argv[0]}`);
}
