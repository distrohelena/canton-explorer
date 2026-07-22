import type { NodeMode, NodeStatus } from './nodes';

export interface ActivitySample {
  timestamp: string;
  activityValue: number;
  activeContractCount: number;
  latestOffset: string | null;
}

export interface ActivitySeries {
  nodeId: string;
  label: string;
  mode?: NodeMode;
  status: NodeStatus;
  latestActiveContractCount: number;
  samples: ActivitySample[];
}

export interface ActivityHistoryResponse {
  generatedAt: string;
  windowMinutes: number;
  nodes: ActivitySeries[];
}
