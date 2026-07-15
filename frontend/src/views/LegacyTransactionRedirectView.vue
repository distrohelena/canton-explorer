<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchSearchResults } from '../lib/api';

defineProps<{ updateId: string }>();

const route = useRoute();
const router = useRouter();
const resolving = ref(true);
let resolutionSequence = 0;

const updateId = computed(() => {
  const rawUpdateId = route.params.updateId;
  return typeof rawUpdateId === 'string' ? rawUpdateId : rawUpdateId?.[0] ?? null;
});

async function resolveLegacyTransaction(updateId: string) {
  const sequence = ++resolutionSequence;
  resolving.value = true;

  try {
    const results = await fetchSearchResults(updateId);
    const firstUpdate = results.updates.items[0];

    if (sequence !== resolutionSequence) {
      return;
    }

    if (firstUpdate) {
      await router.replace(`/nodes/${firstUpdate.nodeId}/updates/${firstUpdate.eventOffset}`);
    } else {
      await router.replace({ path: '/search', query: { q: updateId } });
    }
  } catch {
    if (sequence !== resolutionSequence) {
      return;
    }

    await router.replace({ path: '/search', query: { q: updateId } });
  } finally {
    if (sequence === resolutionSequence) {
      resolving.value = false;
    }
  }
}

watch(updateId, (value) => {
  if (value !== null) {
    void resolveLegacyTransaction(value);
  }
}, { immediate: true });

onBeforeUnmount(() => {
  resolutionSequence += 1;
});
</script>

<template>
  <p v-if="resolving">Resolving transaction...</p>
</template>
