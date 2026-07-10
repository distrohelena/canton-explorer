export interface PartyNodeSummary {
  nodeId: string;
  label: string;
  recentUpdateCount: number;
  recentContractCount: number;
}

export interface PartyRecentUpdate {
  nodeId: string;
  label: string;
  eventOffset: string;
  updateId: string;
  recordTime: string | null;
  parties: string[];
}

export interface PartyRecentContract {
  nodeId: string;
  label: string;
  contractId: string;
  templateId: string | null;
  packageId: string | null;
  packageName: string | null;
  packageVersion: string | null;
  recordTime: string | null;
}

export interface PartyContractsResponse {
  limit: number;
  nextBefore: string | null;
  nextAfter: string | null;
  contracts: PartyRecentContract[];
}

export interface PartyTopologyParticipantMapping {
  participantId: string | null;
  participantUid: string | null;
  permission: string | null;
  threshold: number | null;
  synchronizerIds: string[];
}

export interface PartyTopologyKeyMapping {
  keyFingerprint: string | null;
  publicKey: string | null;
  purpose: string | null;
  keyType: string | null;
  keyFormat: string | null;
  keySpec: string | null;
  threshold: number | null;
  synchronizerIds: string[];
}

export type PartyTopologyNodeStatus = 'ok' | 'grpc_not_configured' | 'grpc_error';

export interface PartyTopologyNodeEntry {
  nodeId: string;
  label: string;
  status: PartyTopologyNodeStatus;
  errorMessage: string | null;
  isLocalParty?: boolean | null;
  partyToParticipants: PartyTopologyParticipantMapping[];
  partyToKeyMappings: PartyTopologyKeyMapping[];
}

export interface PartyDetailResponse {
  partyId: string;
  nodeCount: number;
  recentUpdateCount: number;
  recentContractCount: number;
  nodes: PartyNodeSummary[];
  recentUpdates: PartyRecentUpdate[];
  recentContracts: PartyRecentContract[];
  partyTopologyByNode: PartyTopologyNodeEntry[];
}
