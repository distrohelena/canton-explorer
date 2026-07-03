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

export interface PartyDetailResponse {
  partyId: string;
  nodeCount: number;
  recentUpdateCount: number;
  recentContractCount: number;
  nodes: PartyNodeSummary[];
  recentUpdates: PartyRecentUpdate[];
  recentContracts: PartyRecentContract[];
}
