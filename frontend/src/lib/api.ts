import type { ActivityHistoryResponse } from '../types/activity';
import type { NodeContractDetailResponse } from '../types/contracts';
import type { NodeSnapshot } from '../types/nodes';
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

export function fetchNode(id: string): Promise<NodeSnapshot> {
  return fetchJson<NodeSnapshot>(`/nodes/${id}`);
}

export function fetchActivityHistory(days = 1): Promise<ActivityHistoryResponse> {
  return fetchJson<ActivityHistoryResponse>(`/nodes/activity-history?days=${days}`);
}

export function fetchNodeUpdates(id: string, limit = 25): Promise<NodeUpdatesResponse> {
  return fetchJson<NodeUpdatesResponse>(`/nodes/${id}/updates?limit=${limit}`);
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
