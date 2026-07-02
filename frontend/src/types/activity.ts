import type { NodeStatus } from './nodes';

export interface ActivitySample {
  timestamp: string;
  activityValue: number;
  activeContractCount: number;
  latestOffset: string | null;
}

export interface ActivitySeries {
  nodeId: string;
  label: string;
  status: NodeStatus;
  latestActiveContractCount: number;
  samples: ActivitySample[];
}

export interface ActivityHistoryResponse {
  generatedAt: string;
  windowMinutes: number;
  nodes: ActivitySeries[];
}
