import type { NodeMode } from './nodes';

export interface ActivePartiesNodeEntry {
  nodeId: string;
  label: string;
  mode: NodeMode;
  parties: string[];
  localPartiesStatus?: 'ok' | 'grpc_not_configured' | 'grpc_error';
  localPartiesError?: string | null;
  localPartiesErrorCode?: string | null;
  localPartiesErrorDetails?: string | null;
  localPartiesErrorTid?: string | null;
}

export interface ActivePartiesResponse {
  nodes: ActivePartiesNodeEntry[];
}
