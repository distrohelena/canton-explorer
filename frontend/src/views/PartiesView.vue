<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../lib/pagination';
import QuerySourcePill from '../components/QuerySourcePill.vue';
import {
  fetchNodeActiveParties,
  fetchPartyFingerprints,
  fetchNodeLocalParties,
  fetchNodePartyFingerprints,
  fetchNodes,
} from '../lib/api';
import type {
  ActivePartiesNodeEntry,
  NodePartyFingerprintsEntry,
  PartyFingerprintsResponse,
} from '../types/active-parties';
import type { NodeSnapshot } from '../types/nodes';

type PartiesMode = 'active' | 'all' | 'fingerprints';
const ALL_NODES_ID = '__all_nodes__';

const nodes = ref<NodeSnapshot[] | null>(null);
const activePartiesByNodeId = ref<Record<string, ActivePartiesNodeEntry>>({});
const localPartiesByNodeId = ref<Record<string, ActivePartiesNodeEntry>>({});
const error = ref<string | null>(null);
const selectedMode = ref<PartiesMode>('active');
const selectedNodeId = ref<string | null>(null);
const loadingActiveNodeId = ref<string | null>(null);
const loadingLocalNodeId = ref<string | null>(null);
const partyPageSize = ref(DEFAULT_PAGE_SIZE);
const partyBeforeCursor = ref<string | null>(null);
const partyAfterCursor = ref<string | null>(null);
const loadingNamespaces = ref(false);
const showNamespaceAdvancedFilter = ref(false);
const namespacePublicKeyDraft = ref('');
const namespaceEncodingDraft = ref<'auto' | 'hex' | 'base64' | 'pem'>('auto');
const namespaceKeyFormatDraft = ref<'raw' | 'derX509SubjectPublicKeyInfo'>('raw');
const namespaceKeyTypeDraft = ref<'auto' | 'ed25519' | 'x25519' | 'secp256k1' | 'other'>('auto');
const activeNamespaceFilter = ref<{
  publicKey: string;
  encoding: 'auto' | 'hex' | 'base64' | 'pem';
  keyFormat: 'raw' | 'derX509SubjectPublicKeyInfo';
  keyType: 'auto' | 'ed25519' | 'x25519' | 'secp256k1' | 'other';
} | null>(null);
const namespacePageSize = ref(DEFAULT_PAGE_SIZE);
const namespaceBeforeCursor = ref<string | null>(null);
const namespaceAfterCursor = ref<string | null>(null);
const namespacesResponse = ref<NodePartyFingerprintsEntry | PartyFingerprintsResponse | null>(null);

const nodeButtons = computed(() => nodes.value ?? []);
const hasAllNodesOption = computed(() => nodeButtons.value.length > 1);

