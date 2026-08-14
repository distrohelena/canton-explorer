import { describe, expect, it, jest } from '@jest/globals';
import type { NodeConfig } from '../../src/config/node-config.schema';
import {
  runIndexCommand,
  type IndexCommandDependencies,
} from '../../src/indexes/index-command';

const pqsNode = {
  id: 'pqs-node',
  label: 'PQS node',
  role: 'participant',
  mode: 'pqs_only',
  pqs: { connectionUriEnv: 'PQS_NODE_URL', schema: 'public' },
} satisfies NodeConfig;

const secondPqsNode = {
  id: 'second-pqs-node',
  label: 'Second PQS node',
  role: 'participant',
  mode: 'pqs_only',
  pqs: { connectionUriEnv: 'SECOND_PQS_NODE_URL', schema: 'second_schema' },
} satisfies NodeConfig;

function dependenciesWithNodes(nodes: readonly NodeConfig[]) {
  const inspectPqsIndexes = jest
    .fn<IndexCommandDependencies['inspectPqsIndexes']>()
    .mockResolvedValue({
      schema: 'public',
      contractPartitions: ['__contracts_17'],
      exercisePartitions: ['__exercises_17'],
      hasExercises: true,
      transactionIdIsText: true,
      indexStatuses: [],
      proposedSql: ['create index concurrently index_17'],
    });
  const applyPqsIndexes = jest
    .fn<IndexCommandDependencies['applyPqsIndexes']>()
    .mockResolvedValue({
      schema: 'public',
      appliedVersions: ['001-witnesses'],
      newlyAppliedVersions: ['001-witnesses'],
      skippedVersions: [],
      appliedStatements: 1,
    });
  const onModuleDestroy = jest.fn<() => Promise<void>>().mockResolvedValue();
  const writeOutput = jest.fn<(line: string) => void>();

  const dependencies: IndexCommandDependencies = {
    createNodeConfigService: () => ({ list: () => [...nodes] }),
    createPqsManagerFactory: () => ({
      getPqsConnection: (node) => ({
        connectionString: `postgres:///${node.id}`,
        schema: node.pqs.schema,
      }),
      onModuleDestroy,
    }),
    inspectPqsIndexes,
    applyPqsIndexes,
    writeOutput,
  };

  return {
    dependencies,
    inspectPqsIndexes,
    applyPqsIndexes,
    onModuleDestroy,
    writeOutput,
  };
}

describe('runIndexCommand', () => {
  it('inspects every configured PQS node', async () => {
    const setup = dependenciesWithNodes([pqsNode, secondPqsNode]);

    const result = await runIndexCommand(['inspect'], setup.dependencies);

    expect(result.inspectedNodeIds).toEqual(['pqs-node', 'second-pqs-node']);
    expect(setup.inspectPqsIndexes).toHaveBeenCalledWith(
      'postgres:///pqs-node',
      'public',
    );
    expect(setup.inspectPqsIndexes).toHaveBeenCalledWith(
      'postgres:///second-pqs-node',
      'second_schema',
    );
    expect(setup.onModuleDestroy).toHaveBeenCalledTimes(1);
  });

  it('invokes only the requested configured PQS node', async () => {
    const setup = dependenciesWithNodes([pqsNode, secondPqsNode]);

    const result = await runIndexCommand(
      ['inspect', '--node', 'second-pqs-node'],
      setup.dependencies,
    );

    expect(result.inspectedNodeIds).toEqual(['second-pqs-node']);
    expect(setup.inspectPqsIndexes).toHaveBeenCalledTimes(1);
    expect(setup.inspectPqsIndexes).toHaveBeenCalledWith(
      'postgres:///second-pqs-node',
      'second_schema',
    );
  });

  it('uses inspection for apply dry-runs and never applies indexes', async () => {
    const setup = dependenciesWithNodes([pqsNode]);

    const result = await runIndexCommand(
      ['apply', '--dry-run'],
      setup.dependencies,
    );

    expect(result.inspectedNodeIds).toEqual(['pqs-node']);
    expect(result.appliedNodeIds).toEqual([]);
    expect(setup.inspectPqsIndexes).toHaveBeenCalledTimes(1);
    expect(setup.applyPqsIndexes).not.toHaveBeenCalled();
    expect(setup.writeOutput).toHaveBeenCalledWith(
      expect.stringContaining('create index concurrently index_17'),
    );
  });

  it('selects one requested node and rejects an unknown node', async () => {
    const setup = dependenciesWithNodes([pqsNode]);

    await expect(
      runIndexCommand(['inspect', '--node', 'missing'], setup.dependencies),
    ).rejects.toThrow('Unknown node: missing');

    expect(setup.inspectPqsIndexes).not.toHaveBeenCalled();
    expect(setup.onModuleDestroy).toHaveBeenCalledTimes(1);
  });

  it('sets the config path before constructing the config service', async () => {
    const originalConfigPath = process.env.NODE_CONFIG_PATH;
    let pathAtConstruction: string | undefined;
    const setup = dependenciesWithNodes([pqsNode]);
    setup.dependencies.createNodeConfigService = () => {
      pathAtConstruction = process.env.NODE_CONFIG_PATH;
      return { list: () => [pqsNode] };
    };

    try {
      await runIndexCommand(
        ['inspect', '--config', './client-nodes.json'],
        setup.dependencies,
      );
      expect(pathAtConstruction).toMatch(/client-nodes\.json$/);
    } finally {
      if (originalConfigPath === undefined) {
        delete process.env.NODE_CONFIG_PATH;
      } else {
        process.env.NODE_CONFIG_PATH = originalConfigPath;
      }
    }
  });

  it('rejects duplicate configured node IDs before connecting', async () => {
    const setup = dependenciesWithNodes([pqsNode, { ...pqsNode }]);

    await expect(
      runIndexCommand(['inspect'], setup.dependencies),
    ).rejects.toThrow('Duplicate node ID: pqs-node');

    expect(setup.inspectPqsIndexes).not.toHaveBeenCalled();
    expect(setup.onModuleDestroy).toHaveBeenCalledTimes(1);
  });

  it.each([
    { args: ['remove'], message: 'Unknown indexes command: remove' },
    { args: ['inspect', '--node'], message: 'Missing value for --node' },
    { args: ['inspect', '--wat'], message: 'Unknown argument: --wat' },
    {
      args: ['inspect', '--dry-run'],
      message: '--dry-run is only valid with indexes apply',
    },
  ])('rejects invalid arguments: $message', async ({ args, message }) => {
    const setup = dependenciesWithNodes([pqsNode]);

    await expect(runIndexCommand(args, setup.dependencies)).rejects.toThrow(
      message,
    );

    expect(setup.inspectPqsIndexes).not.toHaveBeenCalled();
  });

  it('prints command-specific help without constructing services', async () => {
    const createNodeConfigService = jest.fn();
    const writeOutput = jest.fn<(line: string) => void>();
    const setup = dependenciesWithNodes([pqsNode]);

    const result = await runIndexCommand(['--help'], {
      ...setup.dependencies,
      createNodeConfigService,
      writeOutput,
    });

    expect(result).toMatchObject({ inspectedNodeIds: [], appliedNodeIds: [] });
    expect(createNodeConfigService).not.toHaveBeenCalled();
    expect(writeOutput).toHaveBeenCalledWith(
      expect.stringContaining('canton-explorer indexes inspect'),
    );
  });
});
