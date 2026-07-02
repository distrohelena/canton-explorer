export interface NodeUpdateEntry {
  updateId: string;
  recordTime: string | null;
  parties: string[];
}

export interface NodeUpdatesResponse {
  nodeId: string;
  label: string;
  limit: number;
  updates: NodeUpdateEntry[];
}

export interface NodeUpdateDetailResponse {
  nodeId: string;
  label: string;
  updateId: string;
  recordTime: string | null;
  parties: string[];
  meta: Record<string, unknown>;
}
