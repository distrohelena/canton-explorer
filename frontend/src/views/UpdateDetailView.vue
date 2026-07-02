<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { fetchNodeUpdateDetail } from '../lib/api';
import type { NodeUpdateDetailResponse } from '../types/updates';
import type { DecodedDamlValue } from '../types/daml';

const props = defineProps<{ id: string; eventOffset: string }>();

const updateDetail = ref<NodeUpdateDetailResponse | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    updateDetail.value = await fetchNodeUpdateDetail(props.id, props.eventOffset);
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

const recordTimeLines = computed(() =>
  updateDetail.value ? formatRecordTime(updateDetail.value.recordTime) : null,
);
const renderedEvents = computed(() => updateDetail.value?.events ?? []);

function formatEventKind(eventKind: NodeUpdateDetailResponse['events'][number]['eventKind']): string {
  switch (eventKind) {
    case 'consuming_exercise':
      return 'Consuming Exercise';
    case 'non_consuming_exercise':
      return 'Non-Consuming Exercise';
    case 'create':
      return 'Create';
  }
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatEventDataLabel(key: string): string {
  return key
    .split('.')
    .map((segment) =>
      segment
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/^./, (char) => char.toUpperCase()),
    )
    .join(' / ');
}

function formatEventDataValue(
  value:
    | string
    | number
    | boolean
    | null
    | { kind: 'contract_id'; value: string }
    | { kind: 'unit' },
): string {
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
  value:
    | string
    | number
    | boolean
    | null
    | { kind: 'contract_id'; value: string }
    | { kind: 'unit' },
): value is { kind: 'contract_id'; value: string } {
  return typeof value === 'object' && value?.kind === 'contract_id';
}

type RenderableValue =
  | string
  | number
  | boolean
  | null
  | { kind: 'contract_id'; value: string }
  | { kind: 'unit' };

function formatDecodeFailureReason(reason: string): string {
  return reason.replaceAll('_', ' ');
}

