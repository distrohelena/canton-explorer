<script setup lang="ts">
import CopyToClipboardButton from "./CopyToClipboardButton.vue";
import type { PackageTypeNode } from "../types/packages";
import {
  compositeSummary,
  contractReferenceValue,
  formatEventDataLabel,
  formatEventDataType,
  formatEventDataValue,
  getListItemEntries,
  getRecordFieldEntries,
  isCompositeValue,
  isContractIdStringReference,
  isContractReference,
  isListValue,
  isPartyReference,
} from "../lib/event-data";
import type { EventDataEntry, ListValue } from "../lib/event-data";

const props = defineProps<{
  entries?: EventDataEntry[];
  listValue?: ListValue;
  schemaNode?: PackageTypeNode | null;
  nodeId: string;
  ariaLabel?: string;
  ariaLabelledby?: string;
}>();
</script>

<template>
  <table
    class="update-detail__data-table"
    :aria-label="props.ariaLabel"
    :aria-labelledby="props.ariaLabelledby"
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
      <template v-if="props.listValue">
        <template v-if="props.listValue.items.length > 0">
          <template
            v-for="itemIndex in props.listValue.items.length"
            :key="`${props.ariaLabel ?? 'list'}-${itemIndex - 1}`"
          >
            <tr class="update-detail__nested-data-table-item">
              <th scope="rowgroup" colspan="3">
                Field {{ itemIndex }}
              </th>
            </tr>
            <template
              v-for="[
                key,
                value,
                optionalDepth,
                type,
              ] in getListItemEntries(
                props.listValue,
                itemIndex - 1,
                props.schemaNode ?? null,
              )"
              :key="`${props.ariaLabel ?? 'list'}-${itemIndex - 1}-${key}`"
            >
              <tr>
                <th scope="row" class="update-detail__data-table-field">
                  {{ formatEventDataLabel(key) }}
                </th>
                <td
                  class="update-detail__data-table-type update-detail__data-table-type--wrappable"
                >
                  {{ formatEventDataType(key, value, optionalDepth, type) }}
                </td>
                <td class="update-detail__data-table-value">
                  <span
                    v-if="isCompositeValue(value)"
                    class="update-detail__data-table-value-content"
                  >
                    {{ compositeSummary(value) }}
                  </span>
                  <span
                    v-else-if="
                      isContractReference(value) ||
                      isContractIdStringReference(key, value)
                    "
                    class="update-detail__data-table-value-with-copy"
                  >
                    <RouterLink
                      class="contract-detail__link update-detail__data-table-value-link"
                      :to="`/nodes/${props.nodeId}/contracts/${contractReferenceValue(value)}`"
                    >
                      {{ contractReferenceValue(value) }}
                    </RouterLink>
                    <CopyToClipboardButton
                      :value="contractReferenceValue(value)"
                      label="contract ID"
                    />
                  </span>
                  <span
                    v-else-if="isPartyReference(key, value)"
                    class="update-detail__data-table-value-with-copy"
                  >
                    <RouterLink
                      class="contract-detail__link update-detail__data-table-value-link"
                      :to="`/parties/${value}`"
                    >
                      {{ value }}
                    </RouterLink>
                    <CopyToClipboardButton :value="value" label="party ID" />
                  </span>
                  <span
                    v-else
                    class="update-detail__data-table-value-content"
                  >
                    {{ formatEventDataValue(value) }}
                  </span>
                </td>
              </tr>
              <tr v-if="isCompositeValue(value)">
                <td colspan="3" class="update-detail__data-table-array-cell">
                  <EventDataTable
                    v-if="isListValue(value)"
                    :list-value="value"
                    :schema-node="type"
                    :node-id="props.nodeId"
                    :aria-label="formatEventDataLabel(key)"
                  />
                  <EventDataTable
                    v-else
                    :entries="getRecordFieldEntries(value, type)"
                    :node-id="props.nodeId"
                    :aria-label="formatEventDataLabel(key)"
                  />
                </td>
              </tr>
            </template>
          </template>
        </template>
        <tr v-else>
          <td colspan="3">No items</td>
        </tr>
      </template>
      <template v-else>
        <template
          v-for="[key, value, optionalDepth, type] in props.entries ?? []"
          :key="`${props.ariaLabel ?? 'table'}-${key}`"
        >
          <tr>
            <th scope="row" class="update-detail__data-table-field">
              {{ formatEventDataLabel(key) }}
            </th>
            <td
              class="update-detail__data-table-type update-detail__data-table-type--wrappable"
            >
              {{ formatEventDataType(key, value, optionalDepth, type) }}
            </td>
            <td class="update-detail__data-table-value">
              <span
                v-if="isCompositeValue(value)"
                class="update-detail__data-table-value-content"
              >
                {{ compositeSummary(value) }}
              </span>
              <span
                v-else-if="
                  isContractReference(value) ||
                  isContractIdStringReference(key, value)
                "
                class="update-detail__data-table-value-with-copy"
              >
                <RouterLink
                  class="contract-detail__link update-detail__data-table-value-link"
                  :to="`/nodes/${props.nodeId}/contracts/${contractReferenceValue(value)}`"
                >
                  {{ contractReferenceValue(value) }}
                </RouterLink>
                <CopyToClipboardButton
                  :value="contractReferenceValue(value)"
                  label="contract ID"
                />
              </span>
              <span
                v-else-if="isPartyReference(key, value)"
                class="update-detail__data-table-value-with-copy"
              >
                <RouterLink
                  class="contract-detail__link update-detail__data-table-value-link"
                  :to="`/parties/${value}`"
                >
                  {{ value }}
                </RouterLink>
                <CopyToClipboardButton :value="value" label="party ID" />
              </span>
              <span
                v-else
                class="update-detail__data-table-value-content"
              >
                {{ formatEventDataValue(value) }}
              </span>
            </td>
          </tr>
          <tr v-if="isCompositeValue(value)">
            <td colspan="3" class="update-detail__data-table-array-cell">
              <EventDataTable
                v-if="isListValue(value)"
                :list-value="value"
                :schema-node="type"
                :node-id="props.nodeId"
                :aria-label="formatEventDataLabel(key)"
              />
              <EventDataTable
                v-else
                :entries="getRecordFieldEntries(value, type)"
                :node-id="props.nodeId"
                :aria-label="formatEventDataLabel(key)"
              />
            </td>
          </tr>
        </template>
      </template>
    </tbody>
  </table>
</template>
