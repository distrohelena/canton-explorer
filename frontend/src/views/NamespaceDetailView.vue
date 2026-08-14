<script setup lang="ts">
import { computed, ref, watch } from "vue";
import QuerySourcePill from "../components/QuerySourcePill.vue";
import { useSectionLoad } from "../composables/useSectionLoad";
import {
  fetchNamespaceContracts,
  fetchNamespaceNodes,
  fetchNamespaceParties,
  fetchNamespaceSummary,
  fetchNamespaceTopology,
  fetchNamespaceUpdates,
} from "../lib/api";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "../lib/pagination";
import type { PartyTopologyNodeEntry } from "../types/parties";

const props = defineProps<{ namespaceId: string }>();

const partiesPageSize = ref(DEFAULT_PAGE_SIZE);
const partiesBeforeCursor = ref<string | null>(null);
const partiesAfterCursor = ref<string | null>(null);

const summary = useSectionLoad(() => fetchNamespaceSummary(props.namespaceId));
const nodes = useSectionLoad(() => fetchNamespaceNodes(props.namespaceId));
const topology = useSectionLoad(() => fetchNamespaceTopology(props.namespaceId));
const parties = useSectionLoad(() =>
  fetchNamespaceParties(props.namespaceId, {
    limit: partiesPageSize.value,
    before: partiesBeforeCursor.value ?? undefined,
    after: partiesAfterCursor.value ?? undefined,
  }),
);
const updates = useSectionLoad(() =>
  fetchNamespaceUpdates(props.namespaceId, { limit: DEFAULT_PAGE_SIZE }),
);
const contracts = useSectionLoad(() =>
  fetchNamespaceContracts(props.namespaceId, { limit: DEFAULT_PAGE_SIZE }),
);

const partyPurposeLabels: Record<string, string> = {
  namespace: "Namespace",
  proofOfOwnership: "Proof-of-Ownership",
  protocol: "Protocol",
};
const partyKeyLabels: Record<string, string> = {
  ed25519: "ED25519",
  ecCurve25519: "ED25519",
  x25519: "X25519",
};
const partyKeyFormatLabels: Record<string, string> = {
  derX509SubjectPublicKeyInfo: "DER X.509 SPKI",
};
const partyPermissionLabels: Record<string, string> = {
  confirmation: "Confirmation",
  submission: "Submission",
  observation: "Observation",
};

const summaryData = summary.data;
const summaryLoading = summary.loading;
const summaryError = summary.error;
const nodesData = nodes.data;
const nodesLoading = nodes.loading;
const nodesError = nodes.error;
const topologyData = topology.data;
const topologyLoading = topology.loading;
const topologyError = topology.error;
const partiesData = parties.data;
const partiesLoading = parties.loading;
const partiesError = parties.error;
const updatesLoading = updates.loading;
const updatesError = updates.error;
const contractsLoading = contracts.loading;
const contractsError = contracts.error;

const renderedUpdates = computed(() =>
  (updates.data.value?.updates ?? []).map((update) => ({
    ...update,
    recordTimeLines: formatRecordTime(update.recordTime),
  })),
);

const renderedContracts = computed(() =>
  (contracts.data.value?.contracts ?? []).map((contract) => ({
    ...contract,
    recordTimeLines: formatRecordTime(contract.recordTime),
  })),
);

function formatRecordTime(
  recordTime: string | null,
): { date: string; time: string } | null {
  if (!recordTime) {
    return null;
  }

  const parsed = new Date(recordTime);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return {
    date: new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
      parsed,
    ),
    time: new Intl.DateTimeFormat(undefined, { timeStyle: "medium" }).format(
      parsed,
    ),
  };
}

function formatEstimatedTrafficUsd(
  value: string | null | undefined,
  gapDays: number | null | undefined,
): string {
  if (!value) {
    return "—";
  }

  if (!gapDays) {
    return `$${value}`;
  }

  return `$${value} (${gapDays} day${gapDays === 1 ? "" : "s"})`;
}

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
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .split(" ")
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function splitPartyPurposeLabels(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
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
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .split(" ")
    .filter((segment) => segment.length > 0)
    .map((segment) =>
      segment === segment.toUpperCase()
        ? segment
        : segment.charAt(0).toUpperCase() + segment.slice(1),
    )
    .join(" ");
}

