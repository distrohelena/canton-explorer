import { onMounted, ref } from 'vue';
import { fetchNodes } from '../lib/api';
import type { NodeSnapshot } from '../types/nodes';

export function useNodes() {
  const nodes = ref<NodeSnapshot[]>([]);
  const loading = ref(true);
  const error = ref<string | null>(null);

  async function refresh() {
    loading.value = true;
    error.value = null;

    try {
      nodes.value = await fetchNodes();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
    } finally {
      loading.value = false;
    }
  }

  onMounted(() => {
    void refresh();
  });

  return { nodes, loading, error, refresh };
}
