<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import type { PackageTypeField, PackageTypeNode } from '../types/packages';
import {
  formatPackageTypeLabel,
  resolveDebuggerSchemaNode,
  unwrapDebuggerSchemaNode,
} from '../lib/debugger-value-schema';

defineOptions({
  name: 'DebuggerValueTree',
});

const CONTRACT_ID_MARKER = '__damlLfContractId';
const NUMERIC_MARKER = '__damlLfNumeric';
const PARTY_MARKER = '__damlLfParty';
const RECORD_ID_MARKER = '__damlLfRecordId';
const INT64_MARKER = '__damlLfInt64';

type DebuggerValueNode = null | boolean | number | string | DebuggerValueArray | DebuggerValueObject;
interface DebuggerValueArray extends Array<DebuggerValueNode> {}
interface DebuggerValueObject {
  [key: string]: DebuggerValueNode;
}

const props = defineProps<{
  value: unknown;
  nodeId?: string | null;
  packageTypeLookup?: Map<string, PackageTypeNode>;
  schemaNode?: PackageTypeNode | null;
}>();

function isObjectValue(value: unknown): value is DebuggerValueObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isScalarMarkerValue(
  value: unknown,
  marker: string,
): value is Record<string, string> {
  return isObjectValue(value) && typeof value[marker] === 'string';
}

function contractTarget(contractId: string): string | null {
  if (!props.nodeId) {
    return null;
  }

  return `/nodes/${encodeURIComponent(props.nodeId)}/contracts/${encodeURIComponent(contractId)}`;
}

function partyTarget(party: string): string {
  return `/parties/${encodeURIComponent(party)}`;
}

function templateTarget(templateId: string): string {
  return `/contracts?template=${encodeURIComponent(templateId)}`;
}

function recordTypeRef(value: unknown): {
  packageId: string;
  typeId: string;
  label: string;
} | null {
  if (!isObjectValue(value)) {
    return null;
  }

  const recordId = value[RECORD_ID_MARKER];

  if (!isObjectValue(recordId)) {
    return null;
  }

  const packageId = typeof recordId.packageId === 'string' ? recordId.packageId : null;
  const moduleName = typeof recordId.moduleName === 'string' ? recordId.moduleName : null;
  const entityName = typeof recordId.entityName === 'string' ? recordId.entityName : null;

  if (packageId && moduleName && entityName) {
    return {
      packageId,
      typeId: `${moduleName}:${entityName}`,
      label: `${moduleName}:${entityName}`,
    };
  }

  if (entityName) {
    return {
      packageId: '',
      typeId: entityName,
      label: entityName,
    };
  }

  return null;
}

function isTupleLikeObject(value: unknown): value is DebuggerValueObject {
  return isObjectValue(value)
    && Object.keys(value)
      .filter((key) => key !== RECORD_ID_MARKER)
      .every((key) => /^\d+$/.test(key));
}

function describeValueType(value: unknown): string {
  const recordType = recordTypeRef(value);

  if (recordType) {
    return recordType.label;
  }

  if (isScalarMarkerValue(value, CONTRACT_ID_MARKER)) {
    return 'contractId';
  }

  if (isScalarMarkerValue(value, PARTY_MARKER)) {
    return 'party';
  }

  if (isScalarMarkerValue(value, NUMERIC_MARKER)) {
    return 'decimal';
  }

  if (isScalarMarkerValue(value, INT64_MARKER)) {
    return 'int64';
  }

  if (Array.isArray(value)) {
    return 'list';
  }

  if (isTupleLikeObject(value)) {
    return 'tuple';
  }

  if (isObjectValue(value)) {
    return 'record';
  }

  if (typeof value === 'string') {
    return 'text';
  }

  if (typeof value === 'boolean') {
    return 'bool';
  }

  if (typeof value === 'number') {
    return 'number';
  }

  return 'unit';
}

function objectEntries(
  value: DebuggerValueObject,
) {
  return Object.entries(value).filter(([key]) => key !== RECORD_ID_MARKER)
    .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }));
}

function entrySchemaField(
  key: string,
  index: number,
  schemaNode: PackageTypeNode | null,
): PackageTypeField | null {
  const structuralNode = unwrapDebuggerSchemaNode(schemaNode);

  if (structuralNode?.kind !== 'record' && structuralNode?.kind !== 'struct') {
    return null;
  }

  if (/^\d+$/.test(key)) {
    return structuralNode.fields?.[index] ?? null;
  }

  return structuralNode.fields?.find((field) => field.name === key) ?? null;
}

function entrySchemaLabel(
  key: string,
  index: number,
  schemaNode: PackageTypeNode | null,
): string {
  const field = entrySchemaField(key, index, schemaNode);

  return field?.name ?? (/^\d+$/.test(key) ? `[${key}]` : key);
}

function entrySchemaNode(
  key: string,
  index: number,
  schemaNode: PackageTypeNode | null,
): PackageTypeNode | null {
  const field = entrySchemaField(key, index, schemaNode);

  if (field) {
    return field.type;
  }

  const structuralNode = unwrapDebuggerSchemaNode(schemaNode);

  if (Array.isArray(structuralNode?.arguments) && /^\d+$/.test(key)) {
    return structuralNode.arguments[index] ?? null;
  }

  return null;
}

