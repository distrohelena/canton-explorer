import type { DecodeState, DecodedDamlValue, ExerciseDecodeState } from './daml';

export interface NodeUpdateEntry {
  eventOffset: string;
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
  eventOffset: string;
  updateId: string;
  recordTime: string | null;
  parties: string[];
  events: NodeUpdateDetailEvent[];
  meta: Record<string, unknown>;
}

export interface NodeUpdateDetailEvent {
  eventKind: 'create' | 'consuming_exercise' | 'non_consuming_exercise';
  eventId: string | null;
  contractId: string | null;
  templateId: string | null;
  choice: string | null;
  witnesses: string[];
  createData?: DecodeState<DecodedDamlValue> | null;
  exerciseData?: ExerciseDecodeState | null;
  raw: Record<string, unknown>;
}
