<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { fetchNode } from '../lib/api';
import type { NodeSnapshot } from '../types/nodes';

const props = defineProps<{ id: string }>();

const node = ref<NodeSnapshot | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    node.value = await fetchNode(props.id);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
  }
});
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
                <dt>Serving status</dt>
                <dd>{{ node.serviceInfo.servingStatus ?? 'Health check unavailable' }}</dd>
              </div>
              <div>
                <dt>gRPC target</dt>
                <dd>{{ node.serviceInfo.target ?? 'not configured' }}</dd>
              </div>
              <div>
                <dt>Health probe</dt>
                <dd>{{ node.serviceInfo.healthCheckImplemented ? 'Implemented' : 'Unavailable' }}</dd>
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
        </div>
      </div>
    </div>
  </section>
</template>
