import type { NodeSnapshot } from '../types/nodes';

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
