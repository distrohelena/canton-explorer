<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import UpdatesToolbar from '../components/UpdatesToolbar.vue';
import {
  fetchNodes,
  fetchTrafficPurchases,
} from '../lib/api';
import { DEFAULT_PAGE_SIZE, normalizePageSize } from '../lib/pagination';
import type {
  GlobalTrafficPurchasesResponse,
  NodeSnapshot,
} from '../types/nodes';

type TrafficPurchaseFilters = {
  minDate: string;
  maxDate: string;
  purchasedMin: string;
  purchasedMax: string;
  paidMin: string;
  paidMax: string;
};

const nodes = ref<NodeSnapshot[]>([]);
const selectedNodeIds = ref<string[]>([]);
const traffic = ref<GlobalTrafficPurchasesResponse | null>(null);
const pageSize = ref(DEFAULT_PAGE_SIZE);
const pageLoading = ref(false);
const loading = ref(true);
const advancedSearchExpanded = ref(false);
const filters = ref<TrafficPurchaseFilters>(emptyTrafficFilters());
const filterDraft = ref<TrafficPurchaseFilters>(emptyTrafficFilters());
const error = ref<string | null>(null);

function emptyTrafficFilters(): TrafficPurchaseFilters {
  return {
    minDate: '',
    maxDate: '',
    purchasedMin: '',
    purchasedMax: '',
    paidMin: '',
    paidMax: '',
  };
}

const allNodesSelected = computed(
  () =>
    nodes.value.length > 0 &&
    selectedNodeIds.value.length === nodes.value.length &&
    nodes.value.every((node) => selectedNodeIds.value.includes(node.id)),
);

const hasHistoryFailure = computed(() =>
  traffic.value?.historyStatus.some((entry) => entry.status === 'pqs_error') ?? false,
);

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function formatDate(value: string | null): string {
  if (!value) {
    return 'Unavailable';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unavailable' : dateFormatter.format(date);
}

function formatTraffic(value: string | null): string {
  if (!value) {
    return 'Unavailable';
  }

  try {
    return `${BigInt(value).toLocaleString('en-US')} bytes`;
  } catch {
    return `${value} bytes`;
  }
}

function formatCc(value: string | null): string {
  return value ? `${value} CC` : 'Unavailable';
}

function normalizeTrafficFilters(value?: Partial<TrafficPurchaseFilters>): TrafficPurchaseFilters {
  return {
    minDate: String(value?.minDate ?? ''),
    maxDate: String(value?.maxDate ?? ''),
    purchasedMin: String(value?.purchasedMin ?? ''),
    purchasedMax: String(value?.purchasedMax ?? ''),
    paidMin: String(value?.paidMin ?? ''),
    paidMax: String(value?.paidMax ?? ''),
  };
}

function nonEmptyFilters(value: TrafficPurchaseFilters): Partial<TrafficPurchaseFilters> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry.length > 0),
  ) as Partial<TrafficPurchaseFilters>;
}

function requestOptions(options: {
  limit?: number;
  before?: string;
  after?: string;
} = {}): Parameters<typeof fetchTrafficPurchases>[0] {
  const request: Parameters<typeof fetchTrafficPurchases>[0] = {
    limit: options.limit ?? pageSize.value,
    ...nonEmptyFilters(filters.value),
  };

  if (!allNodesSelected.value) {
    request.nodeIds = [...selectedNodeIds.value];
  }
  if (options.before) {
    request.before = options.before;
  }
  if (options.after) {
    request.after = options.after;
  }

  return request;
}

async function loadTraffic(options: {
  limit?: number;
  before?: string;
  after?: string;
} = {}): Promise<void> {
  pageLoading.value = true;
  error.value = null;

  try {
    traffic.value = await fetchTrafficPurchases(requestOptions(options));
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Unable to load traffic purchases.';
    traffic.value = null;
  } finally {
    pageLoading.value = false;
  }
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    const nextNodes = await fetchNodes();
    const previousSelection = new Set(selectedNodeIds.value);
    nodes.value = nextNodes;
    selectedNodeIds.value =
      previousSelection.size === 0
        ? nextNodes.map((node) => node.id)
        : nextNodes.map((node) => node.id).filter((nodeId) => previousSelection.has(nodeId));
    await loadTraffic();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Unable to load traffic purchases.';
  } finally {
    loading.value = false;
  }
}

function toggleAdvancedSearch(): void {
  advancedSearchExpanded.value = !advancedSearchExpanded.value;
}

function setNodeSelection(nodeId: string, event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  const nextSelection = new Set(selectedNodeIds.value);
  if (target.checked) {
    nextSelection.add(nodeId);
  } else {
    nextSelection.delete(nodeId);
  }
  selectedNodeIds.value = nodes.value
    .map((node) => node.id)
    .filter((id) => nextSelection.has(id));
  void loadTraffic();
}

function applyFilters(): void {
  filters.value = normalizeTrafficFilters(filterDraft.value);
  void loadTraffic();
}

function clearFilters(): void {
  const nextFilters = emptyTrafficFilters();
  filters.value = nextFilters;
  filterDraft.value = { ...nextFilters };
  void loadTraffic();
}

function setPageSize(value: number): void {
  pageSize.value = normalizePageSize(value);
  void loadTraffic({ limit: pageSize.value });
}

function showOlder(): void {
  if (traffic.value?.nextBefore) {
    void loadTraffic({ before: traffic.value.nextBefore });
  }
}

