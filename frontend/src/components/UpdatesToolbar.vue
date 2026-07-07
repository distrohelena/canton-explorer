<script setup lang="ts">
defineProps<{
  advancedFilterExpanded: boolean;
  advancedFilterControls?: string;
  newerDisabled: boolean;
  olderDisabled: boolean;
}>();

defineEmits<{
  toggleAdvancedFilter: [];
  newer: [];
  older: [];
}>();
</script>

<template>
  <div class="node-updates__pager">
    <button
      type="button"
      class="dashboard__refresh"
      :aria-expanded="advancedFilterExpanded"
      :aria-controls="advancedFilterControls"
      @click="$emit('toggleAdvancedFilter')"
    >
      Advanced Filter
    </button>
    <button
      type="button"
      class="dashboard__refresh"
      :disabled="newerDisabled"
      @click="$emit('newer')"
    >
      Newer
    </button>
    <button
      type="button"
      class="dashboard__refresh"
      :disabled="olderDisabled"
      @click="$emit('older')"
    >
      Older
    </button>
  </div>
</template>
