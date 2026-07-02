import type { ActivityHistoryResponse } from '../types/activity';
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

export function fetchActivityHistory(): Promise<ActivityHistoryResponse> {
  return fetchJson<ActivityHistoryResponse>('/nodes/activity-history');
}

export function fetchNodeUpdates(id: string, limit = 25): Promise<NodeUpdatesResponse> {
  return fetchJson<NodeUpdatesResponse>(`/nodes/${id}/updates?limit=${limit}`);
}

export function fetchNodeUpdateDetail(
  id: string,
  updateId: string,
): Promise<NodeUpdateDetailResponse> {
  return fetchJson<NodeUpdateDetailResponse>(`/nodes/${id}/updates/${updateId}`);
}
