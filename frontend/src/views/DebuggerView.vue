<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { CSSProperties } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import type { LocationQueryRaw } from 'vue-router';
import DebuggerControlPanel from '../components/DebuggerControlPanel.vue';
import DebuggerEventList from '../components/DebuggerEventList.vue';
import DebuggerScopePanel from '../components/DebuggerScopePanel.vue';
import DebuggerTemplatePicker from '../components/DebuggerTemplatePicker.vue';
import type {
  DebuggerTemplateOption,
  DebuggerSimulationKind,
  DebuggerTemplateSelection,
} from '../components/DebuggerTemplatePicker.vue';
import MonacoCodeSurface from '../components/MonacoCodeSurface.vue';
import type { MonacoDebuggerHoverVariable } from '../components/MonacoCodeSurface.vue';
import {
  createDebuggerSession,
  fetchDebuggerSessions,
  fetchNodeContracts,
  fetchNodeTemplates,
  fetchNodes,
  fetchDebuggerEvents,
  fetchDebuggerSession,
  jumpDebuggerSessionToStep,
  stepDebuggerSession,
} from '../lib/api';
import { resolveDamlFunctionVariableRanges } from '../lib/daml-hover-resolution';
import { resolveDefaultControlPanelX } from '../lib/debugger-layout';
import type {
  DebuggerReplayEventSummary,
  DebuggerSessionResponse,
  DebuggerSessionSummary,
  DebuggerSourceLocation,
} from '../types/debugger';
import type { NodeSnapshot } from '../types/nodes';
import type { NodeActiveContractSummary } from '../types/contracts';

interface DebuggerSourceTab {
  readonly path: string;
  readonly content: string;
  readonly language: 'daml' | 'plaintext';
  readonly highlightRange: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  } | null;
}

interface DebuggerTemplateGroup {
  nodeId: string;
  label: string;
  mode: NodeSnapshot['mode'];
  templates: string[];
  error: string | null;
}

