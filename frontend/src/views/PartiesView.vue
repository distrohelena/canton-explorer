<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import QuerySourcePill from '../components/QuerySourcePill.vue';
import { fetchNodeActiveParties, fetchNodeLocalParties, fetchNodes } from '../lib/api';
import type { ActivePartiesNodeEntry } from '../types/active-parties';
import type { NodeSnapshot } from '../types/nodes';

type PartiesMode = 'active' | 'all';
const ALL_NODES_ID = '__all_nodes__';

const nodes = ref<NodeSnapshot[] | null>(null);
const activePartiesByNodeId = ref<Record<string, ActivePartiesNodeEntry>>({});
const localPartiesByNodeId = ref<Record<string, ActivePartiesNodeEntry>>({});
const error = ref<string | null>(null);
const selectedMode = ref<PartiesMode>('active');
const selectedNodeId = ref<string | null>(null);
const loadingActiveNodeId = ref<string | null>(null);
const loadingLocalNodeId = ref<string | null>(null);

const nodeButtons = computed(() => nodes.value ?? []);
const hasAllNodesOption = computed(() => nodeButtons.value.length > 1);

const selectableNodes = computed(() =>
  selectedMode.value === 'active'
    ? nodeButtons.value
    : nodeButtons.value.filter((node) => node.mode === 'pqs_with_grpc'),
);
const isAllNodesSelected = computed(() => selectedNodeId.value === ALL_NODES_ID);

const selectedNodeSnapshot = computed<NodeSnapshot | null>(() => {
  if (!selectedNodeId.value || isAllNodesSelected.value) {
    return null;
  }

  return nodeButtons.value.find((node) => node.id === selectedNodeId.value) ?? null;
});

const selectedNode = computed<ActivePartiesNodeEntry | null>(() => {
  if (!selectedNodeId.value) {
    return null;
  }

  return selectedMode.value === 'all'
    ? localPartiesByNodeId.value[selectedNodeId.value] ?? null
    : activePartiesByNodeId.value[selectedNodeId.value] ?? null;
});

const selectedNodeSnapshots = computed<NodeSnapshot[]>(() => {
  if (isAllNodesSelected.value) {
    return selectableNodes.value;
  }

  return selectedNodeSnapshot.value ? [selectedNodeSnapshot.value] : [];
});

const selectedEntries = computed<ActivePartiesNodeEntry[]>(() => {
  if (isAllNodesSelected.value) {
    const source =
      selectedMode.value === 'all' ? localPartiesByNodeId.value : activePartiesByNodeId.value;

    return selectedNodeSnapshots.value
      .map((node) => source[node.id])
      .filter((entry): entry is ActivePartiesNodeEntry => entry !== undefined);
  }

  return selectedNode.value ? [selectedNode.value] : [];
});

const selectedParties = computed(() =>
  Array.from(
    new Set(
      selectedEntries.value.flatMap((entry) => entry.parties),
    ),
  ).sort((left, right) => left.localeCompare(right)),
);

const selectedHeader = computed(() => {
  if (isAllNodesSelected.value) {
    return selectedNodeSnapshots.value.length > 0 ? 'All Nodes' : null;
  }

  return selectedNodeSnapshot.value?.label ?? null;
});

const selectedLocalNodeStatus = computed(() => {
  if (selectedMode.value !== 'all') {
    return null;
  }

  return selectedNode.value?.localPartiesStatus ?? 'ok';
});

const selectedLocalNodeError = computed(() => {
  if (selectedMode.value !== 'all') {
    return null;
  }

  return selectedNode.value?.localPartiesError ?? null;
});

const selectedLocalNodeErrorCode = computed(() => {
  if (selectedMode.value !== 'all') {
    return null;
  }

  return selectedNode.value?.localPartiesErrorCode ?? null;
});

const selectedLocalNodeErrorDetails = computed(() => {
  if (selectedMode.value !== 'all') {
    return null;
  }

  return selectedNode.value?.localPartiesErrorDetails ?? null;
});

