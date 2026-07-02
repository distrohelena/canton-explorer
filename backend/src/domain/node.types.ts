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
  totalUpdateCount: number;
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
  eventOffset: string;
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

export type NodeDecodeFailureReason =
  | 'missing_package'
  | 'invalid_package'
  | 'unknown_template'
  | 'unknown_choice'
  | 'unknown_data_type'
  | 'decode_failure';

export type NodeDecodedDamlValue =
  | string
  | number
  | boolean
  | { kind: 'contract_id'; value: string }
  | { kind: 'record'; fields: Array<{ label: string; value: NodeDecodedDamlValue }> }
  | { kind: 'variant'; constructor: string; value: NodeDecodedDamlValue | null }
  | { kind: 'enum'; constructor: string }
  | { kind: 'list'; items: NodeDecodedDamlValue[] }
  | { kind: 'optional'; value: NodeDecodedDamlValue | null }
  | { kind: 'text_map'; entries: Array<{ key: string; value: NodeDecodedDamlValue }> }
  | { kind: 'gen_map'; entries: Array<{ key: NodeDecodedDamlValue; value: NodeDecodedDamlValue }> }
  | { kind: 'unit' };

export type NodeDecodeState<T> =
  | { status: 'decoded'; value: T }
  | { status: 'invalid_data'; reason: NodeDecodeFailureReason }
  | { status: 'not_available' };

export interface NodeExerciseDecodeState {
  argument: NodeDecodeState<NodeDecodedDamlValue>;
  result: NodeDecodeState<NodeDecodedDamlValue>;
}

export interface NodeUpdateDetailEvent {
  eventKind: 'create' | 'consuming_exercise' | 'non_consuming_exercise';
  eventId: string | null;
  contractId: string | null;
  templateId: string | null;
  choice: string | null;
  witnesses: string[];
  createData?: NodeDecodeState<NodeDecodedDamlValue> | null;
  exerciseData?: NodeExerciseDecodeState | null;
  raw: Record<string, unknown>;
}

export interface NodeUpdateDetailResponse {
  nodeId: string;
  label: string;
  eventOffset: string;
  updateId: string;
  recordTime: string | null;
  parties: string[];
  meta: NodeUpdateDetailMeta;
  events: NodeUpdateDetailEvent[];
}

export interface NodeContractDetailResponse {
  nodeId: string;
  label: string;
  contractId: string;
  templateId: string | null;
  packageId: string | null;
  packageName: string | null;
  packageVersion: string | null;
  createdUpdateId: string | null;
  createdEventOffset: string | null;
  createdRecordTime: string | null;
  archivedUpdateId: string | null;
  archivedEventOffset: string | null;
  archivedRecordTime: string | null;
  contractData: NodeDecodeState<NodeDecodedDamlValue> | null;
}
