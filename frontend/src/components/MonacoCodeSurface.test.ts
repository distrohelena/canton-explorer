import { render } from '@testing-library/vue';
import { nextTick } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MonacoCodeSurface from './MonacoCodeSurface.vue';

const deltaDecorations = vi.fn(() => []);

vi.mock('../lib/monaco', () => ({
  loadMonaco: vi.fn(async () => ({
    Range: class {
      constructor(..._coordinates: number[]) {}
    },
    editor: {
      createModel: vi.fn(() => ({
        getValue: () => 'template Example where',
        dispose: vi.fn(),
      })),
      create: vi.fn(() => ({
        deltaDecorations,
        layout: vi.fn(),
        revealLineInCenter: vi.fn(),
        updateOptions: vi.fn(),
        dispose: vi.fn(),
      })),
      setModelLanguage: vi.fn(),
      setTheme: vi.fn(),
    },
  })),
}));

describe('MonacoCodeSurface', () => {
  afterEach(() => {
    deltaDecorations.mockClear();
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
});
