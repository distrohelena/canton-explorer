import type { PartyTopologyNodeEntry } from './parties';

export interface NamespacePartySummary {
  partyId: string;
}

export interface NamespacePartiesResponse {
  namespaceId: string;
  partyCount: number;
  limit: number;
  nextBefore: string | null;
  nextAfter: string | null;
  parties: NamespacePartySummary[];
}

export interface NamespaceNodeSummary {
  nodeId: string;
  label: string;
  recentUpdateCount: number;
  recentContractCount: number;
}

export interface NamespaceRecentUpdate {
  nodeId: string;
  label: string;
  eventOffset: string;
  updateId: string;
  recordTime: string | null;
  parties: string[];
  estimatedTrafficUsd?: string | null;
  estimatedTrafficUsdGapDays?: number | null;
}

export interface NamespaceRecentContract {
  nodeId: string;
  label: string;
  contractId: string;
  templateId: string | null;
  packageId: string | null;
  packageName: string | null;
  packageVersion: string | null;
  recordTime: string | null;
}

export interface NamespaceDetailResponse {
  namespaceId: string;
  partyCount: number;
  nodeCount: number;
  recentUpdateCount: number;
  recentContractCount: number;
  nodes: NamespaceNodeSummary[];
  recentUpdates: NamespaceRecentUpdate[];
  recentContracts: NamespaceRecentContract[];
  topologyByNode: PartyTopologyNodeEntry[];
}

export type NamespaceSummaryResponse = Pick<
  NamespaceDetailResponse,
  | 'namespaceId'
  | 'partyCount'
  | 'nodeCount'
  | 'recentUpdateCount'
  | 'recentContractCount'
>;

export type NamespaceNodesResponse = Pick<NamespaceDetailResponse, 'nodes'>;

export type NamespaceTopologyResponse = Pick<
  NamespaceDetailResponse,
  'topologyByNode'
>;
