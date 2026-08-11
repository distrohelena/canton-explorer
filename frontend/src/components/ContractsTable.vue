<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import QuerySourcePill from './QuerySourcePill.vue';

interface ContractRow {
  nodeId: string;
  label: string;
  contractId: string;
  templateId: string | null;
  createdRecordTime?: string | null;
  recordTime?: string | null;
}

const props = withDefaults(
  defineProps<{
    contracts: ContractRow[];
    showNodeColumn?: boolean;
    ariaLabel?: string;
    loading?: boolean;
    loadingMessage?: string;
  }>(),
  {
    showNodeColumn: false,
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

function navigateToContract(contract: ContractRow): void {
  void router.push(contractLink(contract));
}
</script>

<template>
  <div class="node-updates__table contracts-table" role="table" :aria-label="ariaLabel">
    <div
      class="node-updates__row node-updates__row--head contracts-table__row"
      :class="{ 'contracts-table__row--with-node': showNodeColumn }"
    >
      <span v-if="showNodeColumn" role="columnheader">Node</span>
      <span role="columnheader">Contract ID</span>
      <span role="columnheader">Template ID</span>
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
        :class="{ 'contracts-table__row--with-node': showNodeColumn }"
        role="row"
        tabindex="0"
        @click="navigateToContract(contract)"
        @keydown.enter.prevent="navigateToContract(contract)"
        @keydown.space.prevent="navigateToContract(contract)"
      >
        <span v-if="showNodeColumn" class="contracts-table__cell" role="cell">{{ contract.label }}</span>
        <span class="node-updates__id contracts-table__contract-id" role="cell">
          <RouterLink
            class="contract-detail__link"
            :to="contractLink(contract)"
            :title="contract.contractId"
            @click.stop
          >
            {{ contract.contractId }}
          </RouterLink>
        </span>
        <span class="contracts-table__cell contracts-table__template" role="cell">
          <template v-if="contract.templateIdLines">
            <span class="contracts-table__template-namespace">{{ contract.templateIdLines.namespace }}</span>
            <span v-if="contract.templateIdLines.templateName" class="contracts-table__template-name">
              {{ contract.templateIdLines.templateName }}
            </span>
          </template>
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
