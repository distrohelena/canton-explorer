import type { NodeMode } from './nodes';

export interface ActivePartiesNodeEntry {
  nodeId: string;
  label: string;
  mode: NodeMode;
  parties: string[];
}

export interface ActivePartiesResponse {
  nodes: ActivePartiesNodeEntry[];
}
