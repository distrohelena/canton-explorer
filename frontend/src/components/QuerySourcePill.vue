<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  source: 'pqs' | 'grpc';
  fallback?: boolean;
}>();

const label = computed(() => (props.source === 'pqs' ? 'PQS' : 'gRPC'));
const title = computed(() => {
  if (props.source === 'pqs') {
    return 'Data sourced from PQS';
  }

  if (props.fallback) {
    return 'fallback mode';
  }

  return 'Data sourced from gRPC';
});
</script>

<template>
  <span
    class="query-source-pill"
    :class="{
      'query-source-pill--pqs': source === 'pqs',
      'query-source-pill--grpc': source === 'grpc',
      'query-source-pill--fallback': source === 'grpc' && fallback,
    }"
    :title="title"
  >
    {{ label }}
  </span>
</template>
