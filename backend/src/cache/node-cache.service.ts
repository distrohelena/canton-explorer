import { Injectable } from '@nestjs/common';
import type {
  LedgerSummary,
  NodeRole,
  NodeStatus,
  ServiceInfo,
  SourceStatus,
} from '../domain/node.types';

export interface NodeSnapshot {
  id: string;
  label: string;
  role: NodeRole;
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

@Injectable()
export class NodeCacheService {
  private readonly snapshots = new Map<string, NodeSnapshot>();

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
}
