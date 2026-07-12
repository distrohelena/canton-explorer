<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import DebuggerValueTree from './DebuggerValueTree.vue';
import {
  collectRecordTypeRefs,
  loadDebuggerPackageTypeLookup,
  resolveDebuggerSchemaNode,
} from '../lib/debugger-value-schema';
import type { DebuggerScope } from '../types/debugger';
import type { PackageTypeNode } from '../types/packages';

const props = defineProps<{
  scopes: DebuggerScope[];
  nodeId?: string | null;
}>();

const collapsedScopeKeys = ref<Set<string>>(new Set());
const packageTypeLookup = ref<Map<string, PackageTypeNode>>(new Map());

function formatVariableName(name: string | null | undefined, kind: string | null | undefined): string {
  if (kind === 'contractId' && name === 'selfContractId') {
    return 'self';
  }

  return name ?? 'value';
}

function formatKindLabel(kind: string | null | undefined): string {
  if (kind === 'numeric') {
    return 'decimal';
  }

  return kind ?? 'value';
}

function formatScopeName(name: string | null | undefined, frameId: string | null | undefined): string {
  const label = name ?? frameId ?? 'Frame';

  if (!label.startsWith('$')) {
    return label;
  }

  const normalizedHelperName = label.replace(/^\$+/, '');
  const helperMatch = /^sc_(.+?)_(\d+)$/.exec(normalizedHelperName);

  if (!helperMatch) {
    return 'generated helper';
  }

  return `generated helper from ${helperMatch[1]}`;
}

function contractTarget(kind: string | null | undefined, value: string | null | undefined): string | null {
  if (kind !== 'contractId' || !props.nodeId || !value) {
    return null;
  }

  return `/nodes/${encodeURIComponent(props.nodeId)}/contracts/${encodeURIComponent(value)}`;
}

function contractIdArrayValues(kind: string | null | undefined, value: string | null | undefined): string[] {
  if (kind !== 'contractId[]' || !value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0);
    }
  } catch {
    const compactValue = value.trim();

    if (compactValue.startsWith('[') && compactValue.endsWith(']')) {
      return compactValue
        .slice(1, -1)
        .split(',')
        .map((item) => item.trim().replace(/^"(.*)"$/, '$1'))
        .filter((item) => item.length > 0);
    }
  }

  return [];
}

