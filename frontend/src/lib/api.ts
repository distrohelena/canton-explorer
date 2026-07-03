import type { ActivePartiesResponse } from '../types/active-parties';
import type { ActivityHistoryResponse } from '../types/activity';
import type { NodeContractDetailResponse } from '../types/contracts';
import type { NodePackagesResponse, NodeSnapshot } from '../types/nodes';
import type { PartyDetailResponse } from '../types/parties';
import type { PackageDetailResponse, PackageFamilyResponse } from '../types/packages';
import type { NodeUpdateDetailResponse, NodeUpdatesResponse } from '../types/updates';

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

export function fetchNode(id: string): Promise<NodeSnapshot> {
  return fetchJson<NodeSnapshot>(`/nodes/${id}`);
}

export function fetchNodePackages(id: string): Promise<NodePackagesResponse> {
  return fetchJson<NodePackagesResponse>(`/nodes/${id}/packages`);
}

export function fetchActivityHistory(days = 1): Promise<ActivityHistoryResponse> {
  return fetchJson<ActivityHistoryResponse>(`/nodes/activity-history?days=${days}`);
}

export function fetchNodeUpdates(
  id: string,
  options?: {
    before?: string;
    after?: string;
    parties?: string[];
    mode?: 'or' | 'and';
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
  if (options?.mode) {
    params.set('mode', options.mode);
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

export function fetchPackagesByName(packageName: string): Promise<PackageFamilyResponse> {
  return fetchJson<PackageFamilyResponse>(`/packages/by-name/${encodeURIComponent(packageName)}`);
}

export function fetchPartyDetail(partyId: string): Promise<PartyDetailResponse> {
  return fetchJson<PartyDetailResponse>(`/parties/${encodeURIComponent(partyId)}`);
}
