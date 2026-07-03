<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { fetchPartyDetail } from '../lib/api';
import type { PartyDetailResponse } from '../types/parties';

const props = defineProps<{ partyId: string }>();

const partyDetail = ref<PartyDetailResponse | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    partyDetail.value = await fetchPartyDetail(props.partyId);
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

const recentUpdates = computed(() =>
  (partyDetail.value?.recentUpdates ?? []).map((update) => ({
    ...update,
    recordTimeLines: formatRecordTime(update.recordTime),
  })),
);

const recentContracts = computed(() =>
  (partyDetail.value?.recentContracts ?? []).map((contract) => ({
    ...contract,
    recordTimeLines: formatRecordTime(contract.recordTime),
  })),
);
</script>

<template>
  <section class="party-detail">
    <p v-if="error" class="node-detail__message node-detail__message--error">{{ error }}</p>
    <p v-else-if="!partyDetail" class="node-detail__message">Loading party detail...</p>
    <div v-else class="node-page">
      <div class="node-page__rail">
        <RouterLink class="node-detail__back" to="/" aria-label="Back to overview">←</RouterLink>
      </div>

      <div class="node-page__main node-detail__content">
        <header class="node-detail__hero">
          <div>
            <p class="activity-home__eyebrow">Parties</p>
            <h2 class="party-detail__title">{{ partyDetail.partyId }} Party</h2>
          </div>
        </header>

        <div class="node-detail__sections party-detail__sections">
          <section class="node-detail__section party-detail__section--summary">
            <h3>Overview</h3>
            <dl class="detail-grid party-detail__summary-grid">
              <div class="party-detail__summary-item party-detail__summary-item--full-row">
                <dt>Party ID</dt>
                <dd class="update-detail__id">{{ partyDetail.partyId }}</dd>
              </div>
              <div class="party-detail__summary-item">
                <dt>Observed Nodes</dt>
                <dd>{{ partyDetail.nodeCount }}</dd>
              </div>
              <div class="party-detail__summary-item">
                <dt>Recent Updates</dt>
                <dd>{{ partyDetail.recentUpdateCount }}</dd>
              </div>
              <div class="party-detail__summary-item">
                <dt>Recent Contracts</dt>
                <dd>{{ partyDetail.recentContractCount }}</dd>
              </div>
            </dl>
          </section>

          <section class="node-detail__section party-detail__section--nodes">
            <h3>Observed Nodes</h3>
            <div class="package-detail__list">
              <div
                v-for="node in partyDetail.nodes"
                :key="node.nodeId"
                class="package-detail__list-row"
              >
                <div class="party-detail__row-main">
                  <RouterLink class="contract-detail__link" :to="`/nodes/${node.nodeId}`">
                    {{ node.label }}
                  </RouterLink>
                </div>
                <span class="party-detail__meta party-detail__row-text">
                  {{ node.recentUpdateCount }} updates / {{ node.recentContractCount }} contracts
                </span>
              </div>
            </div>
          </section>

          <section class="node-detail__section party-detail__section--updates">
            <h3>Recent Updates</h3>
            <div class="package-detail__list">
              <div
                v-for="update in recentUpdates"
                :key="`${update.nodeId}-${update.eventOffset}`"
                class="package-detail__list-row"
              >
                <div class="party-detail__row-main">
                  <RouterLink
                    class="contract-detail__link"
                    :to="`/nodes/${update.nodeId}/updates/${update.eventOffset}`"
                  >
                    {{ update.eventOffset }}
                  </RouterLink>
                  <p class="package-detail__seen-meta party-detail__row-text">{{ update.label }}</p>
                  <p class="package-detail__seen-meta party-detail__row-text">
                    {{ update.parties.join(', ') }}
                  </p>
                </div>
                <div v-if="update.recordTimeLines" class="update-detail__time">
                  <span class="update-detail__time-date">{{ update.recordTimeLines.date }}</span>
                  <span class="update-detail__time-clock">{{ update.recordTimeLines.time }}</span>
                </div>
              </div>
            </div>
          </section>

          <section class="node-detail__section party-detail__section--contracts">
            <h3>Recent Contracts</h3>
            <div class="package-detail__list">
              <div
                v-for="contract in recentContracts"
                :key="`${contract.nodeId}-${contract.contractId}`"
                class="package-detail__list-row"
              >
                <div class="party-detail__row-main">
                  <RouterLink
                    class="contract-detail__link"
                    :to="`/nodes/${contract.nodeId}/contracts/${contract.contractId}`"
                  >
                    {{ contract.contractId }}
                  </RouterLink>
                  <p class="package-detail__seen-meta party-detail__row-text">
                    {{ contract.templateId ?? 'n/a' }}
                  </p>
                  <p class="package-detail__seen-meta party-detail__row-text">{{ contract.label }}</p>
                </div>
                <div v-if="contract.recordTimeLines" class="update-detail__time">
                  <span class="update-detail__time-date">{{ contract.recordTimeLines.date }}</span>
                  <span class="update-detail__time-clock">{{ contract.recordTimeLines.time }}</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  </section>
</template>
