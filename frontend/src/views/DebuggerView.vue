<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import DebuggerEventList from '../components/DebuggerEventList.vue';
import DebuggerScopePanel from '../components/DebuggerScopePanel.vue';
import MonacoCodeSurface from '../components/MonacoCodeSurface.vue';
import {
  createDebuggerSession,
  fetchDebuggerEvents,
  fetchDebuggerSession,
  jumpDebuggerSessionToStep,
  stepDebuggerSession,
} from '../lib/api';
import type {
  DebuggerReplayEventSummary,
  DebuggerSessionResponse,
} from '../types/debugger';

const route = useRoute();
const theme = ref<'light' | 'dark'>('dark');
const session = ref<DebuggerSessionResponse | null>(null);
const replayEvents = ref<DebuggerReplayEventSummary[]>([]);
const loading = ref(false);
const actionLoading = ref(false);
const eventLoading = ref(false);
const error = ref<string | null>(null);
const workspace = ref<HTMLElement | null>(null);
const editorWidth = ref<number | null>(null);
let themeObserver: MutationObserver | null = null;
let resizePointerId: number | null = null;

const RESIZE_HANDLE_WIDTH = 14;
const SUMMARY_MIN_WIDTH = 320;
const EDITOR_MIN_WIDTH = 420;
const EDITOR_RESIZE_STEP = 48;

function syncTheme() {
  theme.value = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function clampEditorWidth(nextWidth: number) {
  const workspaceElement = workspace.value;

  if (!workspaceElement) {
    return nextWidth;
  }

  const maxWidth = Math.max(
    EDITOR_MIN_WIDTH,
    workspaceElement.clientWidth - SUMMARY_MIN_WIDTH - RESIZE_HANDLE_WIDTH,
  );

  return Math.min(Math.max(nextWidth, EDITOR_MIN_WIDTH), maxWidth);
}

function setEditorWidth(nextWidth: number) {
  editorWidth.value = clampEditorWidth(nextWidth);
}

function releaseResize() {
  resizePointerId = null;
  window.removeEventListener('pointermove', handleResizePointerMove);
  window.removeEventListener('pointerup', handleResizePointerUp);
  window.removeEventListener('pointercancel', handleResizePointerUp);
  document.body.classList.remove('debugger-view--resizing');
}

function handleResizePointerMove(event: PointerEvent) {
  const workspaceElement = workspace.value;

  if (!workspaceElement) {
    return;
  }

  const bounds = workspaceElement.getBoundingClientRect();
  setEditorWidth(event.clientX - bounds.left);
}

function handleResizePointerUp(event?: PointerEvent) {
  if (event && resizePointerId !== null && event.pointerId !== resizePointerId) {
    return;
  }

  releaseResize();
}

function beginResize(event: PointerEvent) {
  if (window.innerWidth <= 980) {
    return;
  }

  resizePointerId = event.pointerId;
  document.body.classList.add('debugger-view--resizing');
  window.addEventListener('pointermove', handleResizePointerMove);
  window.addEventListener('pointerup', handleResizePointerUp);
  window.addEventListener('pointercancel', handleResizePointerUp);
  handleResizePointerMove(event);
}

function resizeEditorBy(delta: number) {
  const workspaceElement = workspace.value;

  if (!workspaceElement) {
    return;
  }

  const fallbackWidth = Math.max(
    EDITOR_MIN_WIDTH,
    Math.round((workspaceElement.clientWidth - RESIZE_HANDLE_WIDTH) * 0.6),
  );
  setEditorWidth((editorWidth.value ?? fallbackWidth) + delta);
}

function handleResizeKeydown(event: KeyboardEvent) {
  if (window.innerWidth <= 980) {
    return;
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    resizeEditorBy(-EDITOR_RESIZE_STEP);
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault();
    resizeEditorBy(EDITOR_RESIZE_STEP);
  }
}

const nodeId = computed(() => {
  const value = route.query.nodeId;
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
});

const updateId = computed(() => {
  const value = route.query.updateId;
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
});

const eventOffset = computed(() => {
  const value = route.query.eventOffset;
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
});

const sourceText = computed(() => {
  if (session.value?.source?.content) {
    return session.value.source.content;
  }

  if (!session.value) {
    return '';
  }

  return JSON.stringify(session.value.currentStep, null, 2);
});

const sourceLanguage = computed(() => {
  const path = session.value?.source?.path?.toLowerCase() ?? '';
  return path.endsWith('.daml') ? 'daml' : 'plaintext';
});

const highlightRange = computed(() => {
  const source = session.value?.source;
  if (
    !source
    || source.startLine === null
    || source.startColumn === null
    || source.endLine === null
    || source.endColumn === null
  ) {
    return null;
  }

  return {
    startLine: source.startLine,
    startColumn: source.startColumn,
    endLine: source.endLine,
    endColumn: source.endColumn,
  };
});

const stepLabel = computed(() => {
  if (!session.value) {
    return 'Not loaded';
  }

  return `${session.value.currentStepIndex + 1} / ${Math.max(1, session.value.stepCount)}`;
});

const phaseLabel = computed(() => {
  if (!session.value) {
    return 'n/a';
  }

  return session.value.currentStep.phase
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (character) => character.toUpperCase());
});

