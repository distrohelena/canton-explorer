<script setup lang="ts">
import { computed, ref, watch } from 'vue';
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
const expandedReplayEventKeys = ref<Set<string>>(new Set());

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

function replayEventKey(event: DebuggerReplayEventSummary): string {
  return event.stepId ?? `event-${event.stepIndex}`;
}

function isReplayEventExpanded(event: DebuggerReplayEventSummary): boolean {
  return expandedReplayEventKeys.value.has(replayEventKey(event));
}

function toggleReplayEvent(event: DebuggerReplayEventSummary): void {
  const nextKeys = new Set(expandedReplayEventKeys.value);
  const key = replayEventKey(event);

  if (nextKeys.has(key)) {
    nextKeys.delete(key);
  } else {
    nextKeys.add(key);
  }

  expandedReplayEventKeys.value = nextKeys;
}

function formatEventValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'n/a';
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

watch(
  () => props.replayEvents.map((event) => replayEventKey(event)),
  (nextKeys) => {
    const nextKeySet = new Set(nextKeys);
    expandedReplayEventKeys.value = new Set(
      [...expandedReplayEventKeys.value].filter((key) => nextKeySet.has(key)),
    );
  },
);
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
        :key="replayEventKey(event)"
        class="debugger-event-list__item"
      >
        <button
          type="button"
          class="debugger-event-list__button"
          :class="{ 'debugger-event-list__button--expanded': isReplayEventExpanded(event) }"
          :data-testid="`debugger-event-${event.stepIndex}`"
          :aria-expanded="isReplayEventExpanded(event)"
          @click="toggleReplayEvent(event)"
        >
          <span class="debugger-event-list__ordinal">#{{ event.eventOrdinal ?? event.stepIndex }}</span>
          <span class="debugger-event-list__summary">{{ describeEvent(event) }}</span>
          <span class="debugger-event-list__location">
            {{ event.sourceLocation?.startLine ?? 'n/a' }}
          </span>
        </button>

        <div
          v-if="isReplayEventExpanded(event)"
          class="debugger-event-list__details"
          :data-testid="`debugger-event-details-${event.stepIndex}`"
        >
          <dl class="debugger-event-list__detail-grid">
            <div>
              <dt>Kind</dt>
              <dd>{{ event.kind ?? 'n/a' }}</dd>
            </div>
            <div>
              <dt>Template</dt>
              <dd>{{ event.templateId?.entityName ?? 'n/a' }}</dd>
            </div>
            <div>
              <dt>Choice</dt>
              <dd>{{ event.choice ?? 'n/a' }}</dd>
            </div>
            <div>
              <dt>Contract</dt>
              <dd>{{ event.targetContractId ?? event.createdContractId ?? 'n/a' }}</dd>
            </div>
            <div>
              <dt>Phase</dt>
              <dd>{{ event.phase }}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{{ event.sourceLocation?.startLine ?? 'n/a' }}</dd>
            </div>
          </dl>

          <div class="debugger-event-list__detail-block">
            <h4>Choice Argument</h4>
            <pre>{{ formatEventValue(event.choiceArgument) }}</pre>
          </div>

          <div class="debugger-event-list__detail-block">
            <h4>Payload</h4>
            <pre>{{ formatEventValue(event.payload) }}</pre>
          </div>
        </div>
      </li>
    </ol>
  </section>
</template>
