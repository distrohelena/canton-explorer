<script setup lang="ts">
import { onMounted, ref } from 'vue';
import ContractsBrowser from '../components/ContractsBrowser.vue';
import { fetchNodes } from '../lib/api';
import type { NodeSnapshot } from '../types/nodes';

const nodes = ref<NodeSnapshot[] | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    nodes.value = await fetchNodes();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
  }
});
</script>

<template>
  <section class="dashboard">
    <p v-if="error" class="dashboard__message dashboard__message--error">{{ error }}</p>
    <p v-else-if="!nodes" class="dashboard__message">Loading contracts...</p>
    <div v-else class="contracts-page">
      <section class="activity-home__updates-section">
        <ContractsBrowser
          scope="global"
          path="/contracts"
          title="Contracts"
          :node-options="nodes"
          show-node-column
          :show-party-filters="true"
          advanced-filter-id="contracts-advanced-filter"
          loading-message="Loading contracts across all nodes..."
          empty-message="No active contracts found across all nodes."
          table-aria-label="All node contracts"
          spinner-label="Updating all node contracts"
        />
      </section>
    </div>
  </section>
</template>
