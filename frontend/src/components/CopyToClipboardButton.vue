<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    value: string;
    label?: string;
  }>(),
  {
    label: 'party ID',
  },
);

const copied = ref(false);
let resetTimer: number | null = null;

async function copyValue(): Promise<void> {
  if (!navigator.clipboard?.writeText) {
    return;
  }

  try {
    await navigator.clipboard.writeText(props.value);
    copied.value = true;

    if (resetTimer !== null) {
      window.clearTimeout(resetTimer);
    }

    resetTimer = window.setTimeout(() => {
      copied.value = false;
      resetTimer = null;
    }, 1400);
  } catch {
    copied.value = false;
  }
}

onBeforeUnmount(() => {
  if (resetTimer !== null) {
    window.clearTimeout(resetTimer);
  }
});
</script>

<template>
  <button
    type="button"
    class="copy-to-clipboard-button"
    :class="{ 'copy-to-clipboard-button--copied': copied }"
    :aria-label="`${copied ? 'Copied' : 'Copy'} ${label} ${value}`"
    :title="`${copied ? 'Copied' : 'Copy'} ${label}`"
    @click.stop="copyValue"
  >
    <span
      v-if="copied"
      class="copy-to-clipboard-button__feedback"
      aria-hidden="true"
    >Copied!</span>
    <svg
      v-if="copied"
      class="copy-to-clipboard-button__icon copy-to-clipboard-button__icon--copied"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M5 12.5 9.5 17 19 7.5"
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
      />
    </svg>
    <svg
      v-else
      class="copy-to-clipboard-button__icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="8" y="8" width="11" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8" />
      <path d="M16 8V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h1" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" />
    </svg>
  </button>
</template>
