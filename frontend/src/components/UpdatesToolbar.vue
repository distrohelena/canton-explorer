<script setup lang="ts">
import { PAGE_SIZE_OPTIONS } from '../lib/pagination';

const props = withDefaults(
  defineProps<{
    advancedFilterExpanded: boolean;
    advancedFilterControls?: string;
    advancedFilterLabel?: string;
    newerDisabled: boolean;
    olderDisabled: boolean;
    pageSize: number;
    pageSizeOptions?: readonly number[];
    pageSizeAriaLabel?: string;
  }>(),
  {
    pageSizeOptions: () => PAGE_SIZE_OPTIONS,
    pageSizeAriaLabel: 'Items per page',
    advancedFilterLabel: 'Advanced Filter',
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
      class="dashboard__refresh node-updates__filter-button"
      :aria-label="props.advancedFilterLabel"
      :aria-expanded="advancedFilterExpanded"
      :aria-controls="advancedFilterControls"
      :title="props.advancedFilterLabel"
      @click="$emit('toggleAdvancedFilter')"
    >
      <svg
        class="node-updates__filter-icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M2 4h20l-8 8v6l-4 2v-8L2 4Z"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.75"
        />
      </svg>
    </button>
    <label class="node-updates__page-size">
      <select
        class="node-updates__page-size-select"
        :value="props.pageSize"
        :aria-label="props.pageSizeAriaLabel"
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
      aria-label="Newer"
      title="Newer"
      @click="$emit('newer')"
    >
      <svg
        class="node-updates__pagination-icon node-updates__pagination-icon--newer"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M15 5l-7 7 7 7"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.75"
        />
      </svg>
    </button>
    <button
      type="button"
      class="dashboard__refresh"
      :disabled="olderDisabled"
      aria-label="Older"
      title="Older"
      @click="$emit('older')"
    >
      <svg
        class="node-updates__pagination-icon node-updates__pagination-icon--older"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M9 5l7 7-7 7"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.75"
        />
      </svg>
    </button>
  </div>
</template>
