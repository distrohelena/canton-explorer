export type NodeRole = 'participant';
export type NodeStatus = 'healthy' | 'degraded' | 'down';

export interface SourceStatus {
  ok: boolean;
  checkedAt: string;
  latencyMs: number | null;
  message: string | null;
}

export interface LedgerSummary {
  ledgerLabel: string;
  pqsDatabase: string;
  activeContractCount: number;
  latestOffset: string | null;
  latestEventAt: string | null;
}

export interface ServiceInfo {
  target: string | null;
  reachable: boolean;
  healthCheckImplemented: boolean;
  servingStatus: string | null;
}
