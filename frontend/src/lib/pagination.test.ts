import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, normalizePageSize } from './pagination';

describe('pagination defaults', () => {
  it('uses the 15/30/50/100/200 page-size contract', () => {
    expect(DEFAULT_PAGE_SIZE).toBe(15);
    expect(PAGE_SIZE_OPTIONS).toEqual([15, 30, 50, 100, 200]);
    expect(normalizePageSize(15)).toBe(15);
    expect(normalizePageSize(30)).toBe(30);
  });

  it('falls back to 15 for retired default options', () => {
    expect(normalizePageSize(10)).toBe(15);
    expect(normalizePageSize(25)).toBe(15);
  });
});
