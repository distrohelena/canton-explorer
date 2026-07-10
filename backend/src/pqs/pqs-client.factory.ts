import { Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import type { NodeConfig } from '../config/node-config.schema';

@Injectable()
export class PqsClientFactory {
  private readonly logger = new Logger(PqsClientFactory.name);
  private readonly clients = new Map<string, Pool>();

  getClient(node: NodeConfig): Pool {
    const existing = this.clients.get(node.id);
    if (existing) {
      return existing;
    }

    const connectionString = process.env[node.pqs.connectionUriEnv];
    if (!connectionString) {
      throw new Error(`Missing PQS connection string env var: ${node.pqs.connectionUriEnv}`);
    }

    const client = new Pool({ connectionString });
    client.on('error', (error: Error & { code?: string }) => {
      this.logger.warn(
        `PQS pool error for ${node.id}: ${error.code ?? 'unknown'} ${error.message}`,
      );
    });
    this.clients.set(node.id, client);
    return client;
  }
}
