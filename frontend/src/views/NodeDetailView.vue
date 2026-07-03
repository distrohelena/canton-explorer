<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { fetchNode, fetchNodePackages } from '../lib/api';
import type { NodePackagesResponse, NodeSnapshot } from '../types/nodes';

const props = defineProps<{ id: string }>();

const node = ref<NodeSnapshot | null>(null);
const nodePackages = ref<NodePackagesResponse | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    const [nodeResponse, packagesResponse] = await Promise.all([
      fetchNode(props.id),
      fetchNodePackages(props.id),
    ]);
    node.value = nodeResponse;
    nodePackages.value = packagesResponse;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
  }
});

function formatRecordTime(recordTime: string | null): { date: string; time: string } | null {
  if (!recordTime) {
    return null;
  }

  const parsed = new Date(recordTime);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return {
    date: new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
    }).format(parsed),
    time: new Intl.DateTimeFormat(undefined, {
      timeStyle: 'medium',
    }).format(parsed),
  };
}

const installedPackages = computed(() =>
  (nodePackages.value?.packagesByName ?? []).map((group) => ({
    ...group,
    packages: group.packages.map((entry) => ({
      ...entry,
      uploadedAtLines: formatRecordTime(entry.uploadedAt),
    })),
  })),
);

const modeLabel = computed(() =>
  node.value?.mode === 'pqs_only' ? 'PQS Only' : 'PQS + gRPC',
);

const grpcNotConfigured = computed(() => node.value?.mode === 'pqs_only');
</script>

<template>
  <section class="node-detail">
    <p v-if="error" class="node-detail__message node-detail__message--error">{{ error }}</p>
    <p v-else-if="!node" class="node-detail__message">Loading node detail...</p>
    <div v-else class="node-page">
      <div class="node-page__rail">
        <RouterLink class="node-detail__back" to="/" aria-label="Back to overview">←</RouterLink>
      </div>

      <div class="node-page__main node-detail__content">
        <header class="node-detail__hero">
          <div>
            <p class="eyebrow">Node Workspace</p>
            <h2>{{ node.label }}</h2>
          </div>
          <p class="status-pill" :data-status="node.status">{{ node.status }}</p>
        </header>

        <div class="node-detail__sections">
          <section class="node-detail__section">
            <h3>Service Health</h3>
            <dl class="detail-grid">
              <div>
                <dt>Mode</dt>
                <dd>{{ modeLabel }}</dd>
              </div>
              <div>
                <dt>Serving status</dt>
                <dd>{{
                  grpcNotConfigured
                    ? 'Not configured'
                    : node.serviceInfo.servingStatus ?? 'Health check unavailable'
                }}</dd>
              </div>
              <div>
                <dt>gRPC target</dt>
                <dd>{{ grpcNotConfigured ? 'Not configured' : node.serviceInfo.target ?? 'Not configured' }}</dd>
              </div>
              <div>
                <dt>Health probe</dt>
                <dd>{{
                  grpcNotConfigured
                    ? 'Not configured'
                    : node.serviceInfo.healthCheckImplemented
                      ? 'Implemented'
                      : 'Unavailable'
                }}</dd>
              </div>
            </dl>
          </section>

          <section class="node-detail__section">
            <h3>Ledger Snapshot</h3>
            <dl class="detail-grid">
              <div>
                <dt>PQS database</dt>
                <dd>{{ node.ledgerSummary.pqsDatabase }}</dd>
              </div>
              <div>
                <dt>Latest offset</dt>
                <dd>{{ node.ledgerSummary.latestOffset ?? 'n/a' }}</dd>
              </div>
              <div>
                <dt>Latest event</dt>
                <dd>{{ node.ledgerSummary.latestEventAt ?? 'n/a' }}</dd>
              </div>
              <div>
                <dt>Active contracts</dt>
                <dd>{{ node.ledgerSummary.activeContractCount }}</dd>
              </div>
            </dl>
          </section>

          <section class="node-detail__section node-detail__section--packages">
            <h3>Installed Packages</h3>
            <p v-if="installedPackages.length === 0" class="update-detail__empty">
              No cached packages recorded for this node.
            </p>
            <div v-else class="node-packages">
              <section
                v-for="group in installedPackages"
                :key="group.packageName"
                class="node-packages__group"
              >
                <h4 class="node-packages__title">{{ group.packageName }}</h4>
                <div class="node-packages__list">
                  <div
                    v-for="entry in group.packages"
                    :key="entry.packageId"
                    class="node-packages__row"
                  >
                    <div class="node-packages__primary">
                      <span class="node-packages__version">{{ entry.version ?? 'n/a' }}</span>
                      <RouterLink class="contract-detail__link" :to="`/packages/${entry.packageId}`">
                        {{ entry.packageId }}
                      </RouterLink>
                    </div>
                    <div v-if="entry.uploadedAtLines" class="update-detail__time">
                      <span class="update-detail__time-date">{{ entry.uploadedAtLines.date }}</span>
                      <span class="update-detail__time-clock">{{ entry.uploadedAtLines.time }}</span>
                    </div>
                    <div v-else class="node-packages__timestamp">n/a</div>
                  </div>
                </div>
              </section>
            </div>
          </section>
        </div>
      </div>
    </div>
  </section>
</template>
