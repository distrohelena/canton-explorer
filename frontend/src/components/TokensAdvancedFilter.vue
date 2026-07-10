<script setup lang="ts">
const props = defineProps<{
  id: string;
  nameDraft: string;
  excludeNameDraft: string;
  issuerDraft: string;
  activeNames: string[];
  activeExcludedNames: string[];
  activeIssuers: string[];
}>();

const emit = defineEmits<{
  'update:nameDraft': [value: string];
  'update:excludeNameDraft': [value: string];
  'update:issuerDraft': [value: string];
  addNameFilter: [];
  addExcludeNameFilter: [];
  addIssuerFilter: [];
  removeNameFilter: [value: string];
  removeExcludeNameFilter: [value: string];
  removeIssuerFilter: [value: string];
}>();

function handleNameDraftInput(event: Event) {
  const target = event.target;
  emit('update:nameDraft', target instanceof HTMLInputElement ? target.value : props.nameDraft);
}

function handleExcludeNameDraftInput(event: Event) {
  const target = event.target;
  emit(
    'update:excludeNameDraft',
    target instanceof HTMLInputElement ? target.value : props.excludeNameDraft,
  );
}

function handleIssuerDraftInput(event: Event) {
  const target = event.target;
  emit('update:issuerDraft', target instanceof HTMLInputElement ? target.value : props.issuerDraft);
}
</script>

<template>
  <section
    :id="id"
    class="node-updates__advanced-filter"
    aria-label="Advanced Filter Parameters"
  >
    <h3 class="node-updates__advanced-filter-title">Advanced Filter Parameters</h3>
    <div class="node-updates__advanced-filter-grid">
      <div class="node-updates__advanced-filter-field">
        <span>Name</span>
        <div class="node-updates__advanced-filter-input-row">
          <input
            :value="nameDraft"
            type="text"
            placeholder="Name"
            @input="handleNameDraftInput"
            @keydown.enter.prevent="$emit('addNameFilter')"
          />
          <button
            type="button"
            class="node-updates__advanced-filter-add"
            aria-label="Add name filter"
            @click="$emit('addNameFilter')"
          >
            +
          </button>
        </div>
      </div>

      <div v-if="activeNames.length > 0" class="node-updates__advanced-filter-chips">
        <div
          v-for="name in activeNames"
          :key="name"
          class="node-updates__advanced-filter-chip"
        >
          <span>{{ name }}</span>
          <button
            type="button"
            class="node-updates__advanced-filter-chip-remove"
            :aria-label="`Remove name filter ${name}`"
            @click="$emit('removeNameFilter', name)"
          >
            ×
          </button>
        </div>
      </div>

      <div class="node-updates__advanced-filter-field">
        <span>Exclude Name</span>
        <div class="node-updates__advanced-filter-input-row">
          <input
            :value="excludeNameDraft"
            type="text"
            placeholder="Exclude Name"
            @input="handleExcludeNameDraftInput"
            @keydown.enter.prevent="$emit('addExcludeNameFilter')"
          />
          <button
            type="button"
            class="node-updates__advanced-filter-add"
            aria-label="Add exclude name filter"
            @click="$emit('addExcludeNameFilter')"
          >
            +
          </button>
        </div>
      </div>

      <div v-if="activeExcludedNames.length > 0" class="node-updates__advanced-filter-chips">
        <div
          v-for="name in activeExcludedNames"
          :key="name"
          class="node-updates__advanced-filter-chip"
        >
          <span>{{ name }}</span>
          <button
            type="button"
            class="node-updates__advanced-filter-chip-remove"
            :aria-label="`Remove exclude name filter ${name}`"
            @click="$emit('removeExcludeNameFilter', name)"
          >
            ×
          </button>
        </div>
      </div>

      <div class="node-updates__advanced-filter-field">
        <span>Issuer</span>
        <div class="node-updates__advanced-filter-input-row">
          <input
            :value="issuerDraft"
            type="text"
            placeholder="Issuer"
            @input="handleIssuerDraftInput"
            @keydown.enter.prevent="$emit('addIssuerFilter')"
          />
          <button
            type="button"
            class="node-updates__advanced-filter-add"
            aria-label="Add issuer filter"
            @click="$emit('addIssuerFilter')"
          >
            +
          </button>
        </div>
      </div>

      <div v-if="activeIssuers.length > 0" class="node-updates__advanced-filter-chips">
        <div
          v-for="issuer in activeIssuers"
          :key="issuer"
          class="node-updates__advanced-filter-chip"
        >
          <span>{{ issuer }}</span>
          <button
            type="button"
            class="node-updates__advanced-filter-chip-remove"
            :aria-label="`Remove issuer filter ${issuer}`"
            @click="$emit('removeIssuerFilter', issuer)"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
