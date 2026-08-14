import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { useSectionLoad } from './useSectionLoad';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

describe('useSectionLoad', () => {
  it('starts one retry after a failed request before exposing a section error', async () => {
    const loader = vi.fn()
      .mockRejectedValueOnce(new Error('first failure'))
      .mockRejectedValueOnce(new Error('second failure'));
    const section = useSectionLoad(loader);

    await section.load();

    expect(loader).toHaveBeenCalledTimes(2);
    expect(section.error.value).toBe('second failure');
    expect(section.loading.value).toBe(false);
  });

  it('ignores a stale completion after a newer load starts', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const loader = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const section = useSectionLoad(loader);

    void section.load();
    void section.load();
    second.resolve('new');
    await flushPromises();
    first.resolve('old');
    await flushPromises();

    expect(section.data.value).toBe('new');
  });

  it('clears a prior error and retries a manually retried section once', async () => {
    const loader = vi.fn()
      .mockRejectedValueOnce(new Error('initial failure'))
      .mockRejectedValueOnce(new Error('retry failure'))
      .mockRejectedValueOnce(new Error('manual failure'))
      .mockResolvedValueOnce('fresh data');
    const section = useSectionLoad(loader);

    await section.load();
    expect(section.error.value).toBe('retry failure');

    const retryPromise = section.retry();
    expect(section.error.value).toBeNull();
    expect(section.loading.value).toBe(true);
    await retryPromise;

    expect(loader).toHaveBeenCalledTimes(4);
    expect(section.data.value).toBe('fresh data');
    expect(section.error.value).toBeNull();
    expect(section.loading.value).toBe(false);
    expect(section.retrying.value).toBe(false);
  });

  it('resets state and ignores an in-flight completion', async () => {
    const request = deferred<string>();
    const loader = vi.fn().mockReturnValue(request.promise);
    const section = useSectionLoad(loader);

    void section.load();
    section.reset();
    request.resolve('stale data');
    await flushPromises();

    expect(section.data.value).toBeNull();
    expect(section.loading.value).toBe(false);
    expect(section.retrying.value).toBe(false);
    expect(section.error.value).toBeNull();
  });
});
