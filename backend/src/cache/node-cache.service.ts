import { Injectable } from '@nestjs/common';
import type {
  LedgerSummary,
  NodeMode,
  NodeActivityHistoryResponse,
  NodeActivitySample,
  NodeActivitySeries,
  NodeRole,
  NodeStatus,
  ServiceInfo,
  SourceStatus,
} from '../domain/node.types';

export interface NodeSnapshot {
  id: string;
  label: string;
  role: NodeRole;
  mode: NodeMode;
  ledgerLabel: string;
  status: NodeStatus;
  latencyMs: number | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  errorSummary: string | null;
  serviceInfo: ServiceInfo;
  ledgerSummary: LedgerSummary;
  sourceStatus: Record<'pqs' | 'grpc', SourceStatus>;
}

interface StoredActivitySeries {
  nodeId: string;
  label: string;
  status: NodeStatus;
  latestActiveContractCount: number;
  lastObservedUpdateCount: number | null;
  samples: NodeActivitySample[];
}

export interface RecordActivitySampleInput {
  nodeId: string;
  label: string;
  status: NodeStatus;
  timestamp: string;
  activeContractCount: number;
  latestOffset: string | null;
  totalUpdateCount: number;
}

export interface SeedActivityHistoryInput {
  nodeId: string;
  label: string;
  status: NodeStatus;
  latestActiveContractCount: number;
  lastObservedUpdateCount: number;
  samples: NodeActivitySample[];
}

@Injectable()
export class NodeCacheService {
  private static readonly supportedWindowDays = [1, 7, 30] as const;
  private static readonly maxActivityRetentionMs = 30 * 24 * 60 * 60 * 1000;
  private static readonly activityBucketMs = 15 * 60 * 1000;
  private readonly snapshots = new Map<string, NodeSnapshot>();
  private readonly activityHistory = new Map<string, StoredActivitySeries>();

  upsert(snapshot: NodeSnapshot): void {
    this.snapshots.set(snapshot.id, snapshot);
  }

  list(): NodeSnapshot[] {
    return [...this.snapshots.values()].sort((left, right) =>
      left.label.localeCompare(right.label),
    );
  }

  get(id: string): NodeSnapshot | undefined {
    return this.snapshots.get(id);
  }

  hasActivityHistory(nodeId: string): boolean {
    return (this.activityHistory.get(nodeId)?.samples.length ?? 0) > 0;
  }

  seedActivityHistory(seed: SeedActivityHistoryInput): void {
    this.activityHistory.set(seed.nodeId, {
      nodeId: seed.nodeId,
      label: seed.label,
      status: seed.status,
      latestActiveContractCount: seed.latestActiveContractCount,
      lastObservedUpdateCount: seed.lastObservedUpdateCount,
      samples: this.pruneActivitySamples(seed.samples),
    });
  }

  recordActivitySample(sample: RecordActivitySampleInput): void {
    const current = this.activityHistory.get(sample.nodeId);
    const bucketedSample = this.toBucketedActivitySample(sample, current?.lastObservedUpdateCount ?? null);
    const samples = this.pruneActivitySamples(
      this.mergeActivitySample(current?.samples ?? [], bucketedSample),
    );

    this.activityHistory.set(sample.nodeId, {
      nodeId: sample.nodeId,
      label: sample.label,
      status: sample.status,
      latestActiveContractCount: sample.activeContractCount,
      lastObservedUpdateCount: sample.totalUpdateCount,
      samples,
    });
  }

  listActivityHistory(requestedDays?: number): NodeActivityHistoryResponse {
    const windowDays = this.normalizeWindowDays(requestedDays);
    const generatedAt = new Date().toISOString();
    const nodes = [...this.activityHistory.values()]
      .sort((left, right) => left.label.localeCompare(right.label))
      .map<NodeActivitySeries>((series) => ({
        nodeId: series.nodeId,
        label: series.label,
        status: series.status,
        latestActiveContractCount: series.latestActiveContractCount,
        samples: this.sliceSamplesForWindow(series.samples, windowDays, generatedAt),
      }));

    return {
      generatedAt,
      windowMinutes: windowDays * 1440,
      nodes,
    };
  }

  private toBucketedActivitySample(
    sample: RecordActivitySampleInput,
    previousTotalUpdateCount: number | null,
  ): NodeActivitySample {
    const bucketTimestamp = this.floorToBucketTimestamp(sample.timestamp);

    return {
      timestamp: bucketTimestamp,
      activityValue: this.computeActivityDelta(previousTotalUpdateCount, sample.totalUpdateCount),
      activeContractCount: sample.activeContractCount,
      latestOffset: sample.latestOffset,
    };
  }

  private mergeActivitySample(
    existingSamples: NodeActivitySample[],
    incomingSample: NodeActivitySample,
  ): NodeActivitySample[] {
    const lastSample = existingSamples.at(-1);

    if (lastSample?.timestamp === incomingSample.timestamp) {
      return [
        ...existingSamples.slice(0, -1),
        {
          ...incomingSample,
          activityValue: lastSample.activityValue + incomingSample.activityValue,
        },
      ];
    }

    return [...existingSamples, incomingSample];
  }

  private normalizeWindowDays(requestedDays?: number): 1 | 7 | 30 {
    if (
      requestedDays &&
      Number.isFinite(requestedDays) &&
      NodeCacheService.supportedWindowDays.includes(requestedDays as 1 | 7 | 30)
    ) {
    return requestedDays as 1 | 7 | 30;
  }

    return 1;
  }

  private sliceSamplesForWindow(
    samples: NodeActivitySample[],
    windowDays: 1 | 7 | 30,
    generatedAt: string,
  ): NodeActivitySample[] {
    if (samples.length === 0) {
      return [];
    }

    const generatedAtTimestamp = Date.parse(generatedAt);
    if (!Number.isFinite(generatedAtTimestamp)) {
      return [...samples];
    }

    const windowStart = generatedAtTimestamp - windowDays * 24 * 60 * 60 * 1000;

    return samples.filter((sample) => {
      const sampleTimestamp = Date.parse(sample.timestamp);
      return (
        Number.isFinite(sampleTimestamp) &&
        sampleTimestamp >= windowStart &&
        sampleTimestamp <= generatedAtTimestamp
      );
    });
  }

  private pruneActivitySamples(samples: NodeActivitySample[]): NodeActivitySample[] {
    if (samples.length === 0) {
      return [];
    }

    const latestTimestamp = Date.parse(samples[samples.length - 1].timestamp);
    if (!Number.isFinite(latestTimestamp)) {
      return [...samples];
    }

    const retentionStart =
      latestTimestamp - NodeCacheService.maxActivityRetentionMs;

    return samples.filter((sample) => {
      const sampleTimestamp = Date.parse(sample.timestamp);
      return Number.isFinite(sampleTimestamp) && sampleTimestamp >= retentionStart;
    });
  }

  private computeActivityDelta(
    previousTotalUpdateCount: number | null,
    currentTotalUpdateCount: number,
  ): number {
    if (previousTotalUpdateCount === null) {
      return 0;
    }

    if (currentTotalUpdateCount < previousTotalUpdateCount) {
      return 0;
    }

    return currentTotalUpdateCount - previousTotalUpdateCount;
  }

  private floorToBucketTimestamp(timestamp: string): string {
    const parsedTimestamp = Date.parse(timestamp);
    if (!Number.isFinite(parsedTimestamp)) {
      return timestamp;
    }

    return new Date(
      Math.floor(parsedTimestamp / NodeCacheService.activityBucketMs) *
        NodeCacheService.activityBucketMs,
    ).toISOString();
  }
}
