<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { RouterLink } from 'vue-router';
import { useSectionLoad } from '../composables/useSectionLoad';
import { fetchNodeTrafficPurchases, fetchNodes } from '../lib/api';
import type { NodeSnapshot, NodeTrafficPurchasesResponse } from '../types/nodes';

const REFRESH_INTERVAL_MS = 15_000;

type TrafficLoader = ReturnType<typeof useSectionLoad<NodeTrafficPurchasesResponse>>;

const {
  data: nodesData,
  loading: nodesLoading,
  error: nodesError,
  load: loadNodeStatus,
} = useSectionLoad(fetchNodes);
const nodes = computed(() => nodesData.value ?? []);
const trafficByNode = shallowRef<Record<string, TrafficLoader>>({});
const hasLoaded = ref(false);
const lastRefreshAt = ref<string | null>(null);
const isRefreshing = computed(() => hasLoaded.value && nodesLoading.value);
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let requestInFlight = false;

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

  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? 'Unavailable' : dateFormatter.format(timestamp);
}

function statusLabel(status: NodeSnapshot['status']): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function sourceLabel(ok: boolean, source: 'PQS' | 'gRPC'): string {
  return ok ? `${source} available` : `${source} unavailable`;
}

function formatTraffic(value: string | null | undefined): string {
  if (!value) {
    return 'Unavailable';
  }

  try {
    return `${BigInt(value).toLocaleString('en-US')} bytes`;
  } catch {
    return `${value} bytes`;
  }
}

function formatCc(value: string | null | undefined): string {
  return value ? `${value} CC` : 'Unavailable';
}

function trafficForNode(nodeId: string): TrafficLoader | null {
  return trafficByNode.value[nodeId] ?? null;
}

function trafficDataForNode(nodeId: string): NodeTrafficPurchasesResponse | null {
  return trafficForNode(nodeId)?.data.value ?? null;
}

function trafficLoadingForNode(nodeId: string): boolean {
  return trafficForNode(nodeId)?.loading.value ?? false;
}

function trafficErrorForNode(nodeId: string): string | null {
  return trafficForNode(nodeId)?.error.value ?? null;
}

function retryTraffic(nodeId: string): void {
  void trafficForNode(nodeId)?.retry();
}

function createTrafficLoader(nodeId: string): TrafficLoader {
  return useSectionLoad(() => fetchNodeTrafficPurchases(nodeId));
}

async function loadNodes(): Promise<void> {
  if (requestInFlight) {
    return;
  }

  requestInFlight = true;

  try {
    await loadNodeStatus();
    if (!nodesData.value) return;

    const nextTrafficByNode: Record<string, TrafficLoader> = {};
    for (const node of nodesData.value) {
      const traffic = trafficByNode.value[node.id] ?? createTrafficLoader(node.id);
      nextTrafficByNode[node.id] = traffic;
      void traffic.load();
    }
    trafficByNode.value = nextTrafficByNode;
    hasLoaded.value = true;
    lastRefreshAt.value = new Date().toISOString();
  } finally {
    requestInFlight = false;
  }
}

function retry(): void {
  void loadNodes();
}

onMounted(() => {
  void loadNodes();
  refreshTimer = setInterval(() => {
    void loadNodes();
  }, REFRESH_INTERVAL_MS);
});

onBeforeUnmount(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
});
</script>

