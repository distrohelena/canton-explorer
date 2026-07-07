<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

interface SearchableComboboxOption {
  value: string;
  label: string;
}

const props = defineProps<{
  modelValue: string;
  options: SearchableComboboxOption[];
  label: string;
  placeholder: string;
  emptyText?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  select: [value: string];
}>();

const rootRef = ref<HTMLElement | null>(null);
const isOpen = ref(false);
const highlightedIndex = ref(-1);
const listboxId = `combobox-listbox-${Math.random().toString(36).slice(2, 10)}`;

const filteredOptions = computed(() => {
  const query = props.modelValue.trim().toLowerCase();

  if (!query) {
    return props.options;
  }

  return props.options.filter((option) => option.label.toLowerCase().includes(query));
});

watch(
  () => [isOpen.value, filteredOptions.value.length],
  () => {
    highlightedIndex.value = filteredOptions.value.length > 0 ? 0 : -1;
  },
);

function openListbox() {
  if (props.disabled) {
    return;
  }

  isOpen.value = true;
}

function closeListbox() {
  isOpen.value = false;
  highlightedIndex.value = -1;
}

function selectOption(value: string) {
  emit('update:modelValue', value);
  emit('select', value);
  closeListbox();
}

function handleInput(event: Event) {
  const target = event.target;
  emit('update:modelValue', target instanceof HTMLInputElement ? target.value : props.modelValue);
  openListbox();
}

function handleKeydown(event: KeyboardEvent) {
  if (props.disabled) {
    return;
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    openListbox();
    if (filteredOptions.value.length === 0) {
      return;
    }

    highlightedIndex.value = Math.min(
      filteredOptions.value.length - 1,
      Math.max(0, highlightedIndex.value + 1),
    );
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    openListbox();
    if (filteredOptions.value.length === 0) {
      return;
    }

    highlightedIndex.value = Math.max(0, highlightedIndex.value - 1);
    return;
  }

  if (event.key === 'Enter' && isOpen.value && highlightedIndex.value >= 0) {
    event.preventDefault();
    const option = filteredOptions.value[highlightedIndex.value];
    if (option) {
      selectOption(option.value);
    }
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    closeListbox();
  }
}

function handleDocumentPointerDown(event: MouseEvent) {
  if (!(event.target instanceof Node) || !rootRef.value) {
    return;
  }

  if (!rootRef.value.contains(event.target)) {
    closeListbox();
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleDocumentPointerDown);
});

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleDocumentPointerDown);
});
</script>

<template>
  <div ref="rootRef" class="searchable-combobox">
    <input
      :value="modelValue"
      :aria-label="label"
      :aria-controls="listboxId"
      :aria-expanded="isOpen ? 'true' : 'false'"
      aria-autocomplete="list"
      autocomplete="off"
      class="searchable-combobox__input"
      :disabled="disabled"
      :placeholder="placeholder"
      role="combobox"
      type="text"
      @focus="openListbox"
      @input="handleInput"
      @keydown="handleKeydown"
    />

    <div
      v-if="isOpen"
      :id="listboxId"
      class="searchable-combobox__menu"
      role="listbox"
    >
      <button
        v-for="(option, index) in filteredOptions"
        :key="option.value"
        type="button"
        class="searchable-combobox__option"
        :class="{ 'searchable-combobox__option--active': index === highlightedIndex }"
        role="option"
        :aria-selected="index === highlightedIndex ? 'true' : 'false'"
        @mousedown.prevent="selectOption(option.value)"
      >
        {{ option.label }}
      </button>

      <div
        v-if="filteredOptions.length === 0"
        class="searchable-combobox__empty"
      >
        {{ emptyText ?? 'No results found' }}
      </div>
    </div>
  </div>
</template>
