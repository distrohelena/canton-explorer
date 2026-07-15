<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchSearchResults } from '../lib/api';

const route = useRoute();
const router = useRouter();
const resolving = ref(true);

const rawUpdateId = route.params.updateId;
const updateId = typeof rawUpdateId === 'string' ? rawUpdateId : rawUpdateId?.[0] ?? '';

onMounted(async () => {
  try {
    const results = await fetchSearchResults(updateId);
    const firstUpdate = results.updates.items[0];

    if (firstUpdate) {
      await router.replace(`/nodes/${firstUpdate.nodeId}/updates/${firstUpdate.eventOffset}`);
    } else {
      await router.replace({ path: '/search', query: { q: updateId } });
    }
  } catch {
    await router.replace({ path: '/search', query: { q: updateId } });
  } finally {
    resolving.value = false;
  }
});
</script>

<template>
  <p v-if="resolving">Resolving transaction...</p>
</template>