<template>
  <section class="settings-page" aria-labelledby="settings-heading">
    <header class="settings-page__header">
      <div>
        <h2 id="settings-heading">Settings</h2>
      </div>
      <p v-if="lastRefreshAt" class="settings-page__refresh" :data-refreshing="isRefreshing">
        Updated {{ formatDate(lastRefreshAt) }}
      </p>
    </header>

    <section class="settings-section" aria-labelledby="indexing-status-heading">
      <div class="settings-section__header">
        <div>
          <h3 id="indexing-status-heading">Indexing status</h3>
        </div>
        <span v-if="isRefreshing" class="settings-section__refreshing">Refreshing…</span>
      </div>

      <div v-if="(nodesLoading || (!hasLoaded && !nodesError && nodes.length === 0))" class="settings-state inline-loading" role="status">
        <span class="node-updates__spinner" aria-hidden="true"></span>
        <span>Loading indexing status…</span>
      </div>

      <div v-else-if="nodesError && nodes.length === 0" class="settings-state settings-state--error" role="alert">
        <strong>Unable to load indexing status.</strong>
        <span>{{ nodesError }}</span>
        <button type="button" class="button button--secondary" @click="retry">Retry</button>
      </div>

      <div v-else-if="nodes.length === 0" class="settings-state">
        <strong>No nodes are configured.</strong>
        <span>Explorer configuration is managed by the server.</span>
      </div>

      <template v-else>
        <p v-if="nodesError" class="settings-refresh-error" role="alert">
          Refresh failed: {{ nodesError }}. Showing the last successful snapshot.
        </p>

        <div class="settings-node-grid">
          <article
            v-for="node in nodes"
            :key="node.id"
            class="settings-node-card"
            :data-status="node.status"
          >
            <header class="settings-node-card__header">
              <div>
                <RouterLink class="settings-node-card__title" :to="`/nodes/${node.id}`">
                  {{ node.label }}
                </RouterLink>
              </div>
              <span class="status-pill" :data-status="node.status">{{ statusLabel(node.status) }}</span>
            </header>

            <dl class="settings-node-card__details">
              <div>
                <dt>PQS status</dt>
                <dd>{{ sourceLabel(node.sourceStatus.pqs.ok, 'PQS') }}</dd>
              </div>
              <div>
                <dt>PQS checked</dt>
                <dd>{{ formatDate(node.sourceStatus.pqs.checkedAt) }}</dd>
              </div>
              <div>
                <dt>Latest indexed offset</dt>
                <dd>{{ node.ledgerSummary.latestOffset ?? 'Unavailable' }}</dd>
              </div>
              <div>
                <dt>Latest indexed event</dt>
                <dd>{{ formatDate(node.ledgerSummary.latestEventAt) }}</dd>
              </div>
              <div>
                <dt>Indexed updates</dt>
                <dd>{{ node.ledgerSummary.totalUpdateCount.toLocaleString() }}</dd>
              </div>
              <div v-if="node.mode === 'pqs_with_grpc'">
                <dt>gRPC status</dt>
                <dd>{{ sourceLabel(node.sourceStatus.grpc.ok, 'gRPC') }}</dd>
              </div>
            </dl>

            <section class="settings-node-card__traffic" aria-label="Traffic Purchases">
              <div class="settings-node-card__traffic-header">
                <span
                  v-if="trafficDataForNode(node.id)?.current.status === 'grpc_error' || trafficDataForNode(node.id)?.history.status === 'pqs_error'"
                  class="settings-node-card__traffic-status"
                >
                  Partial data
                </span>
              </div>

              <div v-if="trafficLoadingForNode(node.id)" class="inline-loading" role="status">
                <span class="node-updates__spinner" aria-hidden="true"></span>
                <span>Loading traffic purchase data…</span>
              </div>
              <div v-else-if="trafficErrorForNode(node.id)" class="settings-state settings-state--error" role="alert">
                <strong>Unable to load traffic purchase data.</strong>
                <span>{{ trafficErrorForNode(node.id) }}</span>
                <button type="button" class="button button--secondary" @click="retryTraffic(node.id)">Retry</button>
              </div>
              <dl v-else-if="trafficDataForNode(node.id)" class="settings-node-card__details settings-node-card__details--traffic">
                <template v-if="trafficDataForNode(node.id)?.current.states.length">
                  <div v-for="state in trafficDataForNode(node.id)?.current.states" :key="state.synchronizerId">
                    <dt>Traffic balance</dt>
                    <dd>{{ formatTraffic(state.extraTrafficPurchased) }}</dd>
                  </div>
                </template>
                <div v-else>
                  <dt>Traffic balance</dt>
                  <dd>Unavailable</dd>
                </div>
                <div>
                  <dt>Latest purchase</dt>
                  <dd>
                    <template v-if="trafficDataForNode(node.id)?.history.purchases[0]">
                      {{ formatCc(trafficDataForNode(node.id)?.history.purchases[0]?.amuletPaid) }}
                      for {{ formatTraffic(trafficDataForNode(node.id)?.history.purchases[0]?.purchasedTraffic) }}
                    </template>
                    <template v-else>No purchase recorded</template>
                  </dd>
                </div>
                <div>
                  <dt>Purchased at</dt>
                  <dd>{{ formatDate(trafficDataForNode(node.id)?.history.purchases[0]?.recordTime ?? null) }}</dd>
                </div>
              </dl>
              <p v-else class="settings-node-card__traffic-empty">Traffic purchase data unavailable.</p>
            </section>

            <div v-if="!node.sourceStatus.pqs.ok || (node.mode === 'pqs_with_grpc' && !node.sourceStatus.grpc.ok)" class="settings-node-card__errors">
              <p v-if="!node.sourceStatus.pqs.ok">{{ node.sourceStatus.pqs.message ?? 'PQS is unavailable.' }}</p>
              <p v-if="node.mode === 'pqs_with_grpc' && !node.sourceStatus.grpc.ok">{{ node.sourceStatus.grpc.message ?? 'gRPC is unavailable.' }}</p>
            </div>
          </article>
        </div>
      </template>
    </section>
  </section>
</template>