const currentScopes = computed(() => session.value?.currentStep.scopes ?? []);
const realLedgerEvents = computed(() => replayEvents.value);
const liveReplayEvents = computed(() => {
  if (!session.value) {
    return [];
  }

  return replayEvents.value.filter(
    (event) => event.stepIndex <= session.value!.currentStepIndex,
  );
});

const workspaceStyle = computed(() =>
  editorWidth.value === null
    ? undefined
    : {
        gridTemplateColumns: `${editorWidth.value}px ${RESIZE_HANDLE_WIDTH}px minmax(${SUMMARY_MIN_WIDTH}px, 1fr)`,
      },
);

async function syncEvents(sessionId: string) {
  eventLoading.value = true;

  try {
    const response = await fetchDebuggerEvents(sessionId);
    replayEvents.value = response.replayEvents;
  } finally {
    eventLoading.value = false;
  }
}

async function loadDebuggerSession() {
  if (!nodeId.value || !eventOffset.value) {
    session.value = null;
    error.value = 'Open the debugger from an update detail page to launch a replay session.';
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const nextSession = await createDebuggerSession(nodeId.value, eventOffset.value);
    session.value = nextSession;
    await syncEvents(nextSession.sessionId);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
    session.value = null;
    replayEvents.value = [];
  } finally {
    loading.value = false;
  }
}

async function runAction(
  action: 'step-back' | 'step-into' | 'step-over' | 'step-out' | 'continue',
) {
  if (!session.value?.sessionId) {
    return;
  }

  actionLoading.value = true;
  error.value = null;

  try {
    const nextSession = await stepDebuggerSession(session.value.sessionId, action);
    session.value = nextSession;
    await syncEvents(nextSession.sessionId);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
  } finally {
    actionLoading.value = false;
  }
}

async function refreshSession() {
  if (!session.value?.sessionId) {
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const nextSession = await fetchDebuggerSession(session.value.sessionId);
    session.value = nextSession;
    await syncEvents(nextSession.sessionId);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
  } finally {
    loading.value = false;
  }
}

async function selectEventStep(stepId: string) {
  if (!session.value?.sessionId) {
    return;
  }

  actionLoading.value = true;
  error.value = null;

  try {
    const nextSession = await jumpDebuggerSessionToStep(session.value.sessionId, stepId);
    session.value = nextSession;
    await syncEvents(nextSession.sessionId);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
  } finally {
    actionLoading.value = false;
  }
}

watch([nodeId, eventOffset], () => {
  void loadDebuggerSession();
});

