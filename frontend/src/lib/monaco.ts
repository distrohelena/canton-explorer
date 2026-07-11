import type * as MonacoEditor from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

type MonacoModule = typeof MonacoEditor;

export const EXPLORER_MONACO_DARK_THEME = 'canton-explorer-noctis-uva';
export const EXPLORER_MONACO_DAML_LANGUAGE = 'daml';

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

function defineExplorerLanguages(monaco: MonacoModule) {
  monaco.languages.register({
    id: EXPLORER_MONACO_DAML_LANGUAGE,
    extensions: ['.daml'],
    aliases: ['DAML', 'daml'],
  });

  monaco.languages.setLanguageConfiguration(EXPLORER_MONACO_DAML_LANGUAGE, {
    comments: {
      lineComment: '--',
      blockComment: ['{-', '-}'],
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
    ],
    indentationRules: {
      increaseIndentPattern: /^.*(\b(where|of|do|let|then|else)\b.*|[\[{(])$/,
      decreaseIndentPattern: /^\s*[\]})]/,
    },
  });

  monaco.languages.setMonarchTokensProvider(EXPLORER_MONACO_DAML_LANGUAGE, {
    defaultToken: '',
    tokenPostfix: '.daml',
    keywords: [
      'module',
      'where',
      'import',
      'as',
      'qualified',
      'hiding',
      'template',
      'with',
      'signatory',
      'observer',
      'controller',
      'choice',
      'nonconsuming',
      'key',
      'maintainer',
      'archive',
      'fetch',
      'fetchByKey',
      'lookupByKey',
      'to',
      'do',
      'let',
      'in',
      'if',
      'then',
      'else',
      'case',
      'of',
      'data',
      'type',
      'newtype',
      'class',
      'instance',
      'deriving',
      'interface',
      'view',
      'method',
      'exception',
      'message',
      'exercise',
      'exerciseByKey',
      'create',
      'createAndExercise',
      'submit',
      'submitMustFail',
      'return',
      'forall',
      'from',
      'when',
      'unless',
      'has',
      'implements',
      'interface',
      'this',
      'self',
      'enum',
      'struct',
    ],
    builtins: [
      'True',
      'False',
      'None',
      'Some',
      'Optional',
      'Text',
      'Int',
      'Decimal',
      'Numeric',
      'Bool',
      'Party',
      'Time',
      'Date',
      'RelTime',
      'ContractId',
      'Update',
      'Scenario',
      'Any',
      'AnyException',
      'List',
      'Map',
      'TextMap',
      'Unit',
    ],
    operators: [
      '=',
      '->',
      '<-',
      '=>',
      '::',
      ':',
      '\\',
      '|',
      '.',
      ',',
      ';',
      '==',
      '/=',
      '<',
      '>',
      '<=',
      '>=',
      '&&',
      '||',
      '+',
      '-',
      '*',
      '/',
      '++',
      '$',
    ],
    escapes:
      /\\(?:[abfnrtv\\\"']|x[0-9A-Fa-f]{2}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
    tokenizer: {
      root: [
        [/[ \t\r\n]+/, 'white'],
        [/--.*$/, 'comment'],
        [/\{-/, { token: 'comment', next: '@comment' }],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
        [/'[^\\']'/, 'string'],
        [/'/, 'string.invalid'],
        [/\b[0-9][0-9_]*(\.[0-9_]+)?\b/, 'number'],
        [/\b[A-Z][\w']*(\.[A-Z][\w']*)*\b/, {
          cases: {
            '@builtins': 'type',
            '@default': 'type.identifier',
          },
        }],
        [/\b[a-z_][\w']*\b/, {
          cases: {
            '@keywords': 'keyword',
            '@default': 'identifier',
          },
        }],
        [/[{}()[\]]/, '@brackets'],
        [/[;,.]/, 'delimiter'],
        [/[:!#$%&*+./<=>?@\\^|\-~]+/, {
          cases: {
            '@operators': 'operator',
            '@default': 'operator',
          },
        }],
      ],
      comment: [
        [/[^\{-]+/, 'comment'],
        [/\{-/, { token: 'comment', next: '@push' }],
        [/-\}/, { token: 'comment', next: '@pop' }],
        [/[\{-]/, 'comment'],
      ],
      string: [
        [/[^\\"]+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
      ],
    },
  });
}

function defineExplorerThemes(monaco: MonacoModule) {
  monaco.editor.defineTheme(EXPLORER_MONACO_DARK_THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: 'D8D3E8', background: '252845' },
      { token: 'comment', foreground: 'A39DBA', fontStyle: 'italic' },
      { token: 'string', foreground: '7FE6D7' },
      { token: 'string.escape', foreground: 'FAD7A0' },
      { token: 'number', foreground: 'A89BFF' },
      { token: 'keyword', foreground: 'FFB86C' },
      { token: 'operator', foreground: 'F2EFFA' },
      { token: 'delimiter', foreground: 'D8D3E8' },
      { token: 'type', foreground: '7AD7FF' },
      { token: 'type.identifier', foreground: '7AD7FF' },
      { token: 'identifier', foreground: 'F0E9FF' },
      { token: 'identifier.daml', foreground: 'F0E9FF' },
      { token: 'keyword.daml', foreground: 'FFB86C' },
      { token: 'type.identifier.daml', foreground: '7AD7FF' },
      { token: 'variable', foreground: 'F0E9FF' },
      { token: 'variable.parameter', foreground: 'FFCAA1', fontStyle: 'italic' },
      { token: 'function', foreground: '7AD7FF' },
      { token: 'function.call', foreground: '7FE6D7' },
      { token: 'tag', foreground: 'FFB86C' },
      { token: 'attribute.name', foreground: 'FFCAA1' },
    ],
    colors: {
      'editor.background': '#252845',
      'editor.foreground': '#D8D3E8',
      'editorLineNumber.foreground': '#787291',
      'editorLineNumber.activeForeground': '#D8D3E8',
      'editorCursor.foreground': '#FFB86C',
      'editor.selectionBackground': '#3A3E67',
      'editor.inactiveSelectionBackground': '#303356',
      'editor.lineHighlightBackground': '#2B2E4C',
      'editorLineNumber.dimmedForeground': '#605B77',
      'editorIndentGuide.background1': '#3A3D59',
      'editorIndentGuide.activeBackground1': '#5A5E84',
      'editorWhitespace.foreground': '#4A4E72',
      'editorGutter.background': '#252845',
      'editorWidget.background': '#2B2F4D',
      'editorWidget.border': '#484C6B',
      'scrollbarSlider.background': '#52577466',
      'scrollbarSlider.hoverBackground': '#666C8C88',
      'scrollbarSlider.activeBackground': '#7A82A699',
    },
  });
}

export async function loadMonaco(): Promise<MonacoModule> {
  if (!monacoPromise) {
    monacoPromise = (
      import('monaco-editor/esm/vs/editor/editor.api') as Promise<MonacoModule>
    ).then((monaco) => {
      configureMonacoWorkers();
      defineExplorerLanguages(monaco);
      defineExplorerThemes(monaco);
      return monaco;
    });
  }

  return monacoPromise;
}
