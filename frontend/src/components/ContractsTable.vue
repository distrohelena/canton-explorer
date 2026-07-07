<script setup lang="ts">
import { computed } from 'vue';

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
  }>(),
  {
    showNodeColumn: false,
    ariaLabel: 'Contracts',
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
      <span role="columnheader">Created Record Time</span>
    </div>

    <template v-if="renderedContracts.length > 0">
      <div
        v-for="contract in renderedContracts"
        :key="`${contract.nodeId}-${contract.contractId}`"
        class="node-updates__row contracts-table__row"
        :class="{ 'contracts-table__row--with-node': showNodeColumn }"
      >
        <span v-if="showNodeColumn" class="contracts-table__cell">{{ contract.label }}</span>
        <RouterLink
          class="node-updates__id contracts-table__contract-id contract-detail__link"
          :to="`/nodes/${contract.nodeId}/contracts/${contract.contractId}`"
          :title="contract.contractId"
        >
          {{ contract.contractId }}
        </RouterLink>
        <span class="contracts-table__cell contracts-table__template">
          <template v-if="contract.templateIdLines">
            <span class="contracts-table__template-namespace">{{ contract.templateIdLines.namespace }}</span>
            <span v-if="contract.templateIdLines.templateName" class="contracts-table__template-name">
              {{ contract.templateIdLines.templateName }}
            </span>
          </template>
          <template v-else>n/a</template>
        </span>
        <span class="node-updates__time contracts-table__cell">
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
