import { Injectable } from '@nestjs/common';
import type { NodeConfig } from '../config/node-config.schema';
import type { ServiceInfo } from '../domain/node.types';
import { GrpcClientFactory } from './grpc-client.factory';

@Injectable()
export class GrpcOperationsService {
  constructor(private readonly clientFactory: GrpcClientFactory) {}

  async fetchOperationalInfo(node: NodeConfig): Promise<ServiceInfo> {
    if (!node.grpc) {
      return {
        target: null,
        reachable: false,
        healthCheckImplemented: false,
        servingStatus: null,
      };
    }

    const client = this.clientFactory.create(node);
    const deadline = Date.now() + node.grpc.connectTimeoutMs;

    await new Promise<void>((resolve, reject) => {
      client.waitForReady(deadline, (error: Error | null) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    const servingStatus = await new Promise<string | null>((resolve) => {
      client.Check(
        { service: '' },
        (error: { code?: number } | null, response?: { status?: string }) => {
          if (error) {
            resolve(null);
            return;
          }

          resolve(response?.status ?? null);
        },
      );
    });

    return {
      target: node.grpc.target,
      reachable: true,
      healthCheckImplemented: servingStatus !== null,
      servingStatus,
    };
  }
}
