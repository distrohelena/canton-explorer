<script setup lang="ts">
import SearchableCombobox from './SearchableCombobox.vue';

type FilterMode = 'or' | 'and';

const props = defineProps<{
  id: string;
  partyDraft: string;
  templateDraft: string;
  activeParties: string[];
  activeTemplates: string[];
  templateOptions: string[];
  filterMode: FilterMode;
  hideSplice: boolean;
  showPartyFilters?: boolean;
  hideSpliceLabel?: string;
}>();

const emit = defineEmits<{
  'update:partyDraft': [value: string];
  'update:templateDraft': [value: string];
  addPartyFilter: [];
  addTemplateFilter: [];
  removePartyFilter: [party: string];
  removeTemplateFilter: [templateId: string];
  setFilterMode: [mode: FilterMode];
  setHideSplice: [hidden: boolean];
}>();

function handlePartyDraftInput(event: Event) {
  const target = event.target;
  emit('update:partyDraft', target instanceof HTMLInputElement ? target.value : props.partyDraft);
}

function handleHideSpliceChange(event: Event) {
  const target = event.target;
  emit('setHideSplice', target instanceof HTMLInputElement ? target.checked : false);
}

function handleTemplateDraftSelect(value: string) {
  emit('update:templateDraft', value);
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
      <div
        v-if="showPartyFilters !== false"
        class="node-updates__advanced-filter-field node-updates__advanced-filter-field--party"
      >
        <span>Party ID</span>
        <div class="node-updates__advanced-filter-input-row">
          <input
            :value="partyDraft"
            type="text"
            placeholder="Party ID"
            @input="handlePartyDraftInput"
            @keydown.enter.prevent="$emit('addPartyFilter')"
          />
          <button
            type="button"
            class="node-updates__advanced-filter-add"
            aria-label="Add party filter"
            @click="$emit('addPartyFilter')"
          >
            +
          </button>
          <button
            type="button"
            class="node-updates__advanced-filter-mode"
            :class="{ 'node-updates__advanced-filter-mode--active': filterMode === 'or' }"
            aria-label="OR"
            @click="$emit('setFilterMode', 'or')"
          >
            OR
          </button>
          <button
            type="button"
            class="node-updates__advanced-filter-mode"
            :class="{ 'node-updates__advanced-filter-mode--active': filterMode === 'and' }"
            aria-label="AND"
            @click="$emit('setFilterMode', 'and')"
          >
            AND
          </button>
        </div>
      </div>

      <div
        v-if="showPartyFilters !== false && activeParties.length > 0"
        class="node-updates__advanced-filter-chips"
      >
        <div
          v-for="party in activeParties"
          :key="party"
          class="node-updates__advanced-filter-chip"
        >
          <span>{{ party }}</span>
          <button
            type="button"
            class="node-updates__advanced-filter-chip-remove"
            :aria-label="`Remove party filter ${party}`"
            @click="$emit('removePartyFilter', party)"
          >
            ×
          </button>
        </div>
      </div>

      <div class="node-updates__advanced-filter-field node-updates__advanced-filter-field--template">
        <span>Template ID</span>
        <div class="node-updates__advanced-filter-input-row node-updates__advanced-filter-input-row--template">
          <SearchableCombobox
            :model-value="templateDraft"
            :options="templateOptions.map((templateId) => ({ value: templateId, label: templateId }))"
            label="Template ID"
            placeholder="Template ID"
            empty-text="No templates found"
            @update:model-value="$emit('update:templateDraft', $event)"
            @select="handleTemplateDraftSelect"
          />
          <button
            type="button"
            class="node-updates__advanced-filter-add"
            aria-label="Add template filter"
            @click="$emit('addTemplateFilter')"
          >
            +
          </button>
          <label class="node-updates__advanced-filter-toggle">
            <input
              class="node-updates__advanced-filter-checkbox"
              :checked="hideSplice"
              type="checkbox"
              @change="handleHideSpliceChange"
            />
            <span>{{ hideSpliceLabel ?? 'Hide Splice Offsets' }}</span>
          </label>
        </div>
      </div>

      <div v-if="activeTemplates.length > 0" class="node-updates__advanced-filter-chips">
        <div
          v-for="templateId in activeTemplates"
          :key="templateId"
          class="node-updates__advanced-filter-chip"
        >
          <span>{{ templateId }}</span>
          <button
            type="button"
            class="node-updates__advanced-filter-chip-remove"
            :aria-label="`Remove template filter ${templateId}`"
            @click="$emit('removeTemplateFilter', templateId)"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
