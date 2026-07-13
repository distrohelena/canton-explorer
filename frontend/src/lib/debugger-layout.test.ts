import { expect, it } from 'vitest';
import { resolveDefaultControlPanelX } from './debugger-layout';

it('places the default replay controls at the workspace right edge', () => {
  expect(resolveDefaultControlPanelX(1_200, 420, 16)).toBe(764);
});
