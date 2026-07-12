import type { NodeMode } from './nodes';

export interface ActivePartiesNodeEntry {
  nodeId: string;
  label: string;
  mode: NodeMode;
  parties: string[];
  activePartiesStatus?: 'ok' | 'pqs_error';
  activePartiesError?: string | null;
  localPartiesStatus?: 'ok' | 'grpc_not_configured' | 'grpc_error';
  localPartiesError?: string | null;
  localPartiesErrorCode?: string | null;
  localPartiesErrorDetails?: string | null;
  localPartiesErrorTid?: string | null;
}

export interface ActivePartiesResponse {
  nodes: ActivePartiesNodeEntry[];
}

export interface NodePartyFingerprintsEntry {
  nodeId: string;
  label: string;
  mode: NodeMode;
  source: 'pqs' | 'grpc';
  limit: number;
  nextBefore: string | null;
  nextAfter: string | null;
  fingerprints: string[];
}

export interface PartyFingerprintsResponse {
  source: 'pqs' | 'grpc';
  limit: number;
  nextBefore: string | null;
  nextAfter: string | null;
  fingerprints: string[];
}
