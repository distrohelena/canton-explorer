import { onMounted, ref } from 'vue';
import { fetchActivityHistory } from '../lib/api';
import type { ActivityHistoryResponse } from '../types/activity';

export function useActivityHistory() {
  const history = ref<ActivityHistoryResponse | null>(null);
  const loading = ref(true);
  const error = ref<string | null>(null);
  const selectedDays = ref<1 | 7 | 30>(7);

  async function refresh() {
    loading.value = true;
    error.value = null;

    try {
      history.value = await fetchActivityHistory(selectedDays.value);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
    } finally {
      loading.value = false;
    }
  }

  async function selectDays(days: 1 | 7 | 30) {
    if (selectedDays.value === days) {
      return;
    }

    selectedDays.value = days;
    await refresh();
  }

  onMounted(() => {
    void refresh();
  });

  return { history, loading, error, refresh, selectedDays, selectDays };
}
