import { render } from '@testing-library/vue';
import { nextTick } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MonacoCodeSurface from './MonacoCodeSurface.vue';

const deltaDecorations = vi.fn(() => []);
const setTheme = vi.fn();
let hoverProvider: {
  provideHover: (model: unknown, position: { lineNumber: number; column: number }) => unknown;
} | null = null;
const disposeHoverProvider = vi.fn();
const hoverProviderDisposables: Array<{ dispose: ReturnType<typeof vi.fn> }> = [];
const registerHoverProvider = vi.fn(
  (
    _language: string,
    provider: {
      provideHover: (model: unknown, position: { lineNumber: number; column: number }) => unknown;
    },
  ) => {
    hoverProvider = provider;
    const disposable = {
      dispose: vi.fn(() => {
        disposeHoverProvider();
      }),
    };
    hoverProviderDisposables.push(disposable);
    return disposable;
  },
);
const createEditor = vi.fn(() => ({
  deltaDecorations,
  layout: vi.fn(),
  getModel: vi.fn(() => null),
  revealLineInCenter: vi.fn(),
  updateOptions: vi.fn(),
  dispose: vi.fn(),
}));
const createModel = vi.fn(
  (): {
    getValue: () => string;
    dispose: ReturnType<typeof vi.fn>;
  } => ({
    getValue: () => 'template Example where',
    dispose: vi.fn(),
  }),
);
const setModelLanguage = vi.fn();

vi.mock('../lib/monaco', () => ({
  EXPLORER_MONACO_DARK_THEME: 'canton-explorer-noctis-uva',
  loadMonaco: vi.fn(async () => ({
    Range: class {
      constructor(..._coordinates: number[]) {}
    },
    editor: {
      createModel,
      create: createEditor,
      setModelLanguage,
      setTheme,
    },
    languages: { registerHoverProvider },
  })),
}));

