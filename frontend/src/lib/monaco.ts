import type * as MonacoEditor from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

type MonacoModule = typeof MonacoEditor;

let monacoPromise: Promise<MonacoModule> | null = null;

function configureMonacoWorkers() {
  const monacoEnvironmentTarget = globalThis as typeof globalThis & {
    MonacoEnvironment?: {
      getWorker: (_moduleId: string, label: string) => Worker;
    };
  };

  if (monacoEnvironmentTarget.MonacoEnvironment) {
    return;
  }

  monacoEnvironmentTarget.MonacoEnvironment = {
    getWorker(_moduleId: string, label: string) {
      switch (label) {
        case 'json':
          return new jsonWorker();
        case 'css':
        case 'scss':
        case 'less':
          return new cssWorker();
        case 'html':
        case 'handlebars':
        case 'razor':
          return new htmlWorker();
        case 'typescript':
        case 'javascript':
          return new tsWorker();
        default:
          return new editorWorker();
      }
    },
  };
}

export async function loadMonaco(): Promise<MonacoModule> {
  if (!monacoPromise) {
    monacoPromise = (
      import('monaco-editor/esm/vs/editor/editor.api') as Promise<MonacoModule>
    ).then((monaco) => {
      configureMonacoWorkers();
      return monaco;
    });
  }

  return monacoPromise;
}
