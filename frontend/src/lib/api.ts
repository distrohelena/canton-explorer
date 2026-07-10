import type {
  ActivePartiesResponse,
  NodePartyFingerprintsEntry,
  PartyFingerprintsResponse,
} from '../types/active-parties';
import type { ActivityHistoryResponse } from '../types/activity';
import type {
  GlobalContractsResponse,
  NodeContractDetailResponse,
  NodeContractsQueryOptions,
  NodeContractsResponse,
} from '../types/contracts';
import type {
  NodePackagesResponse,
  NodeParticipantStatusResponse,
  NodeSnapshot,
} from '../types/nodes';
import type { NamespaceDetailResponse, NamespacePartiesResponse } from '../types/namespaces';
import type { PartyDetailResponse } from '../types/parties';
import type { PartyContractsResponse } from '../types/parties';
import type { PackageDetailResponse, PackageFamilyResponse } from '../types/packages';
import type { SearchResultsResponse } from '../types/search';
import type { TemplateFilterResponse } from '../types/templates';
import type {
  TokenDetailResponse,
  TokenHoldersResponse,
  TokenTransfersResponse,
  TokensResponse,
} from '../types/tokens';
import type {
  GlobalUpdatesResponse,
  NodeUpdateDetailResponse,
  NodeUpdatesResponse,
} from '../types/updates';

export function resolveApiBaseUrl(
  envBaseUrl = import.meta.env.VITE_API_BASE_URL,
  hostname = typeof window !== 'undefined' ? window.location.hostname : undefined,
): string {
  if (hostname === 'canton.sweetsquare.io') {
    return 'https://canton-server.sweetsquare.io/api';
  }

  if (envBaseUrl?.trim()) {
    return envBaseUrl;
  }

  return 'http://localhost:4600/api';
}

const API_BASE = resolveApiBaseUrl();

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function fetchNodes(): Promise<NodeSnapshot[]> {
  return fetchJson<NodeSnapshot[]>('/nodes');
}

export function fetchActiveParties(): Promise<ActivePartiesResponse> {
  return fetchJson<ActivePartiesResponse>('/parties');
}

export function fetchLocalParties(): Promise<ActivePartiesResponse> {
  return fetchJson<ActivePartiesResponse>('/parties/local');
}

export function fetchNodeActiveParties(id: string): Promise<ActivePartiesResponse['nodes'][number]> {
  return fetchJson<ActivePartiesResponse['nodes'][number]>(`/nodes/${id}/parties`);
}

export function fetchNodeLocalParties(id: string): Promise<ActivePartiesResponse['nodes'][number]> {
  return fetchJson<ActivePartiesResponse['nodes'][number]>(`/nodes/${id}/parties/local`);
}

