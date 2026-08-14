import { resolve } from 'node:path';
import type { NodeConfig } from '../config/node-config.schema';
import { NodeConfigService } from '../config/node-config.service';
import { PqsManagerFactory } from '../pqs/pqs-manager.factory';
import {
  applyPqsIndexes,
  inspectPqsIndexes,
  repairPqsIndexes,
  type PqsIndexApplyResult,
  type PqsIndexInspection,
} from './pqs-index-installer';

type IndexAction = 'inspect' | 'apply' | 'repair';

export type IndexCommandResult = {
  command: IndexAction;
  dryRun: boolean;
  inspectedNodeIds: string[];
  appliedNodeIds: string[];
  repairedNodeIds: string[];
};

type PqsConnectionFactory = {
  getPqsConnection(node: NodeConfig): {
    connectionString: string;
    schema: string;
  };
  onModuleDestroy(): Promise<void>;
};

export type IndexCommandDependencies = {
  createNodeConfigService: () => Pick<NodeConfigService, 'list'>;
  createPqsManagerFactory: () => PqsConnectionFactory;
  inspectPqsIndexes: typeof inspectPqsIndexes;
  applyPqsIndexes: typeof applyPqsIndexes;
  repairPqsIndexes: typeof repairPqsIndexes;
  writeOutput: (line: string) => void;
};

type ParsedIndexArguments = {
  command: IndexAction;
  configPath?: string;
  nodeId?: string;
  dryRun: boolean;
  help: boolean;
};

const indexCommandHelp = `Canton Explorer PQS indexes

Usage:
  canton-explorer indexes inspect [--config <path>] [--node <id>]
  canton-explorer indexes apply [--config <path>] [--node <id>] [--dry-run]
  canton-explorer indexes repair [--config <path>] [--node <id>]

Options:
  --config <path>  Path to the node config JSON file
  --node <id>      Process one configured PQS node
  --dry-run        Inspect and print safe apply SQL without applying it
  --help           Show this message`;

const defaultDependencies: IndexCommandDependencies = {
  createNodeConfigService: () => new NodeConfigService(),
  createPqsManagerFactory: () => new PqsManagerFactory(),
  inspectPqsIndexes,
  applyPqsIndexes,
  repairPqsIndexes,
  writeOutput: (line) => process.stdout.write(`${line}\n`),
};

function readFlagValue(
  args: readonly string[],
  index: number,
  flag: string,
): string {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function parseIndexArguments(args: readonly string[]): ParsedIndexArguments {
  let command: IndexAction = 'inspect';
  let commandWasProvided = false;
  let configPath: string | undefined;
  let nodeId: string | undefined;
  let dryRun = false;
  let help = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (
      argument === 'inspect' ||
      argument === 'apply' ||
      argument === 'repair'
    ) {
      if (commandWasProvided) {
        throw new Error(`Unknown indexes command: ${argument}`);
      }
      command = argument;
      commandWasProvided = true;
      continue;
    }
    if (argument === '--config') {
      if (configPath !== undefined) {
        throw new Error('Duplicate argument: --config');
      }
      configPath = resolve(process.cwd(), readFlagValue(args, index, argument));
      index += 1;
      continue;
    }
    if (argument === '--node') {
      if (nodeId !== undefined) {
        throw new Error('Duplicate argument: --node');
      }
      nodeId = readFlagValue(args, index, argument);
      index += 1;
      continue;
    }
    if (argument === '--dry-run') {
      if (dryRun) {
        throw new Error('Duplicate argument: --dry-run');
      }
      dryRun = true;
      continue;
    }
    if (argument === '--help') {
      help = true;
      continue;
    }
    if (argument.startsWith('--')) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    throw new Error(`Unknown indexes command: ${argument}`);
  }

  if (dryRun && command !== 'apply') {
    throw new Error('--dry-run is only valid with indexes apply');
  }

  return { command, configPath, nodeId, dryRun, help };
}

function assertUniqueNodeIds(nodes: readonly NodeConfig[]): void {
  const seen = new Set<string>();
  for (const node of nodes) {
    if (seen.has(node.id)) {
      throw new Error(`Duplicate node ID: ${node.id}`);
    }
    seen.add(node.id);
  }
}

