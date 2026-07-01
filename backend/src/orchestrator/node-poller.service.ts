import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import type { NodeConfig } from '../config/node-config.schema';
import { NodeConfigService } from '../config/node-config.service';
import { computeNodeStatus } from '../domain/node-health';
import { NodeCacheService } from '../cache/node-cache.service';
import { PqsSummaryService } from '../pqs/pqs-summary.service';
import { GrpcOperationsService } from '../grpc/grpc-operations.service';

@Injectable()
export class NodePollerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(NodePollerService.name);
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly configService: NodeConfigService,
    private readonly cacheService: NodeCacheService,
    private readonly pqsSummaryService: PqsSummaryService,
    private readonly grpcOperationsService: GrpcOperationsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    for (const node of this.configService.list()) {
      await this.refreshNode(node);
      const intervalMs = node.polling?.intervalMs ?? 15000;
      this.timers.set(node.id, setInterval(() => void this.refreshNode(node), intervalMs));
    }
  }

  onApplicationShutdown(): void {
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }

    this.timers.clear();
  }

  private async refreshNode(node: NodeConfig): Promise<void> {
    const previous = this.cacheService.get(node.id);
    const timestamp = new Date().toISOString();

    try {
      const startedAt = Date.now();
      const ledgerSummary = await this.pqsSummaryService.fetchSummary(node);
      const serviceInfo = await this.grpcOperationsService.fetchOperationalInfo(node);
      const latencyMs = Date.now() - startedAt;

      this.cacheService.upsert({
        id: node.id,
        label: node.label,
        role: node.role,
        ledgerLabel: node.ledgerLabel ?? node.label,
        status: computeNodeStatus({
          pqsOk: true,
          grpcRequired: Boolean(node.grpc),
          grpcOk: node.grpc ? serviceInfo.reachable : true,
          isStale: false,
          hasUsableSnapshot: true,
        }),
        latencyMs,
        lastSuccessAt: timestamp,
        lastErrorAt: null,
        errorSummary: null,
        serviceInfo,
        ledgerSummary,
        sourceStatus: {
          pqs: { ok: true, checkedAt: timestamp, latencyMs, message: null },
          grpc: {
            ok: node.grpc ? serviceInfo.reachable : true,
            checkedAt: timestamp,
            latencyMs,
            message: node.grpc && !serviceInfo.reachable ? 'gRPC unreachable' : null,
          },
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown refresh failure';
      this.logger.error(`Failed to refresh ${node.id}: ${message}`);

      if (previous) {
        this.cacheService.upsert({
          ...previous,
          status: computeNodeStatus({
            pqsOk: false,
            grpcRequired: Boolean(node.grpc),
            grpcOk: previous.sourceStatus.grpc.ok,
            isStale: true,
            hasUsableSnapshot: true,
          }),
          lastErrorAt: timestamp,
          errorSummary: message,
          sourceStatus: {
            ...previous.sourceStatus,
            pqs: {
              ok: false,
              checkedAt: timestamp,
              latencyMs: previous.sourceStatus.pqs.latencyMs,
              message,
            },
          },
        });
        return;
      }

      this.cacheService.upsert({
        id: node.id,
        label: node.label,
        role: node.role,
        ledgerLabel: node.ledgerLabel ?? node.label,
        status: 'down',
        latencyMs: null,
        lastSuccessAt: null,
        lastErrorAt: timestamp,
        errorSummary: message,
        serviceInfo: {
          target: node.grpc?.target ?? null,
          reachable: false,
          healthCheckImplemented: false,
          servingStatus: null,
        },
        ledgerSummary: {
          ledgerLabel: node.ledgerLabel ?? node.label,
          pqsDatabase: 'unavailable',
          activeContractCount: 0,
          latestOffset: null,
          latestEventAt: null,
        },
        sourceStatus: {
          pqs: { ok: false, checkedAt: timestamp, latencyMs: null, message },
          grpc: {
            ok: false,
            checkedAt: timestamp,
            latencyMs: null,
            message: node.grpc ? message : 'gRPC not configured',
          },
        },
      });
    }
  }
}