export function fetchPartyFingerprints(options?: {
  before?: string;
  after?: string;
  limit?: number;
  publicKey?: string;
  encoding?: 'auto' | 'hex' | 'base64' | 'pem';
  keyFormat?: 'raw' | 'derX509SubjectPublicKeyInfo';
  keyType?: 'auto' | 'ed25519' | 'x25519' | 'secp256k1' | 'other';
}): Promise<PartyFingerprintsResponse> {
  const params = new URLSearchParams();
  if (options?.before) {
    params.set('before', options.before);
  }
  if (options?.after) {
    params.set('after', options.after);
  }
  if (typeof options?.limit === 'number' && Number.isFinite(options.limit) && options.limit > 0) {
    params.set('limit', String(Math.trunc(options.limit)));
  }
  if (options?.publicKey?.trim()) {
    params.set('publicKey', options.publicKey.trim());
  }
  if (options?.encoding && options.encoding !== 'auto') {
    params.set('encoding', options.encoding);
  }
  if (options?.keyFormat && options.keyFormat !== 'raw') {
    params.set('keyFormat', options.keyFormat);
  }
  if (options?.keyType && options.keyType !== 'auto') {
    params.set('keyType', options.keyType);
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : '';
  return fetchJson<PartyFingerprintsResponse>(`/parties/fingerprints${suffix}`);
}

export function fetchNodePartyFingerprints(
  id: string,
  options?: {
    before?: string;
    after?: string;
    limit?: number;
    publicKey?: string;
    encoding?: 'auto' | 'hex' | 'base64' | 'pem';
    keyFormat?: 'raw' | 'derX509SubjectPublicKeyInfo';
    keyType?: 'auto' | 'ed25519' | 'x25519' | 'secp256k1' | 'other';
  },
): Promise<NodePartyFingerprintsEntry> {
  const params = new URLSearchParams();
  if (options?.before) {
    params.set('before', options.before);
  }
  if (options?.after) {
    params.set('after', options.after);
  }
  if (typeof options?.limit === 'number' && Number.isFinite(options.limit) && options.limit > 0) {
    params.set('limit', String(Math.trunc(options.limit)));
  }
  if (options?.publicKey?.trim()) {
    params.set('publicKey', options.publicKey.trim());
  }
  if (options?.encoding && options.encoding !== 'auto') {
    params.set('encoding', options.encoding);
  }
  if (options?.keyFormat && options.keyFormat !== 'raw') {
    params.set('keyFormat', options.keyFormat);
  }
  if (options?.keyType && options.keyType !== 'auto') {
    params.set('keyType', options.keyType);
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : '';
  return fetchJson<NodePartyFingerprintsEntry>(`/nodes/${id}/parties/fingerprints${suffix}`);
}

export function fetchNodeContracts(
  id: string,
  options?: NodeContractsQueryOptions,
): Promise<NodeContractsResponse> {
  const params = new URLSearchParams();
  if (options?.before) {
    params.set('before', options.before);
  }
  if (options?.after) {
    params.set('after', options.after);
  }
  for (const party of options?.parties ?? []) {
    if (party.trim()) {
      params.append('party', party);
    }
  }
  for (const template of options?.templates ?? []) {
    if (template.trim()) {
      params.append('template', template);
    }
  }
  if (options?.partyMode) {
    params.set('partyMode', options.partyMode);
  }
  if (options?.hideSplice) {
    params.set('hideSplice', 'true');
  }
  if (typeof options?.limit === 'number' && Number.isFinite(options.limit) && options.limit > 0) {
    params.set('limit', String(Math.trunc(options.limit)));
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : '';
  return fetchJson<NodeContractsResponse>(`/nodes/${id}/contracts${suffix}`);
}

export function fetchLatestContracts(
  limit = 25,
  options?: {
    before?: string;
    after?: string;
    parties?: string[];
    templates?: string[];
    partyMode?: 'or' | 'and';
    hideSplice?: boolean;
  },
): Promise<GlobalContractsResponse> {
  const params = new URLSearchParams();
  if (options?.before) {
    params.set('before', options.before);
  }
  if (options?.after) {
    params.set('after', options.after);
  }
  for (const party of options?.parties ?? []) {
    if (party.trim()) {
      params.append('party', party);
    }
  }
  for (const template of options?.templates ?? []) {
    if (template.trim()) {
      params.append('template', template);
    }
  }
  if (options?.partyMode) {
    params.set('partyMode', options.partyMode);
  }
  if (options?.hideSplice) {
    params.set('hideSplice', 'true');
  }
  params.set('limit', String(Math.max(1, Math.trunc(limit))));

  return fetchJson<GlobalContractsResponse>(`/contracts?${params.toString()}`);
}

export function fetchNode(id: string): Promise<NodeSnapshot> {
  return fetchJson<NodeSnapshot>(`/nodes/${id}`);
}

export function fetchNodePackages(id: string): Promise<NodePackagesResponse> {
  return fetchJson<NodePackagesResponse>(`/nodes/${id}/packages`);
}

export function fetchNodeTemplates(id: string): Promise<TemplateFilterResponse> {
  return fetchJson<TemplateFilterResponse>(`/nodes/${id}/templates`);
}

export function fetchNodeParticipantStatus(id: string): Promise<NodeParticipantStatusResponse> {
  return fetchJson<NodeParticipantStatusResponse>(`/nodes/${id}/participant-status`);
}

export function fetchActivityHistory(days = 1): Promise<ActivityHistoryResponse> {
  return fetchJson<ActivityHistoryResponse>(`/nodes/activity-history?days=${days}`);
}

export function fetchSearchResults(query: string): Promise<SearchResultsResponse> {
  return fetchJson<SearchResultsResponse>(`/search?q=${encodeURIComponent(query.trim())}`);
}

export function fetchTokens(options?: {
  before?: string;
  after?: string;
  limit?: number;
}): Promise<TokensResponse> {
  const params = new URLSearchParams();
  if (options?.before) {
    params.set('before', options.before);
  }
  if (options?.after) {
    params.set('after', options.after);
  }
  if (typeof options?.limit === 'number' && Number.isFinite(options.limit) && options.limit > 0) {
    params.set('limit', String(Math.trunc(options.limit)));
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : '';
  return fetchJson<TokensResponse>(`/tokens${suffix}`);
}

export function fetchTokenDetail(tokenId: string): Promise<TokenDetailResponse> {
  return fetchJson<TokenDetailResponse>(`/tokens/${encodeURIComponent(tokenId)}`);
}

export function fetchTokenHolders(
  tokenId: string,
  limit = 25,
  options?: {
    before?: string;
    after?: string;
  },
): Promise<TokenHoldersResponse> {
  const params = new URLSearchParams();
  if (options?.before) {
    params.set('before', options.before);
  }
  if (options?.after) {
    params.set('after', options.after);
  }
  params.set('limit', String(Math.max(1, Math.trunc(limit))));

  return fetchJson<TokenHoldersResponse>(
    `/tokens/${encodeURIComponent(tokenId)}/holders?${params.toString()}`,
  );
}

export function fetchLatestTokenTransfers(
  limit = 25,
  options?: {
    before?: string;
    after?: string;
    fromParties?: string[];
    toParties?: string[];
    amountGt?: string;
    amountLt?: string;
  },
): Promise<TokenTransfersResponse> {
  const params = new URLSearchParams();
  if (options?.before) {
    params.set('before', options.before);
  }
  if (options?.after) {
    params.set('after', options.after);
  }
  for (const party of options?.fromParties ?? []) {
    if (party.trim()) {
      params.append('fromParty', party);
    }
  }
  for (const party of options?.toParties ?? []) {
    if (party.trim()) {
      params.append('toParty', party);
    }
  }
  if (options?.amountGt?.trim()) {
    params.set('amountGt', options.amountGt.trim());
  }
  if (options?.amountLt?.trim()) {
    params.set('amountLt', options.amountLt.trim());
  }
  params.set('limit', String(Math.max(1, Math.trunc(limit))));

  return fetchJson<TokenTransfersResponse>(`/tokens/transfers?${params.toString()}`);
}

export function fetchTokenTransfers(
  tokenId: string,
  limit = 25,
  options?: {
    before?: string;
    after?: string;
    fromParties?: string[];
    toParties?: string[];
    amountGt?: string;
    amountLt?: string;
  },
): Promise<TokenTransfersResponse> {
  const params = new URLSearchParams();
  if (options?.before) {
    params.set('before', options.before);
  }
  if (options?.after) {
    params.set('after', options.after);
  }
  for (const party of options?.fromParties ?? []) {
    if (party.trim()) {
      params.append('fromParty', party);
    }
  }
  for (const party of options?.toParties ?? []) {
    if (party.trim()) {
      params.append('toParty', party);
    }
  }
  if (options?.amountGt?.trim()) {
    params.set('amountGt', options.amountGt.trim());
  }
  if (options?.amountLt?.trim()) {
    params.set('amountLt', options.amountLt.trim());
  }
  params.set('limit', String(Math.max(1, Math.trunc(limit))));

  return fetchJson<TokenTransfersResponse>(
    `/tokens/${encodeURIComponent(tokenId)}/transfers?${params.toString()}`,
  );
}

export function fetchTokenTransferDetail(updateId: string): Promise<TokenTransfersResponse['transfers'][number]> {
  return fetchJson<TokenTransfersResponse['transfers'][number]>(
    `/tokens/transfers/${encodeURIComponent(updateId)}`,
  );
}

export function fetchLatestUpdates(
  limit = 25,
  options?: {
    before?: string;
    after?: string;
    parties?: string[];
    templates?: string[];
    partyMode?: 'or' | 'and';
    hideSplice?: boolean;
  },
): Promise<GlobalUpdatesResponse> {
  const params = new URLSearchParams();
  if (options?.before) {
    params.set('before', options.before);
  }
  if (options?.after) {
    params.set('after', options.after);
  }
  for (const party of options?.parties ?? []) {
    if (party.trim()) {
      params.append('party', party);
    }
  }
  for (const template of options?.templates ?? []) {
    if (template.trim()) {
      params.append('template', template);
    }
  }
  if (options?.partyMode) {
    params.set('partyMode', options.partyMode);
  }
  if (options?.hideSplice) {
    params.set('hideSplice', 'true');
  }
  params.set('limit', String(Math.max(1, Math.trunc(limit))));

  return fetchJson<GlobalUpdatesResponse>(`/updates?${params.toString()}`);
}

export function fetchNodeUpdates(
  id: string,
  options?: {
    before?: string;
    after?: string;
    parties?: string[];
    templates?: string[];
    partyMode?: 'or' | 'and';
    hideSplice?: boolean;
    limit?: number;
  },
): Promise<NodeUpdatesResponse> {
  const params = new URLSearchParams();
  if (options?.before) {
    params.set('before', options.before);
  }
  if (options?.after) {
    params.set('after', options.after);
  }
  for (const party of options?.parties ?? []) {
    if (party.trim()) {
      params.append('party', party);
    }
  }
  for (const template of options?.templates ?? []) {
    if (template.trim()) {
      params.append('template', template);
    }
  }
  if (options?.partyMode) {
    params.set('partyMode', options.partyMode);
  }
  if (options?.hideSplice) {
    params.set('hideSplice', 'true');
  }
  if (typeof options?.limit === 'number' && Number.isFinite(options.limit) && options.limit > 0) {
    params.set('limit', String(Math.trunc(options.limit)));
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : '';
  return fetchJson<NodeUpdatesResponse>(`/nodes/${id}/updates${suffix}`);
}

export function fetchNodeUpdateDetail(
  id: string,
  eventOffset: string,
): Promise<NodeUpdateDetailResponse> {
  return fetchJson<NodeUpdateDetailResponse>(`/nodes/${id}/updates/${eventOffset}`);
}

export function fetchNodeContractDetail(
  id: string,
  contractId: string,
): Promise<NodeContractDetailResponse> {
  return fetchJson<NodeContractDetailResponse>(`/nodes/${id}/contracts/${contractId}`);
}

export function fetchPackageDetail(packageId: string): Promise<PackageDetailResponse> {
  return fetchJson<PackageDetailResponse>(`/packages/${packageId}`);
}

export function fetchTemplates(): Promise<TemplateFilterResponse> {
  return fetchJson<TemplateFilterResponse>('/templates');
}

export function fetchPackagesByName(packageName: string): Promise<PackageFamilyResponse> {
  return fetchJson<PackageFamilyResponse>(`/packages/by-name/${encodeURIComponent(packageName)}`);
}

export function fetchPartyDetail(partyId: string): Promise<PartyDetailResponse> {
  return fetchJson<PartyDetailResponse>(`/parties/${encodeURIComponent(partyId)}`);
}

export function fetchNamespaceDetail(namespaceId: string): Promise<NamespaceDetailResponse> {
  return fetchJson<NamespaceDetailResponse>(`/namespaces/${encodeURIComponent(namespaceId)}`);
}

export function fetchNamespaceParties(
  namespaceId: string,
  options?: {
    before?: string;
    after?: string;
    limit?: number;
  },
): Promise<NamespacePartiesResponse> {
  const params = new URLSearchParams();
  if (options?.before) {
    params.set('before', options.before);
  }
  if (options?.after) {
    params.set('after', options.after);
  }
  if (typeof options?.limit === 'number' && Number.isFinite(options.limit) && options.limit > 0) {
    params.set('limit', String(Math.trunc(options.limit)));
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : '';
  return fetchJson<NamespacePartiesResponse>(
    `/namespaces/${encodeURIComponent(namespaceId)}/parties${suffix}`,
  );
}

export function fetchPartyUpdates(
  partyId: string,
  options?: {
    before?: string;
    after?: string;
    templates?: string[];
    hideSplice?: boolean;
    limit?: number;
  },
): Promise<GlobalUpdatesResponse> {
  const params = new URLSearchParams();
  if (options?.before) {
    params.set('before', options.before);
  }
  if (options?.after) {
    params.set('after', options.after);
  }
  for (const template of options?.templates ?? []) {
    if (template.trim()) {
      params.append('template', template);
    }
  }
  if (options?.hideSplice) {
    params.set('hideSplice', 'true');
  }
  params.set('limit', String(Math.max(1, Math.trunc(options?.limit ?? 25))));

  return fetchJson<GlobalUpdatesResponse>(
    `/parties/${encodeURIComponent(partyId)}/updates?${params.toString()}`,
  );
}

export function fetchPartyContracts(
  partyId: string,
  options?: {
    before?: string;
    after?: string;
    templates?: string[];
    hideSplice?: boolean;
    limit?: number;
  },
): Promise<PartyContractsResponse> {
  const params = new URLSearchParams();
  if (options?.before) {
    params.set('before', options.before);
  }
  if (options?.after) {
    params.set('after', options.after);
  }
  for (const template of options?.templates ?? []) {
    if (template.trim()) {
      params.append('template', template);
    }
  }
  if (options?.hideSplice) {
    params.set('hideSplice', 'true');
  }
  params.set('limit', String(Math.max(1, Math.trunc(options?.limit ?? 25))));

  return fetchJson<PartyContractsResponse>(
    `/parties/${encodeURIComponent(partyId)}/contracts?${params.toString()}`,
  );
}
