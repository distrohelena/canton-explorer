<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import type * as MonacoEditor from 'monaco-editor';
import { EXPLORER_MONACO_DARK_THEME, loadMonaco } from '../lib/monaco';

type MonacoModule = typeof MonacoEditor;
type MonacoEditorInstance = MonacoEditor.editor.IStandaloneCodeEditor;
type MonacoModel = MonacoEditor.editor.ITextModel;

export interface MonacoDebuggerHoverVariable {
  name: string;
  kind: string | null;
  value: string | null;
  contractType: string | null;
  range: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
}

const props = withDefaults(
  defineProps<{
    modelValue: string;
    language?: string;
    theme?: 'light' | 'dark';
    readOnly?: boolean;
    minimap?: boolean;
    ariaLabel?: string;
    highlightRange?: {
      startLine: number;
      startColumn: number;
      endLine: number;
      endColumn: number;
    } | null;
    hoverVariables?: MonacoDebuggerHoverVariable[];
  }>(),
  {
    language: 'plaintext',
    theme: 'dark',
    readOnly: true,
    minimap: false,
    ariaLabel: 'Code editor',
    highlightRange: null,
    hoverVariables: () => [],
  },
);

const container = ref<HTMLDivElement | null>(null);
const loading = ref(true);
const loadError = ref<string | null>(null);
const monacoModule = shallowRef<MonacoModule | null>(null);
const editor = shallowRef<MonacoEditorInstance | null>(null);
const model = shallowRef<MonacoModel | null>(null);
let resizeObserver: ResizeObserver | null = null;
let highlightDecorations: string[] = [];
let hoverProviderDisposable: MonacoEditor.IDisposable | null = null;

function resolveMonacoTheme(theme: 'light' | 'dark') {
  return theme === 'light' ? 'vs' : EXPLORER_MONACO_DARK_THEME;
}

async function mountEditor() {
  if (!container.value) {
    return;
  }

  loading.value = true;
  loadError.value = null;

  try {
    const monaco = await loadMonaco();
    if (!container.value) {
      return;
    }

    monacoModule.value = monaco;
    model.value = monaco.editor.createModel(props.modelValue, props.language);
    monaco.editor.setTheme(resolveMonacoTheme(props.theme));
    editor.value = monaco.editor.create(container.value, {
      model: model.value,
      readOnly: props.readOnly,
      automaticLayout: false,
      minimap: props.minimap
        ? {
            enabled: true,
            renderCharacters: true,
            side: 'right',
            size: 'fill',
            maxColumn: 160,
          }
        : { enabled: false },
      scrollBeyondLastLine: false,
      lineNumbers: 'on',
      wordWrap: 'on',
      glyphMargin: true,
      renderLineHighlight: 'all',
      scrollbar: {
        verticalScrollbarSize: props.minimap ? 18 : 12,
        horizontalScrollbarSize: 12,
      },
      fontSize: 13,
      tabSize: 2,
      ariaLabel: props.ariaLabel,
    });
    resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      const width = entry?.contentRect.width ?? container.value?.clientWidth ?? 0;
      const height = entry?.contentRect.height ?? container.value?.clientHeight ?? 0;

      if (width > 0 && height > 0) {
        editor.value?.layout({ width, height });
      }
    });
    resizeObserver.observe(container.value);
    applyHighlightRange();
    registerHoverProvider();
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Failed to load Monaco editor';
  } finally {
    loading.value = false;
  }
}

function applyHighlightRange() {
  const monaco = monacoModule.value;
  const activeEditor = editor.value;

  if (!monaco || !activeEditor) {
    return;
  }

  if (!props.highlightRange) {
    highlightDecorations = activeEditor.deltaDecorations(highlightDecorations, []);
    return;
  }

  const { startLine, startColumn, endLine, endColumn } = props.highlightRange;
  highlightDecorations = activeEditor.deltaDecorations(highlightDecorations, [
    {
      range: new monaco.Range(startLine, startColumn, endLine, endColumn),
      options: {
        className: 'monaco-surface__highlight',
        isWholeLine: false,
      },
    },
    {
      range: new monaco.Range(startLine, 1, startLine, 1),
      options: {
        isWholeLine: true,
        className: 'monaco-surface__execution-line',
        linesDecorationsClassName: 'monaco-surface__execution-line-gutter',
      },
    },
  ]);
  activeEditor.revealLineInCenter(startLine);
}

