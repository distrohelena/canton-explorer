import type { ActivePartiesResponse } from '../types/active-parties';
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
import type { PartyDetailResponse } from '../types/parties';
import type { PartyContractsResponse } from '../types/parties';
import type { PackageDetailResponse, PackageFamilyResponse } from '../types/packages';
import type { SearchResultsResponse } from '../types/search';
import type { TemplateFilterResponse } from '../types/templates';
import type { TokenTransfersResponse, TokensResponse } from '../types/tokens';
import type {
  GlobalUpdatesResponse,
  NodeUpdateDetailResponse,
  NodeUpdatesResponse,
} from '../types/updates';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';

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

export function fetchTokens(): Promise<TokensResponse> {
  return fetchJson<TokensResponse>('/tokens');
}

export function fetchLatestTokenTransfers(
  limit = 25,
  options?: {
    before?: string;
    after?: string;
  },
): Promise<TokenTransfersResponse> {
  const params = new URLSearchParams();
  if (options?.before) {
    params.set('before', options.before);
  }
  if (options?.after) {
    params.set('after', options.after);
  }
  params.set('limit', String(Math.max(1, Math.trunc(limit))));

  return fetchJson<TokenTransfersResponse>(`/tokens/transfers?${params.toString()}`);
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
