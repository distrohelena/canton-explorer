<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import CopyToClipboardButton from "../components/CopyToClipboardButton.vue";
import { fetchNodeUpdateDetail } from "../lib/api";
import type { NodeUpdateDetailResponse } from "../types/updates";
import type { DecodedDamlValue } from "../types/daml";

const props = defineProps<{ id: string; eventOffset: string }>();
const route = useRoute();

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
const backTarget = computed(() => {
  const source = Array.isArray(route.query.from)
    ? route.query.from[0]
    : route.query.from;
  const partyId = Array.isArray(route.query.partyId)
    ? route.query.partyId[0]
    : route.query.partyId;

  if (source === "updates") {
    return "/";
  }

  if (source === "tokens") {
    return "/tokens";
  }

  if (
    source === "party" &&
    typeof partyId === "string" &&
    partyId.trim().length > 0
  ) {
    return `/parties/${encodeURIComponent(partyId)}`;
  }

  return `/nodes/${props.id}/updates`;
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

function formatInteger(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatEventDataLabel(key: string): string {
  return key
    .split(".")
    .map((segment) =>
      segment
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/^./, (char) => char.toUpperCase()),
    )
    .join(" / ");
}

function formatEventDataValue(
  value:
    | string
    | number
    | boolean
    | null
    | { kind: "contract_id"; value: string }
    | { kind: "unit" },
): string {
  if (typeof value === "number") {
    return formatInteger(value);
  }

  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }

  if (value && typeof value === "object") {
    if (value.kind === "contract_id") {
      return value.value;
    }

    if (value.kind === "unit") {
      return "Unit";
    }
  }

  return value ?? "n/a";
}

function isContractReference(
  value:
    | string
    | number
    | boolean
    | null
    | { kind: "contract_id"; value: string }
    | { kind: "unit" },
): value is { kind: "contract_id"; value: string } {
  return typeof value === "object" && value?.kind === "contract_id";
}

function isPartyFieldLabel(label: string): boolean {
  return label.split(".").some((segment) =>
    segment
      .replace(/\[\d+\]/g, "")
      .toLowerCase()
      .includes("party"),
  );
}

function isPartyReference(
  label: string,
  value: RenderableValue,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    (isPartyFieldLabel(label) || value.includes("::"))
  );
}

function isContractIdFieldLabel(label: string): boolean {
  const fieldLabel = label
    .split(".")
    .at(-1)
    ?.replace(/\[\d+\]/g, "")
    .toLowerCase();
  return Boolean(
    fieldLabel &&
    (fieldLabel.endsWith("cid") || fieldLabel.includes("contractid")),
  );
}

function isContractIdStringReference(
  label: string,
  value: RenderableValue,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    isContractIdFieldLabel(label)
  );
}

function contractReferenceValue(value: RenderableValue): string {
  return isContractReference(value) ? value.value : String(value);
}

type RenderableValue =
  | string
  | number
  | boolean
  | null
  | { kind: "contract_id"; value: string }
  | { kind: "unit" };

type EventDataEntry = [string, RenderableValue, number];

function isNumericFieldLabel(label: string): boolean {
  const fieldLabel = label
    .split(".")
    .at(-1)
    ?.replace(/\[\d+\]/g, "")
    .toLowerCase();

  return Boolean(
    fieldLabel &&
    /(?:amount|balance|decimal|fee|numeric|percentage|price|quantity|rate|ratio|shares|value)/.test(
      fieldLabel,
    ),
  );
}

function inferOptionalInnerType(label: string): string {
  const innerLabel = label.replace(/(^|\.)optional(?=[A-Z]|\.|$)/gi, "$1");

  if (isContractIdFieldLabel(innerLabel)) {
    return "ContractId";
  }

  if (isPartyFieldLabel(innerLabel)) {
    return "Party";
  }

  if (isNumericFieldLabel(innerLabel)) {
    return "Numeric";
  }

  const fieldLabel = innerLabel
    .split(".")
    .at(-1)
    ?.replace(/\[\d+\]/g, "")
    .toLowerCase();

  return fieldLabel?.endsWith("round") ? "Int64" : "Text";
}

function formatEventDataType(
  label: string,
  value: RenderableValue,
  optionalDepth = 0,
): string {
  let baseType: string;

  if (value === null) {
    baseType =
      optionalDepth > 0 ? inferOptionalInnerType(label) : "Optional";
  } else if (
    isContractReference(value) ||
    isContractIdStringReference(label, value)
  ) {
    baseType = "ContractId";
  } else if (isPartyReference(label, value)) {
    baseType = "Party";
  } else if (value && typeof value === "object") {
    baseType = value.kind === "unit" ? "Unit" : "Unknown";
  } else if (typeof value === "boolean") {
    baseType = "Bool";
  } else if (typeof value === "number") {
    baseType = isNumericFieldLabel(label) ? "Numeric" : "Int64";
  } else {
    baseType = "Text";
  }

  return (
    "Optional<".repeat(optionalDepth) +
    baseType +
    ">".repeat(optionalDepth)
  );
}

function formatDecodeFailureReason(reason: string): string {
  return reason.replaceAll("_", " ");
}

