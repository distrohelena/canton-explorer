import type { DecodeState, DecodedDamlValue } from './daml';

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
