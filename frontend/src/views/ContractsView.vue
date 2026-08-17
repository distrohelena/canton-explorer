<script setup lang="ts">
import { onMounted } from 'vue';
import ContractsBrowser from '../components/ContractsBrowser.vue';
import { useSectionLoad } from '../composables/useSectionLoad';
import { fetchNodes } from '../lib/api';

const {
  data: nodes,
  loading: nodesLoading,
  error: nodesError,
  load: loadNodes,
  retry: retryNodes,
} = useSectionLoad(fetchNodes);

onMounted(() => {
  void loadNodes();
});
</script>

<template>
  <section class="dashboard">
    <div v-if="nodesError" class="dashboard__message dashboard__message--error" role="alert">
      <p>{{ nodesError }}</p>
      <button type="button" class="button button--secondary" @click="retryNodes">
        Retry node discovery
      </button>
    </div>
    <p v-else-if="nodesLoading" class="dashboard__message inline-loading" role="status">
      <span class="node-updates__spinner" aria-hidden="true"></span>
      <span>Loading contracts...</span>
    </p>
    <div v-else-if="nodes" class="contracts-page">
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
          empty-message="No contracts found across all nodes."
          table-aria-label="All node contracts"
          spinner-label="Updating all node contracts"
        />
      </section>
    </div>
  </section>
</template>
