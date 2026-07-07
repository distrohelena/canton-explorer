export interface SearchResultGroup<T> {
  items: T[];
  displayedCount: number;
  truncated: boolean;
  status: 'ok' | 'partial' | 'failed';
  warnings: string[];
}

export interface SearchUpdateResult {
  nodeId: string;
  label: string;
  eventOffset: string;
  updateId: string;
  recordTime: string | null;
  parties: string[];
}

export interface SearchContractResult {
  nodeId: string;
  label: string;
  contractId: string;
  templateId: string | null;
  createdRecordTime: string | null;
}

export interface SearchPartyResult {
  partyId: string;
  nodeIds: string[];
}

export interface SearchPackageIdResult {
  packageId: string;
  name: string | null;
  version: string | null;
}

export interface SearchPackageNameResult {
  name: string;
  packages: Array<{
    packageId: string;
    version: string | null;
  }>;
}

export interface SearchResultsResponse {
  query: string;
  updates: SearchResultGroup<SearchUpdateResult>;
  contracts: SearchResultGroup<SearchContractResult>;
  parties: SearchResultGroup<SearchPartyResult>;
  packages: {
    packageIds: SearchResultGroup<SearchPackageIdResult>;
    packageNames: SearchResultGroup<SearchPackageNameResult>;
  };
}