function formatPartyPermissionLabel(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  return (
    partyPermissionLabels[trimmedValue] ??
    formatPartyKeyLabel(trimmedValue) ??
    trimmedValue
  );
}

function formatPartyKeyFormatLabel(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  return (
    partyKeyFormatLabels[trimmedValue] ??
    formatPartyKeyLabel(trimmedValue) ??
    trimmedValue
  );
}

function resolvePartyParticipantThreshold(
  participants: PartyTopologyNodeEntry["partyToParticipants"],
): number | null {
  const thresholds = participants
    .map((participant) => participant.threshold)
    .filter((threshold): threshold is number => threshold !== null);

  return thresholds[0] ?? null;
}

function resolvePartyKeyThreshold(
  keyMappings: PartyTopologyNodeEntry["partyToKeyMappings"],
): number | null {
  const thresholds = keyMappings
    .map((keyMapping) => keyMapping.threshold)
    .filter((threshold): threshold is number => threshold !== null);

  return thresholds[0] ?? null;
}

function resetPartyPagination() {
  partiesBeforeCursor.value = null;
  partiesAfterCursor.value = null;
}

async function showOlderParties() {
  const cursor = partiesData.value?.nextBefore;
  if (!cursor) {
    return;
  }

  partiesBeforeCursor.value = cursor;
  partiesAfterCursor.value = null;
  await parties.load();
}

async function showNewerParties() {
  const cursor = partiesData.value?.nextAfter;
  if (!cursor) {
    return;
  }

  partiesAfterCursor.value = cursor;
  partiesBeforeCursor.value = null;
  await parties.load();
}

async function handlePartyPageSizeChange(event: Event) {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) {
    return;
  }

  partiesPageSize.value =
    Number.parseInt(target.value, 10) || DEFAULT_PAGE_SIZE;
  resetPartyPagination();
  await parties.load();
}

watch(
  () => props.namespaceId,
  () => {
    resetPartyPagination();
    partiesPageSize.value = DEFAULT_PAGE_SIZE;
    summary.reset();
    nodes.reset();
    topology.reset();
    parties.reset();
    updates.reset();
    contracts.reset();
    void summary.load();
    void nodes.load();
    void topology.load();
    void parties.load();
    void updates.load();
    void contracts.load();
  },
  { immediate: true },
);
</script>

