import { render } from '@testing-library/vue';
import { nextTick } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MonacoCodeSurface from './MonacoCodeSurface.vue';

const deltaDecorations = vi.fn(() => []);
const setTheme = vi.fn();
const createModel = vi.fn(() => ({
  getValue: () => 'template Example where',
  dispose: vi.fn(),
}));
const setModelLanguage = vi.fn();

vi.mock('../lib/monaco', () => ({
  EXPLORER_MONACO_DARK_THEME: 'canton-explorer-noctis-uva',
  loadMonaco: vi.fn(async () => ({
    Range: class {
      constructor(..._coordinates: number[]) {}
    },
    editor: {
      createModel,
      create: vi.fn(() => ({
        deltaDecorations,
        layout: vi.fn(),
        revealLineInCenter: vi.fn(),
        updateOptions: vi.fn(),
        dispose: vi.fn(),
      })),
      setModelLanguage,
      setTheme,
    },
  })),
}));

describe('MonacoCodeSurface', () => {
  afterEach(() => {
    deltaDecorations.mockClear();
    setTheme.mockClear();
    createModel.mockClear();
    setModelLanguage.mockClear();
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
});
