import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Monaco worker imports', () => {
  it('uses worker files that resolve in Vite dev mode', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/lib/monaco.ts'), 'utf8');

    expect(source).toContain("from 'monaco-editor/editor/editor.worker.js?worker'");
    expect(source).toContain("from 'monaco-editor/language/json/json.worker.js?worker'");
    expect(source).toContain("from 'monaco-editor/language/css/css.worker.js?worker'");
    expect(source).toContain("from 'monaco-editor/language/html/html.worker.js?worker'");
    expect(source).toContain(
      "from 'monaco-editor/language/typescript/ts.worker.js?worker'",
    );
  });
});
