<script setup lang="ts">
import { watch } from 'vue';
import CopyToClipboardButton from '../components/CopyToClipboardButton.vue';
import ContractsBrowser from '../components/ContractsBrowser.vue';
import QuerySourcePill from '../components/QuerySourcePill.vue';
import UpdatesBrowser from '../components/UpdatesBrowser.vue';
import { useSectionLoad } from '../composables/useSectionLoad';
import { fetchPartyNodes, fetchPartySummary, fetchPartyTopology } from '../lib/api';
import type { PartyTopologyResponse } from '../types/parties';

const props = defineProps<{ partyId: string }>();

const {
  data: summaryData,
  loading: summaryLoading,
  error: summaryError,
  load: loadSummary,
  retry: retrySummary,
  reset: resetSummary,
} = useSectionLoad(() => fetchPartySummary(props.partyId));
const {
  data: nodesData,
  loading: nodesLoading,
  error: nodesError,
  load: loadNodes,
  retry: retryNodes,
  reset: resetNodes,
} = useSectionLoad(() => fetchPartyNodes(props.partyId));
const {
  data: topologyData,
  loading: topologyLoading,
  error: topologyError,
  load: loadTopology,
  retry: retryTopology,
  reset: resetTopology,
} = useSectionLoad(() => fetchPartyTopology(props.partyId));
const partyPurposeLabels: Record<string, string> = {
  namespace: 'Namespace',
  proofOfOwnership: 'Proof-of-Ownership',
  protocol: 'Protocol',
};
const partyKeyLabels: Record<string, string> = {
  ed25519: 'ED25519',
  ecCurve25519: 'ED25519',
  x25519: 'X25519',
};
const partyKeyFormatLabels: Record<string, string> = {
  derX509SubjectPublicKeyInfo: 'DER X.509 SPKI',
};
const partyPermissionLabels: Record<string, string> = {
  confirmation: 'Confirmation',
  submission: 'Submission',
  observation: 'Observation',
};

function formatPartyPurposeLabel(value: string): string {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return trimmedValue;
  }

  const knownLabel = partyPurposeLabels[trimmedValue];
  if (knownLabel) {
    return knownLabel;
  }

  return trimmedValue
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function splitPartyPurposeLabels(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((segment) => formatPartyPurposeLabel(segment))
    .filter((segment) => segment.length > 0);
}

function formatPartyKeyLabel(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  const knownLabel = partyKeyLabels[trimmedValue];
  if (knownLabel) {
    return knownLabel;
  }

  return trimmedValue
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter((segment) => segment.length > 0)
    .map((segment) =>
      segment === segment.toUpperCase()
        ? segment
        : segment.charAt(0).toUpperCase() + segment.slice(1),
    )
    .join(' ');
}

function formatPartyPermissionLabel(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  return partyPermissionLabels[trimmedValue]
    ?? formatPartyKeyLabel(trimmedValue)
    ?? trimmedValue;
}

function formatPartyKeyFormatLabel(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  return partyKeyFormatLabels[trimmedValue]
    ?? formatPartyKeyLabel(trimmedValue)
    ?? trimmedValue;
}

function resolvePartyParticipantThreshold(
  participants: PartyTopologyResponse['partyTopologyByNode'][number]['partyToParticipants'],
): number | null {
  const thresholds = participants
    .map((participant) => participant.threshold)
    .filter((threshold): threshold is number => threshold !== null);

  if (thresholds.length === 0) {
    return null;
  }

  return thresholds[0] ?? null;
}

function resolvePartyKeyThreshold(
  keyMappings: PartyTopologyResponse['partyTopologyByNode'][number]['partyToKeyMappings'],
): number | null {
  const thresholds = keyMappings
    .map((keyMapping) => keyMapping.threshold)
    .filter((threshold): threshold is number => threshold !== null);

  if (thresholds.length === 0) {
    return null;
  }

  return thresholds[0] ?? null;
}

watch(
  () => props.partyId,
  () => {
    resetSummary();
    resetNodes();
    resetTopology();
    void loadSummary();
    void loadNodes();
    void loadTopology();
  },
  { immediate: true },
);
</script>

