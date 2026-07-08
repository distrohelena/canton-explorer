export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200] as const;

export function normalizePageSize(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const normalized = Math.trunc(value);
    return PAGE_SIZE_OPTIONS.includes(normalized as (typeof PAGE_SIZE_OPTIONS)[number])
      ? normalized
      : DEFAULT_PAGE_SIZE;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    return normalizePageSize(parsed);
  }

  if (Array.isArray(value)) {
    return normalizePageSize(value[0]);
  }

  return DEFAULT_PAGE_SIZE;
}
