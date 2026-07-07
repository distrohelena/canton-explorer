<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { fetchTokenTransferDetail } from '../lib/api';
import type { TokenTransfersResponse } from '../types/tokens';

const props = defineProps<{ updateId: string }>();

const transferDetail = ref<TokenTransfersResponse['transfers'][number] | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    transferDetail.value = await fetchTokenTransferDetail(props.updateId);
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
    date: new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(parsed),
    time: new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' }).format(parsed),
  };
}

function partyLink(partyId: string): string {
  return `/parties/${encodeURIComponent(partyId)}`;
}

function nodeUpdateLink(nodeId: string, eventOffset: string): string {
  return `/nodes/${nodeId}/updates/${encodeURIComponent(eventOffset)}?from=tokens`;
}

const recordTimeLines = computed(() =>
  transferDetail.value ? formatRecordTime(transferDetail.value.recordTime) : null,
);
</script>

<template>
  <section class="contract-detail">
    <p v-if="error" class="node-detail__message node-detail__message--error">{{ error }}</p>
    <p v-else-if="!transferDetail" class="node-detail__message">Loading transfer detail...</p>
    <div v-else class="node-page">
      <div class="node-page__rail">
        <RouterLink class="node-detail__back" to="/tokens" aria-label="Back to overview">
          ←
        </RouterLink>
      </div>

      <div class="node-page__main contract-detail__content">
        <header class="node-detail__hero">
          <div>
            <p class="activity-home__eyebrow">Tokens</p>
            <h2>{{ transferDetail.tokenName }} Transfer</h2>
          </div>
        </header>

        <div class="node-detail__sections">
          <section class="node-detail__section contract-detail__section--summary">
            <h3>Summary</h3>
            <dl class="detail-grid contract-detail__summary-grid">
              <div class="contract-detail__summary-item">
                <dt>Token ID</dt>
                <dd>{{ transferDetail.tokenId }}</dd>
              </div>
              <div class="contract-detail__summary-item contract-detail__summary-item--full-row">
                <dt>Amount</dt>
                <dd class="token-transfer-detail__amount">{{ transferDetail.amount ?? 'n/a' }}</dd>
              </div>
              <div class="contract-detail__summary-item contract-detail__summary-item--full-row">
                <dt>From</dt>
                <dd v-if="transferDetail.sender">
                  <RouterLink class="contract-detail__link" :to="partyLink(transferDetail.sender)">
                    {{ transferDetail.sender }}
                  </RouterLink>
                </dd>
                <dd v-else>n/a</dd>
              </div>
              <div class="contract-detail__summary-item contract-detail__summary-item--full-row">
                <dt>To</dt>
                <dd v-if="transferDetail.receiver">
                  <RouterLink class="contract-detail__link" :to="partyLink(transferDetail.receiver)">
                    {{ transferDetail.receiver }}
                  </RouterLink>
                </dd>
                <dd v-else>n/a</dd>
              </div>
              <div class="contract-detail__summary-item contract-detail__summary-item--full-row">
                <dt>Update ID</dt>
                <dd class="update-detail__id">{{ transferDetail.updateId }}</dd>
              </div>
              <div class="contract-detail__summary-item">
                <dt>Record Time</dt>
                <dd v-if="recordTimeLines" class="update-detail__time">
                  <span class="node-updates__time-date">{{ recordTimeLines.date }}</span>
                  <span class="node-updates__time-clock">{{ recordTimeLines.time }}</span>
                </dd>
                <dd v-else>n/a</dd>
              </div>
            </dl>
          </section>

          <section class="node-detail__section contract-detail__section--data">
            <h3>Observing Nodes</h3>
            <div class="package-detail__list">
              <article
                v-for="node in transferDetail.nodes"
                :key="`${node.nodeId}:${node.eventOffset}`"
                class="package-detail__list-row"
              >
                <span class="package-detail__list-primary">{{ node.label }}</span>
                <RouterLink
                  class="package-detail__list-secondary contract-detail__link"
                  :to="nodeUpdateLink(node.nodeId, node.eventOffset)"
                >
                  {{ node.eventOffset }}
                </RouterLink>
              </article>
            </div>
          </section>
        </div>
      </div>
    </div>
  </section>
</template>
