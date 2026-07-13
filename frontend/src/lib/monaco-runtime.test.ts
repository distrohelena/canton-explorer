import { expect, it, vi } from 'vitest';

const editor = { contribution: 'hover' };
const languages = { registerHoverProvider: vi.fn() };

vi.mock('monaco-editor/esm/vs/editor/editor.main', () => ({
  editor,
  languages,
}));

it('loads Monaco with editor contributions, including hover', async () => {
  const runtime = await import('./monaco-runtime');

  expect(runtime.default.editor).toBe(editor);
  expect(runtime.default.languages).toBe(languages);
});
