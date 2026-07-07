import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import type { NodeConfig } from '../config/node-config.schema';
import { NodeConfigService } from '../config/node-config.service';
import { computeNodeStatus } from '../domain/node-health';
import type { LedgerSummary, ServiceInfo } from '../domain/node.types';
import { NodeCacheService } from '../cache/node-cache.service';
import { PqsSummaryService } from '../pqs/pqs-summary.service';
import { GrpcOperationsService } from '../grpc/grpc-operations.service';
import { PackageSyncService } from '../packages/package-sync.service';

interface RefreshAttempt<T> {
  ok: boolean;
  value: T;
  latencyMs: number | null;
  error: string | null;
}

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
    private readonly packageSyncService: PackageSyncService,
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
    const grpcRequired = node.mode === 'pqs_with_grpc';
    const [ledgerAttempt, grpcAttempt] = await Promise.all([
      this.refreshPqs(node),
      this.refreshGrpc(node),
    ]);

    if (!ledgerAttempt.ok) {
      this.logger.error(`PQS refresh failed for ${node.id}: ${ledgerAttempt.error}`);
    }

    if (grpcRequired && !grpcAttempt.ok) {
      this.logger.error(`gRPC refresh failed for ${node.id}: ${grpcAttempt.error}`);
    }

    const ledgerSummary = ledgerAttempt.ok
      ? ledgerAttempt.value
      : previous?.ledgerSummary ?? this.defaultLedgerSummary(node);
    const serviceInfo = grpcAttempt.ok
      ? grpcAttempt.value
      : previous?.serviceInfo ?? this.defaultServiceInfo(node);
    const errorSummary = [this.formatSourceError('PQS', ledgerAttempt), this.formatSourceError('gRPC', grpcAttempt)]
      .filter((message): message is string => message !== null)
      .join('; ');
    const pqsOk = ledgerAttempt.ok;
    const grpcOk = grpcRequired ? grpcAttempt.ok : true;
    const hasUsableSnapshot = ledgerAttempt.ok || Boolean(previous);
    const status = computeNodeStatus({
      pqsOk,
      grpcRequired,
      grpcOk,
      isStale: !pqsOk,
      hasUsableSnapshot,
    });

    this.cacheService.upsert({
      id: node.id,
      label: node.label,
      role: node.role,
      mode: node.mode,
      ledgerLabel: node.ledgerLabel ?? node.label,
      status,
      latencyMs: this.combineLatencies(ledgerAttempt.latencyMs, grpcAttempt.latencyMs),
      lastSuccessAt:
        pqsOk || grpcAttempt.ok ? timestamp : previous?.lastSuccessAt ?? null,
      lastErrorAt: errorSummary ? timestamp : null,
      errorSummary: errorSummary || null,
      serviceInfo,
      ledgerSummary,
      sourceStatus: {
        pqs: {
          ok: pqsOk,
          checkedAt: timestamp,
          latencyMs: ledgerAttempt.latencyMs,
          message: ledgerAttempt.error,
        },
        grpc: {
          ok: grpcOk,
          checkedAt: timestamp,
          latencyMs: grpcAttempt.latencyMs,
          message: grpcRequired ? grpcAttempt.error : 'Not configured',
        },
      },
    });

    if (ledgerAttempt.ok) {
      try {
        await this.packageSyncService.syncNodePackagesIfDue(node);
      } catch (error) {
        this.logger.warn(
          `Package cache sync failed for ${node.id}: ${
            error instanceof Error ? error.message : 'Unknown package cache failure'
          }`,
        );
      }

      if (!this.cacheService.hasActivityHistory(node.id)) {
        try {
          const historicalSamples = await this.pqsSummaryService.fetchActivityBuckets(
            node,
            30,
            15,
          );

          if (historicalSamples.length > 0) {
            this.cacheService.seedActivityHistory({
              nodeId: node.id,
              label: node.label,
              status,
              latestActiveContractCount: ledgerSummary.activeContractCount,
              lastObservedUpdateCount: ledgerSummary.totalUpdateCount,
              samples: historicalSamples.map((sample) => ({
                ...sample,
                activeContractCount: ledgerSummary.activeContractCount,
              })),
            });

            return;
          }
        } catch (error) {
          this.logger.warn(
            `Activity history backfill failed for ${node.id}: ${
              error instanceof Error ? error.message : 'Unknown backfill failure'
            }`,
          );
        }
      }

      this.cacheService.recordActivitySample({
        nodeId: node.id,
        label: node.label,
        status,
        timestamp,
        activeContractCount: ledgerSummary.activeContractCount,
        latestOffset: ledgerSummary.latestOffset,
        totalUpdateCount: ledgerSummary.totalUpdateCount,
      });
    }
  }

  private async refreshPqs(node: NodeConfig): Promise<RefreshAttempt<LedgerSummary>> {
    return this.runAttempt(() => this.pqsSummaryService.fetchSummary(node), this.defaultLedgerSummary(node));
  }

  private async refreshGrpc(node: NodeConfig): Promise<RefreshAttempt<ServiceInfo>> {
    if (node.mode === 'pqs_only') {
      return {
        ok: true,
        value: this.defaultServiceInfo(node),
        latencyMs: null,
        error: null,
      };
    }

    return this.runAttempt(
      () => this.grpcOperationsService.fetchOperationalInfo(node),
      this.defaultServiceInfo(node),
    );
  }

  private async runAttempt<T>(
    run: () => Promise<T>,
    fallback: T,
  ): Promise<RefreshAttempt<T>> {
    const startedAt = Date.now();

    try {
      return {
        ok: true,
        value: await run(),
        latencyMs: Date.now() - startedAt,
        error: null,
      };
    } catch (error) {
      return {
        ok: false,
        value: fallback,
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : 'Unknown refresh failure',
      };
    }
  }

  private combineLatencies(...latencies: Array<number | null>): number | null {
    const measured = latencies.filter((latency): latency is number => latency !== null);
    if (measured.length === 0) {
      return null;
    }

    return Math.max(...measured);
  }

  private formatSourceError<T>(
    source: 'PQS' | 'gRPC',
    attempt: RefreshAttempt<T>,
  ): string | null {
    if (attempt.ok || !attempt.error) {
      return null;
    }

    return `${source}: ${attempt.error}`;
  }

  private defaultServiceInfo(node: NodeConfig): ServiceInfo {
    return {
      target: node.mode === 'pqs_with_grpc' ? node.grpc.ledgerTarget : null,
      reachable: false,
      healthCheckImplemented: false,
      servingStatus: null,
    };
  }

  private defaultLedgerSummary(node: NodeConfig): LedgerSummary {
    return {
      ledgerLabel: node.ledgerLabel ?? node.label,
      pqsDatabase: 'unavailable',
      activeContractCount: 0,
      latestOffset: null,
      latestEventAt: null,
      totalUpdateCount: 0,
    };
  }
}
