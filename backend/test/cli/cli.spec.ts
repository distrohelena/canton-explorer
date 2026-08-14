import { describe, expect, it, jest } from '@jest/globals';
import { runCli } from '../../src/cli';

describe('runCli', () => {
  it('starts HTTP when invoked with no command', async () => {
    const bootstrapHttp = jest.fn<() => Promise<void>>().mockResolvedValue();

    await runCli([], { bootstrapHttp, runIndexCommand: jest.fn() });

    expect(bootstrapHttp).toHaveBeenCalledTimes(1);
  });

  it('forwards indexes arguments without starting HTTP', async () => {
    const runIndexCommand = jest
      .fn<(args: readonly string[]) => Promise<void>>()
      .mockResolvedValue();

    await runCli(['indexes', 'inspect', '--node', 'participant-1'], {
      bootstrapHttp: jest.fn(),
      runIndexCommand,
    });

    expect(runIndexCommand).toHaveBeenCalledWith([
      'inspect',
      '--node',
      'participant-1',
    ]);
  });
});
