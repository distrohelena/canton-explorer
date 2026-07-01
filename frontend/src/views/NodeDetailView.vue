<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { fetchNode } from '../lib/api';
import type { NodeSnapshot } from '../types/nodes';

const props = defineProps<{ id: string }>();

const node = ref<NodeSnapshot | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    node.value = await fetchNode(props.id);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
  }
});
</script>

<template>
  <section class="node-detail">
    <p v-if="error">{{ error }}</p>
    <p v-else-if="!node">Loading node detail...</p>
    <div v-else>
      <RouterLink to="/">Back to dashboard</RouterLink>
      <h2>{{ node.label }}</h2>
      <p>{{ node.serviceInfo.servingStatus ?? 'Health check unavailable' }}</p>
      <dl class="detail-grid">
        <div>
          <dt>PQS database</dt>
          <dd>{{ node.ledgerSummary.pqsDatabase }}</dd>
        </div>
        <div>
          <dt>Latest offset</dt>
          <dd>{{ node.ledgerSummary.latestOffset ?? 'n/a' }}</dd>
        </div>
        <div>
          <dt>gRPC target</dt>
          <dd>{{ node.serviceInfo.target ?? 'not configured' }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>