<template>
  <section class="party-detail">
    <div class="node-page">
      <div class="node-page__main node-detail__content">
        <header class="node-detail__hero">
          <div>
            <h2 class="party-detail__title">
              {{ summaryData?.namespaceId ?? props.namespaceId }} Namespace
            </h2>
          </div>
        </header>

        <div class="node-detail__sections party-detail__sections">
          <section class="node-detail__section party-detail__section--summary">
            <h3>Overview</h3>
            <p v-if="summaryError" class="node-detail__message node-detail__message--error">
              {{ summaryError }}
              <button type="button" class="dashboard__refresh" @click="summary.load">Retry</button>
            </p>
            <p v-else-if="summaryLoading" class="node-detail__message inline-loading" role="status">
              <span class="node-updates__spinner" aria-hidden="true"></span>
              <span>Loading namespace summary...</span>
            </p>
            <dl v-else-if="summaryData" class="detail-grid party-detail__summary-grid">
              <div
                class="party-detail__summary-item party-detail__summary-item--full-row"
              >
                <dt>Namespace ID</dt>
                <dd class="update-detail__id">
                  {{ summaryData.namespaceId }}
                </dd>
              </div>
              <div class="party-detail__summary-item">
                <dt>Observed Parties</dt>
                <dd>{{ summaryData.partyCount }}</dd>
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
            <div class="party-detail__section-header">
              <h3>Observed Parties</h3>
              <div class="node-updates__pager">
                <label class="node-updates__page-size">
                  <span class="node-updates__page-size-label">Show</span>
                  <select
                    class="node-updates__page-size-select"
                    :value="partiesPageSize"
                    aria-label="Items per page"
                    @change="handlePartyPageSizeChange"
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
                  :disabled="!partiesData?.nextAfter || partiesLoading"
                  @click="showNewerParties"
                >
                  Newer
                </button>
                <button
                  type="button"
                  class="dashboard__refresh"
                  :disabled="!partiesData?.nextBefore || partiesLoading"
                  @click="showOlderParties"
                >
                  Older
                </button>
              </div>
            </div>
            <div class="package-detail__list">
              <div
                v-for="party in partiesData?.parties ?? []"
                :key="party.partyId"
                class="package-detail__list-row"
              >
                <div class="party-detail__row-main">
                  <RouterLink
                    class="contract-detail__link"
                    :to="`/parties/${encodeURIComponent(party.partyId)}`"
                  >
                    {{ party.partyId }}
                  </RouterLink>
                </div>
              </div>
              <p v-if="partiesError" class="update-detail__empty node-detail__message--error">
                {{ partiesError }}
                <button type="button" class="dashboard__refresh" @click="parties.load">Retry</button>
              </p>
              <p
                v-else-if="
                  partiesLoading &&
                  (partiesData?.parties.length ?? 0) === 0
                "
                class="update-detail__empty inline-loading"
                role="status"
              >
                <span class="node-updates__spinner" aria-hidden="true"></span>
                <span>Loading observed parties...</span>
              </p>
              <p
                v-else-if="(partiesData?.parties.length ?? 0) === 0"
                class="update-detail__empty"
              >
                No parties observed for this namespace.
              </p>
            </div>
          </section>

          <section class="node-detail__section party-detail__section--nodes">
            <h3>Observed Nodes</h3>
            <p
              v-if="nodesError"
              class="node-detail__message node-detail__message--error"
              role="alert"
              aria-label="Observed Nodes error"
            >
              <span>{{ nodesError }}</span>
              <button type="button" class="dashboard__refresh" @click="nodes.retry">Retry</button>
            </p>
            <p
              v-else-if="nodesLoading"
              class="node-detail__message inline-loading"
              role="status"
            >
              <span class="node-updates__spinner" aria-hidden="true"></span>
              <span>Loading observed nodes...</span>
            </p>
            <div v-else-if="nodesData" class="package-detail__list">
              <div
                v-for="node in nodesData.nodes"
                :key="node.nodeId"
                class="package-detail__list-row"
              >
                <div class="party-detail__row-main">
                  <RouterLink
                    class="contract-detail__link"
                    :to="`/nodes/${node.nodeId}`"
                  >
                    {{ node.label }}
                  </RouterLink>
                </div>
                <span class="party-detail__meta party-detail__row-text">
                  {{ node.recentUpdateCount }} updates / {{ node.recentContractCount }} contracts
                </span>
              </div>
              <p v-if="nodesData.nodes.length === 0" class="update-detail__empty">
                No nodes observed for this namespace.
              </p>
            </div>
          </section>

          <section class="node-detail__section party-detail__section--topology">
            <h3>Namespace Topology</h3>
            <p v-if="topologyError" class="node-detail__message node-detail__message--error">
              {{ topologyError }}
              <button type="button" class="dashboard__refresh" @click="topology.load">Retry</button>
            </p>
            <p v-else-if="topologyLoading" class="node-detail__message inline-loading" role="status">
              <span class="node-updates__spinner" aria-hidden="true"></span>
              <span>Loading namespace topology...</span>
            </p>
            <div v-else-if="topologyData" class="party-topology__list">
              <article
                v-for="nodeTopology in topologyData.topologyByNode"
                :key="nodeTopology.nodeId"
                class="party-topology__card"
              >
                <div class="party-topology__header">
                  <p class="party-topology__node">{{ nodeTopology.label }}</p>
                  <QuerySourcePill source="grpc" />
                </div>

                <p
                  v-if="nodeTopology.status === 'grpc_not_configured'"
                  class="party-topology__state"
                >
                  gRPC not configured for this node.
                </p>
                <p
                  v-else-if="nodeTopology.status === 'grpc_error'"
                  class="party-topology__state party-topology__state--error"
                >
                  {{ nodeTopology.errorMessage ?? "Topology read failed." }}
                </p>
                <template v-else>
                  <div
                    v-if="nodeTopology.partyToParticipants.length > 0"
                    class="party-topology__group"
                  >
                    <div class="party-topology__group-title-row">
                      <h4>Party to Participant</h4>
                      <span
                        v-if="
                          resolvePartyParticipantThreshold(
                            nodeTopology.partyToParticipants,
                          ) !== null
                        "
                        class="party-topology__threshold"
                      >
                        Threshold
                        {{
                          resolvePartyParticipantThreshold(
                            nodeTopology.partyToParticipants,
                          )
                        }}
                      </span>
                    </div>
                    <div
                      v-for="participant in nodeTopology.partyToParticipants"
                      :key="`${participant.participantUid ?? participant.participantId ?? 'participant'}-${participant.permission ?? 'none'}`"
                      class="party-topology__mapping"
                    >
                      <div class="party-topology__field">
                        <span class="party-topology__label"
                          >Participant UID</span
                        >
                        <span
                          class="party-topology__value party-topology__value--truncate"
                          >{{
                            participant.participantUid ?? "Not Present"
                          }}</span
                        >
                      </div>
                      <div class="party-topology__field">
                        <span class="party-topology__label">Permission</span>
                        <span
                          v-if="
                            formatPartyPermissionLabel(participant.permission)
                          "
                          class="party-topology__pill"
                        >
                          {{
                            formatPartyPermissionLabel(participant.permission)
                          }}
                        </span>
                        <span v-else class="party-topology__value"
                          >Not Present</span
                        >
                      </div>
                    </div>
                  </div>

                  <div
                    v-if="nodeTopology.partyToKeyMappings.length > 0"
                    class="party-topology__group"
                  >
                    <div class="party-topology__group-title-row">
                      <h4>Party to Key</h4>
                      <span
                        v-if="
                          resolvePartyKeyThreshold(
                            nodeTopology.partyToKeyMappings,
                          ) !== null
                        "
                        class="party-topology__threshold"
                      >
                        Threshold
                        {{
                          resolvePartyKeyThreshold(nodeTopology.partyToKeyMappings)
                        }}
                      </span>
                    </div>
                    <div
                      v-for="keyMapping in nodeTopology.partyToKeyMappings"
                      :key="`${keyMapping.keyFingerprint ?? keyMapping.publicKey ?? 'key'}-${keyMapping.purpose ?? 'none'}`"
                      class="party-topology__mapping"
                    >
                      <div class="party-topology__field">
                        <span class="party-topology__label">Fingerprint</span>
                        <span
                          class="party-topology__value party-topology__value--truncate"
                          >{{
                            keyMapping.keyFingerprint ?? "Not Present"
                          }}</span
                        >
                      </div>
                      <div class="party-topology__field">
                        <span class="party-topology__label">Public Key</span>
                        <span
                          class="party-topology__value party-topology__value--truncate"
                          >{{ keyMapping.publicKey ?? "Not Present" }}</span
                        >
                      </div>
                      <div class="party-topology__field">
                        <span class="party-topology__label">Purposes</span>
                        <div
                          v-if="
                            splitPartyPurposeLabels(keyMapping.purpose).length >
                            0
                          "
                          class="party-topology__pill-list"
                        >
                          <span
                            v-for="purpose in splitPartyPurposeLabels(
                              keyMapping.purpose,
                            )"
                            :key="purpose"
                            class="party-topology__pill"
                          >
                            {{ purpose }}
                          </span>
                        </div>
                        <span v-else class="party-topology__value"
                          >Not Present</span
                        >
                      </div>
                      <div class="party-topology__field">
                        <span class="party-topology__label">Key Type</span>
                        <span
                          v-if="formatPartyKeyLabel(keyMapping.keyType)"
                          class="party-topology__pill"
                        >
                          {{ formatPartyKeyLabel(keyMapping.keyType) }}
                        </span>
                        <span v-else class="party-topology__value"
                          >Not Present</span
                        >
                      </div>
                      <div class="party-topology__field">
                        <span class="party-topology__label">Key Format</span>
                        <span
                          v-if="formatPartyKeyFormatLabel(keyMapping.keyFormat)"
                          class="party-topology__pill"
                        >
                          {{ formatPartyKeyFormatLabel(keyMapping.keyFormat) }}
                        </span>
                        <span v-else class="party-topology__value"
                          >Not Present</span
                        >
                      </div>
                    </div>
                  </div>
                </template>
              </article>
            </div>
          </section>

          <section class="node-detail__section party-detail__section--nodes">
            <h3>Recent Updates</h3>
            <p
              v-if="updatesError"
              class="node-detail__message node-detail__message--error"
              role="alert"
              aria-label="Recent Updates error"
            >
              <span>{{ updatesError }}</span>
              <button type="button" class="dashboard__refresh" @click="updates.retry">Retry</button>
            </p>
            <p
              v-else-if="updatesLoading"
              class="node-detail__message inline-loading"
              role="status"
            >
              <span class="node-updates__spinner" aria-hidden="true"></span>
              <span>Loading recent updates...</span>
            </p>
            <div v-else class="package-detail__list">
              <RouterLink
                v-for="update in renderedUpdates"
                :key="`${update.nodeId}:${update.eventOffset}`"
                class="package-detail__list-row"
                :to="`/nodes/${update.nodeId}/updates/${encodeURIComponent(update.eventOffset)}`"
              >
                <div class="party-detail__row-main">
                  <span class="party-detail__row-title">{{
                    update.label
                  }}</span>
                  <span class="update-detail__id">{{ update.updateId }}</span>
                  <div class="party-detail__row-parties">
                    <span
                      v-for="party in update.parties"
                      :key="party"
                      class="party-detail__meta party-detail__row-text"
                    >
                      {{ party }}
                    </span>
                  </div>
                </div>
                <span
                  v-if="update.recordTimeLines"
                  class="party-detail__meta party-detail__row-text"
                >
                  {{ update.recordTimeLines.date }}
                  {{ update.recordTimeLines.time }}
                </span>
                <span class="party-detail__meta party-detail__row-text">
                  {{
                    formatEstimatedTrafficUsd(
                      update.estimatedTrafficUsd,
                      update.estimatedTrafficUsdGapDays,
                    )
                  }}
                </span>
              </RouterLink>
              <p
                v-if="renderedUpdates.length === 0"
                class="update-detail__empty"
              >
                No updates observed for this namespace.
              </p>
            </div>
          </section>

          <section class="node-detail__section party-detail__section--nodes">
            <h3>Recent Contracts</h3>
            <p
              v-if="contractsError"
              class="node-detail__message node-detail__message--error"
              role="alert"
              aria-label="Recent Contracts error"
            >
              <span>{{ contractsError }}</span>
              <button type="button" class="dashboard__refresh" @click="contracts.retry">Retry</button>
            </p>
            <p
              v-else-if="contractsLoading"
              class="node-detail__message inline-loading"
              role="status"
            >
              <span class="node-updates__spinner" aria-hidden="true"></span>
              <span>Loading recent contracts...</span>
            </p>
            <div v-else class="package-detail__list">
              <RouterLink
                v-for="contract in renderedContracts"
                :key="`${contract.nodeId}:${contract.contractId}`"
                class="package-detail__list-row"
                :to="`/nodes/${contract.nodeId}/contracts/${encodeURIComponent(contract.contractId)}`"
              >
                <div class="party-detail__row-main">
                  <span class="party-detail__row-title">{{
                    contract.label
                  }}</span>
                  <span class="update-detail__id">{{
                    contract.contractId
                  }}</span>
                  <span class="party-detail__meta party-detail__row-text">
                    {{ contract.templateId ?? "Template not present" }}
                  </span>
                </div>
                <span
                  v-if="contract.recordTimeLines"
                  class="party-detail__meta party-detail__row-text"
                >
                  {{ contract.recordTimeLines.date }}
                  {{ contract.recordTimeLines.time }}
                </span>
              </RouterLink>
              <p
                v-if="renderedContracts.length === 0"
                class="update-detail__empty"
              >
                No contracts observed for this namespace.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  </section>
</template>
