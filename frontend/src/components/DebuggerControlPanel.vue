<script setup lang="ts">
defineProps<{
  actionLoading: boolean;
  isTerminal: boolean;
  currentStepIndex: number;
}>();

defineEmits<{
  (event: 'drag-start', pointerEvent: PointerEvent): void;
  (event: 'refresh'): void;
  (
    event: 'action',
    action: 'step-back' | 'step-into' | 'step-over' | 'step-out' | 'continue',
  ): void;
}>();
</script>

<template>
  <section class="debugger-control-panel" data-testid="debugger-control-panel" aria-label="Debugger controls">
    <div
      class="debugger-control-panel__handle"
      data-testid="debugger-control-panel-handle"
      @pointerdown.stop.prevent="$emit('drag-start', $event)"
    >
      <span class="debugger-control-panel__title">Replay Controls</span>
      <span class="debugger-control-panel__meta">drag to reposition</span>
    </div>

    <div class="debugger-control-panel__actions">
      <button
        type="button"
        class="debugger-control-panel__button"
        :disabled="actionLoading || currentStepIndex <= 0"
        @click="$emit('action', 'step-back')"
      >
        Step Back
      </button>
      <button
        type="button"
        class="debugger-control-panel__button"
        :disabled="actionLoading"
        @click="$emit('refresh')"
      >
        Refresh
      </button>
      <button
        type="button"
        class="debugger-control-panel__button"
        :disabled="actionLoading || isTerminal"
        @click="$emit('action', 'step-into')"
      >
        Step Into
      </button>
      <button
        type="button"
        class="debugger-control-panel__button"
        :disabled="actionLoading || isTerminal"
        @click="$emit('action', 'step-over')"
      >
        Step Over
      </button>
      <button
        type="button"
        class="debugger-control-panel__button"
        :disabled="actionLoading || isTerminal"
        @click="$emit('action', 'step-out')"
      >
        Step Out
      </button>
      <button
        type="button"
        class="debugger-control-panel__button"
        :disabled="actionLoading || isTerminal"
        @click="$emit('action', 'continue')"
      >
        Continue
      </button>
    </div>
  </section>
</template>
