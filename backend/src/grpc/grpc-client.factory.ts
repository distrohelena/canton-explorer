import { Injectable } from '@nestjs/common';
import { credentials, loadPackageDefinition } from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import { join } from 'node:path';
import type { NodeConfig } from '../config/node-config.schema';

@Injectable()
export class GrpcClientFactory {
  create(node: NodeConfig) {
    if (!node.grpc) {
      throw new Error(`Node ${node.id} does not define grpc settings`);
    }

    const packageDefinition = loadSync(
      join(process.cwd(), 'proto', 'grpc', 'health', 'v1', 'health.proto'),
      { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true },
    );

    const loaded = loadPackageDefinition(packageDefinition) as {
      grpc: { health: { v1: { Health: new (...args: unknown[]) => any } } };
    };

    const Client = loaded.grpc.health.v1.Health;
    const channelCredentials = node.grpc.useTls
      ? credentials.createSsl()
      : credentials.createInsecure();

    return new Client(node.grpc.target, channelCredentials);
  }
}
