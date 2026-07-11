<script setup lang="ts">
import type { DebuggerScope } from '../types/debugger';

defineProps<{
  scopes: DebuggerScope[];
}>();

function formatVariableName(name: string | null | undefined, kind: string | null | undefined): string {
  if (kind === 'contractId' && name === 'selfContractId') {
    return 'self';
  }

  return name ?? 'value';
}
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

    <div v-for="scope in scopes" :key="scope.frameId ?? scope.name ?? 'scope'" class="debugger-scope-panel__scope">
      <div class="debugger-scope-panel__scope-header">
        <h4>{{ scope.name ?? scope.frameId ?? 'Frame' }}</h4>
        <span class="debugger-scope-panel__scope-id">{{ scope.frameId ?? 'anonymous' }}</span>
      </div>

      <ul v-if="scope.variables.length > 0" class="debugger-scope-panel__variables">
        <li
          v-for="variable in scope.variables"
          :key="`${scope.frameId ?? 'scope'}:${variable.name ?? 'variable'}`"
          class="debugger-scope-panel__variable"
        >
          <div class="debugger-scope-panel__variable-meta">
            <strong>{{ formatVariableName(variable.name, variable.kind) }}</strong>
            <span class="debugger-scope-panel__kind">{{ variable.kind ?? 'value' }}</span>
          </div>
          <code>{{ variable.value ?? 'null' }}</code>
        </li>
      </ul>

      <p v-else class="debugger-scope-panel__empty">No variables in this frame.</p>
    </div>
  </section>
</template>
