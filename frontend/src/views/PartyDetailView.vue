<script setup lang="ts">
import { ref, watch } from 'vue';
import ContractsBrowser from '../components/ContractsBrowser.vue';
import QuerySourcePill from '../components/QuerySourcePill.vue';
import UpdatesBrowser from '../components/UpdatesBrowser.vue';
import { fetchPartyDetail } from '../lib/api';
import type { PartyDetailResponse } from '../types/parties';

const props = defineProps<{ partyId: string }>();

const partyDetail = ref<PartyDetailResponse | null>(null);
const detailError = ref<string | null>(null);

async function loadPartyDetail() {
  detailError.value = null;

  try {
    partyDetail.value = await fetchPartyDetail(props.partyId);
  } catch (err) {
    detailError.value = err instanceof Error ? err.message : 'Unknown error';
  }
}

watch(
  () => props.partyId,
  () => {
    void loadPartyDetail();
  },
  { immediate: true },
);
</script>

<template>
  <section class="party-detail">
    <p v-if="detailError" class="node-detail__message node-detail__message--error">{{ detailError }}</p>
    <p v-else-if="!partyDetail" class="node-detail__message">Loading party detail...</p>
    <div v-else class="node-page">
      <div class="node-page__rail">
        <RouterLink class="node-detail__back" to="/parties" aria-label="Back to overview">←</RouterLink>
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

          <section class="node-detail__section party-detail__section--topology">
            <h3>Party Topology</h3>
            <div class="party-topology__list">
              <article
                v-for="topology in partyDetail.partyTopologyByNode"
                :key="topology.nodeId"
                class="party-topology__card"
              >
                <div class="party-topology__header">
                  <p class="party-topology__node">{{ topology.label }}</p>
                  <QuerySourcePill source="grpc" />
                </div>

                <p
                  v-if="topology.status === 'grpc_not_configured'"
                  class="party-topology__state"
                >
                  gRPC not configured for this node.
                </p>
                <p
                  v-else-if="topology.status === 'grpc_error'"
                  class="party-topology__state party-topology__state--error"
                >
                  {{ topology.errorMessage ?? 'Topology read failed.' }}
                </p>
                <template v-else>
                  <div class="party-topology__group">
                    <h4>Party to Participant</h4>
                    <p v-if="topology.partyToParticipants.length === 0" class="party-topology__state">
                      Not Present
                    </p>
                    <div v-else class="party-topology__rows">
                      <div
                        v-for="participant in topology.partyToParticipants"
                        :key="`${topology.nodeId}-${participant.participantUid ?? participant.participantId ?? 'participant'}`"
                        class="party-topology__row"
                      >
                        <span class="party-topology__field">
                          <strong>Participant ID</strong>
                          {{ participant.participantId ?? 'Not Present' }}
                        </span>
                        <span class="party-topology__field">
                          <strong>Participant UID</strong>
                          {{ participant.participantUid ?? 'Not Present' }}
                        </span>
                        <span class="party-topology__field">
                          <strong>Permission</strong>
                          {{ participant.permission ?? 'Not Present' }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div class="party-topology__group">
                    <h4>Party to Key</h4>
                    <p v-if="topology.partyToKeyMappings.length === 0" class="party-topology__state">
                      Not Present
                    </p>
                    <div v-else class="party-topology__rows">
                      <div
                        v-for="keyMapping in topology.partyToKeyMappings"
                        :key="`${topology.nodeId}-${keyMapping.keyFingerprint ?? keyMapping.keyType ?? 'key'}`"
                        class="party-topology__row"
                      >
                        <span class="party-topology__field">
                          <strong>Fingerprint</strong>
                          {{ keyMapping.keyFingerprint ?? 'Not Present' }}
                        </span>
                        <span class="party-topology__field">
                          <strong>Purpose</strong>
                          {{ keyMapping.purpose ?? 'Not Present' }}
                        </span>
                        <span class="party-topology__field">
                          <strong>Key Type</strong>
                          {{ keyMapping.keyType ?? 'Not Present' }}
                        </span>
                      </div>
                    </div>
                  </div>
                </template>
              </article>
            </div>
          </section>

          <section class="node-detail__section party-detail__section--updates">
            <UpdatesBrowser
              scope="party"
              :path="`/parties/${encodeURIComponent(props.partyId)}`"
              :party-id="props.partyId"
              title="Recent Updates"
              eyebrow="Updates"
              show-node-column
              :show-party-filters="false"
              source-tag="party"
              query-prefix="updates"
              advanced-filter-id="party-updates-advanced-filter"
              loading-message="Loading party updates..."
              empty-message="No updates found for this party."
              table-aria-label="Recent party updates"
              spinner-label="Updating party updates"
            />
          </section>

          <section class="node-detail__section party-detail__section--contracts">
            <ContractsBrowser
              scope="party"
              :path="`/parties/${encodeURIComponent(props.partyId)}`"
              :party-id="props.partyId"
              title="Recent Contracts"
              eyebrow="Contracts"
              query-prefix="contracts"
              show-node-column
              :show-party-filters="false"
              advanced-filter-id="party-contracts-advanced-filter"
              loading-message="Loading party contracts..."
              empty-message="No contracts found for this party."
              table-aria-label="Recent party contracts"
              spinner-label="Updating party contracts"
            />
          </section>
        </div>
      </div>
    </div>
  </section>
</template>