function containsPosition(
  range: MonacoDebuggerHoverVariable['range'],
  position: { lineNumber: number; column: number },
) {
  if (position.lineNumber < range.startLine || position.lineNumber > range.endLine) {
    return false;
  }

  if (position.lineNumber === range.startLine && position.column < range.startColumn) {
    return false;
  }

  if (position.lineNumber === range.endLine && position.column >= range.endColumn) {
    return false;
  }

  return true;
}

function rangeSize(range: MonacoDebuggerHoverVariable['range']) {
  return (range.endLine - range.startLine) * 1_000_000 + (range.endColumn - range.startColumn);
}

function formatMarkdownCodeSpan(value: string) {
  const backtickRuns = value.match(/`+/g) ?? [];
  const longestBacktickRun = backtickRuns.reduce((longest, run) => Math.max(longest, run.length), 0);

  if (longestBacktickRun === 0) {
    return `\`${value}\``;
  }

  const delimiter = '`'.repeat(longestBacktickRun + 1);
  return `${delimiter} ${value} ${delimiter}`;
}

function formatHoverContents(match: MonacoDebuggerHoverVariable) {
  return [
    { value: formatMarkdownCodeSpan(match.name) },
    match.kind ? { value: `kind: ${formatMarkdownCodeSpan(match.kind)}` } : null,
    match.value !== null ? { value: `value: ${formatMarkdownCodeSpan(match.value)}` } : null,
    match.contractType !== null
      ? { value: `contract type: ${formatMarkdownCodeSpan(match.contractType)}` }
      : null,
  ].filter((content): content is { value: string } => content !== null);
}

function disposeHoverProvider() {
  hoverProviderDisposable?.dispose();
  hoverProviderDisposable = null;
}

function registerHoverProvider() {
  const monaco = monacoModule.value;

  disposeHoverProvider();

  if (!monaco || !model.value) {
    return;
  }

  hoverProviderDisposable = monaco.languages.registerHoverProvider(props.language, {
    provideHover(providerModel, position) {
      if (providerModel !== model.value) {
        return null;
      }

      const match = [...props.hoverVariables]
        .filter((entry) => containsPosition(entry.range, position))
        .sort((left, right) => rangeSize(left.range) - rangeSize(right.range))[0];

      return match ? { contents: formatHoverContents(match) } : null;
    },
  });
}

watch(
  () => props.modelValue,
  (nextValue) => {
    if (!model.value || nextValue === model.value.getValue()) {
      return;
    }

    model.value.setValue(nextValue);
  },
);

watch(
  () => props.language,
  (nextLanguage) => {
    if (!model.value || !monacoModule.value) {
      return;
    }

    monacoModule.value.editor.setModelLanguage(model.value, nextLanguage);
    registerHoverProvider();
  },
);

watch(
  () => props.theme,
  (nextTheme) => {
    monacoModule.value?.editor.setTheme(resolveMonacoTheme(nextTheme));
  },
);

watch(
  () => props.readOnly,
  (nextReadOnly) => {
    editor.value?.updateOptions({ readOnly: nextReadOnly });
  },
);

watch(
  () => props.minimap,
  (nextMinimap) => {
    editor.value?.updateOptions({
      minimap: nextMinimap
        ? {
            enabled: true,
            renderCharacters: true,
            side: 'right',
            size: 'fill',
            maxColumn: 160,
          }
        : { enabled: false },
      scrollbar: {
        verticalScrollbarSize: nextMinimap ? 18 : 12,
        horizontalScrollbarSize: 12,
      },
    });
  },
);

watch(
  () => props.highlightRange,
  () => {
    applyHighlightRange();
  },
  { deep: true },
);

watch(
  () => props.hoverVariables,
  () => {
    registerHoverProvider();
  },
  { deep: true },
);

onMounted(() => {
  void mountEditor();
});

onBeforeUnmount(() => {
  disposeHoverProvider();
  resizeObserver?.disconnect();
  if (editor.value) {
    highlightDecorations = editor.value.deltaDecorations(highlightDecorations, []);
  }
  editor.value?.dispose();
  model.value?.dispose();
});
</script>

<template>
  <div class="monaco-surface">
    <div
      v-if="loading"
      class="monaco-surface__state monaco-surface__state--loading"
    >
      Loading editor...
    </div>
    <div
      v-else-if="loadError"
      class="monaco-surface__state monaco-surface__state--error"
    >
      {{ loadError }}
    </div>
    <div
      v-show="!loading && !loadError"
      ref="container"
      class="monaco-surface__editor"
      :aria-label="ariaLabel"
    />
  </div>
</template>
