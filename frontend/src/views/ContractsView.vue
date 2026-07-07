<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import ContractsBrowser from '../components/ContractsBrowser.vue';
import { fetchNodes } from '../lib/api';
import type { NodeSnapshot } from '../types/nodes';

const ALL_NODES_ID = '__all_nodes__';
const nodes = ref<NodeSnapshot[] | null>(null);
const error = ref<string | null>(null);
const selectedNodeId = ref<string | null>(null);

const nodeButtons = computed(() => nodes.value ?? []);
const hasAllNodesOption = computed(() => nodeButtons.value.length > 1);
const isAllNodesSelected = computed(() => selectedNodeId.value === ALL_NODES_ID);

const selectedNodeSnapshot = computed<NodeSnapshot | null>(() => {
  if (!selectedNodeId.value || isAllNodesSelected.value) {
    return null;
  }

  return nodeButtons.value.find((node) => node.id === selectedNodeId.value) ?? null;
});

const browserTitle = computed(() => (isAllNodesSelected.value ? 'All Nodes' : selectedNodeSnapshot.value?.label ?? null));

async function selectNode(nodeId: string): Promise<void> {
  selectedNodeId.value = nodeId;
}

async function selectAllNodes(): Promise<void> {
  selectedNodeId.value = ALL_NODES_ID;
}

onMounted(async () => {
  try {
    nodes.value = await fetchNodes();
    selectedNodeId.value = nodes.value[0]?.id ?? null;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
  }
});
</script>

<template>
  <section class="dashboard">
    <header class="dashboard__hero parties-page__hero">
      <div class="dashboard__hero-copy">
        <p class="activity-home__eyebrow">Contracts</p>
        <h2>Contracts</h2>
      </div>
    </header>

    <p v-if="error" class="dashboard__message dashboard__message--error">{{ error }}</p>
    <p v-else-if="!nodes" class="dashboard__message">Loading contracts...</p>
    <div v-else class="parties-page contracts-page">
      <section class="node-detail__section parties-page__section">
        <div class="parties-page__node-list" role="tablist" aria-label="Node selectors">
          <button
            v-if="hasAllNodesOption"
            type="button"
            class="parties-page__node-button"
            :class="{ 'parties-page__node-button--active': isAllNodesSelected }"
            :aria-pressed="isAllNodesSelected"
            @click="selectAllNodes"
          >
            <span class="parties-page__node-label">All Nodes</span>
          </button>
          <button
            v-for="node in nodeButtons"
            :key="node.id"
            type="button"
            class="parties-page__node-button"
            :class="{ 'parties-page__node-button--active': node.id === selectedNodeId }"
            :aria-pressed="node.id === selectedNodeId"
            @click="selectNode(node.id)"
          >
            <span class="parties-page__node-label">{{ node.label }}</span>
          </button>
        </div>
      </section>

      <section class="node-detail__section parties-page__section parties-page__results">
        <ContractsBrowser
          v-if="browserTitle"
          :key="selectedNodeSnapshot?.id ?? ALL_NODES_ID"
          :scope="isAllNodesSelected ? 'global' : 'node'"
          :node-id="selectedNodeSnapshot?.id"
          path="/contracts"
          :title="browserTitle"
          :show-node-column="isAllNodesSelected"
          :show-party-filters="true"
          advanced-filter-id="contracts-advanced-filter"
          :loading-message="
            isAllNodesSelected
              ? 'Loading contracts across all nodes...'
              : 'Loading contracts for this node...'
          "
          :empty-message="
            isAllNodesSelected
              ? 'No active contracts found across all nodes.'
              : 'No active contracts found for this node.'
          "
          :table-aria-label="isAllNodesSelected ? 'All node contracts' : 'Node contracts'"
          :spinner-label="isAllNodesSelected ? 'Updating all node contracts' : 'Updating node contracts'"
        />
      </section>
    </div>
  </section>
</template>