function flattenDecodedValue(
  label: string,
  value: DecodedDamlValue,
  optionalDepth = 0,
): EventDataEntry[] {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return [[label, value, optionalDepth]];
  }

  if (value.kind === "contract_id" || value.kind === "unit") {
    return [[label, value, optionalDepth]];
  }

  if (value.kind === "record") {
    return value.fields.flatMap((field) =>
      flattenDecodedValue(
        label ? `${label}.${field.label}` : field.label,
        field.value,
        optionalDepth,
      ),
    );
  }

  if (value.kind === "variant") {
    return value.value === null
      ? [[label, value.constructor, optionalDepth]]
      : [
          [label, value.constructor, optionalDepth],
          ...flattenDecodedValue(
            `${label}.${value.constructor}`,
            value.value,
            optionalDepth,
          ),
        ];
  }

  if (value.kind === "enum") {
    return [[label, value.constructor, optionalDepth]];
  }

  if (value.kind === "optional") {
    return value.value === null
      ? [[label, null, optionalDepth + 1]]
      : flattenDecodedValue(label, value.value, optionalDepth + 1);
  }

  if (value.kind === "list") {
    return value.items.length === 0
      ? [[label, null, optionalDepth]]
      : value.items.flatMap((item, index) =>
          flattenDecodedValue(`${label}[${index + 1}]`, item, optionalDepth),
        );
  }

  if (value.kind === "text_map") {
    return value.entries.flatMap((entry) =>
      flattenDecodedValue(`${label}.${entry.key}`, entry.value, optionalDepth),
    );
  }

  return value.entries.flatMap((entry, index) => [
    ...flattenDecodedValue(
      `${label}[${index + 1}].key`,
      entry.key,
      optionalDepth,
    ),
    ...flattenDecodedValue(
      `${label}[${index + 1}].value`,
      entry.value,
      optionalDepth,
    ),
  ]);
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
      ],
    ];
  }

  if (state.status !== "decoded") {
    return [];
  }

  return flattenDecodedValue("", state.value).map(
    ([key, value, optionalDepth]) => [key || "value", value, optionalDepth],
  );
}

function getExerciseEntries(
  state:
    | NodeUpdateDetailResponse["events"][number]["exerciseData"]
    | null
    | undefined,
): EventDataEntry[] {
  const entries: EventDataEntry[] = [];

  for (const [label, branch] of [
    ["argument", state?.argument],
    ["result", state?.result],
  ] as const) {
    if (!branch || branch.status !== "decoded") {
      if (branch?.status === "invalid_data") {
        entries.push([
          `${label}.decodeStatus`,
          `Invalid data (${formatDecodeFailureReason(branch.reason)})`,
          0,
        ]);
      }
      continue;
    }

    entries.push(...flattenDecodedValue(label, branch.value));
  }

  return entries;
}

type EventDataTableModel = {
  label: "Create Data" | "Exercise Data";
  entries: EventDataEntry[];
};

function getEventDataTable(
  event: NodeUpdateDetailResponse["events"][number],
): EventDataTableModel | null {
  const createEntries = getRecordEntries(event.createData);
  if (createEntries.length > 0) {
    return { label: "Create Data", entries: createEntries };
  }

  const exerciseEntries = getExerciseEntries(event.exerciseData);
  if (exerciseEntries.length > 0) {
    return { label: "Exercise Data", entries: exerciseEntries };
  }

  return null;
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
      <div class="node-page__rail">
        <RouterLink
          class="node-detail__back"
          :to="backTarget"
          aria-label="Back to overview"
        >
          ←
        </RouterLink>
      </div>

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
                <dd class="update-detail__canonical">
                  {{ updateDetail.updateId }}
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
              v-if="getEventDataTable(event)"
              class="update-detail__data-section"
              :aria-labelledby="`update-detail-event-data-heading-${eventIndex}`"
            >
              <h4 :id="`update-detail-event-data-heading-${eventIndex}`">
                {{ getEventDataTable(event)?.label }}
              </h4>
              <div class="update-detail__data-table-wrap">
                <table
                  class="update-detail__data-table"
                  :aria-labelledby="`update-detail-event-data-heading-${eventIndex}`"
                >
                  <colgroup>
                    <col class="update-detail__data-table-col--field" />
                    <col class="update-detail__data-table-col--type" />
                    <col class="update-detail__data-table-col--value" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope="col">Field</th>
                      <th scope="col">Type</th>
                      <th scope="col">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="[key, value, optionalDepth] in getEventDataTable(event)
                        ?.entries ?? []"
                      :key="`${event.eventId ?? 'missing-event-id'}-${key}`"
                    >
                      <th scope="row" class="update-detail__data-table-field">
                        {{ formatEventDataLabel(key) }}
                      </th>
                      <td class="update-detail__data-table-type">
                        {{ formatEventDataType(key, value, optionalDepth) }}
                      </td>
                      <td class="update-detail__data-table-value">
                        <RouterLink
                          v-if="
                            isContractReference(value) ||
                            isContractIdStringReference(key, value)
                          "
                          class="contract-detail__link"
                          :to="`/nodes/${props.id}/contracts/${contractReferenceValue(value)}`"
                        >
                          {{ contractReferenceValue(value) }}
                        </RouterLink>
                        <RouterLink
                          v-else-if="isPartyReference(key, value)"
                          class="contract-detail__link"
                          :to="`/parties/${value}`"
                        >
                          {{ value }}
                        </RouterLink>
                        <template v-else>
                          {{ formatEventDataValue(value) }}
                        </template>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </article>
        </div>
      </div>
    </div>
  </section>
</template>
