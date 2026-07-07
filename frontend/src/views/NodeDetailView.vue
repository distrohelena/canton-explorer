<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { fetchNode, fetchNodePackages, fetchNodeParticipantStatus } from '../lib/api';
import type {
  NodePackagesResponse,
  NodeParticipantStatusResponse,
  NodeSnapshot,
} from '../types/nodes';

const props = defineProps<{ id: string }>();

const node = ref<NodeSnapshot | null>(null);
const nodePackages = ref<NodePackagesResponse | null>(null);
const participantStatusResponse = ref<NodeParticipantStatusResponse | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    const [nodeResponse, packagesResponse, participantStatus] = await Promise.all([
      fetchNode(props.id),
      fetchNodePackages(props.id),
      fetchNodeParticipantStatus(props.id),
    ]);
    node.value = nodeResponse;
    nodePackages.value = packagesResponse;
    participantStatusResponse.value = participantStatus;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
  }
});

const installedPackages = computed(() => nodePackages.value?.packagesByName ?? []);
const participantStatus = computed(() => participantStatusResponse.value?.participantStatus ?? null);
const notInitialized = computed(() => participantStatusResponse.value?.notInitialized ?? null);
const participantStatusState = computed(
  () => participantStatusResponse.value?.participantStatusStatus ?? 'grpc_not_configured',
);
const participantStatusPorts = computed(() => Object.entries(participantStatus.value?.ports ?? {}));

const modeLabel = computed(() =>
  node.value?.mode === 'pqs_only' ? 'PQS Only' : 'PQS + gRPC',
);

const grpcNotConfigured = computed(() => node.value?.mode === 'pqs_only');

function formatBoolean(value: boolean | null | undefined) {
  if (value === null || value === undefined) {
    return 'n/a';
  }

  return value ? 'Yes' : 'No';
}

function formatWaitingForExternalInput(value: string) {
  switch (value) {
    case 'node_topology':
      return 'Node Topology';
    default:
      return value.replace(/_/g, ' ').replace(/\b\w/g, (segment) => segment.toUpperCase());
  }
}

function formatComponentSeverity(value: string) {
  return value.toUpperCase();
}

function formatSynchronizerHealth(value: string) {
  switch (value) {
    case 'healthy':
      return 'Healthy';
    case 'unhealthy':
      return 'Unhealthy';
    default:
      return 'Unspecified';
  }
}
</script>