function toEntries(
  value: unknown,
  schemaNode: PackageTypeNode | null,
): Array<{ label: string; value: unknown; schemaNode: PackageTypeNode | null; typeLabel: string }> {
  if (Array.isArray(value)) {
    return value.map((item, index) => ({
      label: `[${index}]`,
      value: item,
      schemaNode: null,
      typeLabel: describeValueType(item),
    }));
  }

  if (!isObjectValue(value)) {
    return [];
  }

  return objectEntries(value).map(([key, child], index) => {
    const childSchemaNode = entrySchemaNode(key, index, schemaNode);
    return {
      label: entrySchemaLabel(key, index, schemaNode),
      value: child,
      schemaNode: childSchemaNode,
      typeLabel: childSchemaNode ? formatPackageTypeLabel(childSchemaNode) : describeValueType(child),
    };
  });
}

function resolvedSchemaNode(): PackageTypeNode | null {
  if (props.schemaNode) {
    return props.schemaNode;
  }

  if (!props.packageTypeLookup) {
    return null;
  }

  return resolveDebuggerSchemaNode(props.value, props.packageTypeLookup);
}

function resolvedRecordType(): string | null {
  const schemaNode = resolvedSchemaNode();

  if (schemaNode && schemaNode.packageId && schemaNode.typeId) {
    return schemaNode.typeId;
  }

  const recordType = recordTypeRef(props.value);
  return recordType?.label ?? null;
}

function resolvedRecordLinkTarget(): string | null {
  const schemaNode = resolvedSchemaNode();

  if (schemaNode?.packageId && schemaNode.typeId) {
    return templateTarget(schemaNode.typeId);
  }

  const recordType = recordTypeRef(props.value);
  return recordType ? templateTarget(recordType.label) : null;
}

const schemaNode = computed(() => resolvedSchemaNode());

const kind = computed(() => {
  if (isScalarMarkerValue(props.value, CONTRACT_ID_MARKER)) {
    return 'contractId';
  }

  if (isScalarMarkerValue(props.value, PARTY_MARKER)) {
    return 'party';
  }

  if (isScalarMarkerValue(props.value, NUMERIC_MARKER)) {
    return 'numeric';
  }

  if (isScalarMarkerValue(props.value, INT64_MARKER)) {
    return 'int64';
  }

  if (Array.isArray(props.value)) {
    return 'array';
  }

  if (isObjectValue(props.value)) {
    return 'record';
  }

  return 'scalar';
});

const entries = computed(() => toEntries(props.value, schemaNode.value));
const recordType = computed(() => resolvedRecordType());
const recordTypeTarget = computed(() => resolvedRecordLinkTarget());
const typeLabel = computed(() =>
  schemaNode.value ? formatPackageTypeLabel(schemaNode.value) : describeValueType(props.value),
);
</script>

<template>
  <div class="debugger-value-tree">
    <div
      v-if="recordType || kind === 'array' || kind === 'record'"
      class="debugger-value-tree__type-label"
    >
      <RouterLink
        v-if="recordType && recordTypeTarget"
        class="debugger-scope-panel__value-link"
        :to="recordTypeTarget"
        target="_blank"
        rel="noreferrer"
      >
        {{ recordType }}
      </RouterLink>
      <template v-else-if="recordType">
        {{ recordType }}
      </template>
      <template v-else>
        {{ typeLabel }}
      </template>
    </div>
    <RouterLink
      v-if="kind === 'contractId' && contractTarget((value as Record<string, string>)[CONTRACT_ID_MARKER])"
      class="debugger-scope-panel__value-link"
      :to="contractTarget((value as Record<string, string>)[CONTRACT_ID_MARKER]) ?? ''"
      target="_blank"
      rel="noreferrer"
    >
      {{ (value as Record<string, string>)[CONTRACT_ID_MARKER] }}
    </RouterLink>
    <RouterLink
      v-else-if="kind === 'party'"
      class="debugger-scope-panel__value-link"
      :to="partyTarget((value as Record<string, string>)[PARTY_MARKER])"
      target="_blank"
      rel="noreferrer"
    >
      {{ (value as Record<string, string>)[PARTY_MARKER] }}
    </RouterLink>
    <span v-else-if="kind === 'numeric'">
      {{ (value as Record<string, string>)[NUMERIC_MARKER] }}
    </span>
    <span v-else-if="kind === 'int64'">
      {{ (value as Record<string, string>)[INT64_MARKER] }}
    </span>
    <span v-else-if="kind === 'scalar'">
      {{ typeof value === 'string' ? value : JSON.stringify(value) }}
    </span>
    <div v-else class="debugger-value-tree__composite">
      <ul class="debugger-value-tree__entries">
        <li
          v-for="entry in entries"
          :key="entry.label"
          class="debugger-value-tree__entry"
        >
          <div class="debugger-value-tree__entry-meta">
            <span class="debugger-value-tree__label">{{ entry.label }}</span>
            <span class="debugger-value-tree__entry-type">{{ entry.typeLabel }}</span>
          </div>
          <div class="debugger-value-tree__child">
            <DebuggerValueTree
              :value="entry.value"
              :node-id="nodeId"
              :schema-node="entry.schemaNode"
              :package-type-lookup="packageTypeLookup"
            />
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