onMounted(() => {
  syncTheme();
  themeObserver = new MutationObserver(() => {
    syncTheme();
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  void loadDebuggerSession();
});

onBeforeUnmount(() => {
  themeObserver?.disconnect();
  releaseResize();
});
</script>

<template>
  <section class="debugger-view">
    <p v-if="error" class="node-detail__message node-detail__message--error">{{ error }}</p>
    <p v-else-if="loading && !session" class="node-detail__message">Loading debugger session...</p>

    <div
      v-if="session"
      ref="workspace"
      class="debugger-view__workspace"
      :style="workspaceStyle"
      data-testid="debugger-workspace"
    >
      <section class="debugger-view__editor-shell" data-testid="debugger-editor-shell">
        <MonacoCodeSurface
          :model-value="sourceText"
          :theme="theme"
          :language="sourceLanguage"
          :highlight-range="highlightRange"
          aria-label="DAML debugger code surface"
        />
      </section>

      <div
        class="debugger-view__divider"
        role="separator"
        aria-label="Resize editor panel"
        aria-orientation="vertical"
        tabindex="0"
        data-testid="debugger-editor-divider"
        @pointerdown="beginResize"
        @keydown="handleResizeKeydown"
      />

      <aside class="debugger-view__summary" data-testid="debugger-summary">
        <div class="debugger-view__summary-header">
          <div class="debugger-view__panel-meta">
            <div class="debugger-view__signal-row">
              <span class="debugger-view__signal">Replay Session</span>
              <span class="debugger-view__status">{{ stepLabel }}</span>
              <span class="debugger-view__status">{{ phaseLabel }}</span>
            </div>
            <h2>Launch Context</h2>
          </div>
        </div>

        <div class="debugger-view__summary-section">
          <h3>Execution Script</h3>
          <p class="debugger-view__panel-copy">
            {{ session.source?.path ?? 'Source mapping unavailable for this step.' }}
          </p>
        </div>

        <dl class="detail-grid debugger-view__summary-grid">
          <div>
            <dt>Node</dt>
            <dd>{{ session.nodeId }}</dd>
          </div>
          <div>
            <dt>Event Offset</dt>
            <dd class="update-detail__id">{{ session.offset }}</dd>
          </div>
          <div>
            <dt>Canonical Update ID</dt>
            <dd class="update-detail__canonical">{{ session.updateId ?? updateId ?? 'n/a' }}</dd>
          </div>
          <div>
            <dt>Session</dt>
            <dd class="update-detail__canonical">{{ session.sessionId }}</dd>
          </div>
          <div>
            <dt>Step</dt>
            <dd>{{ stepLabel }}</dd>
          </div>
          <div>
            <dt>Phase</dt>
            <dd>{{ phaseLabel }}</dd>
          </div>
        </dl>

        <div class="debugger-view__actions">
          <button
            type="button"
            class="node-updates__filter-toggle debugger-view__action-button"
            :disabled="actionLoading || session.currentStepIndex <= 0"
            @click="runAction('step-back')"
          >
            Step Back
          </button>
          <button
            type="button"
            class="node-updates__filter-toggle debugger-view__action-button"
            :disabled="actionLoading"
            @click="refreshSession"
          >
            Refresh
          </button>
          <button
            type="button"
            class="node-updates__filter-toggle debugger-view__action-button"
            :disabled="actionLoading || session.isTerminal"
            @click="runAction('step-into')"
          >
            Step Into
          </button>
          <button
            type="button"
            class="node-updates__filter-toggle debugger-view__action-button"
            :disabled="actionLoading || session.isTerminal"
            @click="runAction('step-over')"
          >
            Step Over
          </button>
          <button
            type="button"
            class="node-updates__filter-toggle debugger-view__action-button"
            :disabled="actionLoading || session.isTerminal"
            @click="runAction('step-out')"
          >
            Step Out
          </button>
          <button
            type="button"
            class="node-updates__filter-toggle debugger-view__action-button"
            :disabled="actionLoading || session.isTerminal"
            @click="runAction('continue')"
          >
            Continue
          </button>
        </div>

        <DebuggerScopePanel :scopes="currentScopes" />
        <DebuggerEventList
          :real-events="realLedgerEvents"
          :replay-events="liveReplayEvents"
          :current-step-id="session.currentStep.stepId"
          :loading="eventLoading"
          @select-step="selectEventStep"
        />
      </aside>
    </div>
  </section>
</template>
