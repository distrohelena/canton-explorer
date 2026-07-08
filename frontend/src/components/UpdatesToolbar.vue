<script setup lang="ts">
import { PAGE_SIZE_OPTIONS } from '../lib/pagination';

const props = withDefaults(
  defineProps<{
    advancedFilterExpanded: boolean;
    advancedFilterControls?: string;
    newerDisabled: boolean;
    olderDisabled: boolean;
    pageSize: number;
    pageSizeOptions?: readonly number[];
  }>(),
  {
    pageSizeOptions: () => PAGE_SIZE_OPTIONS,
  },
);

const emit = defineEmits<{
  toggleAdvancedFilter: [];
  newer: [];
  older: [];
  pageSizeChange: [value: number];
}>();

function handlePageSizeChange(event: Event) {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) {
    return;
  }

  emit('pageSizeChange', Number.parseInt(target.value, 10));
}
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
    <label class="node-updates__page-size">
      <span class="node-updates__page-size-label">Show</span>
      <select
        class="node-updates__page-size-select"
        :value="props.pageSize"
        aria-label="Items per page"
        @change="handlePageSizeChange"
      >
        <option
          v-for="option in props.pageSizeOptions"
          :key="option"
          :value="option"
        >
          {{ option }}
        </option>
      </select>
    </label>
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