<template>
  <section class="party-detail">
    <div class="node-page">
      <div class="node-page__main node-detail__content">
        <header class="node-detail__hero">
          <div class="party-detail__heading">
            <h2 class="party-detail__title">{{ props.partyId }}</h2>
            <CopyToClipboardButton :value="props.partyId" />
          </div>
        </header>

        <div class="node-detail__sections party-detail__sections">
          <section class="node-detail__section party-detail__section--summary">
            <h3>Overview</h3>
            <div
              v-if="summaryLoading"
              class="inline-loading"
              role="status"
              aria-label="Loading overview"
            >
              <span class="node-updates__spinner" aria-hidden="true"></span>
              <span>Loading overview...</span>
            </div>
            <div
              v-else-if="summaryError"
              class="node-detail__message node-detail__message--error"
              role="alert"
            >
              <span>{{ summaryError }}</span>
              <button type="button" class="button button--secondary" @click="retrySummary">Retry</button>
            </div>
            <dl v-else-if="summaryData" class="detail-grid party-detail__summary-grid">
              <div class="party-detail__summary-item party-detail__summary-item--full-row">
                <dt>Party ID</dt>
                <dd class="update-detail__id">{{ summaryData.partyId }}</dd>
              </div>
              <div class="party-detail__summary-item">
                <dt>Observed Nodes</dt>
                <dd>{{ summaryData.nodeCount }}</dd>
              </div>
              <div class="party-detail__summary-item">
                <dt>Recent Updates</dt>
                <dd>{{ summaryData.recentUpdateCount }}</dd>
              </div>
              <div class="party-detail__summary-item">
                <dt>Recent Contracts</dt>
                <dd>{{ summaryData.recentContractCount }}</dd>
              </div>
            </dl>
          </section>

          <section class="node-detail__section party-detail__section--nodes">
            <h3>Observed Nodes</h3>
            <div
              v-if="nodesLoading"
              class="inline-loading"
              role="status"
              aria-label="Loading observed nodes"
            >
              <span class="node-updates__spinner" aria-hidden="true"></span>
              <span>Loading observed nodes...</span>
            </div>
            <div
              v-else-if="nodesError"
              class="node-detail__message node-detail__message--error"
              role="alert"
            >
              <span>{{ nodesError }}</span>
              <button type="button" class="button button--secondary" @click="retryNodes">Retry</button>
            </div>
            <div v-else-if="nodesData" class="package-detail__list">
              <div
                v-for="node in nodesData.nodes"
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
            <div
              v-if="topologyLoading"
              class="inline-loading"
              role="status"
              aria-label="Loading party topology"
            >
              <span class="node-updates__spinner" aria-hidden="true"></span>
              <span>Loading party topology...</span>
            </div>
            <div
              v-else-if="topologyError"
              class="node-detail__message node-detail__message--error"
              role="alert"
            >
              <span>{{ topologyError }}</span>
              <button type="button" class="button button--secondary" @click="retryTopology">Retry</button>
            </div>
            <div v-else-if="topologyData" class="party-topology__list">
              <article
                v-for="topology in topologyData.partyTopologyByNode"
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
                  <div v-if="topology.isLocalParty !== undefined && topology.isLocalParty !== null" class="party-topology__group">
                    <h4>Local Party</h4>
                    <p class="party-topology__state">{{ topology.isLocalParty ? 'Yes' : 'No' }}</p>
                  </div>

                  <p
                    v-if="
                      topology.isLocalParty === true
                      && topology.partyToParticipants.length === 0
                      && topology.partyToKeyMappings.length === 0
                    "
                    class="party-topology__state"
                  >
                    No aggregated topology mappings returned for this local party.
                  </p>

                  <div class="party-topology__group">
                    <h4>Party to Participant</h4>
                    <p v-if="topology.partyToParticipants.length === 0" class="party-topology__state">
                      Not Present
                    </p>
                    <template v-else>
                      <div class="party-topology__row">
                        <span class="party-topology__field">
                          <strong>Threshold</strong>
                          {{ resolvePartyParticipantThreshold(topology.partyToParticipants) ?? 'Not Present' }}
                        </span>
                      </div>
                      <div class="party-topology__rows">
                      <div
                        v-for="participant in topology.partyToParticipants"
                        :key="`${topology.nodeId}-${participant.participantUid ?? participant.participantId ?? 'participant'}`"
                        class="party-topology__row party-topology__row--participant"
                      >
                        <span class="party-topology__field party-topology__field--participant-uid">
                          <strong>Participant UID</strong>
                          <RouterLink
                            v-if="participant.participantUid"
                            class="contract-detail__link party-topology__uid-link"
                            :to="`/parties/${encodeURIComponent(participant.participantUid)}`"
                            :title="participant.participantUid"
                          >
                            {{ participant.participantUid }}
                          </RouterLink>
                          <span v-else>Not Present</span>
                        </span>
                        <span class="party-topology__field">
                          <strong>Permission</strong>
                          <span
                            v-if="formatPartyPermissionLabel(participant.permission)"
                            class="party-topology__pill-list"
                          >
                            <span class="party-topology__pill">
                              {{ formatPartyPermissionLabel(participant.permission) }}
                            </span>
                          </span>
                          <span v-else>Not Present</span>
                        </span>
                      </div>
                      </div>
                    </template>
                  </div>

                  <div class="party-topology__group">
                    <h4>Party to Key</h4>
                    <p v-if="topology.partyToKeyMappings.length === 0" class="party-topology__state">
                      Not Present
                    </p>
                    <template v-else>
                      <div class="party-topology__row">
                        <span class="party-topology__field">
                          <strong>Threshold</strong>
                          {{ resolvePartyKeyThreshold(topology.partyToKeyMappings) ?? 'Not Present' }}
                        </span>
                      </div>
                      <div class="party-topology__rows">
                        <div
                          v-for="keyMapping in topology.partyToKeyMappings"
                          :key="`${topology.nodeId}-${keyMapping.keyFingerprint ?? keyMapping.keyType ?? 'key'}`"
                          class="party-topology__row party-topology__row--key"
                        >
                          <span class="party-topology__field party-topology__field--key-identity">
                            <span class="party-topology__stacked-value">
                              <strong>Fingerprint</strong>
                              <RouterLink
                                v-if="keyMapping.keyFingerprint"
                                class="contract-detail__link"
                                :to="`/namespaces/${encodeURIComponent(keyMapping.keyFingerprint)}`"
                              >
                                {{ keyMapping.keyFingerprint }}
                              </RouterLink>
                              <span v-else>Not Present</span>
                            </span>
                            <span class="party-topology__stacked-value">
                              <strong>Public Key</strong>
                              <span>{{ keyMapping.publicKey ?? 'Not Present' }}</span>
                            </span>
                          </span>
                          <span class="party-topology__field">
                            <strong>Purpose</strong>
                            <span
                              v-if="splitPartyPurposeLabels(keyMapping.purpose).length > 0"
                              class="party-topology__pill-list"
                            >
                              <span
                                v-for="purpose in splitPartyPurposeLabels(keyMapping.purpose)"
                                :key="`${topology.nodeId}-${keyMapping.keyFingerprint ?? keyMapping.keyType ?? 'key'}-${purpose}`"
                                class="party-topology__pill"
                              >
                                {{ purpose }}
                              </span>
                            </span>
                            <span v-else>Not Present</span>
                          </span>
                          <span class="party-topology__field">
                            <strong>Key Type</strong>
                          <span
                            v-if="formatPartyKeyLabel(keyMapping.keyType)"
                            class="party-topology__pill-list"
                          >
                            <span class="party-topology__pill">
                              {{ formatPartyKeyLabel(keyMapping.keyType) }}
                            </span>
                          </span>
                          <span v-else class="party-topology__pill-list">
                            <span class="party-topology__pill">Not Present</span>
                          </span>
                        </span>
                          <span class="party-topology__field">
                            <strong>Format</strong>
                            <span
                              v-if="formatPartyKeyFormatLabel(keyMapping.keyFormat)"
                              class="party-topology__pill-list"
                            >
                              <span class="party-topology__pill">
                                {{ formatPartyKeyFormatLabel(keyMapping.keyFormat) }}
                              </span>
                            </span>
                            <span v-else>Not Present</span>
                          </span>
                          <span class="party-topology__field">
                            <strong>Key Spec</strong>
                            <span
                              v-if="formatPartyKeyLabel(keyMapping.keySpec)"
                              class="party-topology__pill-list"
                            >
                              <span class="party-topology__pill">
                                {{ formatPartyKeyLabel(keyMapping.keySpec) }}
                              </span>
                            </span>
                            <span v-else>Not Present</span>
                          </span>
                        </div>
                      </div>
                    </template>
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
              title="Updates"
              eyebrow=""
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
              title="Contracts"
              eyebrow=""
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
