<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../lib/pagination';
import CopyToClipboardButton from '../components/CopyToClipboardButton.vue';
import QuerySourcePill from '../components/QuerySourcePill.vue';
import UpdatesAdvancedFilter from '../components/UpdatesAdvancedFilter.vue';
import {
  fetchNodeActiveParties,
  fetchPartyFingerprints,
  fetchNodeLocalParties,
  fetchNodes,
} from '../lib/api';
import type {
  ActivePartiesNodeEntry,
  NodePartyFingerprintsEntry,
  PartyFingerprintsResponse,
} from '../types/active-parties';
import type { NodeSnapshot } from '../types/nodes';

type PartiesMode = 'active' | 'all' | 'fingerprints';

const route = useRoute();
const router = useRouter();
const nodes = ref<NodeSnapshot[] | null>(null);
const activePartiesByNodeId = ref<Record<string, ActivePartiesNodeEntry>>({});
const localPartiesByNodeId = ref<Record<string, ActivePartiesNodeEntry>>({});
const activeNodeErrors = ref<Record<string, string | null>>({});
const localNodeErrors = ref<Record<string, string | null>>({});
const error = ref<string | null>(null);
const selectedMode = ref<PartiesMode>('active');
const activeNodeLoading = ref<Record<string, boolean>>({});
const localNodeLoading = ref<Record<string, boolean>>({});
const activeNodeFilters = ref<string[]>([]);
const requestGeneration = ref(0);
const partyPageSize = ref(DEFAULT_PAGE_SIZE);
const partyBeforeCursor = ref<string | null>(null);
const partyAfterCursor = ref<string | null>(null);
const loadingNamespaces = ref(false);
const showAdvancedFilter = ref(Object.prototype.hasOwnProperty.call(route.query, 'node'));
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

const selectedNodes = computed(() =>
  nodeButtons.value.filter((node) => activeNodeFilters.value.includes(node.id)),
);

const selectableNodes = computed(() => {
  if (selectedMode.value === 'all') {
    return selectedNodes.value.filter((node) => node.mode === 'pqs_with_grpc');
  }

  return selectedNodes.value;
});

const selectedNodeSnapshots = computed<NodeSnapshot[]>(() => {
  return selectedNodes.value;
});

const selectedEntries = computed<ActivePartiesNodeEntry[]>(() => {
  const source =
    selectedMode.value === 'all' ? localPartiesByNodeId.value : activePartiesByNodeId.value;

  return selectableNodes.value
    .map((node) => source[node.id])
    .filter((entry): entry is ActivePartiesNodeEntry => entry !== undefined);
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
  if (selectedMode.value !== 'fingerprints') {
    return null;
  }

  return namespacesResponse.value?.source ?? null;
});

const selectedHeader = computed(() => {
  return selectedNodeSnapshots.value.length > 0 ? 'All Nodes' : 'No Nodes Selected';
});

const selectedLocalNodeStatus = computed(() => {
  if (selectedMode.value !== 'all') {
    return null;
  }

  return selectedEntries.value.find((entry) => entry.localPartiesStatus && entry.localPartiesStatus !== 'ok')
    ?.localPartiesStatus ?? 'ok';
});

const selectedLocalNodeError = computed(() => {
  if (selectedMode.value !== 'all') {
    return null;
  }

  return selectedEntries.value.find((entry) => entry.localPartiesError)?.localPartiesError ?? null;
});

const selectedLocalNodeErrorCode = computed(() => {
  if (selectedMode.value !== 'all') {
    return null;
  }

  return selectedEntries.value.find((entry) => entry.localPartiesErrorCode)?.localPartiesErrorCode ?? null;
});

const selectedLocalNodeErrorDetails = computed(() => {
  if (selectedMode.value !== 'all') {
    return null;
  }

  return selectedEntries.value.find((entry) => entry.localPartiesErrorDetails)?.localPartiesErrorDetails ?? null;
});

const selectedLocalNodeErrorTid = computed(() => {
  if (selectedMode.value !== 'all') {
    return null;
  }

  return selectedEntries.value.find((entry) => entry.localPartiesErrorTid)?.localPartiesErrorTid ?? null;
});

