import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type NodeConfig, parseNodeConfigFile } from './node-config.schema';

@Injectable()
export class NodeConfigService {
  private readonly nodes: NodeConfig[];

  constructor() {
    const configPath =
      process.env.NODE_CONFIG_PATH ?? resolve(process.cwd(), 'config', 'nodes.local.json');
    const fileContents = readFileSync(configPath, 'utf8');
    const parsed = parseNodeConfigFile(JSON.parse(fileContents));
    this.nodes = parsed.nodes;
  }

  list(): NodeConfig[] {
    return this.nodes;
  }
}
