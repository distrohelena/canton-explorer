<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import type * as MonacoEditor from 'monaco-editor';
import { loadMonaco } from '../lib/monaco';

type MonacoModule = typeof MonacoEditor;
type MonacoEditorInstance = MonacoEditor.editor.IStandaloneCodeEditor;
type MonacoModel = MonacoEditor.editor.ITextModel;

const props = withDefaults(
  defineProps<{
    modelValue: string;
    language?: string;
    theme?: 'light' | 'dark';
    readOnly?: boolean;
    ariaLabel?: string;
    highlightRange?: {
      startLine: number;
      startColumn: number;
      endLine: number;
      endColumn: number;
    } | null;
  }>(),
  {
    language: 'plaintext',
    theme: 'dark',
    readOnly: true,
    ariaLabel: 'Code editor',
    highlightRange: null,
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

function resolveMonacoTheme(theme: 'light' | 'dark') {
  return theme === 'light' ? 'vs' : 'vs-dark';
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
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      lineNumbers: 'on',
      wordWrap: 'on',
      glyphMargin: true,
      renderLineHighlight: 'all',
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
  () => props.highlightRange,
  () => {
    applyHighlightRange();
  },
  { deep: true },
);

onMounted(() => {
  void mountEditor();
});

onBeforeUnmount(() => {
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