const selectedActiveNodeStatus = computed(() => {
  if (selectedMode.value !== 'active') {
    return null;
  }

  return selectedEntries.value.find((entry) => entry.activePartiesStatus === 'pqs_error')
    ?.activePartiesStatus ?? 'ok';
});

const selectedActiveNodeError = computed(() => {
  if (selectedMode.value !== 'active') {
    return null;
  }

  return selectedEntries.value.find((entry) => entry.activePartiesError)?.activePartiesError ?? null;
});

const isSelectedNodeLoading = computed(() => {
  if (selectedMode.value === 'all') {
    return selectableNodes.value.some((node) => localNodeLoading.value[node.id]);
  }
  if (selectedMode.value === 'fingerprints') {
    return loadingNamespaces.value;
  }
  return selectableNodes.value.some((node) => activeNodeLoading.value[node.id]);
});

const resultsLoadingLabel = 'Loading parties across selected nodes';

const selectedActiveRequestError = computed(
  () =>
    selectableNodes.value
      .map((node) => activeNodeErrors.value[node.id])
      .find((message): message is string => Boolean(message)) ?? null,
);

const selectedLocalRequestError = computed(
  () =>
    selectableNodes.value
      .map((node) => localNodeErrors.value[node.id])
      .find((message): message is string => Boolean(message)) ?? null,
);

function uniqueValues(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );
}

function readQueryValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }

  return typeof value === 'string' ? [value] : [];
}

function readNodeFilters(availableNodes: NodeSnapshot[], query = route.query): string[] {
  if (!Object.prototype.hasOwnProperty.call(query, 'node')) {
    return availableNodes.map((node) => node.id);
  }

  const availableNodeIds = new Set(availableNodes.map((node) => node.id));
  return uniqueValues(readQueryValues(query.node)).filter((nodeId) =>
    availableNodeIds.has(nodeId),
  );
}

function allNodesSelected(nodeIds: string[]): boolean {
  return (
    nodeButtons.value.length > 0 &&
    nodeIds.length === nodeButtons.value.length &&
    nodeButtons.value.every((node) => nodeIds.includes(node.id))
  );
}

function buildNodeQuery(nodeIds: string[]): LocationQueryRaw {
  const nextQuery: LocationQueryRaw = { ...route.query };
  if (allNodesSelected(nodeIds)) {
    delete nextQuery.node;
  } else {
    nextQuery.node = nodeIds.length > 0 ? nodeIds : '';
  }

  return nextQuery;
}

function beginRequestGeneration(): number {
  requestGeneration.value += 1;
  return requestGeneration.value;
}

function clearPartyResults(): void {
  activePartiesByNodeId.value = {};
  localPartiesByNodeId.value = {};
  activeNodeErrors.value = {};
  localNodeErrors.value = {};
  activeNodeLoading.value = {};
  localNodeLoading.value = {};
}

function nodesForMode(mode: PartiesMode): NodeSnapshot[] {
  const selected = selectedNodes.value;
  return mode === 'all' ? selected.filter((node) => node.mode === 'pqs_with_grpc') : selected;
}

function selectMode(mode: PartiesMode): void {
  selectedMode.value = mode;
  const generation = beginRequestGeneration();
  error.value = null;

  if (mode === 'fingerprints') {
    resetNamespacePagination();
    namespacesResponse.value = null;
    loadingNamespaces.value = false;
  } else {
    resetPartyPagination();
    loadingNamespaces.value = false;
    namespacesResponse.value = null;
    clearPartyResults();
  }

  void ensureAllNodesPartiesLoaded(mode, generation, true);
}

async function ensureAllNodesPartiesLoaded(
  mode: PartiesMode,
  generation = requestGeneration.value,
  force = false,
): Promise<void> {
  if (mode === 'fingerprints') {
    await loadNamespaces(generation);
    return;
  }

  await Promise.all(
    nodesForMode(mode).map((node) => ensureNodePartiesLoaded(mode, node.id, generation, force)),
  );
}