function flattenDecodedValue(
  label: string,
  value: DecodedDamlValue,
): Array<[string, RenderableValue]> {
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

function getRecordEntries(
  state: NodeUpdateDetailResponse['events'][number]['createData'] | null | undefined,
): Array<[string, RenderableValue]> {
  if (!state) {
    return [];
  }

  if (state.status === 'invalid_data') {
    return [['decodeStatus', `Invalid data (${formatDecodeFailureReason(state.reason)})`]];
  }

  if (state.status !== 'decoded') {
    return [];
  }

  return flattenDecodedValue('', state.value).map(([key, value]) => [
    key || 'value',
    value,
  ]);
}

function getExerciseEntries(
  state: NodeUpdateDetailResponse['events'][number]['exerciseData'] | null | undefined,
): Array<[string, RenderableValue]> {
  const entries: Array<[string, RenderableValue]> = [];

  for (const [label, branch] of [
    ['argument', state?.argument],
    ['result', state?.result],
  ] as const) {
    if (!branch || branch.status !== 'decoded') {
      if (branch?.status === 'invalid_data') {
        entries.push([`${label}.decodeStatus`, `Invalid data (${formatDecodeFailureReason(branch.reason)})`]);
      }
      continue;
    }

    entries.push(...flattenDecodedValue(label, branch.value));
  }

  return entries;
}
</script>
<template>
  <section class="update-detail">
    <p v-if="error" class="node-detail__message node-detail__message--error">{{ error }}</p>
    <p v-else-if="!updateDetail" class="node-detail__message">Loading update detail...</p>
    <div v-else class="node-page">
      <div class="node-page__rail">
        <RouterLink
          class="node-detail__back"
          :to="`/nodes/${props.id}/updates`"
          aria-label="Back to overview"
        >
          ←
        </RouterLink>
      </div>

      <div class="node-page__main update-detail__content">
        <header class="node-detail__hero">
          <div>
            <p class="activity-home__eyebrow">Recent Activity</p>
            <h2>{{ updateDetail.label }} Update</h2>
          </div>
        </header>

        <div class="node-detail__sections">
          <section class="node-detail__section update-detail__section--summary">
            <h3>Summary</h3>
            <dl class="detail-grid update-detail__summary-grid">
              <div class="update-detail__summary-item">
                <dt>Event Offset</dt>
                <dd class="update-detail__id">{{ updateDetail.eventOffset }}</dd>
              </div>
              <div class="update-detail__summary-item">
                <dt>Canonical Update ID</dt>
                <dd class="update-detail__canonical">{{ updateDetail.updateId }}</dd>
              </div>
              <div class="update-detail__summary-item">
                <dt>Record Time</dt>
                <dd v-if="recordTimeLines" class="update-detail__time">
                  <span class="update-detail__time-date">{{ recordTimeLines.date }}</span>
                  <span class="update-detail__time-clock">{{ recordTimeLines.time }}</span>
                </dd>
                <dd v-else>n/a</dd>
              </div>
              <div class="update-detail__summary-item update-detail__summary-item--parties">
                <dt>Parties</dt>
                <dd class="update-detail__parties">
                  <span v-if="updateDetail.parties.length > 0">
                    {{ updateDetail.parties.join(', ') }}
                  </span>
                  <span v-else>No parties</span>
                </dd>
              </div>
            </dl>
          </section>

          <section class="node-detail__section update-detail__events-section">
            <h3>Events</h3>
            <p v-if="renderedEvents.length === 0" class="update-detail__empty">
              No event rows found for this update.
            </p>
            <div v-else class="update-detail__events">
              <article
                v-for="event in renderedEvents"
                :key="`${event.eventKind}-${event.eventId ?? 'missing-event-id'}-${event.contractId ?? 'missing-contract-id'}`"
                class="update-detail__event"
              >
                <dl class="detail-grid update-detail__event-grid">
                  <div class="update-detail__event-item">
                    <dt>Event ID</dt>
                    <dd>{{ event.eventId ?? 'n/a' }}</dd>
                  </div>
                  <div class="update-detail__event-item">
                    <dt>Kind</dt>
                    <dd>{{ formatEventKind(event.eventKind) }}</dd>
                  </div>
                  <div class="update-detail__event-item update-detail__event-item--template">
                    <dt>Template ID</dt>
                    <dd>{{ event.templateId ?? 'n/a' }}</dd>
                  </div>
                  <div class="update-detail__event-item update-detail__event-item--choice">
                    <dt>Choice</dt>
                    <dd>{{ event.choice ?? 'n/a' }}</dd>
                  </div>
                  <div class="update-detail__event-item update-detail__event-item--contract">
                    <dt>Contract ID</dt>
                    <dd v-if="event.contractId">
                      <RouterLink
                        class="contract-detail__link"
                        :to="`/nodes/${props.id}/contracts/${event.contractId}`"
                      >
                        {{ event.contractId }}
                      </RouterLink>
                    </dd>
                    <dd v-else>n/a</dd>
                  </div>
                  <div class="update-detail__event-item">
                    <dt>Witnesses</dt>
                    <dd class="update-detail__witnesses">
                      <template v-if="event.witnesses.length > 0">
                        <span
                          v-for="witness in event.witnesses"
                          :key="`${event.eventId ?? 'missing-event-id'}-${witness}`"
                          class="update-detail__witness"
                        >
                          {{ witness }}
                        </span>
                      </template>
                      <span v-else>No witnesses</span>
                    </dd>
                  </div>
                  <div
                    v-if="getRecordEntries(event.createData).length > 0"
                    class="update-detail__event-item update-detail__event-item--exercise-data"
                  >
                    <dt>Create Data</dt>
                    <dd class="update-detail__exercise-data">
                      <div
                        v-for="[key, value] in getRecordEntries(event.createData)"
                        :key="`${event.eventId ?? 'missing-event-id'}-create-${key}`"
                        class="update-detail__exercise-data-row"
                      >
                        <span class="update-detail__exercise-data-key">
                          {{ formatEventDataLabel(key) }}
                        </span>
                        <span class="update-detail__exercise-data-value">
                          <RouterLink
                            v-if="isContractReference(value)"
                            class="contract-detail__link"
                            :to="`/nodes/${props.id}/contracts/${value.value}`"
                          >
                            {{ value.value }}
                          </RouterLink>
                          <template v-else>
                            {{ formatEventDataValue(value) }}
                          </template>
                        </span>
                      </div>
                    </dd>
                  </div>
                  <div
                    v-if="getExerciseEntries(event.exerciseData).length > 0"
                    class="update-detail__event-item update-detail__event-item--exercise-data"
                  >
                    <dt>Exercise Data</dt>
                    <dd class="update-detail__exercise-data">
                      <div
                        v-for="[key, value] in getExerciseEntries(event.exerciseData)"
                        :key="`${event.eventId ?? 'missing-event-id'}-${key}`"
                        class="update-detail__exercise-data-row"
                      >
                        <span class="update-detail__exercise-data-key">
                          {{ formatEventDataLabel(key) }}
                        </span>
                        <span class="update-detail__exercise-data-value">
                          <RouterLink
                            v-if="isContractReference(value)"
                            class="contract-detail__link"
                            :to="`/nodes/${props.id}/contracts/${value.value}`"
                          >
                            {{ value.value }}
                          </RouterLink>
                          <template v-else>
                            {{ formatEventDataValue(value) }}
                          </template>
                        </span>
                      </div>
                    </dd>
                  </div>
                </dl>
              </article>
            </div>
          </section>
        </div>
      </div>
    </div>
  </section>
</template>