const selectableNodes = computed(() =>
  selectedMode.value === 'active' || selectedMode.value === 'fingerprints'
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

const paginatedSelectedParties = computed(() =>
  paginateItems(selectedParties.value, {
    limit: partyPageSize.value,
    before: partyBeforeCursor.value ?? undefined,
    after: partyAfterCursor.value ?? undefined,
  }),
);

const selectedFingerprints = computed(() => namespacesResponse.value?.fingerprints ?? []);

const selectedFingerprintSource = computed<'pqs' | 'grpc' | null>(() => {
  return namespacesResponse.value?.source ?? null;
});

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

const selectedActiveNodeStatus = computed(() => {
  if (selectedMode.value !== 'active') {
    return null;
  }

  return selectedNode.value?.activePartiesStatus ?? 'ok';
});

const selectedActiveNodeError = computed(() => {
  if (selectedMode.value !== 'active') {
    return null;
  }

  return selectedNode.value?.activePartiesError ?? null;
});

const isSelectedNodeLoading = computed(() => {
  if (!selectedNodeId.value) {
    return false;
  }

  if (isAllNodesSelected.value) {
    const selectedIds = new Set(selectedNodeSnapshots.value.map((node) => node.id));
    if (selectedMode.value === 'all') {
      return loadingLocalNodeId.value !== null && selectedIds.has(loadingLocalNodeId.value);
    }
    if (selectedMode.value === 'fingerprints') {
      return loadingNamespaces.value;
    }
    return loadingActiveNodeId.value !== null && selectedIds.has(loadingActiveNodeId.value);
  }

  if (selectedMode.value === 'all') {
    return loadingLocalNodeId.value === selectedNodeId.value;
  }
  if (selectedMode.value === 'fingerprints') {
    return loadingNamespaces.value;
  }
  return loadingActiveNodeId.value === selectedNodeId.value;
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
  if (mode === 'fingerprints') {
    resetNamespacePagination();
  } else {
    resetPartyPagination();
    showNamespaceAdvancedFilter.value = false;
  }

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
  if (selectedMode.value === 'fingerprints') {
    resetNamespacePagination();
  } else {
    resetPartyPagination();
  }
  void ensureNodePartiesLoaded(selectedMode.value, nodeId);
}

function selectAllNodes(): void {
  selectedNodeId.value = ALL_NODES_ID;
  if (selectedMode.value === 'fingerprints') {
    resetNamespacePagination();
  } else {
    resetPartyPagination();
  }
  void ensureAllNodesPartiesLoaded(selectedMode.value);
}

async function ensureAllNodesPartiesLoaded(mode: PartiesMode): Promise<void> {
  if (mode === 'fingerprints') {
    await loadNamespaces();
    return;
  }

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

  if (mode === 'fingerprints') {
    await loadNamespaces();
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

function resetNamespacePagination(): void {
  namespaceBeforeCursor.value = null;
  namespaceAfterCursor.value = null;
}

function resetPartyPagination(): void {
  partyBeforeCursor.value = null;
  partyAfterCursor.value = null;
}

function paginateItems(
  items: string[],
  options: {
    limit: number;
    before?: string;
    after?: string;
  },
) {
  const limit = Math.max(1, options.limit);

  if (options.after) {
    const endIndex = items.findIndex((value) => value === options.after);
    const normalizedEndIndex = endIndex >= 0 ? endIndex : items.length;
    const startIndex = Math.max(0, normalizedEndIndex - limit);
    const page = items.slice(startIndex, normalizedEndIndex);

    return {
      items: page,
      nextBefore:
        normalizedEndIndex < items.length && page.length > 0 ? page[page.length - 1] : null,
      nextAfter: startIndex > 0 && page.length > 0 ? page[0] : null,
    };
  }

  const startIndex = options.before
    ? (() => {
        const index = items.findIndex((value) => value === options.before);
        return index >= 0 ? index + 1 : 0;
      })()
    : 0;
  const page = items.slice(startIndex, startIndex + limit);

  return {
    items: page,
    nextBefore: startIndex + limit < items.length && page.length > 0 ? page[page.length - 1] : null,
    nextAfter: startIndex > 0 && page.length > 0 ? page[0] : null,
  };
}

async function loadNamespaces(): Promise<void> {
  loadingNamespaces.value = true;

  try {
    const options = {
      before: namespaceBeforeCursor.value ?? undefined,
      after: namespaceAfterCursor.value ?? undefined,
      limit: namespacePageSize.value,
      publicKey: activeNamespaceFilter.value?.publicKey,
      encoding: activeNamespaceFilter.value?.encoding,
      keyFormat: activeNamespaceFilter.value?.keyFormat,
      keyType: activeNamespaceFilter.value?.keyType,
    };

    namespacesResponse.value = isAllNodesSelected.value
      ? await fetchPartyFingerprints(options)
      : await fetchNodePartyFingerprints(selectedNodeId.value ?? '', options);
    error.value = null;
  } catch (err) {
    namespacesResponse.value = null;
    error.value = err instanceof Error ? err.message : 'Unknown error';
  } finally {
    loadingNamespaces.value = false;
  }
}

async function showOlderNamespaces(): Promise<void> {
  const cursor = namespacesResponse.value?.nextBefore;
  if (!cursor) {
    return;
  }

  namespaceBeforeCursor.value = cursor;
  namespaceAfterCursor.value = null;
  await loadNamespaces();
}

async function showNewerNamespaces(): Promise<void> {
  const cursor = namespacesResponse.value?.nextAfter;
  if (!cursor) {
    return;
  }

  namespaceAfterCursor.value = cursor;
  namespaceBeforeCursor.value = null;
  await loadNamespaces();
}

async function setNamespacePageSize(event: Event): Promise<void> {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) {
    return;
  }

  namespacePageSize.value = Number.parseInt(target.value, 10) || DEFAULT_PAGE_SIZE;
  resetNamespacePagination();
  await loadNamespaces();
}

function toggleNamespaceAdvancedFilter(): void {
  showNamespaceAdvancedFilter.value = !showNamespaceAdvancedFilter.value;
}

async function applyNamespaceAdvancedFilter(): Promise<void> {
  const publicKey = namespacePublicKeyDraft.value.trim();
  activeNamespaceFilter.value = publicKey
    ? {
        publicKey,
        encoding: namespaceEncodingDraft.value,
        keyFormat: namespaceKeyFormatDraft.value,
        keyType: namespaceKeyTypeDraft.value,
      }
    : null;
  resetNamespacePagination();
  await loadNamespaces();
}

async function clearNamespaceAdvancedFilter(): Promise<void> {
  namespacePublicKeyDraft.value = '';
  namespaceEncodingDraft.value = 'auto';
  namespaceKeyFormatDraft.value = 'raw';
  namespaceKeyTypeDraft.value = 'auto';
  activeNamespaceFilter.value = null;
  resetNamespacePagination();
  await loadNamespaces();
}

function showOlderParties(): void {
  const cursor = paginatedSelectedParties.value.nextBefore;
  if (!cursor) {
    return;
  }

  partyBeforeCursor.value = cursor;
  partyAfterCursor.value = null;
}

function showNewerParties(): void {
  const cursor = paginatedSelectedParties.value.nextAfter;
  if (!cursor) {
    return;
  }

  partyAfterCursor.value = cursor;
  partyBeforeCursor.value = null;
}

function setPartyPageSize(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) {
    return;
  }

  partyPageSize.value = Number.parseInt(target.value, 10) || DEFAULT_PAGE_SIZE;
  resetPartyPagination();
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
          <button
            type="button"
            class="parties-page__mode-button"
            :class="{ 'parties-page__mode-button--active': selectedMode === 'fingerprints' }"
            :aria-pressed="selectedMode === 'fingerprints'"
            @click="selectMode('fingerprints')"
          >
            Namespaces
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

      <section
        class="node-detail__section parties-page__section parties-page__results"
        :class="{ 'parties-page__results--inline-actions': true }"
      >
        <div v-if="selectedHeader" class="parties-page__results-header">
          <div>
            <h3>{{ selectedHeader }}</h3>
          </div>
          <div class="results-header__actions">
            <div class="node-updates__pager">
              <button
                v-if="selectedMode === 'fingerprints'"
                type="button"
                class="dashboard__refresh"
                :aria-expanded="showNamespaceAdvancedFilter"
                aria-controls="namespace-advanced-filter"
                @click="toggleNamespaceAdvancedFilter"
              >
                Advanced Filter
              </button>
              <label class="node-updates__page-size">
                <span class="node-updates__page-size-label">Show</span>
                <select
                  class="node-updates__page-size-select"
                  :value="selectedMode === 'fingerprints' ? namespacePageSize : partyPageSize"
                  aria-label="Items per page"
                  @change="selectedMode === 'fingerprints' ? setNamespacePageSize($event) : setPartyPageSize($event)"
                >
                  <option
                    v-for="option in PAGE_SIZE_OPTIONS"
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
                :disabled="selectedMode === 'fingerprints' ? !namespacesResponse?.nextAfter : !paginatedSelectedParties.nextAfter"
                @click="selectedMode === 'fingerprints' ? showNewerNamespaces() : showNewerParties()"
              >
                Newer
              </button>
              <button
                type="button"
                class="dashboard__refresh"
                :disabled="selectedMode === 'fingerprints' ? !namespacesResponse?.nextBefore : !paginatedSelectedParties.nextBefore"
                @click="selectedMode === 'fingerprints' ? showOlderNamespaces() : showOlderParties()"
              >
                Older
              </button>
            </div>
            <QuerySourcePill
              v-if="selectedMode === 'fingerprints' ? selectedFingerprintSource : true"
              :source="selectedMode === 'fingerprints' ? selectedFingerprintSource! : (selectedMode === 'active' ? 'pqs' : 'grpc')"
            />
          </div>
        </div>
        <section
          v-if="selectedMode === 'fingerprints' && showNamespaceAdvancedFilter"
          id="namespace-advanced-filter"
          class="node-updates__advanced-filter parties-page__namespace-filter"
          aria-label="Advanced Filter Parameters"
        >
          <h3 class="node-updates__advanced-filter-title">Advanced Filter Parameters</h3>
          <div class="node-updates__advanced-filter-grid parties-page__namespace-filter-grid">
            <label class="node-updates__advanced-filter-field parties-page__namespace-filter-field parties-page__namespace-filter-field--full">
              <span>Public Key</span>
              <textarea
                v-model="namespacePublicKeyDraft"
                aria-label="Public Key"
                placeholder="Paste hex, base64, or PEM public key"
                rows="4"
              ></textarea>
            </label>
            <label class="node-updates__advanced-filter-field parties-page__namespace-filter-field">
              <span>Encoding</span>
              <select v-model="namespaceEncodingDraft" aria-label="Encoding">
                <option value="auto">Auto</option>
                <option value="hex">Hex</option>
                <option value="base64">Base64</option>
                <option value="pem">PEM</option>
              </select>
            </label>
            <label class="node-updates__advanced-filter-field parties-page__namespace-filter-field">
              <span>Key Format</span>
              <select v-model="namespaceKeyFormatDraft" aria-label="Key Format">
                <option value="raw">Raw</option>
                <option value="derX509SubjectPublicKeyInfo">DER X.509 SPKI</option>
              </select>
            </label>
            <label class="node-updates__advanced-filter-field parties-page__namespace-filter-field">
              <span>Key Type</span>
              <select v-model="namespaceKeyTypeDraft" aria-label="Key Type">
                <option value="auto">Auto</option>
                <option value="ed25519">ED25519</option>
                <option value="x25519">X25519</option>
                <option value="secp256k1">Secp256k1</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>
          <div class="parties-page__namespace-filter-actions">
            <button
              type="button"
              class="dashboard__refresh"
              @click="applyNamespaceAdvancedFilter"
            >
              Search Namespaces
            </button>
            <button
              type="button"
              class="dashboard__refresh"
              @click="clearNamespaceAdvancedFilter"
            >
              Clear
            </button>
          </div>
        </section>
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
            v-for="party in paginatedSelectedParties.items"
            :key="party"
            class="package-detail__list-row contract-detail__link parties-page__party-link"
            :to="`/parties/${party}`"
          >
            {{ party }}
          </RouterLink>
          <p
            v-if="selectedActiveNodeStatus === 'pqs_error'"
            class="update-detail__empty"
          >
            PQS error while listing active parties for this node.
          </p>
          <p
            v-if="selectedActiveNodeStatus === 'pqs_error' && selectedActiveNodeError"
            class="package-detail__seen-meta parties-page__results-copy"
          >
            {{ selectedActiveNodeError }}
          </p>
          <p
            v-if="selectedParties.length === 0 && selectedActiveNodeStatus !== 'pqs_error'"
            class="update-detail__empty"
          >
            {{ isAllNodesSelected ? 'No active parties found across selected nodes.' : 'No active parties found for this node.' }}
          </p>
        </div>

        <div v-else-if="selectedMode === 'all' && selectedEntries.length > 0" class="package-detail__list">
          <RouterLink
            v-for="party in paginatedSelectedParties.items"
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

        <div v-else-if="selectedMode === 'fingerprints' && namespacesResponse" class="package-detail__list">
          <RouterLink
            v-for="fingerprint in selectedFingerprints"
            :key="fingerprint"
            class="package-detail__list-row contract-detail__link parties-page__party-link parties-page__fingerprint-row"
            :to="`/namespaces/${encodeURIComponent(fingerprint)}`"
          >
            <span class="parties-page__fingerprint-value">{{ fingerprint }}</span>
          </RouterLink>
          <p v-if="selectedFingerprints.length === 0" class="update-detail__empty">
            {{ isAllNodesSelected ? 'No known namespaces found across selected nodes.' : 'No known namespaces found for this node.' }}
          </p>
        </div>
      </section>
    </div>
  </section>
</template>