async function ensureNodePartiesLoaded(
  mode: PartiesMode,
  nodeId: string,
  generation = requestGeneration.value,
  force = false,
): Promise<void> {
  const isCurrentRequest = () =>
    generation === requestGeneration.value &&
    selectedMode.value === mode &&
    activeNodeFilters.value.includes(nodeId);

  if (mode === 'active') {
    if (!force && (activePartiesByNodeId.value[nodeId] || activeNodeLoading.value[nodeId])) {
      return;
    }

    activeNodeLoading.value = { ...activeNodeLoading.value, [nodeId]: true };
    activeNodeErrors.value = { ...activeNodeErrors.value, [nodeId]: null };
    try {
      const entry = await fetchNodeActiveParties(nodeId);
      if (isCurrentRequest()) {
        activePartiesByNodeId.value = {
          ...activePartiesByNodeId.value,
          [nodeId]: entry,
        };
      }
    } catch (err) {
      if (isCurrentRequest()) {
        activeNodeErrors.value = {
          ...activeNodeErrors.value,
          [nodeId]: err instanceof Error ? err.message : 'Unknown error',
        };
      }
    } finally {
      if (generation === requestGeneration.value) {
        activeNodeLoading.value = { ...activeNodeLoading.value, [nodeId]: false };
      }
    }
    return;
  }

  if (mode === 'fingerprints') {
    await loadNamespaces(generation);
    return;
  }

  if (!force && (localPartiesByNodeId.value[nodeId] || localNodeLoading.value[nodeId])) {
    return;
  }

  localNodeLoading.value = { ...localNodeLoading.value, [nodeId]: true };
  localNodeErrors.value = { ...localNodeErrors.value, [nodeId]: null };
  try {
    const entry = await fetchNodeLocalParties(nodeId);
    if (isCurrentRequest()) {
      localPartiesByNodeId.value = {
        ...localPartiesByNodeId.value,
        [nodeId]: entry,
      };
    }
  } catch (err) {
    if (isCurrentRequest()) {
      localNodeErrors.value = {
        ...localNodeErrors.value,
        [nodeId]: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  } finally {
    if (generation === requestGeneration.value) {
      localNodeLoading.value = { ...localNodeLoading.value, [nodeId]: false };
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

async function loadNamespaces(generation = requestGeneration.value): Promise<void> {
  if (generation !== requestGeneration.value || selectedMode.value !== 'fingerprints') {
    return;
  }

  if (activeNodeFilters.value.length === 0) {
    namespacesResponse.value = null;
    loadingNamespaces.value = false;
    error.value = null;
    return;
  }

  loadingNamespaces.value = true;
  error.value = null;

  try {
    const options: NonNullable<Parameters<typeof fetchPartyFingerprints>[0]> = {
      before: namespaceBeforeCursor.value ?? undefined,
      after: namespaceAfterCursor.value ?? undefined,
      limit: namespacePageSize.value,
      publicKey: activeNamespaceFilter.value?.publicKey,
      encoding: activeNamespaceFilter.value?.encoding,
      keyFormat: activeNamespaceFilter.value?.keyFormat,
      keyType: activeNamespaceFilter.value?.keyType,
    };
    if (!allNodesSelected(activeNodeFilters.value)) {
      options.nodeIds = activeNodeFilters.value;
    }

    const response = await fetchPartyFingerprints(options);
    if (generation === requestGeneration.value && selectedMode.value === 'fingerprints') {
      namespacesResponse.value = response;
    }
  } catch (err) {
    if (generation === requestGeneration.value && selectedMode.value === 'fingerprints') {
      namespacesResponse.value = null;
      error.value = err instanceof Error ? err.message : 'Unknown error';
    }
  } finally {
    if (generation === requestGeneration.value) {
      loadingNamespaces.value = false;
    }
  }
}

async function showOlderNamespaces(): Promise<void> {
  const cursor = namespacesResponse.value?.nextBefore;
  if (!cursor) {
    return;
  }

  namespaceBeforeCursor.value = cursor;
  namespaceAfterCursor.value = null;
  await loadNamespaces(beginRequestGeneration());
}

async function showNewerNamespaces(): Promise<void> {
  const cursor = namespacesResponse.value?.nextAfter;
  if (!cursor) {
    return;
  }

  namespaceAfterCursor.value = cursor;
  namespaceBeforeCursor.value = null;
  await loadNamespaces(beginRequestGeneration());
}

async function setNamespacePageSize(event: Event): Promise<void> {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) {
    return;
  }

  namespacePageSize.value = Number.parseInt(target.value, 10) || DEFAULT_PAGE_SIZE;
  resetNamespacePagination();
  await loadNamespaces(beginRequestGeneration());
}

function toggleAdvancedFilter(): void {
  showAdvancedFilter.value = !showAdvancedFilter.value;
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
  await loadNamespaces(beginRequestGeneration());
}

async function clearNamespaceAdvancedFilter(): Promise<void> {
  namespacePublicKeyDraft.value = '';
  namespaceEncodingDraft.value = 'auto';
  namespaceKeyFormatDraft.value = 'raw';
  namespaceKeyTypeDraft.value = 'auto';
  activeNamespaceFilter.value = null;
  resetNamespacePagination();
  await loadNamespaces(beginRequestGeneration());
}

async function setNodeFilters(nodeIds: string[]): Promise<void> {
  const availableNodeIds = new Set(nodeButtons.value.map((node) => node.id));
  activeNodeFilters.value = uniqueValues(nodeIds).filter((nodeId) => availableNodeIds.has(nodeId));
  resetPartyPagination();
  resetNamespacePagination();
  namespacesResponse.value = null;
  loadingNamespaces.value = false;
  clearPartyResults();
  error.value = null;

  beginRequestGeneration();
  await router.push({
    path: '/parties',
    query: buildNodeQuery(activeNodeFilters.value),
  });
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

function syncNodeFiltersFromRoute(): void {
  if (Object.prototype.hasOwnProperty.call(route.query, 'node')) {
    showAdvancedFilter.value = true;
  }

  if (!nodes.value) {
    return;
  }

  activeNodeFilters.value = readNodeFilters(nodes.value);
  resetPartyPagination();
  resetNamespacePagination();
  namespacesResponse.value = null;
  loadingNamespaces.value = false;
  clearPartyResults();
  error.value = null;

  const generation = beginRequestGeneration();
  void ensureAllNodesPartiesLoaded(selectedMode.value, generation, true);
}

watch(
  () => route.query,
  () => {
    syncNodeFiltersFromRoute();
  },
  { deep: true },
);

onMounted(async () => {
  try {
    nodes.value = await fetchNodes();
    activeNodeFilters.value = readNodeFilters(nodes.value);
    if (Object.prototype.hasOwnProperty.call(route.query, 'node')) {
      showAdvancedFilter.value = true;
    }
    await ensureAllNodesPartiesLoaded(selectedMode.value, requestGeneration.value);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
  }
});
</script>

<template>
  <section class="dashboard">
    <header class="dashboard__hero parties-page__hero">
      <div class="dashboard__hero-copy">
        <h2>Parties</h2>
      </div>
    </header>

    <p v-if="error" class="dashboard__message dashboard__message--error">{{ error }}</p>
    <div v-else class="parties-page">
      <div class="parties-page__mode-switch" role="tablist" aria-label="Party source modes">
          <button
            type="button"
            class="parties-page__mode-button"
            :class="{ 'parties-page__mode-button--active': selectedMode === 'active' }"
            :aria-pressed="selectedMode === 'active'"
            @click="selectMode('active')"
          >
            Active Parties (PQS)
          </button>
          <button
            type="button"
            class="parties-page__mode-button"
            :class="{ 'parties-page__mode-button--active': selectedMode === 'all' }"
            :aria-pressed="selectedMode === 'all'"
            @click="selectMode('all')"
          >
            All Parties (gRPC)
          </button>
          <button
            type="button"
            class="parties-page__mode-button"
            :class="{ 'parties-page__mode-button--active': selectedMode === 'fingerprints' }"
            :aria-pressed="selectedMode === 'fingerprints'"
            @click="selectMode('fingerprints')"
          >
            Namespaces (gRPC)
          </button>
      </div>

      <div>
        <div v-if="selectedHeader" class="parties-page__results-header">
          <div>
            <h3>{{ selectedHeader }}</h3>
          </div>
          <div class="results-header__actions">
            <div class="node-updates__pager">
              <button
                type="button"
                class="dashboard__refresh"
                :aria-expanded="showAdvancedFilter"
                aria-controls="parties-advanced-filter"
                @click="toggleAdvancedFilter"
              >
                Advanced Filter
              </button>
              <label class="node-updates__page-size">
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
                aria-label="Newer"
                title="Newer"
                @click="selectedMode === 'fingerprints' ? showNewerNamespaces() : showNewerParties()"
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
                :disabled="selectedMode === 'fingerprints' ? !namespacesResponse?.nextBefore : !paginatedSelectedParties.nextBefore"
                aria-label="Older"
                title="Older"
                @click="selectedMode === 'fingerprints' ? showOlderNamespaces() : showOlderParties()"
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
            <QuerySourcePill
              v-if="(selectedMode === 'all' && selectedNodes.length > 0) || selectedFingerprintSource === 'grpc'"
              source="grpc"
            />
          </div>
        </div>
        <div
          v-if="showAdvancedFilter"
          class="node-updates-filter-shell node-updates-filter-shell--open"
        >
          <UpdatesAdvancedFilter
            id="parties-advanced-filter"
            party-draft=""
            template-draft=""
            :active-parties="[]"
            :active-templates="[]"
            :template-options="[]"
            filter-mode="or"
            :hide-splice="false"
            :node-options="nodeButtons"
            :active-nodes="activeNodeFilters"
            :show-party-filters="false"
            :show-template-filters="false"
            @set-node-filters="setNodeFilters"
          >
            <template #additional-fields>
              <template v-if="selectedMode === 'fingerprints'">
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
              </template>
            </template>
          </UpdatesAdvancedFilter>
        </div>
        <div
          v-if="selectedMode === 'all' && selectedNodes.length > 0 && selectableNodes.length === 0"
          class="parties-page__results-header"
        >
          <div>
            <h3>No gRPC nodes available</h3>
            <p class="package-detail__seen-meta parties-page__results-copy">
              Switch to Active Parties, or enable gRPC on at least one node to browse all local parties.
            </p>
          </div>
        </div>

        <div
          v-if="nodes && selectedHeader && isSelectedNodeLoading"
          class="inline-loading"
          role="status"
          :aria-label="resultsLoadingLabel"
        >
          <span class="node-updates__spinner" aria-hidden="true"></span>
          <span>{{ resultsLoadingLabel }}...</span>
        </div>

        <div v-else-if="selectedMode === 'active'" class="package-detail__list">
          <div
            v-for="party in paginatedSelectedParties.items"
            :key="party"
            class="package-detail__list-row parties-page__party-row"
          >
            <RouterLink
              class="contract-detail__link parties-page__party-link"
              :to="`/parties/${party}`"
            >
              {{ party }}
            </RouterLink>
            <CopyToClipboardButton :value="party" />
          </div>
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
            v-if="selectedActiveRequestError"
            class="package-detail__seen-meta parties-page__results-copy"
          >
            {{ selectedActiveRequestError }}
          </p>
          <p
            v-if="selectedParties.length === 0 && selectedActiveNodeStatus !== 'pqs_error' && !selectedActiveRequestError"
            class="update-detail__empty"
          >
            No active parties found across selected nodes.
          </p>
        </div>

        <div
          v-else-if="selectedMode === 'all' && (selectedNodes.length === 0 || selectableNodes.length > 0)"
          class="package-detail__list"
        >
          <div
            v-for="party in paginatedSelectedParties.items"
            :key="party"
            class="package-detail__list-row parties-page__party-row"
          >
            <RouterLink
              class="contract-detail__link parties-page__party-link"
              :to="`/parties/${party}`"
            >
              {{ party }}
            </RouterLink>
            <CopyToClipboardButton :value="party" />
          </div>
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
            v-if="selectedLocalRequestError"
            class="package-detail__seen-meta parties-page__results-copy"
          >
            {{ selectedLocalRequestError }}
          </p>
          <p
            v-else-if="selectedParties.length === 0 && !selectedLocalRequestError"
            class="update-detail__empty"
          >
            No local parties found across selected nodes.
          </p>
        </div>

        <div v-else-if="selectedMode === 'fingerprints'" class="package-detail__list">
          <RouterLink
            v-for="fingerprint in selectedFingerprints"
            :key="fingerprint"
            class="package-detail__list-row contract-detail__link parties-page__party-link parties-page__fingerprint-row"
            :to="`/namespaces/${encodeURIComponent(fingerprint)}`"
          >
            <span class="parties-page__fingerprint-value">{{ fingerprint }}</span>
          </RouterLink>
          <p v-if="selectedFingerprints.length === 0" class="update-detail__empty">
            No known namespaces found across selected nodes.
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
