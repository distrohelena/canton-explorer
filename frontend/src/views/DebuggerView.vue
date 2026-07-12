<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { CSSProperties } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import DebuggerControlPanel from '../components/DebuggerControlPanel.vue';
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
const controlPanel = ref<HTMLElement | null>(null);
const editorWidth = ref<number | null>(null);
const viewportWidth = ref(typeof window === 'undefined' ? 1280 : window.innerWidth);
const controlPanelPosition = ref<{ x: number; y: number } | null>(null);
let themeObserver: MutationObserver | null = null;
let resizePointerId: number | null = null;
let controlPanelPointerId: number | null = null;
let controlPanelDragOffsetX = 0;
let controlPanelDragOffsetY = 0;

const RESIZE_HANDLE_WIDTH = 14;
const SUMMARY_MIN_WIDTH = 320;
const EDITOR_MIN_WIDTH = 420;
const EDITOR_RESIZE_STEP = 48;
const CONTROL_PANEL_INSET = 16;

function syncTheme() {
  theme.value = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

const isCompactWorkspace = computed(() => viewportWidth.value <= 980);

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

function clampControlPanelPosition(nextPosition: { x: number; y: number }) {
  const workspaceElement = workspace.value;
  const panelElement = controlPanel.value;

  if (!workspaceElement || !panelElement) {
    return nextPosition;
  }

  const maxX = Math.max(
    CONTROL_PANEL_INSET,
    workspaceElement.clientWidth - panelElement.offsetWidth - CONTROL_PANEL_INSET,
  );
  const maxY = Math.max(
    CONTROL_PANEL_INSET,
    workspaceElement.clientHeight - panelElement.offsetHeight - CONTROL_PANEL_INSET,
  );

  return {
    x: Math.min(Math.max(nextPosition.x, CONTROL_PANEL_INSET), maxX),
    y: Math.min(Math.max(nextPosition.y, CONTROL_PANEL_INSET), maxY),
  };
}

function ensureDefaultControlPanelPosition() {
  if (isCompactWorkspace.value) {
    return;
  }

  const workspaceElement = workspace.value;
  const panelElement = controlPanel.value;

  if (!workspaceElement || !panelElement) {
    return;
  }

  const centeredX = Math.max(
    CONTROL_PANEL_INSET,
    Math.round((workspaceElement.clientWidth - panelElement.offsetWidth) / 2),
  );

  controlPanelPosition.value = clampControlPanelPosition({
    x: centeredX,
    y: CONTROL_PANEL_INSET,
  });
}

function releaseControlPanelDrag() {
  controlPanelPointerId = null;
  window.removeEventListener('pointermove', handleControlPanelPointerMove);
  window.removeEventListener('pointerup', handleControlPanelPointerUp);
  window.removeEventListener('pointercancel', handleControlPanelPointerUp);
  document.body.classList.remove('debugger-view--dragging-panel');
}

function handleControlPanelPointerMove(event: PointerEvent) {
  const workspaceElement = workspace.value;

  if (!workspaceElement) {
    return;
  }

  const bounds = workspaceElement.getBoundingClientRect();
  controlPanelPosition.value = clampControlPanelPosition({
    x: event.clientX - bounds.left - controlPanelDragOffsetX,
    y: event.clientY - bounds.top - controlPanelDragOffsetY,
  });
}

function handleControlPanelPointerUp(event?: PointerEvent) {
  if (event && controlPanelPointerId !== null && event.pointerId !== controlPanelPointerId) {
    return;
  }

  releaseControlPanelDrag();
}

function beginControlPanelDrag(event: PointerEvent) {
  if (isCompactWorkspace.value || !controlPanel.value) {
    return;
  }

  const panelBounds = controlPanel.value.getBoundingClientRect();
  controlPanelPointerId = event.pointerId;
  controlPanelDragOffsetX = event.clientX - panelBounds.left;
  controlPanelDragOffsetY = event.clientY - panelBounds.top;
  document.body.classList.add('debugger-view--dragging-panel');
  window.addEventListener('pointermove', handleControlPanelPointerMove);
  window.addEventListener('pointerup', handleControlPanelPointerUp);
  window.addEventListener('pointercancel', handleControlPanelPointerUp);
}

function handleViewportResize() {
  viewportWidth.value = window.innerWidth;

  if (isCompactWorkspace.value) {
    releaseControlPanelDrag();
    return;
  }

  if (controlPanelPosition.value === null) {
    void nextTick().then(() => {
      ensureDefaultControlPanelPosition();
    });
    return;
  }

  controlPanelPosition.value = clampControlPanelPosition(controlPanelPosition.value);
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

const updateDetailTarget = computed(() => {
  if (!session.value?.nodeId || !session.value.offset) {
    return null;
  }

  return `/nodes/${encodeURIComponent(session.value.nodeId)}/updates/${encodeURIComponent(session.value.offset)}`;
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

const controlPanelStyle = computed<CSSProperties>(() => {
  if (isCompactWorkspace.value) {
    return {
      top: `${CONTROL_PANEL_INSET}px`,
      left: `${CONTROL_PANEL_INSET}px`,
      right: `${CONTROL_PANEL_INSET}px`,
    };
  }

  if (controlPanelPosition.value === null) {
    return {
      visibility: 'hidden' as const,
    };
  }

  return {
    left: `${controlPanelPosition.value.x}px`,
    top: `${controlPanelPosition.value.y}px`,
  };
});

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
  controlPanelPosition.value = null;
  void loadDebuggerSession();
});

watch(
  () => session.value?.sessionId,
  async (nextSessionId) => {
    if (!nextSessionId) {
      return;
    }

    await nextTick();
    ensureDefaultControlPanelPosition();
  },
);

onMounted(() => {
  syncTheme();
  viewportWidth.value = window.innerWidth;
  themeObserver = new MutationObserver(() => {
    syncTheme();
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  window.addEventListener('resize', handleViewportResize);
  void loadDebuggerSession();
});

onBeforeUnmount(() => {
  themeObserver?.disconnect();
  releaseResize();
  releaseControlPanelDrag();
  window.removeEventListener('resize', handleViewportResize);
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
      <div
        ref="controlPanel"
        class="debugger-view__floating-controls"
        :style="controlPanelStyle"
        data-testid="debugger-floating-controls"
      >
        <DebuggerControlPanel
          :action-loading="actionLoading"
          :is-terminal="session.isTerminal"
          :current-step-index="session.currentStepIndex"
          @drag-start="beginControlPanelDrag"
          @refresh="refreshSession"
          @action="runAction"
        />
      </div>

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
        <div class="debugger-view__summary-columns">
          <div class="debugger-view__summary-column debugger-view__summary-column--context" data-testid="debugger-summary-context">
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
                <dd class="update-detail__id">
                  <RouterLink
                    v-if="updateDetailTarget"
                    class="update-detail__debug-action"
                    :to="updateDetailTarget"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {{ session.offset }}
                  </RouterLink>
                  <span v-else>{{ session.offset }}</span>
                </dd>
              </div>
              <div class="debugger-view__summary-item debugger-view__summary-item--canonical">
                <dt>Canonical Update ID</dt>
                <dd class="update-detail__canonical">
                  <RouterLink
                    v-if="updateDetailTarget && (session.updateId ?? updateId)"
                    class="update-detail__debug-action"
                    :to="updateDetailTarget"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {{ session.updateId ?? updateId }}
                  </RouterLink>
                  <span v-else>{{ session.updateId ?? updateId ?? 'n/a' }}</span>
                </dd>
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

            <DebuggerScopePanel :scopes="currentScopes" :node-id="session.nodeId" />
          </div>

          <div class="debugger-view__summary-column debugger-view__summary-column--events" data-testid="debugger-summary-events">
            <DebuggerEventList
              :real-events="realLedgerEvents"
              :replay-events="liveReplayEvents"
              :current-step-id="session.currentStep.stepId"
              :loading="eventLoading"
              @select-step="selectEventStep"
            />
          </div>
        </div>
      </aside>
    </div>
  </section>
</template>
