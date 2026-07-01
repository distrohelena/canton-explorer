<script setup lang="ts">
import type { NodeSnapshot } from '../types/nodes';

defineProps<{
  node: NodeSnapshot;
}>();
</script>

<template>
  <RouterLink class="node-card" :to="`/nodes/${node.id}`">
    <div class="node-card__header">
      <div>
        <p class="node-card__eyebrow">{{ node.role }}</p>
        <h2>{{ node.label }}</h2>
      </div>
      <span class="status-pill" :data-status="node.status">{{ node.status }}</span>
    </div>
    <dl class="node-card__metrics">
      <div>
        <dt>Ledger</dt>
        <dd>{{ node.ledgerSummary.ledgerLabel }}</dd>
      </div>
      <div>
        <dt>Latency</dt>
        <dd>{{ node.latencyMs ?? 'n/a' }} ms</dd>
      </div>
      <div>
        <dt>Contracts</dt>
        <dd>{{ node.ledgerSummary.activeContractCount }} active contracts</dd>
      </div>
    </dl>
  </RouterLink>
</template>
