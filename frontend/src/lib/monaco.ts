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
      { token: '', foreground: 'F0EAFF', background: '2A2648' },
      { token: 'comment', foreground: 'A79FC4', fontStyle: 'italic' },
      { token: 'string', foreground: '7CE4D2' },
      { token: 'string.escape', foreground: 'FFD19A' },
      { token: 'number', foreground: 'A99BFF' },
      { token: 'keyword', foreground: 'FFB86F' },
      { token: 'operator', foreground: 'F3F0FF' },
      { token: 'delimiter', foreground: 'DCD6F2' },
      { token: 'type', foreground: '8FD0FF' },
      { token: 'type.identifier', foreground: '8FD0FF' },
      { token: 'identifier', foreground: 'F1EAFF' },
      { token: 'identifier.daml', foreground: 'F1EAFF' },
      { token: 'keyword.daml', foreground: 'FFB86F' },
      { token: 'type.identifier.daml', foreground: '8FD0FF' },
      { token: 'variable', foreground: 'F1EAFF' },
      { token: 'variable.parameter', foreground: 'FFC9A0', fontStyle: 'italic' },
      { token: 'function', foreground: '8FD0FF' },
      { token: 'function.call', foreground: '7CE4D2' },
      { token: 'tag', foreground: 'FFB86F' },
      { token: 'attribute.name', foreground: 'FFC9A0' },
    ],
    colors: {
      'editor.background': '#2A2648',
      'editor.foreground': '#F0EAFF',
      'editorLineNumber.foreground': '#8B82AE',
      'editorLineNumber.activeForeground': '#F0EAFF',
      'editorCursor.foreground': '#FFB86F',
      'editor.selectionBackground': '#443C73',
      'editor.inactiveSelectionBackground': '#38305F',
      'editor.lineHighlightBackground': '#312C53',
      'editorLineNumber.dimmedForeground': '#665F87',
      'editorIndentGuide.background1': '#4A436B',
      'editorIndentGuide.activeBackground1': '#6B6298',
      'editorWhitespace.foreground': '#59527E',
      'editorGutter.background': '#2A2648',
      'editorWidget.background': '#302A53',
      'editorWidget.border': '#655A96',
      'scrollbarSlider.background': '#72669E66',
      'scrollbarSlider.hoverBackground': '#8A7BB788',
      'scrollbarSlider.activeBackground': '#A090CF99',
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
