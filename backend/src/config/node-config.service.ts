import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  type DebuggerConfig,
  type NodeConfig,
  type NodeConfigFile,
  type TokenMetadataConfig,
  parseNodeConfigFile,
} from './node-config.schema';

@Injectable()
export class NodeConfigService {
  private readonly config: NodeConfigFile;

  constructor() {
    const configPath =
      process.env.NODE_CONFIG_PATH ?? resolve(process.cwd(), 'config', 'nodes.local.json');
    const fileContents = readFileSync(configPath, 'utf8');
    this.config = parseNodeConfigFile(JSON.parse(fileContents));
  }

  list(): NodeConfig[] {
    return this.config.nodes;
  }

  getTokenMetadataConfig(): TokenMetadataConfig {
    return this.config.tokenMetadata;
  }

  getDebuggerConfig(): DebuggerConfig {
    return this.config.debugger;
  }
}