function inspectOutput(
  nodeId: string,
  inspection: PqsIndexInspection,
  dryRun: boolean,
): string {
  const lines = [
    `[indexes] node=${nodeId} ${dryRun ? 'dry-run' : 'inspect'} schema=${inspection.schema} schema-supported=${inspection.schemaValidation.supported} pqs-version=${inspection.schemaValidation.pqsVersion ?? 'unknown'} contract-partitions=${inspection.contractPartitions.length} exercise-partitions=${inspection.exercisePartitions.length} installed=${inspection.indexStatuses.length} conflicts=${inspection.conflicts.length} proposed=${inspection.proposedSql.length} repair=${inspection.repairSql.length}`,
    ...inspection.relationStats.map(
      (stats) =>
        `[indexes] relation=${stats.relationName} partitions=${stats.partitionCount} estimated-rows=${stats.estimatedRows} table-bytes=${stats.tableSizeBytes} index-bytes=${stats.indexSizeBytes} total-bytes=${stats.totalSizeBytes}`,
    ),
    ...inspection.indexStatuses.map(
      (status) =>
        `[indexes] index=${status.name} state=${status.state} valid=${status.isValid} ready=${status.isReady} definition-matches=${status.definitionMatches} size-bytes=${status.sizeBytes} mismatches=${status.mismatchReasons.join(' | ') || 'none'} definition=${status.definition}`,
    ),
    `[indexes] explain-relation=${inspection.representativeExplain.relation} plan=${JSON.stringify(inspection.representativeExplain.plan)}`,
  ];
  if (inspection.proposedSql.length > 0) {
    lines.push('[indexes] safe-apply-sql', ...inspection.proposedSql);
  }
  if (inspection.repairSql.length > 0) {
    lines.push('[indexes] explicit-repair-sql', ...inspection.repairSql);
  }
  return lines.join('\n');
}

function applyOutput(nodeId: string, result: PqsIndexApplyResult): string {
  return `[indexes] node=${nodeId} apply statements=${result.appliedStatements} newly-applied=${result.newlyAppliedVersions.length} skipped=${result.skippedVersions.length}`;
}

function repairOutput(nodeId: string, result: PqsIndexApplyResult): string {
  return `[indexes] node=${nodeId} repair statements=${result.appliedStatements} repaired=${result.repairedIndexes.length} newly-applied=${result.newlyAppliedVersions.length} skipped=${result.skippedVersions.length}`;
}

export async function runIndexCommand(
  args: readonly string[],
  dependencyOverrides: Partial<IndexCommandDependencies> = {},
): Promise<IndexCommandResult> {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  const parsed = parseIndexArguments(args);
  const result: IndexCommandResult = {
    command: parsed.command,
    dryRun: parsed.dryRun,
    inspectedNodeIds: [],
    appliedNodeIds: [],
    repairedNodeIds: [],
  };

  if (parsed.help) {
    dependencies.writeOutput(indexCommandHelp);
    return result;
  }

  if (parsed.configPath) {
    process.env.NODE_CONFIG_PATH = parsed.configPath;
  }

  const configService = dependencies.createNodeConfigService();
  const factory = dependencies.createPqsManagerFactory();

  try {
    const configuredNodes = configService.list();
    assertUniqueNodeIds(configuredNodes);

    const selectedNodes = parsed.nodeId
      ? configuredNodes.filter((node) => node.id === parsed.nodeId)
      : configuredNodes;
    if (parsed.nodeId && selectedNodes.length === 0) {
      throw new Error(`Unknown node: ${parsed.nodeId}`);
    }

    for (const node of selectedNodes) {
      const { connectionString, schema } = factory.getPqsConnection(node);
      if (parsed.command === 'inspect' || parsed.dryRun) {
        const inspection = await dependencies.inspectPqsIndexes(
          connectionString,
          schema,
        );
        result.inspectedNodeIds.push(node.id);
        dependencies.writeOutput(
          inspectOutput(node.id, inspection, parsed.dryRun),
        );
        continue;
      }

      if (parsed.command === 'apply') {
        const application = await dependencies.applyPqsIndexes(
          connectionString,
          schema,
        );
        result.appliedNodeIds.push(node.id);
        dependencies.writeOutput(applyOutput(node.id, application));
        continue;
      }

      const repair = await dependencies.repairPqsIndexes(
        connectionString,
        schema,
      );
      result.repairedNodeIds.push(node.id);
      dependencies.writeOutput(repairOutput(node.id, repair));
    }

    return result;
  } finally {
    await factory.onModuleDestroy();
  }
}
