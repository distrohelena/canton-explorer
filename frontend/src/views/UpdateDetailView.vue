<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import CopyToClipboardButton from "../components/CopyToClipboardButton.vue";
import EventDataTable from "../components/EventDataTable.vue";
import { fetchNodeUpdateDetail } from "../lib/api";
import type { NodeUpdateDetailResponse } from "../types/updates";
import {
  flattenDecodedValue as flattenEventDataValue,
} from "../lib/event-data";
import type { EventDataEntry as SharedEventDataEntry } from "../lib/event-data";

type EventDataEntry = SharedEventDataEntry;

const props = defineProps<{ id: string; eventOffset: string }>();

const updateDetail = ref<NodeUpdateDetailResponse | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    updateDetail.value = await fetchNodeUpdateDetail(
      props.id,
      props.eventOffset,
    );
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Unknown error";
  }
});

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
    date: new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
    }).format(parsed),
    time: new Intl.DateTimeFormat(undefined, {
      timeStyle: "medium",
    }).format(parsed),
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

const recordTimeLines = computed(() =>
  updateDetail.value ? formatRecordTime(updateDetail.value.recordTime) : null,
);
const renderedEvents = computed(() => updateDetail.value?.events ?? []);
const debuggerTarget = computed(() => {
  if (!updateDetail.value) {
    return "/debugger";
  }

  const params = new URLSearchParams({ updateId: updateDetail.value.updateId });

  return `/debugger?${params.toString()}`;
});
function formatEventKind(
  eventKind: NodeUpdateDetailResponse["events"][number]["eventKind"],
): string {
  switch (eventKind) {
    case "consuming_exercise":
      return "Consuming Exercise";
    case "non_consuming_exercise":
      return "Non-Consuming Exercise";
    case "create":
      return "Create";
  }
}

function formatDecodeFailureReason(reason: string): string {
  return reason.replaceAll("_", " ");
}

function getRecordEntries(
  state:
    NodeUpdateDetailResponse["events"][number]["createData"] | null | undefined,
): EventDataEntry[] {
  if (!state) {
    return [];
  }

  if (state.status === "invalid_data") {
    return [
      [
        "decodeStatus",
        `Invalid data (${formatDecodeFailureReason(state.reason)})`,
        0,
        null,
      ],
    ];
  }

  if (state.status !== "decoded") {
    return [];
  }

  return flattenEventDataValue("", state.value, 0, state.type ?? null).map(
    ([key, value, optionalDepth, type]) => [
      key || "value",
      value,
      optionalDepth,
      type,
    ],
  );
}

type EventDataTableModel = {
  label: "Create Data" | "Argument" | "Result";
  entries: EventDataEntry[];
};

type ExerciseDataBranch = NonNullable<
  NonNullable<
    NodeUpdateDetailResponse["events"][number]["exerciseData"]
  >["argument"]
>;

function getExerciseBranchEntries(
  state: ExerciseDataBranch | undefined,
): EventDataEntry[] {
  if (!state) {
    return [];
  }

  if (state.status === "invalid_data") {
    return [
      [
        "decodeStatus",
        `Invalid data (${formatDecodeFailureReason(state.reason)})`,
        0,
        null,
      ],
    ];
  }

  if (state.status !== "decoded") {
    return [];
  }

  return flattenEventDataValue("", state.value, 0, state.type ?? null).map(
    ([key, value, optionalDepth, type]) => [
      key || "value",
      value,
      optionalDepth,
      type,
    ],
  );
}

function getExerciseEntries(
  state:
    NodeUpdateDetailResponse["events"][number]["exerciseData"] | null | undefined,
): EventDataTableModel[] {
  if (!state) {
    return [];
  }

  return ([
    ["Argument", state.argument],
    ["Result", state.result],
  ] as const)
    .map(([label, branch]) => ({
      label,
      entries: getExerciseBranchEntries(branch),
    }))
    .filter((table) => table.entries.length > 0);
}