const route = useRoute();
const router = useRouter();
const theme = ref<'light' | 'dark'>('dark');
const session = ref<DebuggerSessionResponse | null>(null);
const replayEvents = ref<DebuggerReplayEventSummary[]>([]);
const openSourceTabs = ref<DebuggerSourceTab[]>([]);
const activeSourcePath = ref<string | null>(null);
const loading = ref(false);
const actionLoading = ref(false);
const eventLoading = ref(false);
const error = ref<string | null>(null);
const templateLoading = ref(false);
const templateError = ref<string | null>(null);
const templateGroups = ref<DebuggerTemplateGroup[]>([]);
const selectedTemplate = ref<DebuggerTemplateSelection | null>(null);
const debuggerSessions = ref<DebuggerSessionSummary[]>([]);
const debuggerSessionsLoading = ref(false);
const debuggerSessionsError = ref<string | null>(null);
const showNewSimulation = ref(false);
const activeContracts = ref<NodeActiveContractSummary[]>([]);
const activeContractsLoading = ref(false);
const activeContractsError = ref<string | null>(null);
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
let syncingRouteFromSession = false;
let pendingLoadKey: string | null = null;

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

  controlPanelPosition.value = clampControlPanelPosition({
    x: resolveDefaultControlPanelX(
      workspaceElement.clientWidth,
      panelElement.offsetWidth,
      CONTROL_PANEL_INSET,
    ),
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

const routeSessionId = computed(() => {
  const value = route.query.sessionId;
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
});

const routeStepId = computed(() => {
  const value = route.query.stepId;
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
});

const routeReplayKey = computed(() => JSON.stringify({
  nodeId: nodeId.value,
  eventOffset: eventOffset.value,
  sessionId: routeSessionId.value,
  stepId: routeStepId.value,
}));

const hasReplayContext = computed(() => Boolean(nodeId.value && eventOffset.value));

const templateOptions = computed<DebuggerTemplateOption[]>(() =>
  templateGroups.value.flatMap((group) =>
    group.error
      ? []
      : group.templates.map((templateId) => ({
        templateId,
        nodeId: group.nodeId,
        nodeLabel: group.label,
        mode: group.mode,
      })),
  ),
);

function selectTemplate(selection: DebuggerTemplateSelection) {
  selectedTemplate.value = selection;
}

async function loadActiveContracts(nodeId: string, simulationKind: DebuggerSimulationKind) {
  activeContracts.value = [];
  activeContractsError.value = null;

  if (simulationKind !== 'exercise_existing') {
    activeContractsLoading.value = false;
    return;
  }

  activeContractsLoading.value = true;

  try {
    const response = await fetchNodeContracts(nodeId, { limit: 100 });
    activeContracts.value = response.contracts;
  } catch (err) {
    activeContractsError.value = err instanceof Error ? err.message : 'Unable to load active contracts.';
  } finally {
    activeContractsLoading.value = false;
  }
}

async function loadDebuggerSessions() {
  debuggerSessionsLoading.value = true;
  debuggerSessionsError.value = null;

  try {
    debuggerSessions.value = await fetchDebuggerSessions();
  } catch (err) {
    debuggerSessions.value = [];
    debuggerSessionsError.value = err instanceof Error ? err.message : 'Unable to load debugger sessions.';
  } finally {
    debuggerSessionsLoading.value = false;
  }
}

function startNewSimulation() {
  showNewSimulation.value = true;
  void loadTemplateCatalog();
}

function returnToSessions() {
  showNewSimulation.value = false;
  void loadDebuggerSessions();
}

async function openDebuggerSession(debuggerSession: DebuggerSessionSummary) {
  await router.push({
    path: '/debugger',
    query: {
      nodeId: debuggerSession.nodeId,
      ...(debuggerSession.updateId ? { updateId: debuggerSession.updateId } : {}),
      eventOffset: debuggerSession.offset,
      sessionId: debuggerSession.sessionId,
    },
  });
}

function resolveSourceLanguage(path: string | null | undefined): 'daml' | 'plaintext' {
  return path?.toLowerCase().endsWith('.daml') ? 'daml' : 'plaintext';
}

function normalizeSourcePath(path: string | null | undefined): string | null {
  return path ? path.replace(/\\/g, '/') : null;
}

function isCompleteSourceLocation(
  location: DebuggerSourceLocation | null | undefined,
): location is DebuggerSourceLocation & {
  path: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
} {
  return Boolean(
    location?.path
    && typeof location.startLine === 'number'
    && typeof location.startColumn === 'number'
    && typeof location.endLine === 'number'
    && typeof location.endColumn === 'number',
  );
}

function buildHoverRange(
  location: DebuggerSourceLocation & {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  },
): MonacoDebuggerHoverVariable['range'] {
  return {
    startLine: location.startLine,
    startColumn: location.startColumn,
    endLine: location.endLine,
    endColumn: location.endColumn,
  };
}

function rangesMatch(
  left: MonacoDebuggerHoverVariable['range'],
  right: MonacoDebuggerHoverVariable['range'],
): boolean {
  return left.startLine === right.startLine
    && left.startColumn === right.startColumn
    && left.endLine === right.endLine
    && left.endColumn === right.endColumn;
}

function findProvableExactIdentifierRanges(
  content: string,
  location: DebuggerSourceLocation & {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  },
): Array<{
  name: string;
  range: MonacoDebuggerHoverVariable['range'];
}> {
  if (location.startLine !== location.endLine) {
    return [];
  }

  const lines = content.split(/\r?\n/u);
  const line = lines[location.startLine - 1];

  if (typeof line !== 'string') {
    return [];
  }

  const startIndex = location.startColumn - 1;
  const endIndex = location.endColumn - 1;

  if (
    startIndex < 0
    || endIndex < startIndex
    || startIndex > line.length
    || endIndex > line.length
  ) {
    return [];
  }

  const exactSlice = line.slice(startIndex, endIndex);
  const matches = exactSlice.matchAll(/[A-Za-z_$][A-Za-z0-9_'$]*/gu);

  return [...matches].flatMap((match) => {
    const name = match[0];
    const relativeStartIndex = match.index;

    if (typeof relativeStartIndex !== 'number') {
      return [];
    }

    const absoluteStartIndex = startIndex + relativeStartIndex;

    if (absoluteStartIndex > 0 && line[absoluteStartIndex - 1] === '.') {
      return [];
    }

    return [
      {
        name,
        range: {
          startLine: location.startLine,
          startColumn: absoluteStartIndex + 1,
          endLine: location.endLine,
          endColumn: absoluteStartIndex + name.length + 1,
        },
      },
    ];
  });
}

function resolveSourceHighlightRange(
  source: DebuggerSessionResponse['source'],
): DebuggerSourceTab['highlightRange'] {
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
}

function rememberSessionSource(
  nextSession: DebuggerSessionResponse | null,
  options?: { reset?: boolean },
) {
  if (options?.reset) {
    openSourceTabs.value = [];
    activeSourcePath.value = null;
  }

  const source = nextSession?.source;

  if (!source?.path || typeof source.content !== 'string') {
    return;
  }

  const nextTab: DebuggerSourceTab = {
    path: source.path,
    content: source.content,
    language: resolveSourceLanguage(source.path),
    highlightRange: resolveSourceHighlightRange(source),
  };
  const existingIndex = openSourceTabs.value.findIndex((tab) => tab.path === nextTab.path);

  if (existingIndex >= 0) {
    const nextTabs = [...openSourceTabs.value];
    nextTabs.splice(existingIndex, 1, nextTab);
    openSourceTabs.value = nextTabs;
  } else {
    openSourceTabs.value = [...openSourceTabs.value, nextTab];
  }

  activeSourcePath.value = nextTab.path;
}

function formatSourceTabLabel(path: string): string {
  const normalizedPath = path.replace(/\\/g, '/');
  const segments = normalizedPath.split('/').filter((segment) => segment.length > 0);

  return segments.at(-1) ?? path;
}

function selectSourceTab(path: string) {
  activeSourcePath.value = path;
}

const activeSourceTab = computed(() =>
  openSourceTabs.value.find((tab) => tab.path === activeSourcePath.value)
  ?? openSourceTabs.value.at(-1)
  ?? null,
);

const sourceText = computed(() => {
  if (activeSourceTab.value) {
    return activeSourceTab.value.content;
  }

  if (!session.value) {
    return '';
  }

  return JSON.stringify(session.value.currentStep, null, 2);
});

const sourceLanguage = computed(() => {
  return activeSourceTab.value?.language ?? 'plaintext';
});

const highlightRange = computed(() => {
  return activeSourceTab.value?.highlightRange ?? null;
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
const hoverVariables = computed<MonacoDebuggerHoverVariable[]>(() => {
  const activeTab = activeSourceTab.value;
  const activePath = normalizeSourcePath(activeTab?.path);

  if (!activePath) {
    return [];
  }

  const directHoverVariables = currentScopes.value.flatMap((scope) =>
    scope.variables.flatMap((variable) => {
      const name = typeof variable.name === 'string' ? variable.name.trim() : '';
      const location = variable.sourceLocation;

      if (
        name.length === 0
        || variable.value === null
        || !isCompleteSourceLocation(location)
        || normalizeSourcePath(location.path) !== activePath
      ) {
        return [];
      }

      return [
        {
          name,
          kind: variable.kind,
          value: variable.value,
          contractType: variable.contractType,
          range: buildHoverRange(location),
        },
      ];
    }),
  );

  const currentStep = session.value?.currentStep;
  const currentLocation = currentStep?.sourceLocation;

  if (
    !activeTab
    || !currentStep
    || !isCompleteSourceLocation(currentLocation)
    || currentLocation.precision !== 'exact'
    || normalizeSourcePath(currentLocation.path) !== activePath
  ) {
    return directHoverVariables;
  }

  const fallbackRanges = [
    ...findProvableExactIdentifierRanges(activeTab.content, currentLocation),
    ...resolveDamlFunctionVariableRanges(
      activeTab.content,
      currentLocation.startLine,
      currentScopes.value.flatMap((scope) =>
        scope.variables.flatMap((variable) =>
          typeof variable.name === 'string' ? [variable.name] : [],
        ),
      ),
    ),
  ].filter((range, index, allRanges) =>
    allRanges.findIndex((candidate) =>
      candidate.name === range.name && rangesMatch(candidate.range, range.range),
    ) === index,
  ).sort((left, right) =>
    left.range.startLine - right.range.startLine
    || left.range.startColumn - right.range.startColumn
    || left.range.endLine - right.range.endLine
    || left.range.endColumn - right.range.endColumn,
  );

  const fallbackHoverVariables = fallbackRanges
    .flatMap(({ name, range }) => {
      const matchingVariables = currentScopes.value.flatMap((scope) =>
        scope.variables.filter((variable) => {
          const variableName = typeof variable.name === 'string' ? variable.name.trim() : '';
          return variableName === name && variable.value !== null;
        }),
      );

      if (matchingVariables.length !== 1) {
        return [];
      }

      const [matchedVariable] = matchingVariables;
      return [
        {
          name,
          kind: matchedVariable.kind,
          value: matchedVariable.value,
          contractType: matchedVariable.contractType,
          range,
        } satisfies MonacoDebuggerHoverVariable,
      ];
    })
    .filter((fallbackHoverVariable, index, allVariables) =>
      allVariables.findIndex((variable) =>
        variable.name === fallbackHoverVariable.name
        && rangesMatch(variable.range, fallbackHoverVariable.range),
      ) === index,
    )
    .filter((fallbackHoverVariable) =>
      !directHoverVariables.some((variable) =>
        variable.name === fallbackHoverVariable.name
        && rangesMatch(variable.range, fallbackHoverVariable.range),
      ),
    );

  return [...directHoverVariables, ...fallbackHoverVariables];
});
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

function buildDebuggerQuery(nextSession: DebuggerSessionResponse | null): LocationQueryRaw {
  const nextQuery: LocationQueryRaw = { ...route.query };

  if (nodeId.value) {
    nextQuery.nodeId = nodeId.value;
  } else {
    delete nextQuery.nodeId;
  }

  if (updateId.value) {
    nextQuery.updateId = updateId.value;
  } else {
    delete nextQuery.updateId;
  }

  if (eventOffset.value) {
    nextQuery.eventOffset = eventOffset.value;
  } else {
    delete nextQuery.eventOffset;
  }

  if (nextSession?.sessionId) {
    nextQuery.sessionId = nextSession.sessionId;
  } else {
    delete nextQuery.sessionId;
  }

  if (nextSession?.currentStep.stepId) {
    nextQuery.stepId = nextSession.currentStep.stepId;
  } else {
    delete nextQuery.stepId;
  }

  return nextQuery;
}

async function syncRouteToSession(nextSession: DebuggerSessionResponse | null) {
  const nextQuery = buildDebuggerQuery(nextSession);
  const queryKeys = ['nodeId', 'updateId', 'eventOffset', 'sessionId', 'stepId'] as const;
  const routeChanged = queryKeys.some((key) => {
    const currentValue = route.query[key];
    const nextValue = nextQuery[key];
    return String(currentValue ?? '') !== String(nextValue ?? '');
  });

  if (!routeChanged) {
    return;
  }

  syncingRouteFromSession = true;

  try {
    await router.replace({
      query: nextQuery,
    });
  } finally {
    syncingRouteFromSession = false;
  }
}

async function loadDebuggerSession() {
  if (!nodeId.value || !eventOffset.value) {
    session.value = null;
    error.value = 'Open the debugger from an update detail page to launch a replay session.';
    return;
  }

  try {
    if (
      session.value
      && session.value.nodeId === nodeId.value
      && session.value.offset === eventOffset.value
      && (!routeSessionId.value || session.value.sessionId === routeSessionId.value)
      && (!routeStepId.value || session.value.currentStep.stepId === routeStepId.value)
    ) {
      return;
    }

    const loadKey = routeReplayKey.value;

    if (pendingLoadKey === loadKey) {
      return;
    }

    pendingLoadKey = loadKey;
    loading.value = true;
    error.value = null;

    let nextSession: DebuggerSessionResponse;

    if (routeSessionId.value) {
      try {
        nextSession = await fetchDebuggerSession(routeSessionId.value);
      } catch {
        nextSession = await createDebuggerSession(nodeId.value, eventOffset.value);
      }
    } else {
      nextSession = await createDebuggerSession(nodeId.value, eventOffset.value);
    }

    if (routeStepId.value && nextSession.currentStep.stepId !== routeStepId.value) {
      nextSession = await jumpDebuggerSessionToStep(nextSession.sessionId, routeStepId.value);
    }

    rememberSessionSource(nextSession, {
      reset: nextSession.sessionId !== session.value?.sessionId,
    });
    session.value = nextSession;
    await syncEvents(nextSession.sessionId);
    await syncRouteToSession(nextSession);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
    session.value = null;
    replayEvents.value = [];
  } finally {
    if (pendingLoadKey === routeReplayKey.value) {
      pendingLoadKey = null;
    }
    loading.value = false;
  }
}

async function loadTemplateCatalog() {
  templateLoading.value = true;
  templateError.value = null;
  error.value = null;
  selectedTemplate.value = null;
  templateGroups.value = [];
  activeContracts.value = [];
  activeContractsError.value = null;
  activeContractsLoading.value = false;
  session.value = null;
  replayEvents.value = [];
  openSourceTabs.value = [];
  activeSourcePath.value = null;

  try {
    const nodes = await fetchNodes();
    templateGroups.value = await Promise.all(
      nodes.map(async (node) => {
        try {
          const response = await fetchNodeTemplates(node.id);
          return {
            nodeId: node.id,
            label: node.label,
            mode: node.mode,
            templates: [...new Set(response.templates.map((template) => template.templateId))],
            error: null,
          } satisfies DebuggerTemplateGroup;
        } catch (err) {
          return {
            nodeId: node.id,
            label: node.label,
            mode: node.mode,
            templates: [],
            error: err instanceof Error ? err.message : 'Unable to load templates.',
          } satisfies DebuggerTemplateGroup;
        }
      }),
    );
  } catch (err) {
    templateGroups.value = [];
    templateError.value = err instanceof Error ? err.message : 'Unable to load templates.';
  } finally {
    templateLoading.value = false;
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
    rememberSessionSource(nextSession);
    session.value = nextSession;
    await syncEvents(nextSession.sessionId);
    await syncRouteToSession(nextSession);
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
    rememberSessionSource(nextSession);
    session.value = nextSession;
    await syncEvents(nextSession.sessionId);
    await syncRouteToSession(nextSession);
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
    rememberSessionSource(nextSession);
    session.value = nextSession;
    await syncEvents(nextSession.sessionId);
    await syncRouteToSession(nextSession);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
  } finally {
    actionLoading.value = false;
  }
}

watch(
  routeReplayKey,
  () => {
    if (syncingRouteFromSession) {
      return;
    }

    controlPanelPosition.value = null;
    if (hasReplayContext.value) {
      void loadDebuggerSession();
    } else if (showNewSimulation.value) {
      void loadTemplateCatalog();
    } else {
      void loadDebuggerSessions();
    }
  },
  {
    immediate: true,
  },
);

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
  void nextTick(() => {
    ensureDefaultControlPanelPosition();
  });
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
    <section
      v-if="!session && !hasReplayContext && !showNewSimulation"
      class="debugger-view__session-catalog"
      data-testid="debugger-session-catalog"
    >
      <header class="node-detail__hero debugger-view__template-catalog-header">
        <div>
          <p class="activity-home__eyebrow">TOOLS</p>
          <h2 class="party-detail__title">Debugger</h2>
        </div>
        <button type="button" class="debugger-view__new-simulation" @click="startNewSimulation">
          New Simulation
        </button>
      </header>

      <p v-if="debuggerSessionsLoading" class="debugger-view__session-state">
        Loading debug sessions...
      </p>
      <p v-else-if="debuggerSessionsError" class="debugger-view__session-state debugger-view__session-state--error">
        {{ debuggerSessionsError }}
      </p>
      <template v-else-if="debuggerSessions.length > 0">
        <div class="debugger-view__session-heading">
          <h3>Debug Sessions</h3>
          <span>{{ debuggerSessions.length }} sessions</span>
        </div>
        <div class="debugger-view__session-list">
          <button
            v-for="debuggerSession in debuggerSessions"
            :key="debuggerSession.sessionId"
            type="button"
            class="debugger-view__session-card"
            :aria-label="`Open session ${debuggerSession.sessionId}`"
            @click="openDebuggerSession(debuggerSession)"
          >
            <span class="debugger-view__session-card-main">
              <strong>{{ debuggerSession.sessionId }}</strong>
              <span>{{ debuggerSession.nodeId }}</span>
            </span>
            <span class="debugger-view__session-card-meta">
              <span>Offset {{ debuggerSession.offset }}</span>
              <span>{{ debuggerSession.currentStepIndex + 1 }} / {{ debuggerSession.stepCount }}</span>
              <span>{{ debuggerSession.isTerminal ? 'Complete' : 'In progress' }}</span>
            </span>
          </button>
        </div>
      </template>
      <p v-else class="debugger-view__session-state">
        No debug sessions started yet.
      </p>
    </section>

    <section
      v-if="!session && !hasReplayContext && showNewSimulation"
      class="debugger-view__template-catalog"
      data-testid="debugger-template-catalog"
    >
      <header class="node-detail__hero debugger-view__template-catalog-header">
        <div>
          <p class="activity-home__eyebrow">TOOLS</p>
          <h2 class="party-detail__title">Debugger</h2>
        </div>
        <button type="button" class="debugger-view__back-to-sessions" @click="returnToSessions">
          Back to Sessions
        </button>
      </header>

      <DebuggerTemplatePicker
        :model-value="selectedTemplate"
        :options="templateOptions"
        :active-contracts="activeContracts"
        :active-contracts-loading="activeContractsLoading"
        :active-contracts-error="activeContractsError"
        :loading="templateLoading"
        :error="templateError"
        @select="selectTemplate"
        @node-select="loadActiveContracts"
      />
    </section>
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
        <div
          v-if="openSourceTabs.length > 0"
          class="debugger-view__editor-tabs"
          role="tablist"
          aria-label="Open DAML source files"
        >
          <button
            v-for="sourceTab in openSourceTabs"
            :key="sourceTab.path"
            type="button"
            role="tab"
            class="debugger-view__editor-tab"
            :class="{ 'debugger-view__editor-tab--active': sourceTab.path === activeSourcePath }"
            :aria-selected="sourceTab.path === activeSourcePath"
            :title="sourceTab.path"
            :data-testid="`debugger-source-tab-${sourceTab.path}`"
            @click="selectSourceTab(sourceTab.path)"
          >
            {{ formatSourceTabLabel(sourceTab.path) }}
          </button>
        </div>
        <MonacoCodeSurface
          :model-value="sourceText"
          :theme="theme"
          :language="sourceLanguage"
          :minimap="true"
          :highlight-range="highlightRange"
          :hover-variables="hoverVariables"
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

            <dl class="detail-grid debugger-view__summary-grid debugger-view__launch-context-grid">
              <div>
                <dt>Node</dt>
                <dd>{{ session.nodeId }}</dd>
              </div>
              <div>
                <dt>Event Offset</dt>
                <dd class="update-detail__id">
                  <RouterLink
                    v-if="updateDetailTarget"
                    class="debugger-view__detail-link"
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
                    class="debugger-view__detail-link"
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
                <dd class="debugger-view__session-id">{{ session.sessionId }}</dd>
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