<template>
  <p v-if="error" class="node-detail__message node-detail__message--error">{{ error }}</p>
  <p v-else-if="!node" class="node-detail__message">Loading node detail...</p>
  <div v-else class="node-page">
    <div class="node-page__rail">
      <RouterLink class="node-detail__back" to="/nodes" aria-label="Back to overview">←</RouterLink>
    </div>

    <div class="node-page__main node-detail__content">
      <header class="node-detail__hero">
        <div>
          <p class="activity-home__eyebrow">Nodes</p>
          <h2 class="party-detail__title">Node {{ node.label }}</h2>
        </div>
      </header>

      <div class="node-detail__sections">
        <section class="node-detail__section node-detail__section--half">
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

        <section class="node-detail__section node-detail__section--half">
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

        <section class="node-detail__section node-detail__section--participant-status">
          <h3>Participant Status</h3>
          <p v-if="participantStatusState === 'grpc_not_configured'" class="update-detail__empty">
            Not configured
          </p>
          <div v-else-if="participantStatusState === 'grpc_error'" class="node-participant-status">
            <p class="update-detail__empty">gRPC error while loading participant status.</p>
            <dl class="detail-grid">
              <div v-if="participantStatusResponse?.participantStatusError">
                <dt>Error</dt>
                <dd>{{ participantStatusResponse.participantStatusError }}</dd>
              </div>
              <div v-if="participantStatusResponse?.participantStatusErrorCode">
                <dt>Code</dt>
                <dd>{{ participantStatusResponse.participantStatusErrorCode }}</dd>
              </div>
              <div v-if="participantStatusResponse?.participantStatusErrorTid">
                <dt>Tid</dt>
                <dd>{{ participantStatusResponse.participantStatusErrorTid }}</dd>
              </div>
              <div v-if="participantStatusResponse?.participantStatusErrorDetails">
                <dt>Details</dt>
                <dd>{{ participantStatusResponse.participantStatusErrorDetails }}</dd>
              </div>
            </dl>
          </div>
          <div
            v-else-if="participantStatusState === 'not_initialized' && notInitialized"
            class="node-participant-status"
          >
            <dl class="detail-grid">
                <div>
                  <dt>Active</dt>
                  <dd>{{ formatBoolean(notInitialized.active) }}</dd>
                </div>
                <div>
                  <dt>Waiting For External Input</dt>
                  <dd>{{ formatWaitingForExternalInput(notInitialized.waitingForExternalInput) }}</dd>
                </div>
                <div>
                  <dt>Version</dt>
                  <dd>{{ notInitialized.version ?? 'n/a' }}</dd>
                </div>
              </dl>
          </div>
          <div v-else-if="participantStatus" class="node-participant-status">
            <dl class="detail-grid">
              <div>
                <dt>UID</dt>
                <dd>{{ participantStatus.uid ?? 'n/a' }}</dd>
              </div>
              <div>
                <dt>Version</dt>
                <dd>{{ participantStatus.version ?? 'n/a' }}</dd>
              </div>
              <div>
                <dt>Uptime</dt>
                <dd>{{ participantStatus.uptime ?? 'n/a' }}</dd>
              </div>
              <div>
                <dt>Active</dt>
                <dd>{{ formatBoolean(participantStatus.active) }}</dd>
              </div>
              <div>
                <dt>Common Status Active</dt>
                <dd>{{ formatBoolean(participantStatus.commonStatusActive) }}</dd>
              </div>
              <div>
                <dt>Supported Protocol Versions</dt>
                <dd>{{ participantStatus.supportedProtocolVersions.join(', ') || 'n/a' }}</dd>
              </div>
            </dl>

            <div class="node-participant-status__block">
              <h4 class="node-packages__title">Ports</h4>
              <p v-if="participantStatusPorts.length === 0" class="update-detail__empty">
                No ports reported.
              </p>
              <dl v-else class="detail-grid node-participant-status__mini-grid">
                <div v-for="[portName, portValue] in participantStatusPorts" :key="portName">
                  <dt>{{ portName }}</dt>
                  <dd>{{ portValue }}</dd>
                </div>
              </dl>
            </div>

            <div class="node-participant-status__block">
              <h4 class="node-packages__title">Topology Queues</h4>
              <dl
                v-if="participantStatus.topologyQueues"
                class="detail-grid node-participant-status__mini-grid"
              >
                <div>
                  <dt>Manager</dt>
                  <dd>{{ participantStatus.topologyQueues.manager }}</dd>
                </div>
                <div>
                  <dt>Dispatcher</dt>
                  <dd>{{ participantStatus.topologyQueues.dispatcher }}</dd>
                </div>
                <div>
                  <dt>Clients</dt>
                  <dd>{{ participantStatus.topologyQueues.clients }}</dd>
                </div>
              </dl>
              <p v-else class="update-detail__empty">No topology queue data reported.</p>
            </div>

            <div class="node-participant-status__block">
              <h4 class="node-packages__title">Components</h4>
              <p v-if="participantStatus.components.length === 0" class="update-detail__empty">
                No components reported.
              </p>
              <div v-else class="node-synchronizers">
                <article
                  v-for="component in participantStatus.components"
                  :key="component.name"
                  class="node-synchronizers__row"
                >
                  <dl class="detail-grid node-synchronizers__grid">
                    <div>
                      <dt>Name</dt>
                      <dd>{{ component.name }}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{{ formatComponentSeverity(component.severity) }}</dd>
                    </div>
                    <div>
                      <dt>Description</dt>
                      <dd>{{ component.description ?? 'n/a' }}</dd>
                    </div>
                  </dl>
                </article>
              </div>
            </div>

            <div class="node-participant-status__block">
              <h4 class="node-packages__title">Connected Synchronizers</h4>
              <p
                v-if="participantStatus.connectedSynchronizers.length === 0"
                class="update-detail__empty"
              >
                No synchronizers reported.
              </p>
              <div v-else class="node-synchronizers">
                <article
                  v-for="(synchronizer, index) in participantStatus.connectedSynchronizers"
                  :key="`${synchronizer.physicalSynchronizerId ?? 'none'}:${index}`"
                  class="node-synchronizers__row"
                >
                  <dl class="detail-grid node-synchronizers__grid">
                    <div>
                      <dt>Physical ID</dt>
                      <dd>{{ synchronizer.physicalSynchronizerId ?? 'n/a' }}</dd>
                    </div>
                    <div>
                      <dt>Health</dt>
                      <dd>{{ formatSynchronizerHealth(synchronizer.health) }}</dd>
                    </div>
                  </dl>
                </article>
              </div>
            </div>
          </div>
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
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