function parsedLedgerValue(kind: string | null | undefined, value: string | null | undefined): unknown | null {
  if (kind !== 'ledgerValue' || !value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

const scopeViews = computed(() =>
  props.scopes.map((scope) => ({
    ...scope,
    variables: scope.variables.map((variable) => ({
      ...variable,
      parsedLedgerValue: parsedLedgerValue(variable.kind, variable.value),
    })),
  })),
);

const packageIds = computed(() => {
  const ids = new Set<string>();

  scopeViews.value.forEach((scope) => {
    scope.variables.forEach((variable) => {
      if (!variable.parsedLedgerValue) {
        return;
      }

      collectRecordTypeRefs(variable.parsedLedgerValue).forEach((recordTypeRef) => {
        ids.add(recordTypeRef.packageId);
      });
    });
  });

  return [...ids].sort();
});

watch(
  packageIds,
  async (nextPackageIds, _previousPackageIds, onCleanup) => {
    let cancelled = false;
    onCleanup(() => {
      cancelled = true;
    });

    if (nextPackageIds.length === 0) {
      packageTypeLookup.value = new Map();
      return;
    }

    const lookup = await loadDebuggerPackageTypeLookup(nextPackageIds);
    if (!cancelled) {
      packageTypeLookup.value = lookup;
    }
  },
  { immediate: true },
);

function partyTarget(kind: string | null | undefined, value: string | null | undefined): string | null {
  if (kind !== 'party' || !value) {
    return null;
  }

  return `/parties/${encodeURIComponent(value)}`;
}

function templateTarget(contractType: string | null | undefined): string | null {
  if (!contractType) {
    return null;
  }

  return `/contracts?template=${encodeURIComponent(contractType)}`;
}

function showsContractType(kind: string | null | undefined, contractType: string | null | undefined): boolean {
  return typeof kind === 'string'
    && kind.startsWith('contractId')
    && typeof contractType === 'string'
    && contractType.length > 0;
}

function scopeKey(scope: DebuggerScope): string {
  return scope.frameId ?? scope.name ?? 'scope';
}

function isCollapsed(scope: DebuggerScope): boolean {
  return collapsedScopeKeys.value.has(scopeKey(scope));
}

function toggleScope(scope: DebuggerScope): void {
  const nextKeys = new Set(collapsedScopeKeys.value);
  const key = scopeKey(scope);

  if (nextKeys.has(key)) {
    nextKeys.delete(key);
  } else {
    nextKeys.add(key);
  }

  collapsedScopeKeys.value = nextKeys;
}

watch(
  () => props.scopes.map((scope) => scopeKey(scope)),
  (nextKeys) => {
    const nextKeySet = new Set(nextKeys);
    collapsedScopeKeys.value = new Set(
      [...collapsedScopeKeys.value].filter((key) => nextKeySet.has(key)),
    );
  },
);
</script>

<template>
  <section class="debugger-scope-panel" data-testid="debugger-scope-panel">
    <div class="debugger-scope-panel__header">
      <h3>In-Scope Variables</h3>
      <span class="debugger-scope-panel__count">{{ scopes.length }} frames</span>
    </div>

    <p v-if="scopeViews.length === 0" class="debugger-scope-panel__empty">
      No scoped variables are available at this step.
    </p>

    <div v-for="scope in scopeViews" :key="scopeKey(scope)" class="debugger-scope-panel__scope">
      <button
        type="button"
        class="debugger-scope-panel__scope-toggle"
        :aria-expanded="!isCollapsed(scope)"
        @click="toggleScope(scope)"
      >
        <div class="debugger-scope-panel__scope-header">
          <h4>{{ formatScopeName(scope.name, scope.frameId) }}</h4>
          <div class="debugger-scope-panel__scope-meta">
            <span class="debugger-scope-panel__scope-id">{{ scope.frameId ?? 'anonymous' }}</span>
            <span class="debugger-scope-panel__scope-chevron" aria-hidden="true">
              {{ isCollapsed(scope) ? '▸' : '▾' }}
            </span>
          </div>
        </div>
      </button>

      <ul v-if="!isCollapsed(scope) && scope.variables.length > 0" class="debugger-scope-panel__variables">
        <li
          v-for="variable in scope.variables"
          :key="`${scope.frameId ?? 'scope'}:${variable.name ?? 'variable'}`"
          class="debugger-scope-panel__variable"
        >
          <div class="debugger-scope-panel__variable-meta">
            <strong>{{ formatVariableName(variable.name, variable.kind) }}</strong>
            <span class="debugger-scope-panel__kind">{{ formatKindLabel(variable.kind) }}</span>
          </div>
          <div class="debugger-scope-panel__value-block">
            <DebuggerValueTree
              v-if="variable.parsedLedgerValue !== null"
              :value="variable.parsedLedgerValue"
              :node-id="nodeId"
              :schema-node="resolveDebuggerSchemaNode(variable.parsedLedgerValue, packageTypeLookup)"
              :package-type-lookup="packageTypeLookup"
            />
            <code v-else>
            <RouterLink
              v-if="contractTarget(variable.kind, variable.value)"
              class="debugger-scope-panel__value-link"
              :to="contractTarget(variable.kind, variable.value) ?? ''"
              target="_blank"
              rel="noreferrer"
            >
              {{ variable.value ?? 'null' }}
            </RouterLink>
            <template v-else-if="nodeId && contractIdArrayValues(variable.kind, variable.value).length > 0">
              [
              <template
                v-for="(contractId, index) in contractIdArrayValues(variable.kind, variable.value)"
                :key="`${scope.frameId ?? 'scope'}:${variable.name ?? 'variable'}:${contractId}`"
              >
                <RouterLink
                  class="debugger-scope-panel__value-link"
                  :to="contractTarget('contractId', contractId) ?? ''"
                  target="_blank"
                  rel="noreferrer"
                >
                  {{ contractId }}
                </RouterLink>
                <template v-if="index < contractIdArrayValues(variable.kind, variable.value).length - 1">, </template>
              </template>
              ]
            </template>
            <RouterLink
              v-else-if="partyTarget(variable.kind, variable.value)"
              class="debugger-scope-panel__value-link"
              :to="partyTarget(variable.kind, variable.value) ?? ''"
              target="_blank"
              rel="noreferrer"
            >
              {{ variable.value ?? 'null' }}
            </RouterLink>
            <template v-else>
              {{ variable.value ?? 'null' }}
            </template>
            </code>
            <div
              v-if="showsContractType(variable.kind, variable.contractType)"
              class="debugger-scope-panel__contract-type"
            >
              <RouterLink
                v-if="templateTarget(variable.contractType)"
                class="debugger-scope-panel__value-link"
                :to="templateTarget(variable.contractType) ?? ''"
                target="_blank"
                rel="noreferrer"
              >
                {{ variable.contractType }}
              </RouterLink>
              <template v-else>
                {{ variable.contractType }}
              </template>
            </div>
          </div>
        </li>
      </ul>

      <p v-else-if="!isCollapsed(scope)" class="debugger-scope-panel__empty">No variables in this frame.</p>
    </div>
  </section>
</template>
