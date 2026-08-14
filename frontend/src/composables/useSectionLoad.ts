import { ref, shallowRef, type Ref } from 'vue';

type SectionLoad<T> = {
  data: Ref<T | null>;
  loading: Ref<boolean>;
  retrying: Ref<boolean>;
  error: Ref<string | null>;
  load: () => Promise<void>;
  retry: () => Promise<void>;
  reset: () => void;
};

function message(caught: unknown): string {
  return caught instanceof Error ? caught.message : 'Unknown error';
}

export function useSectionLoad<T>(loader: () => Promise<T>): SectionLoad<T> {
  const data = shallowRef<T | null>(null);
  const loading = ref(false);
  const retrying = ref(false);
  const error = ref<string | null>(null);
  let generationCounter = 0;

  async function run(): Promise<void> {
    const generation = ++generationCounter;
    error.value = null;
    loading.value = true;
    retrying.value = false;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const result = await loader();
        if (generation === generationCounter) {
          data.value = result;
          loading.value = false;
          retrying.value = false;
        }
        return;
      } catch (caught) {
        if (generation !== generationCounter) return;
        if (attempt === 0) {
          retrying.value = true;
          continue;
        }
        error.value = message(caught);
        loading.value = false;
        retrying.value = false;
      }
    }
  }

  function reset(): void {
    generationCounter += 1;
    data.value = null;
    loading.value = false;
    retrying.value = false;
    error.value = null;
  }

  return { data, loading, retrying, error, load: run, retry: run, reset };
}
