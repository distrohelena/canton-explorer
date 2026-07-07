<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { fetchNodeContractDetail } from '../lib/api';
import type { NodeContractDetailResponse } from '../types/contracts';
import type { DecodedDamlValue } from '../types/daml';

const props = defineProps<{ id: string; contractId: string }>();

const contractDetail = ref<NodeContractDetailResponse | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    contractDetail.value = await fetchNodeContractDetail(props.id, props.contractId);
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

function formatInteger(value: number): string {
  return new Intl.NumberFormat().format(value);
}

type RenderableContractValue =
  | string
  | number
  | boolean
  | null
  | { kind: 'contract_id'; value: string }
  | { kind: 'unit' };

function formatDataLabel(key: string): string {
  return key
    .split('.')
    .map((segment) =>
      segment
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/^./, (char) => char.toUpperCase()),
    )
    .join(' / ');
}

function formatDataValue(value: RenderableContractValue): string {
  if (typeof value === 'number') {
    return formatInteger(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'True' : 'False';
  }

  if (value && typeof value === 'object') {
    if (value.kind === 'contract_id') {
      return value.value;
    }

    if (value.kind === 'unit') {
      return 'Unit';
    }
  }

  return value ?? 'n/a';
}

function isContractReference(
  value: RenderableContractValue,
): value is { kind: 'contract_id'; value: string } {
  return typeof value === 'object' && value?.kind === 'contract_id';
}

function formatDecodeFailureReason(reason: string): string {
  return reason.replaceAll('_', ' ');
}

function flattenDecodedValue(
  label: string,
  value: DecodedDamlValue,
): Array<[string, RenderableContractValue]> {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return [[label, value]];
  }

  if (value.kind === 'contract_id' || value.kind === 'unit') {
    return [[label, value]];
  }

  if (value.kind === 'record') {
    return value.fields.flatMap((field) =>
      flattenDecodedValue(label ? `${label}.${field.label}` : field.label, field.value),
    );
  }

  if (value.kind === 'variant') {
    return value.value === null
      ? [[label, value.constructor]]
      : [
          [label, value.constructor],
          ...flattenDecodedValue(`${label}.${value.constructor}`, value.value),
        ];
  }

  if (value.kind === 'enum') {
    return [[label, value.constructor]];
  }

  if (value.kind === 'optional') {
    return value.value === null ? [[label, null]] : flattenDecodedValue(label, value.value);
  }

  if (value.kind === 'list') {
    return value.items.length === 0
      ? [[label, null]]
      : value.items.flatMap((item, index) =>
          flattenDecodedValue(`${label}[${index + 1}]`, item),
        );
  }

  if (value.kind === 'text_map') {
    return value.entries.flatMap((entry) =>
      flattenDecodedValue(`${label}.${entry.key}`, entry.value),
    );
  }

  return value.entries.flatMap((entry, index) => [
    ...flattenDecodedValue(`${label}[${index + 1}].key`, entry.key),
    ...flattenDecodedValue(`${label}[${index + 1}].value`, entry.value),
  ]);
}

const createdRecordTime = computed(() =>
  contractDetail.value ? formatRecordTime(contractDetail.value.createdRecordTime) : null,
);
const archivedRecordTime = computed(() =>
  contractDetail.value ? formatRecordTime(contractDetail.value.archivedRecordTime) : null,
);
const contractDataEntries = computed(() => {
  const state = contractDetail.value?.contractData;
  if (!state) {
    return [] as Array<{ key: string; value: RenderableContractValue }>;
  }

  if (state.status === 'invalid_data') {
    return [{ key: 'decodeStatus', value: `Invalid data (${formatDecodeFailureReason(state.reason)})` }];
  }

  if (state.status !== 'decoded') {
    return [] as Array<{ key: string; value: RenderableContractValue }>;
  }

  return flattenDecodedValue('', state.value).map(([key, value]) => ({
    key: key || 'value',
    value,
  }));
});

</script>

