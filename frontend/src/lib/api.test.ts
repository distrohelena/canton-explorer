import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchNodes } from './api';

describe('fetchNodes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads node summaries from the backend API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { id: 'participant-1', label: 'Participant 1', status: 'healthy' },
        ],
      }),
    );

    const nodes = await fetchNodes();

    expect(nodes[0].id).toBe('participant-1');
  });
});