const selectedLocalNodeErrorTid = computed(() => {
  if (selectedMode.value !== 'all') {
    return null;
  }

  return selectedNode.value?.localPartiesErrorTid ?? null;
});

const isSelectedNodeLoading = computed(() => {
  if (!selectedNodeId.value) {
    return false;
  }

  if (isAllNodesSelected.value) {
    const selectedIds = new Set(selectedNodeSnapshots.value.map((node) => node.id));
    return selectedMode.value === 'all'
      ? (loadingLocalNodeId.value !== null && selectedIds.has(loadingLocalNodeId.value))
      : (loadingActiveNodeId.value !== null && selectedIds.has(loadingActiveNodeId.value));
  }

  return selectedMode.value === 'all'
    ? loadingLocalNodeId.value === selectedNodeId.value
    : loadingActiveNodeId.value === selectedNodeId.value;
});

function syncSelectedNode(preferredNodeId: string | null = selectedNodeId.value): void {
  if (preferredNodeId === ALL_NODES_ID && hasAllNodesOption.value) {
    selectedNodeId.value = ALL_NODES_ID;
    return;
  }

  const availableNodeIds = new Set(selectableNodes.value.map((node) => node.id));

  if (preferredNodeId && availableNodeIds.has(preferredNodeId)) {
    selectedNodeId.value = preferredNodeId;
    return;
  }

  selectedNodeId.value = selectableNodes.value[0]?.id ?? null;
}

function selectMode(mode: PartiesMode): void {
  selectedMode.value = mode;
  syncSelectedNode(selectedNodeId.value);

  if (selectedNodeId.value === ALL_NODES_ID) {
    void ensureAllNodesPartiesLoaded(mode);
    return;
  }

  if (selectedNodeId.value) {
    void ensureNodePartiesLoaded(mode, selectedNodeId.value);
  }
}

function selectNode(nodeId: string): void {
  selectedNodeId.value = nodeId;
  void ensureNodePartiesLoaded(selectedMode.value, nodeId);
}

function selectAllNodes(): void {
  selectedNodeId.value = ALL_NODES_ID;
  void ensureAllNodesPartiesLoaded(selectedMode.value);
}

async function ensureAllNodesPartiesLoaded(mode: PartiesMode): Promise<void> {
  await Promise.all(selectableNodes.value.map((node) => ensureNodePartiesLoaded(mode, node.id)));
}

async function ensureNodePartiesLoaded(mode: PartiesMode, nodeId: string): Promise<void> {
  if (mode === 'active') {
    if (activePartiesByNodeId.value[nodeId] || loadingActiveNodeId.value === nodeId) {
      return;
    }

    loadingActiveNodeId.value = nodeId;
    try {
      const entry = await fetchNodeActiveParties(nodeId);
      activePartiesByNodeId.value = {
        ...activePartiesByNodeId.value,
        [nodeId]: entry,
      };
      error.value = null;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
    } finally {
      if (loadingActiveNodeId.value === nodeId) {
        loadingActiveNodeId.value = null;
      }
    }
    return;
  }

  if (localPartiesByNodeId.value[nodeId] || loadingLocalNodeId.value === nodeId) {
    return;
  }

  loadingLocalNodeId.value = nodeId;
  try {
    const entry = await fetchNodeLocalParties(nodeId);
    localPartiesByNodeId.value = {
      ...localPartiesByNodeId.value,
      [nodeId]: entry,
    };
    error.value = null;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
  } finally {
    if (loadingLocalNodeId.value === nodeId) {
      loadingLocalNodeId.value = null;
    }
  }
}

