<script setup lang="ts">
import { computed } from 'vue';
import type { NodeSnapshot } from '../types/nodes';

const props = defineProps<{
  node: NodeSnapshot;
}>();

const statusLabel = computed(
  () => props.node.status.charAt(0).toUpperCase() + props.node.status.slice(1),
);
</script>

<template>
  <RouterLink class="node-card" :to="`/nodes/${node.id}`">
    <div class="node-card__topline">
      <p class="node-card__eyebrow">{{ node.role }}</p>
      <span class="node-card__state-dot" :data-status="node.status" aria-hidden="true"></span>
    </div>
    <div class="node-card__body">
      <h3>{{ node.label }}</h3>
      <p class="node-card__status" :data-status="node.status">{{ statusLabel }}</p>
    </div>
  </RouterLink>
</template>
