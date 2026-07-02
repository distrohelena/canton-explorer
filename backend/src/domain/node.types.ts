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

export interface NodeActivitySample {
  timestamp: string;
  activityValue: number;
  activeContractCount: number;
  latestOffset: string | null;
}

export interface NodeActivitySeries {
  nodeId: string;
  label: string;
  status: NodeStatus;
  latestActiveContractCount: number;
  samples: NodeActivitySample[];
}

export interface NodeActivityHistoryResponse {
  generatedAt: string;
  windowMinutes: number;
  nodes: NodeActivitySeries[];
}

export interface NodeRecentUpdate {
  updateId: string;
  recordTime: string | null;
  parties: string[];
}

export interface NodeRecentUpdatesResponse {
  nodeId: string;
  label: string;
  limit: number;
  updates: NodeRecentUpdate[];
}

export interface NodeUpdateDetailMeta {
  update_id: string;
  record_time: string | number | null;
  [key: string]: unknown;
}

export interface NodeUpdateDetailResponse {
  nodeId: string;
  label: string;
  updateId: string;
  recordTime: string | null;
  parties: string[];
  meta: NodeUpdateDetailMeta;
}
