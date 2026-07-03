import { Injectable } from '@nestjs/common';
import type { NodeConfig } from '../config/node-config.schema';

@Injectable()
export class GrpcClientFactory {
  async create(node: NodeConfig) {
    if (node.mode !== 'pqs_with_grpc') {
      throw new Error(`Node ${node.id} does not define grpc settings`);
    }

    const sdk = await import('canton-typescript-sdk');

    return new sdk.CantonClient(
      new sdk.CantonClientOptions({
        transportKind: sdk.TransportKind.grpc,
        endpoint: node.grpc.target,
        defaultRequestTimeoutMs: node.grpc.connectTimeoutMs,
        grpcConnectTimeoutMs: node.grpc.connectTimeoutMs,
        grpcChannelSecurity: node.grpc.useTls
          ? sdk.GrpcChannelSecurity.tls
          : sdk.GrpcChannelSecurity.insecure,
      }),
    );
  }
}