function showNewer(): void {
  if (traffic.value?.nextAfter) {
    void loadTraffic({ after: traffic.value.nextAfter });
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <section class="traffic-page" aria-labelledby="traffic-purchases-heading">
    <header class="traffic-page__header">
      <div>
        <p class="eyebrow">Traffic</p>
        <h2 id="traffic-purchases-heading">Traffic Purchases</h2>
      </div>
    </header>

    <div v-if="loading" class="traffic-page__state" role="status">Loading traffic purchases…</div>

    <div v-else-if="error" class="traffic-page__state traffic-page__state--error" role="alert">
      <strong>Unable to load traffic purchases.</strong>
      <span>{{ error }}</span>
      <button type="button" class="button button--secondary" @click="load">Retry</button>
    </div>

    <div v-else-if="nodes.length === 0" class="traffic-page__state">
      No nodes are configured.
    </div>

    <section v-else class="traffic-page__section activity-home__updates-section">
      <header class="node-detail__hero">
        <div>
          <p class="activity-home__eyebrow">Traffic</p>
          <h3>Purchases</h3>
        </div>
        <div class="results-header__actions">
          <UpdatesToolbar
            :advanced-filter-expanded="advancedSearchExpanded"
            advanced-filter-controls="traffic-purchases-advanced-search"
            advanced-filter-label="Advanced Search"
            :newer-disabled="!traffic?.nextAfter || pageLoading"
            :older-disabled="!traffic?.nextBefore || pageLoading"
            :page-size="pageSize"
            page-size-aria-label="Traffic Purchases per page"
            @toggle-advanced-filter="toggleAdvancedSearch"
            @newer="showNewer"
            @older="showOlder"
            @page-size-change="setPageSize"
          />
        </div>
      </header>

      <div
        class="traffic-advanced-search-shell"
        :class="{ 'traffic-advanced-search-shell--open': advancedSearchExpanded }"
      >
        <section
          id="traffic-purchases-advanced-search"
          class="node-updates__advanced-filter traffic-advanced-search"
          :aria-hidden="!advancedSearchExpanded"
          aria-label="Advanced Search Parameters"
        >
          <h3 class="node-updates__advanced-filter-title">Advanced Search Parameters</h3>
          <div class="traffic-advanced-search__grid">
            <div class="node-updates__advanced-filter-field node-updates__advanced-filter-field--nodes">
              <span>Nodes</span>
              <div class="node-updates__advanced-filter-node-list">
                <label
                  v-for="node in nodes"
                  :key="node.id"
                  class="node-updates__advanced-filter-node-toggle"
                >
                  <input
                    class="node-updates__advanced-filter-checkbox"
                    :checked="selectedNodeIds.includes(node.id)"
                    type="checkbox"
                    :aria-label="node.label"
                    @change="setNodeSelection(node.id, $event)"
                  />
                  <span>{{ node.label }}</span>
                </label>
              </div>
            </div>
            <label class="node-updates__advanced-filter-field">
              Minimum date
              <input v-model="filterDraft.minDate" type="date" />
            </label>
            <label class="node-updates__advanced-filter-field">
              Maximum date
              <input v-model="filterDraft.maxDate" type="date" />
            </label>
            <label class="node-updates__advanced-filter-field">
              Minimum purchased traffic
              <input v-model="filterDraft.purchasedMin" type="number" min="0" step="1" />
            </label>
            <label class="node-updates__advanced-filter-field">
              Maximum purchased traffic
              <input v-model="filterDraft.purchasedMax" type="number" min="0" step="1" />
            </label>
            <label class="node-updates__advanced-filter-field">
              Minimum paid amount
              <input v-model="filterDraft.paidMin" type="number" min="0" step="any" />
            </label>
            <label class="node-updates__advanced-filter-field">
              Maximum paid amount
              <input v-model="filterDraft.paidMax" type="number" min="0" step="any" />
            </label>
          </div>
          <div class="traffic-advanced-search__actions">
            <button type="button" class="button button--secondary" @click="clearFilters">
              Clear filters
            </button>
            <button type="button" class="dashboard__refresh" @click="applyFilters">
              Apply filters
            </button>
          </div>
        </section>
      </div>

      <div v-if="traffic?.purchases.length" class="traffic-purchases-table" role="table" aria-label="All node traffic purchases">
        <div class="traffic-purchases-table__row traffic-purchases-table__row--header" role="row">
          <span>Node</span>
          <span>Purchased</span>
          <span>Paid</span>
          <span>Time</span>
          <span>Offset</span>
        </div>
        <div
          v-for="purchase in traffic.purchases"
          :key="`${purchase.nodeId}-${purchase.updateId}`"
          class="traffic-purchases-table__row"
          role="row"
        >
          <span>{{ purchase.label }}</span>
          <span>{{ formatTraffic(purchase.purchasedTraffic) }}</span>
          <span>{{ formatCc(purchase.amuletPaid) }}</span>
          <span>{{ formatDate(purchase.recordTime) }}</span>
          <span>{{ purchase.eventOffset }}</span>
        </div>
      </div>
      <p v-else-if="hasHistoryFailure" class="traffic-node-card__empty">
        Traffic purchase data unavailable.
      </p>
      <p v-else class="traffic-node-card__empty">No traffic purchases recorded.</p>
    </section>
  </section>
</template>
