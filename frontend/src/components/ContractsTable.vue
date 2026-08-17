<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import CopyToClipboardButton from './CopyToClipboardButton.vue';
import QuerySourcePill from './QuerySourcePill.vue';

interface ContractRow {
  nodeId: string;
  label: string;
  contractId: string;
  templateId: string | null;
  createdRecordTime?: string | null;
  recordTime?: string | null;
  status?: 'active' | 'archived';
}

const props = withDefaults(
  defineProps<{
    contracts: ContractRow[];
    showNodeColumn?: boolean;
    showStatusColumn?: boolean;
    ariaLabel?: string;
    loading?: boolean;
    loadingMessage?: string;
  }>(),
  {
    showNodeColumn: false,
    showStatusColumn: false,
    ariaLabel: 'Contracts',
    loading: false,
    loadingMessage: 'Loading contracts...',
  },
);

function formatRecordTime(
  recordTime: string | null | undefined,
): { date: string; time: string } | null {
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

function formatTemplateId(
  templateId: string | null,
): { namespace: string; templateName: string } | null {
  if (!templateId) {
    return null;
  }

  const splitIndex = templateId.lastIndexOf(':');
  if (splitIndex <= 0 || splitIndex >= templateId.length - 1) {
    return {
      namespace: templateId,
      templateName: '',
    };
  }

  return {
    namespace: templateId.slice(0, splitIndex),
    templateName: templateId.slice(splitIndex + 1),
  };
}

const renderedContracts = computed(() =>
  props.contracts.map((contract) => ({
    ...contract,
    templateIdLines: formatTemplateId(contract.templateId),
    recordTimeLines: formatRecordTime(contract.createdRecordTime ?? contract.recordTime ?? null),
  })),
);

const router = useRouter();

function contractLink(contract: ContractRow): string {
  return `/nodes/${contract.nodeId}/contracts/${contract.contractId}`;
}

function nodeLink(nodeId: string): string {
  return `/nodes/${encodeURIComponent(nodeId)}`;
}

function navigateToContract(contract: ContractRow): void {
  void router.push(contractLink(contract));
}
</script>

<template>
  <div class="node-updates__table contracts-table" role="table" :aria-label="ariaLabel">
    <div
      class="node-updates__row node-updates__row--head contracts-table__row"
      :class="{
        'contracts-table__row--with-node': showNodeColumn,
        'contracts-table__row--with-status': showStatusColumn,
      }"
    >
      <span v-if="showNodeColumn" role="columnheader">Node</span>
      <span role="columnheader">Contract ID</span>
      <span role="columnheader">Template ID</span>
      <span v-if="showStatusColumn" role="columnheader">Status</span>
      <span class="contracts-table__record-time-header" role="columnheader">
        <span>Created Time</span>
        <QuerySourcePill class="contracts-table__source-pill" source="pqs" />
      </span>
    </div>

    <div
      v-if="loading && renderedContracts.length === 0"
      class="node-updates__row node-updates__row--loading"
    >
      <span class="node-updates__spinner" aria-hidden="true"></span>
      <span>{{ loadingMessage }}</span>
    </div>

    <template v-if="renderedContracts.length > 0">
      <div
        v-for="contract in renderedContracts"
        :key="`${contract.nodeId}-${contract.contractId}`"
        class="node-updates__row node-updates__row--link contracts-table__row"
        :class="{
          'contracts-table__row--with-node': showNodeColumn,
          'contracts-table__row--with-status': showStatusColumn,
        }"
        role="row"
        tabindex="0"
        @click="navigateToContract(contract)"
        @keydown.enter.prevent="navigateToContract(contract)"
        @keydown.space.prevent="navigateToContract(contract)"
      >
        <span v-if="showNodeColumn" class="node-updates__cell-with-copy contracts-table__cell" role="cell">
          <RouterLink
            class="contract-detail__link"
            :to="nodeLink(contract.nodeId)"
            @click.stop
            @keydown.enter.stop
            @keydown.space.stop
          >
            {{ contract.label }}
          </RouterLink>
          <CopyToClipboardButton :value="contract.label" label="node name" />
        </span>
        <span class="node-updates__cell-with-copy node-updates__id" role="cell">
          <RouterLink
            class="contract-detail__link contracts-table__contract-id"
            :to="contractLink(contract)"
            :title="contract.contractId"
            @click.stop
          >
            {{ contract.contractId }}
          </RouterLink>
          <CopyToClipboardButton :value="contract.contractId" label="contract ID" />
        </span>
        <span class="node-updates__cell-with-copy contracts-table__cell" role="cell">
          <span class="contracts-table__template">
            <template v-if="contract.templateIdLines">
              <span class="contracts-table__template-namespace">{{ contract.templateIdLines.namespace }}</span>
              <span v-if="contract.templateIdLines.templateName" class="contracts-table__template-name">
                {{ contract.templateIdLines.templateName }}
              </span>
            </template>
            <template v-else>n/a</template>
          </span>
          <CopyToClipboardButton
            v-if="contract.templateId"
            :value="contract.templateId"
            label="template ID"
          />
        </span>
        <span v-if="showStatusColumn" class="contracts-table__cell" role="cell">
          <span
            v-if="contract.status"
            class="contracts-table__status-badge"
            :class="`contracts-table__status-badge--${contract.status}`"
          >
            {{ contract.status === 'archived' ? 'Archived' : 'Active' }}
          </span>
          <template v-else>n/a</template>
        </span>
        <span class="node-updates__time contracts-table__cell" role="cell">
          <template v-if="contract.recordTimeLines">
            <span class="node-updates__time-date">{{ contract.recordTimeLines.date }}</span>
            <span class="node-updates__time-clock">{{ contract.recordTimeLines.time }}</span>
          </template>
          <template v-else>Not available</template>
        </span>
      </div>
    </template>
  </div>
</template>
