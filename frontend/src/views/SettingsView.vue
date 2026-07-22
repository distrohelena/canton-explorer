<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { fetchNodeTrafficPurchases, fetchNodes } from '../lib/api';
import type { NodeSnapshot, NodeTrafficPurchasesResponse } from '../types/nodes';

const REFRESH_INTERVAL_MS = 15_000;

const nodes = ref<NodeSnapshot[]>([]);
const trafficByNode = ref<Record<string, NodeTrafficPurchasesResponse | null>>({});
const loading = ref(true);
const hasLoaded = ref(false);
const error = ref<string | null>(null);
const lastRefreshAt = ref<string | null>(null);
const isRefreshing = ref(false);
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

function trafficForNode(nodeId: string): NodeTrafficPurchasesResponse | null {
  return trafficByNode.value[nodeId] ?? null;
}

function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : 'Unknown indexing status failure';
}

async function loadNodes(): Promise<void> {
  if (requestInFlight) {
    return;
  }

  requestInFlight = true;
  if (hasLoaded.value) {
    isRefreshing.value = true;
  } else {
    loading.value = true;
  }

  try {
    const nextNodes = await fetchNodes();
    nodes.value = nextNodes;
    const trafficEntries = await Promise.all(
      nextNodes.map(async (node) => {
        try {
          return [node.id, await fetchNodeTrafficPurchases(node.id)] as const;
        } catch {
          return [node.id, null] as const;
        }
      }),
    );
    trafficByNode.value = Object.fromEntries(trafficEntries);
    error.value = null;
    hasLoaded.value = true;
    lastRefreshAt.value = new Date().toISOString();
  } catch (caught) {
    error.value = errorMessage(caught);
  } finally {
    loading.value = false;
    isRefreshing.value = false;
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
        <p class="eyebrow">Operational view</p>
        <h2 id="settings-heading">Settings</h2>
      </div>
      <p v-if="lastRefreshAt" class="settings-page__refresh" :data-refreshing="isRefreshing">
        Updated {{ formatDate(lastRefreshAt) }}
      </p>
    </header>

    <section class="settings-section" aria-labelledby="indexing-status-heading">
      <div class="settings-section__header">
        <div>
          <p class="eyebrow">Node observability</p>
          <h3 id="indexing-status-heading">Indexing status</h3>
        </div>
        <span v-if="isRefreshing" class="settings-section__refreshing">Refreshing…</span>
      </div>

      <div v-if="loading" class="settings-state" role="status">
        Loading indexing status…
      </div>

      <div v-else-if="error && nodes.length === 0" class="settings-state settings-state--error" role="alert">
        <strong>Unable to load indexing status.</strong>
        <span>{{ error }}</span>
        <button type="button" class="button button--secondary" @click="retry">Retry</button>
      </div>

      <div v-else-if="nodes.length === 0" class="settings-state">
        <strong>No nodes are configured.</strong>
        <span>Explorer configuration is managed by the server.</span>
      </div>

      <template v-else>
        <p v-if="error" class="settings-refresh-error" role="alert">
          Refresh failed: {{ error }}. Showing the last successful snapshot.
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
                <p class="eyebrow">{{ node.ledgerLabel }}</p>
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
                <p class="eyebrow">Traffic Purchases</p>
                <span
                  v-if="trafficForNode(node.id)?.current.status === 'grpc_error' || trafficForNode(node.id)?.history.status === 'pqs_error'"
                  class="settings-node-card__traffic-status"
                >
                  Partial data
                </span>
              </div>

              <dl v-if="trafficForNode(node.id)" class="settings-node-card__details settings-node-card__details--traffic">
                <template v-if="trafficForNode(node.id)?.current.states.length">
                  <div v-for="state in trafficForNode(node.id)?.current.states" :key="state.synchronizerId">
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
                    <template v-if="trafficForNode(node.id)?.history.purchases[0]">
                      {{ formatCc(trafficForNode(node.id)?.history.purchases[0]?.amuletPaid) }}
                      for {{ formatTraffic(trafficForNode(node.id)?.history.purchases[0]?.purchasedTraffic) }}
                    </template>
                    <template v-else>No purchase recorded</template>
                  </dd>
                </div>
                <div>
                  <dt>Purchased at</dt>
                  <dd>{{ formatDate(trafficForNode(node.id)?.history.purchases[0]?.recordTime ?? null) }}</dd>
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
