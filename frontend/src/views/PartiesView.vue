<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { fetchActiveParties, fetchLocalParties } from '../lib/api';
import type { ActivePartiesNodeEntry, ActivePartiesResponse } from '../types/active-parties';

type PartiesMode = 'active' | 'all';

const activeParties = ref<ActivePartiesResponse | null>(null);
const localParties = ref<ActivePartiesResponse | null>(null);
const error = ref<string | null>(null);
const selectedMode = ref<PartiesMode>('active');
const selectedNodeId = ref<string | null>(null);

const nodes = computed(() => activeParties.value?.nodes ?? []);

const selectableNodes = computed(() =>
  selectedMode.value === 'active'
    ? nodes.value
    : nodes.value.filter((node) => node.mode === 'pqs_with_grpc'),
);

const selectedNode = computed<ActivePartiesNodeEntry | null>(() => {
  if (!selectedNodeId.value) {
    return null;
  }

  const sourceNodes =
    selectedMode.value === 'all'
      ? localParties.value?.nodes ?? []
      : activeParties.value?.nodes ?? [];

  return sourceNodes.find((node) => node.nodeId === selectedNodeId.value) ?? null;
});

function syncSelectedNode(preferredNodeId: string | null = selectedNodeId.value): void {
  const availableNodeIds = new Set(selectableNodes.value.map((node) => node.nodeId));

  if (preferredNodeId && availableNodeIds.has(preferredNodeId)) {
    selectedNodeId.value = preferredNodeId;
    return;
  }

  selectedNodeId.value = selectableNodes.value[0]?.nodeId ?? null;
}

function selectMode(mode: PartiesMode): void {
  selectedMode.value = mode;
}

function selectNode(nodeId: string): void {
  selectedNodeId.value = nodeId;
}

async function ensureLocalPartiesLoaded(): Promise<void> {
  if (localParties.value) {
    return;
  }

  localParties.value = await fetchLocalParties();
}

onMounted(async () => {
  try {
    activeParties.value = await fetchActiveParties();
    syncSelectedNode(activeParties.value.nodes[0]?.nodeId ?? null);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
  }
});

watch(selectedMode, async (mode) => {
  if (mode === 'all') {
    try {
      await ensureLocalPartiesLoaded();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
    }
  }

  syncSelectedNode();
});
</script>

<template>
  <section class="dashboard">
    <header class="dashboard__hero parties-page__hero">
      <div class="dashboard__hero-copy">
        <p class="activity-home__eyebrow">Parties</p>
        <h2>Parties</h2>
      </div>
    </header>

    <p v-if="error" class="dashboard__message dashboard__message--error">{{ error }}</p>
    <p v-else-if="!activeParties" class="dashboard__message">Loading active parties...</p>
    <div v-else class="parties-page">
      <section class="node-detail__section parties-page__section">
        <div class="parties-page__mode-switch" role="tablist" aria-label="Party source modes">
          <button
            type="button"
            class="parties-page__mode-button"
            :class="{ 'parties-page__mode-button--active': selectedMode === 'active' }"
            :aria-pressed="selectedMode === 'active'"
            @click="selectMode('active')"
          >
            Active Parties
          </button>
          <button
            type="button"
            class="parties-page__mode-button"
            :class="{ 'parties-page__mode-button--active': selectedMode === 'all' }"
            :aria-pressed="selectedMode === 'all'"
            @click="selectMode('all')"
          >
            All Parties
          </button>
        </div>

        <div class="parties-page__node-list" role="tablist" aria-label="Node selectors">
          <button
            v-for="node in nodes"
            :key="node.nodeId"
            type="button"
            class="parties-page__node-button"
            :class="{
              'parties-page__node-button--active': node.nodeId === selectedNodeId,
              'parties-page__node-button--disabled':
                selectedMode === 'all' && node.mode === 'pqs_only',
            }"
            :aria-pressed="node.nodeId === selectedNodeId"
            :disabled="selectedMode === 'all' && node.mode === 'pqs_only'"
            @click="selectNode(node.nodeId)"
          >
            <span class="parties-page__node-label">{{ node.label }}</span>
            <span
              v-if="selectedMode === 'all' && node.mode === 'pqs_only'"
              class="parties-page__node-meta"
            >
              No gRPC
            </span>
          </button>
        </div>
      </section>

      <section class="node-detail__section parties-page__section parties-page__results">
        <div v-if="selectedNode" class="parties-page__results-header">
          <div>
            <h3>{{ selectedNode.label }}</h3>
            <p v-if="selectedMode === 'all'" class="package-detail__seen-meta parties-page__results-copy">
              Local party inventory via gRPC.
            </p>
          </div>
        </div>
        <div v-else class="parties-page__results-header">
          <div>
            <h3>No gRPC nodes available</h3>
            <p class="package-detail__seen-meta parties-page__results-copy">
              Switch to Active Parties, or enable gRPC on at least one node to browse all local parties.
            </p>
          </div>
        </div>

        <div v-if="selectedMode === 'active' && selectedNode" class="package-detail__list">
          <RouterLink
            v-for="party in selectedNode.parties"
            :key="party"
            class="package-detail__list-row contract-detail__link parties-page__party-link"
            :to="`/parties/${party}`"
          >
            {{ party }}
          </RouterLink>
          <p v-if="selectedNode.parties.length === 0" class="update-detail__empty">
            No active parties found for this node.
          </p>
        </div>

        <div v-else-if="selectedMode === 'all' && selectedNode" class="package-detail__list">
          <RouterLink
            v-for="party in selectedNode.parties"
            :key="party"
            class="package-detail__list-row contract-detail__link parties-page__party-link"
            :to="`/parties/${party}`"
          >
            {{ party }}
          </RouterLink>
          <p v-if="selectedNode.parties.length === 0" class="update-detail__empty">
            No local parties found for this node.
          </p>
        </div>
      </section>
    </div>
  </section>
</template>