describe('MonacoCodeSurface', () => {
  afterEach(() => {
    deltaDecorations.mockClear();
    setTheme.mockClear();
    createEditor.mockClear();
    createModel.mockClear();
    setModelLanguage.mockClear();
    hoverProvider = null;
    disposeHoverProvider.mockClear();
    hoverProviderDisposables.length = 0;
    registerHoverProvider.mockClear();
    vi.restoreAllMocks();
  });

  it('marks the source range and current execution line separately', async () => {
    render(MonacoCodeSurface, {
      props: {
        modelValue: 'template Example where',
        highlightRange: {
          startLine: 4,
          startColumn: 3,
          endLine: 8,
          endColumn: 12,
        },
      },
    });

    await Promise.resolve();
    await nextTick();

    expect(deltaDecorations).toHaveBeenCalledWith([], [
      expect.objectContaining({
        options: expect.objectContaining({
          className: 'monaco-surface__highlight',
          isWholeLine: false,
        }),
      }),
      expect.objectContaining({
        options: expect.objectContaining({
          className: 'monaco-surface__execution-line',
          isWholeLine: true,
        }),
      }),
    ]);
  });

  it('uses the custom explorer dark theme for Monaco in dark mode', async () => {
    render(MonacoCodeSurface, {
      props: {
        modelValue: 'template Example where',
        theme: 'dark',
      },
    });

    await Promise.resolve();
    await nextTick();

    expect(setTheme).toHaveBeenCalledWith('canton-explorer-noctis-uva');
  });

  it('creates DAML models with the DAML language id', async () => {
    render(MonacoCodeSurface, {
      props: {
        modelValue: 'template Example where',
        language: 'daml',
      },
    });

    await Promise.resolve();
    await nextTick();

    expect(createModel).toHaveBeenCalledWith('template Example where', 'daml');
  });

  it('enables the Monaco minimap when requested', async () => {
    render(MonacoCodeSurface, {
      props: {
        modelValue: 'template Example where',
        minimap: true,
      },
    });

    await Promise.resolve();
    await nextTick();

    expect(createEditor).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        minimap: expect.objectContaining({
          enabled: true,
          renderCharacters: true,
          side: 'right',
          size: 'fill',
          maxColumn: 160,
        }),
        scrollbar: expect.objectContaining({
          verticalScrollbarSize: 18,
        }),
      }),
    );
  });

  it('shows debugger hover content only inside proven variable ranges', async () => {
    const model = {
      getValue: () => 'template Example where\n  signatory owner\n',
      dispose: vi.fn(),
    };
    createModel.mockReturnValueOnce(model);

    render(MonacoCodeSurface, {
      props: {
        modelValue: 'template Example where\n  signatory owner\n',
        language: 'daml',
        hoverVariables: [
          {
            name: 'owner',
            kind: 'text',
            value: 'Alice',
            contractType: null,
            range: {
              startLine: 2,
              startColumn: 13,
              endLine: 2,
              endColumn: 18,
            },
          },
        ],
      },
    });

    await Promise.resolve();
    await nextTick();

    expect(registerHoverProvider).toHaveBeenCalledWith('daml', expect.anything());
    expect(hoverProvider?.provideHover(model, { lineNumber: 2, column: 14 })).toEqual({
      contents: [
        { value: '`owner`' },
        { value: 'kind: `text`' },
        { value: 'value: `Alice`' },
      ],
    });
    expect(hoverProvider?.provideHover(model, { lineNumber: 1, column: 1 })).toBeNull();
  });

  it('returns no debugger hover content for a different Monaco model', async () => {
    const model = {
      getValue: () => 'template Example where\n  signatory owner\n',
      dispose: vi.fn(),
    };
    createModel.mockReturnValueOnce(model);

    render(MonacoCodeSurface, {
      props: {
        modelValue: 'template Example where\n  signatory owner\n',
        language: 'daml',
        hoverVariables: [
          {
            name: 'owner',
            kind: 'text',
            value: 'Alice',
            contractType: null,
            range: {
              startLine: 2,
              startColumn: 13,
              endLine: 2,
              endColumn: 18,
            },
          },
        ],
      },
    });

    await Promise.resolve();
    await nextTick();

    expect(hoverProvider?.provideHover({ getValue: () => model.getValue() }, { lineNumber: 2, column: 14 })).toBeNull();
  });

  it('disposes the old hover provider and registers a new one when language changes', async () => {
    const model = {
      getValue: () => 'template Example where\n  signatory owner\n',
      dispose: vi.fn(),
    };
    createModel.mockReturnValueOnce(model);

    const hoverVariables = [
      {
        name: 'owner',
        kind: 'text',
        value: 'Alice',
        contractType: null,
        range: {
          startLine: 2,
          startColumn: 13,
          endLine: 2,
          endColumn: 18,
        },
      },
    ];
    const { rerender } = render(MonacoCodeSurface, {
      props: {
        modelValue: 'template Example where\n  signatory owner\n',
        language: 'daml',
        hoverVariables,
      },
    });

    await Promise.resolve();
    await nextTick();
    const firstProvider = hoverProvider;
    const firstDisposable = hoverProviderDisposables[0];

    await rerender({
      modelValue: 'template Example where\n  signatory owner\n',
      language: 'plaintext',
      hoverVariables,
    });
    await nextTick();

    expect(firstDisposable.dispose).toHaveBeenCalledTimes(1);
    expect(registerHoverProvider).toHaveBeenCalledTimes(2);
    expect(registerHoverProvider).toHaveBeenLastCalledWith('plaintext', expect.anything());
    expect(hoverProvider).not.toBe(firstProvider);
  });

  it('re-registers the hover provider when hover variables change without accumulating providers', async () => {
    const model = {
      getValue: () => 'template Example where\n  signatory owner\n',
      dispose: vi.fn(),
    };
    createModel.mockReturnValueOnce(model);

    const { rerender } = render(MonacoCodeSurface, {
      props: {
        modelValue: 'template Example where\n  signatory owner\n',
        language: 'daml',
        hoverVariables: [
          {
            name: 'owner',
            kind: 'text',
            value: 'Alice',
            contractType: null,
            range: {
              startLine: 2,
              startColumn: 13,
              endLine: 2,
              endColumn: 18,
            },
          },
        ],
      },
    });

    await Promise.resolve();
    await nextTick();
    const firstProvider = hoverProvider;
    const firstDisposable = hoverProviderDisposables[0];

    await rerender({
      modelValue: 'template Example where\n  signatory owner\n',
      language: 'daml',
      hoverVariables: [
        {
          name: 'owner',
          kind: 'text',
          value: 'Bob',
          contractType: null,
          range: {
            startLine: 2,
            startColumn: 13,
            endLine: 2,
            endColumn: 18,
          },
        },
      ],
    });
    await nextTick();

    expect(firstDisposable.dispose).toHaveBeenCalledTimes(1);
    expect(registerHoverProvider).toHaveBeenCalledTimes(2);
    expect(hoverProviderDisposables[1].dispose).not.toHaveBeenCalled();
    expect(hoverProvider).not.toBe(firstProvider);
    expect(hoverProvider?.provideHover(model, { lineNumber: 2, column: 14 })).toEqual({
      contents: [
        { value: '`owner`' },
        { value: 'kind: `text`' },
        { value: 'value: `Bob`' },
      ],
    });
  });

  it('disposes the active hover provider on unmount', async () => {
    const model = {
      getValue: () => 'template Example where\n  signatory owner\n',
      dispose: vi.fn(),
    };
    createModel.mockReturnValueOnce(model);

    const { unmount } = render(MonacoCodeSurface, {
      props: {
        modelValue: 'template Example where\n  signatory owner\n',
        language: 'daml',
        hoverVariables: [
          {
            name: 'owner',
            kind: 'text',
            value: 'Alice',
            contractType: null,
            range: {
              startLine: 2,
              startColumn: 13,
              endLine: 2,
              endColumn: 18,
            },
          },
        ],
      },
    });

    await Promise.resolve();
    await nextTick();
    const activeDisposable = hoverProviderDisposables[0];

    unmount();

    expect(activeDisposable.dispose).toHaveBeenCalledTimes(1);
  });

  it('treats debugger hover ranges as start-inclusive and end-exclusive', async () => {
    const model = {
      getValue: () => 'template Example where\n  signatory owner\n',
      dispose: vi.fn(),
    };
    createModel.mockReturnValueOnce(model);

    render(MonacoCodeSurface, {
      props: {
        modelValue: 'template Example where\n  signatory owner\n',
        language: 'daml',
        hoverVariables: [
          {
            name: 'owner',
            kind: 'text',
            value: 'Alice',
            contractType: null,
            range: {
              startLine: 2,
              startColumn: 13,
              endLine: 2,
              endColumn: 18,
            },
          },
        ],
      },
    });

    await Promise.resolve();
    await nextTick();

    expect(hoverProvider?.provideHover(model, { lineNumber: 2, column: 13 })).toEqual({
      contents: [
        { value: '`owner`' },
        { value: 'kind: `text`' },
        { value: 'value: `Alice`' },
      ],
    });
    expect(hoverProvider?.provideHover(model, { lineNumber: 2, column: 18 })).toBeNull();
  });

  it('uses the smallest debugger hover range when proven ranges overlap', async () => {
    const model = {
      getValue: () => 'template Example where\n  signatory owner\n',
      dispose: vi.fn(),
    };
    createModel.mockReturnValueOnce(model);

    render(MonacoCodeSurface, {
      props: {
        modelValue: 'template Example where\n  signatory owner\n',
        language: 'daml',
        hoverVariables: [
          {
            name: 'signatory owner',
            kind: 'expression',
            value: null,
            contractType: null,
            range: {
              startLine: 2,
              startColumn: 3,
              endLine: 2,
              endColumn: 18,
            },
          },
          {
            name: 'owner',
            kind: 'text',
            value: 'Alice',
            contractType: 'Example',
            range: {
              startLine: 2,
              startColumn: 13,
              endLine: 2,
              endColumn: 18,
            },
          },
        ],
      },
    });

    await Promise.resolve();
    await nextTick();

    expect(hoverProvider?.provideHover(model, { lineNumber: 2, column: 14 })).toEqual({
      contents: [
        { value: '`owner`' },
        { value: 'kind: `text`' },
        { value: 'value: `Alice`' },
        { value: 'contract type: `Example`' },
      ],
    });
  });

  it('formats debugger hover code spans safely when values contain backticks', async () => {
    const model = {
      getValue: () => 'template Example where\n  signatory owner\n',
      dispose: vi.fn(),
    };
    createModel.mockReturnValueOnce(model);

    render(MonacoCodeSurface, {
      props: {
        modelValue: 'template Example where\n  signatory owner\n',
        language: 'daml',
        hoverVariables: [
          {
            name: 'own`er',
            kind: 'te`xt',
            value: 'Ali``ce',
            contractType: '`Example`',
            range: {
              startLine: 2,
              startColumn: 13,
              endLine: 2,
              endColumn: 18,
            },
          },
        ],
      },
    });

    await Promise.resolve();
    await nextTick();

    expect(hoverProvider?.provideHover(model, { lineNumber: 2, column: 14 })).toEqual({
      contents: [
        { value: '`` own`er ``' },
        { value: 'kind: `` te`xt ``' },
        { value: 'value: ``` Ali``ce ```' },
        { value: 'contract type: `` `Example` ``' },
      ],
    });
  });

  it('includes empty debugger hover kind values', async () => {
    const model = {
      getValue: () => 'template Example where\n  signatory owner\n',
      dispose: vi.fn(),
    };
    createModel.mockReturnValueOnce(model);

    render(MonacoCodeSurface, {
      props: {
        modelValue: 'template Example where\n  signatory owner\n',
        language: 'daml',
        hoverVariables: [
          {
            name: 'owner',
            kind: '',
            value: null,
            contractType: null,
            range: {
              startLine: 2,
              startColumn: 13,
              endLine: 2,
              endColumn: 18,
            },
          },
        ],
      },
    });

    await Promise.resolve();
    await nextTick();

    expect(hoverProvider?.provideHover(model, { lineNumber: 2, column: 14 })).toEqual({
      contents: [{ value: '`owner`' }, { value: 'kind: ``' }],
    });
  });
});
