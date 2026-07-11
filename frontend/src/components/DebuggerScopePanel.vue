<script setup lang="ts">
import { ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import type { DebuggerScope } from '../types/debugger';

const props = defineProps<{
  scopes: DebuggerScope[];
  nodeId?: string | null;
}>();

const collapsedScopeKeys = ref<Set<string>>(new Set());

function formatVariableName(name: string | null | undefined, kind: string | null | undefined): string {
  if (kind === 'contractId' && name === 'selfContractId') {
    return 'self';
  }

  return name ?? 'value';
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

function partyTarget(kind: string | null | undefined, value: string | null | undefined): string | null {
  if (kind !== 'party' || !value) {
    return null;
  }

  return `/parties/${encodeURIComponent(value)}`;
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

    <p v-if="scopes.length === 0" class="debugger-scope-panel__empty">
      No scoped variables are available at this step.
    </p>

    <div v-for="scope in scopes" :key="scopeKey(scope)" class="debugger-scope-panel__scope">
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
            <span class="debugger-scope-panel__kind">{{ variable.kind ?? 'value' }}</span>
          </div>
          <div class="debugger-scope-panel__value-block">
            <code>
            <RouterLink
              v-if="contractTarget(variable.kind, variable.value)"
              class="debugger-scope-panel__value-link"
              :to="contractTarget(variable.kind, variable.value) ?? ''"
              target="_blank"
              rel="noreferrer"
            >
              {{ variable.value ?? 'null' }}
            </RouterLink>
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
              v-if="variable.kind === 'contractId' && variable.contractType"
              class="debugger-scope-panel__contract-type"
            >
              {{ variable.contractType }}
            </div>
          </div>
        </li>
      </ul>

      <p v-else-if="!isCollapsed(scope)" class="debugger-scope-panel__empty">No variables in this frame.</p>
    </div>
  </section>
</template>
