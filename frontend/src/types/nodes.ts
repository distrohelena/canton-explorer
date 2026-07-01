export type NodeStatus = 'healthy' | 'degraded' | 'down';

export interface SourceStatus {
  ok: boolean;
  checkedAt: string;
  latencyMs: number | null;
  message: string | null;
}

export interface NodeSnapshot {
  id: string;
  label: string;
  role: 'participant';
  ledgerLabel: string;
  status: NodeStatus;
  latencyMs: number | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  errorSummary: string | null;
  serviceInfo: {
    target: string | null;
    reachable: boolean;
    healthCheckImplemented: boolean;
    servingStatus: string | null;
  };
  ledgerSummary: {
    ledgerLabel: string;
    pqsDatabase: string;
    activeContractCount: number;
    latestOffset: string | null;
    latestEventAt: string | null;
  };
  sourceStatus: Record<'pqs' | 'grpc', SourceStatus>;
}