<template>
  <section class="contract-detail">
    <p v-if="error" class="node-detail__message node-detail__message--error">{{ error }}</p>
    <p v-else-if="!contractDetail" class="node-detail__message">Loading contract detail...</p>
    <div v-else class="node-page">
      <div class="node-page__rail">
        <RouterLink class="node-detail__back" to="/contracts" aria-label="Back to overview">
          ←
        </RouterLink>
      </div>

      <div class="node-page__main contract-detail__content">
        <header class="node-detail__hero">
          <div>
            <p class="activity-home__eyebrow">Contracts</p>
            <h2>{{ contractDetail.label }} Contract</h2>
          </div>
        </header>

        <div class="node-detail__sections">
          <section class="node-detail__section contract-detail__section--summary">
            <h3>Summary</h3>
            <dl class="detail-grid contract-detail__summary-grid">
              <div class="contract-detail__summary-item contract-detail__summary-item--contract-id">
                <dt>Contract ID</dt>
                <dd class="update-detail__id">{{ contractDetail.contractId }}</dd>
              </div>
              <div class="contract-detail__summary-item">
                <dt>Template ID</dt>
                <dd>{{ contractDetail.templateId ?? 'n/a' }}</dd>
              </div>
              <div class="contract-detail__summary-item contract-detail__summary-item--full-row">
                <dt>Package ID</dt>
                <dd v-if="contractDetail.packageId">
                  <RouterLink
                    class="contract-detail__link"
                    :to="`/packages/${contractDetail.packageId}`"
                  >
                    {{ contractDetail.packageId }}
                  </RouterLink>
                </dd>
                <dd v-else>n/a</dd>
              </div>
              <div class="contract-detail__summary-item contract-detail__summary-item--full-row">
                <div class="contract-detail__summary-pair contract-detail__summary-pair--package">
                  <div class="contract-detail__summary-subitem">
                    <dt>Package Name</dt>
                    <dd>{{ contractDetail.packageName ?? 'n/a' }}</dd>
                  </div>
                  <div class="contract-detail__summary-subitem">
                    <dt>Version</dt>
                    <dd>{{ contractDetail.packageVersion ?? 'n/a' }}</dd>
                  </div>
                </div>
              </div>
              <div class="contract-detail__summary-item contract-detail__summary-item--full-row">
                <div class="contract-detail__summary-pair contract-detail__summary-pair--created">
                  <div class="contract-detail__summary-subitem">
                    <dt>Created Event</dt>
                    <dd v-if="contractDetail.createdEventOffset">
                      <RouterLink
                        class="contract-detail__link"
                        :to="`/nodes/${props.id}/updates/${contractDetail.createdEventOffset}`"
                      >
                        {{ contractDetail.createdEventOffset }}
                      </RouterLink>
                    </dd>
                    <dd v-else>n/a</dd>
                  </div>
                  <div class="contract-detail__summary-subitem">
                    <dt>Created Record Time</dt>
                    <dd v-if="createdRecordTime" class="update-detail__time">
                      <span class="update-detail__time-date">{{ createdRecordTime.date }}</span>
                      <span class="update-detail__time-clock">{{ createdRecordTime.time }}</span>
                    </dd>
                    <dd v-else>n/a</dd>
                  </div>
                </div>
              </div>
              <div class="contract-detail__summary-item contract-detail__summary-item--full-row">
                <div class="contract-detail__summary-pair contract-detail__summary-pair--archived">
                  <div class="contract-detail__summary-subitem">
                    <dt>Archived Event</dt>
                    <dd v-if="contractDetail.archivedEventOffset">
                      <RouterLink
                        class="contract-detail__link"
                        :to="`/nodes/${props.id}/updates/${contractDetail.archivedEventOffset}`"
                      >
                        {{ contractDetail.archivedEventOffset }}
                      </RouterLink>
                    </dd>
                    <dd v-else>Not Present</dd>
                  </div>
                  <div class="contract-detail__summary-subitem">
                    <dt>Archived Record Time</dt>
                    <dd v-if="archivedRecordTime" class="update-detail__time">
                      <span class="update-detail__time-date">{{ archivedRecordTime.date }}</span>
                      <span class="update-detail__time-clock">{{ archivedRecordTime.time }}</span>
                    </dd>
                    <dd v-else>Not Present</dd>
                  </div>
                </div>
              </div>
            </dl>
          </section>

          <section class="node-detail__section contract-detail__section--data">
            <h3>Create Event</h3>
            <p v-if="contractDataEntries.length === 0" class="update-detail__empty">
              No decoded create event data available for this contract.
            </p>
            <dl v-else class="contract-detail__data">
              <div
                v-for="entry in contractDataEntries"
                :key="`${contractDetail.contractId}-${entry.key}`"
                class="contract-detail__data-row"
              >
                <dt class="contract-detail__data-key">{{ formatDataLabel(entry.key) }}</dt>
                <dd class="contract-detail__data-value">
                  <RouterLink
                    v-if="isContractReference(entry.value)"
                    class="contract-detail__link"
                    :to="`/nodes/${props.id}/contracts/${entry.value.value}`"
                  >
                    {{ entry.value.value }}
                  </RouterLink>
                  <template v-else>
                    {{ formatDataValue(entry.value) }}
                  </template>
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  </section>
</template>