onMounted(async () => {
  try {
    nodes.value = await fetchNodes();
    syncSelectedNode(nodes.value[0]?.id ?? null);

    if (selectedNodeId.value) {
      await ensureNodePartiesLoaded('active', selectedNodeId.value);
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
  }
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
    <p v-else-if="!nodes" class="dashboard__message">Loading parties...</p>
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
            v-if="hasAllNodesOption"
            type="button"
            class="parties-page__node-button"
            :class="{ 'parties-page__node-button--active': isAllNodesSelected }"
            :aria-pressed="isAllNodesSelected"
            :disabled="selectedMode === 'all' && selectableNodes.length === 0"
            @click="selectAllNodes"
          >
            <span class="parties-page__node-label">All Nodes</span>
          </button>
          <button
            v-for="node in nodeButtons"
            :key="node.id"
            type="button"
            class="parties-page__node-button"
            :class="{
              'parties-page__node-button--active': node.id === selectedNodeId,
              'parties-page__node-button--disabled':
                selectedMode === 'all' && node.mode === 'pqs_only',
            }"
            :aria-pressed="node.id === selectedNodeId"
            :disabled="selectedMode === 'all' && node.mode === 'pqs_only'"
            @click="selectNode(node.id)"
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
        <QuerySourcePill
          class="results-section__source-pill"
          :source="selectedMode === 'active' ? 'pqs' : 'grpc'"
        />

        <div v-if="selectedHeader" class="parties-page__results-header">
          <div>
            <h3>{{ selectedHeader }}</h3>
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

        <p v-if="selectedHeader && isSelectedNodeLoading" class="dashboard__message">
          {{ isAllNodesSelected ? 'Loading parties across selected nodes...' : 'Loading parties for this node...' }}
        </p>

        <div v-else-if="selectedMode === 'active' && selectedEntries.length > 0" class="package-detail__list">
          <RouterLink
            v-for="party in selectedParties"
            :key="party"
            class="package-detail__list-row contract-detail__link parties-page__party-link"
            :to="`/parties/${party}`"
          >
            {{ party }}
          </RouterLink>
          <p v-if="selectedParties.length === 0" class="update-detail__empty">
            {{ isAllNodesSelected ? 'No active parties found across selected nodes.' : 'No active parties found for this node.' }}
          </p>
        </div>

        <div v-else-if="selectedMode === 'all' && selectedEntries.length > 0" class="package-detail__list">
          <RouterLink
            v-for="party in selectedParties"
            :key="party"
            class="package-detail__list-row contract-detail__link parties-page__party-link"
            :to="`/parties/${party}`"
          >
            {{ party }}
          </RouterLink>
          <p
            v-if="selectedLocalNodeStatus === 'grpc_error'"
            class="update-detail__empty"
          >
            gRPC error while listing local parties for this node.
          </p>
          <p
            v-if="selectedLocalNodeStatus === 'grpc_error' && selectedLocalNodeErrorCode !== null"
            class="package-detail__seen-meta parties-page__results-copy"
          >
            Status code: {{ selectedLocalNodeErrorCode }}
          </p>
          <p
            v-if="selectedLocalNodeStatus === 'grpc_error' && selectedLocalNodeErrorTid"
            class="package-detail__seen-meta parties-page__results-copy"
          >
            Request ID: {{ selectedLocalNodeErrorTid }}
          </p>
          <p
            v-if="selectedLocalNodeStatus === 'grpc_error' && selectedLocalNodeErrorDetails"
            class="package-detail__seen-meta parties-page__results-copy"
          >
            {{ selectedLocalNodeErrorDetails }}
          </p>
          <p
            v-else-if="selectedLocalNodeStatus === 'grpc_error' && selectedLocalNodeError"
            class="package-detail__seen-meta parties-page__results-copy"
          >
            {{ selectedLocalNodeError }}
          </p>
          <p
            v-else-if="selectedLocalNodeStatus === 'grpc_not_configured'"
            class="update-detail__empty"
          >
            gRPC is not configured for this node.
          </p>
          <p
            v-else-if="selectedParties.length === 0"
            class="update-detail__empty"
          >
            {{ isAllNodesSelected ? 'No local parties found across selected nodes.' : 'No local parties found for this node.' }}
          </p>
        </div>
      </section>
    </div>
  </section>
</template>
