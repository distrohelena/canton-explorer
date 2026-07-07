import type { DecodeState, DecodedDamlValue } from './daml';

export interface NodeActiveContractSummary {
  contractId: string;
  templateId: string | null;
  createdRecordTime: string | null;
}

export interface NodeContractsResponse {
  nodeId: string;
  label: string;
  limit: number;
  nextBefore: string | null;
  nextAfter: string | null;
  contracts: NodeActiveContractSummary[];
}

export interface NodeContractsQueryOptions {
  before?: string;
  after?: string;
  limit?: number;
  parties?: string[];
  templates?: string[];
  partyMode?: 'or' | 'and';
  hideSplice?: boolean;
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
  contractData: DecodeState<DecodedDamlValue> | null;
}