function getEventDataTables(
  event: NodeUpdateDetailResponse["events"][number],
): EventDataTableModel[] {
  const createEntries = getRecordEntries(event.createData);
  if (createEntries.length > 0) {
    return [{ label: "Create Data", entries: createEntries }];
  }

  return getExerciseEntries(event.exerciseData);
}
</script>
<template>
  <section class="update-detail">
    <p v-if="error" class="node-detail__message node-detail__message--error">
      {{ error }}
    </p>
    <p
      v-else-if="!updateDetail"
      class="node-detail__message inline-loading"
      role="status"
    >
      <span class="node-updates__spinner" aria-hidden="true"></span>
      <span>Loading update detail...</span>
    </p>
    <div v-else class="node-page">
      <div class="update-detail__action-rail">
        <RouterLink class="update-detail__debug-action" :to="debuggerTarget">
          Debug Offset
        </RouterLink>
      </div>

      <div class="node-page__main update-detail__content">
        <header class="node-detail__hero">
          <div>
            <h2>{{ updateDetail.label }} Update</h2>
          </div>
        </header>

        <div class="node-detail__sections">
          <section class="node-detail__section update-detail__section--summary">
            <h3>Summary</h3>
            <dl class="detail-grid update-detail__summary-grid">
              <div class="update-detail__summary-item">
                <dt>Event Offset</dt>
                <dd class="update-detail__id">
                  {{ updateDetail.eventOffset }}
                </dd>
              </div>
              <div class="update-detail__summary-item">
                <dt>Canonical Update ID</dt>
                <dd
                  class="update-detail__canonical update-detail__canonical-with-copy"
                >
                  <span
                    class="update-detail__canonical-value"
                    :title="updateDetail.updateId"
                  >
                    {{ updateDetail.updateId }}
                  </span>
                  <CopyToClipboardButton
                    :value="updateDetail.updateId"
                    label="update ID"
                  />
                </dd>
              </div>
              <div class="update-detail__summary-item">
                <dt>Record Time</dt>
                <dd v-if="recordTimeLines" class="update-detail__time">
                  <span class="update-detail__time-date">{{
                    recordTimeLines.date
                  }}</span>
                  <span class="update-detail__time-clock">{{
                    recordTimeLines.time
                  }}</span>
                </dd>
                <dd v-else>n/a</dd>
              </div>
              <div class="update-detail__summary-item">
                <dt>Estimated traffic cost</dt>
                <dd>
                  {{
                    formatEstimatedTrafficUsd(
                      updateDetail.estimatedTrafficUsd,
                      updateDetail.estimatedTrafficUsdGapDays,
                    )
                  }}
                </dd>
              </div>
              <div
                class="update-detail__summary-item update-detail__summary-item--parties"
              >
                <dt>Parties</dt>
                <dd class="update-detail__parties">
                  <template v-if="updateDetail.parties.length > 0">
                    <div
                      v-for="party in updateDetail.parties"
                      :key="party"
                      class="package-detail__list-row parties-page__party-row"
                    >
                      <RouterLink
                        class="contract-detail__link parties-page__party-link"
                        :to="`/parties/${party}`"
                      >
                        {{ party }}
                      </RouterLink>
                      <CopyToClipboardButton :value="party" />
                    </div>
                  </template>
                  <span v-else>No parties</span>
                </dd>
              </div>
            </dl>
          </section>
        </div>

        <h3>Events</h3>
        <p v-if="renderedEvents.length === 0" class="update-detail__empty">
          No event rows found for this update.
        </p>
        <div v-else class="update-detail__events">
          <article
            v-for="(event, eventIndex) in renderedEvents"
            :key="`${event.eventKind}-${event.eventId ?? 'missing-event-id'}-${event.contractId ?? 'missing-contract-id'}`"
            class="update-detail__event"
          >
            <dl class="detail-grid update-detail__event-grid">
              <div class="update-detail__event-item">
                <dt>Event ID</dt>
                <dd>{{ event.eventId ?? "n/a" }}</dd>
              </div>
              <div class="update-detail__event-item">
                <dt>Kind</dt>
                <dd class="update-detail__event-kind">
                  {{ formatEventKind(event.eventKind) }}
                </dd>
              </div>
              <div
                class="update-detail__event-item update-detail__event-item--template"
              >
                <dt>Template ID</dt>
                <dd
                  class="update-detail__event-template-id"
                  :title="event.templateId ?? 'n/a'"
                >
                  {{ event.templateId ?? "n/a" }}
                </dd>
              </div>
              <div
                class="update-detail__event-item update-detail__event-item--package"
              >
                <dt>Package ID</dt>
                <dd v-if="event.packageId">
                  <RouterLink
                    class="contract-detail__link update-detail__event-package-id"
                    :title="event.packageId"
                    :to="`/packages/${event.packageId}`"
                  >
                    {{ event.packageId }}
                  </RouterLink>
                </dd>
                <dd v-else>n/a</dd>
              </div>
              <div
                class="update-detail__event-item update-detail__event-item--choice"
              >
                <dt>Choice</dt>
                <dd>{{ event.choice ?? "n/a" }}</dd>
              </div>
              <div
                class="update-detail__event-item update-detail__event-item--contract"
              >
                <dt>Contract ID</dt>
                <dd v-if="event.contractId">
                  <RouterLink
                    class="contract-detail__link update-detail__event-contract-id"
                    :title="event.contractId"
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
                    <div
                      v-for="witness in event.witnesses"
                      :key="`${event.eventId ?? 'missing-event-id'}-${witness}`"
                      class="package-detail__list-row parties-page__party-row"
                    >
                      <RouterLink
                        class="contract-detail__link parties-page__party-link"
                        :to="`/parties/${witness}`"
                      >
                        {{ witness }}
                      </RouterLink>
                      <CopyToClipboardButton :value="witness" />
                    </div>
                  </template>
                  <span v-else>No witnesses</span>
                </dd>
              </div>
            </dl>
            <section
              v-if="getEventDataTables(event).length > 0"
              class="update-detail__data-section"
              :aria-labelledby="`update-detail-event-data-heading-${eventIndex}-0`"
            >
              <template
                v-for="(dataTable, dataTableIndex) in getEventDataTables(event)"
                :key="`${event.eventId ?? 'missing-event-id'}-${dataTable.label}`"
              >
                <h4
                  :id="`update-detail-event-data-heading-${eventIndex}-${dataTableIndex}`"
                >
                  {{ dataTable.label }}
                </h4>
                <div class="update-detail__data-table-wrap">
                  <EventDataTable
                    :entries="dataTable.entries"
                    :node-id="props.id"
                    :aria-labelledby="`update-detail-event-data-heading-${eventIndex}-${dataTableIndex}`"
                  />
                </div>
              </template>
            </section>
          </article>
        </div>
      </div>
    </div>
  </section>
</template>
