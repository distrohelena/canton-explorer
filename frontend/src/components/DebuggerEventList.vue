<script setup lang="ts">
import { computed, ref } from 'vue';
import type { DebuggerReplayEventSummary } from '../types/debugger';

const props = defineProps<{
  realEvents: DebuggerReplayEventSummary[];
  replayEvents: DebuggerReplayEventSummary[];
  currentStepId: string | null;
  loading?: boolean;
}>();

const emit = defineEmits<{
  selectStep: [stepId: string];
}>();

const activeTab = ref<'real' | 'replay'>('real');

const visibleCount = computed(() =>
  activeTab.value === 'real' ? props.realEvents.length : props.replayEvents.length,
);

function describeEvent(event: DebuggerReplayEventSummary): string {
  const templateName = event.templateId?.entityName ?? 'unknown-template';
  const choice = event.choice ? `.${event.choice}` : '';
  const contractId = event.targetContractId ?? event.createdContractId;

  return [event.kind ?? 'event', `${templateName}${choice}`, contractId].filter(Boolean).join(' ');
}

function selectEvent(stepId: string | null) {
  if (stepId) {
    emit('selectStep', stepId);
  }
}
</script>

<template>
  <section class="debugger-event-list" data-testid="debugger-event-list">
    <div class="debugger-event-list__header">
      <h3>Ledger Events</h3>
      <span class="debugger-event-list__count">{{ visibleCount }} events</span>
    </div>

    <div class="debugger-event-list__tabs" role="tablist" aria-label="Ledger event views">
      <button
        type="button"
        role="tab"
        class="debugger-event-list__tab"
        :class="{ 'debugger-event-list__tab--active': activeTab === 'real' }"
        :aria-selected="activeTab === 'real'"
        @click="activeTab = 'real'"
      >
        Real Events
      </button>
      <button
        type="button"
        role="tab"
        class="debugger-event-list__tab"
        :class="{ 'debugger-event-list__tab--active': activeTab === 'replay' }"
        :aria-selected="activeTab === 'replay'"
        @click="activeTab = 'replay'"
      >
        Replay Events
      </button>
    </div>

    <p v-if="loading" class="debugger-event-list__empty">Loading ledger events…</p>
    <p v-else-if="activeTab === 'real' && realEvents.length === 0" class="debugger-event-list__empty">
      No real ledger events are available for this update.
    </p>
    <p v-else-if="activeTab === 'replay' && replayEvents.length === 0" class="debugger-event-list__empty">
      No replay ledger events were emitted in this session.
    </p>

    <ol v-else-if="activeTab === 'real'" class="debugger-event-list__items">
      <li
        v-for="event in props.realEvents"
        :key="event.stepId ?? `real-event-${event.stepIndex}`"
        class="debugger-event-list__item"
      >
        <button
          type="button"
          class="debugger-event-list__button"
          :class="{ 'debugger-event-list__button--active': event.stepId === currentStepId }"
          :data-testid="`real-debugger-event-${event.stepIndex}`"
          @click="selectEvent(event.stepId)"
        >
          <span class="debugger-event-list__ordinal">#{{ event.eventOrdinal ?? event.stepIndex }}</span>
          <span class="debugger-event-list__summary">{{ describeEvent(event) }}</span>
          <span class="debugger-event-list__location">
            {{ event.sourceLocation?.startLine ?? 'n/a' }}
          </span>
        </button>
      </li>
    </ol>

    <ol v-else class="debugger-event-list__items">
      <li
        v-for="event in props.replayEvents"
        :key="event.stepId ?? `event-${event.stepIndex}`"
        class="debugger-event-list__item"
      >
        <button
          type="button"
          class="debugger-event-list__button"
          :class="{ 'debugger-event-list__button--active': event.stepId === currentStepId }"
          :data-testid="`debugger-event-${event.stepIndex}`"
          @click="selectEvent(event.stepId)"
        >
          <span class="debugger-event-list__ordinal">#{{ event.eventOrdinal ?? event.stepIndex }}</span>
          <span class="debugger-event-list__summary">{{ describeEvent(event) }}</span>
          <span class="debugger-event-list__location">
            {{ event.sourceLocation?.startLine ?? 'n/a' }}
          </span>
        </button>
      </li>
    </ol>
  </section>
</template>
