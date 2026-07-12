<script setup lang="ts">
const props = defineProps<{
  id: string;
  fromDraft: string;
  toDraft: string;
  movementTypeDraft: string;
  amountGtDraft: string;
  amountLtDraft: string;
  activeFromParties: string[];
  activeToParties: string[];
  activeMovementTypes: string[];
}>();

const emit = defineEmits<{
  'update:fromDraft': [value: string];
  'update:toDraft': [value: string];
  'update:movementTypeDraft': [value: string];
  'update:amountGtDraft': [value: string];
  'update:amountLtDraft': [value: string];
  addFromPartyFilter: [];
  addToPartyFilter: [];
  addMovementTypeFilter: [];
  removeFromPartyFilter: [party: string];
  removeToPartyFilter: [party: string];
  removeMovementTypeFilter: [movementType: string];
}>();

function handleFromDraftInput(event: Event) {
  const target = event.target;
  emit('update:fromDraft', target instanceof HTMLInputElement ? target.value : props.fromDraft);
}

function handleToDraftInput(event: Event) {
  const target = event.target;
  emit('update:toDraft', target instanceof HTMLInputElement ? target.value : props.toDraft);
}

function handleMovementTypeDraftInput(event: Event) {
  const target = event.target;
  emit(
    'update:movementTypeDraft',
    target instanceof HTMLSelectElement ? target.value : props.movementTypeDraft,
  );
}

function handleAmountGtDraftInput(event: Event) {
  const target = event.target;
  emit(
    'update:amountGtDraft',
    target instanceof HTMLInputElement ? target.value : props.amountGtDraft,
  );
}

function handleAmountLtDraftInput(event: Event) {
  const target = event.target;
  emit(
    'update:amountLtDraft',
    target instanceof HTMLInputElement ? target.value : props.amountLtDraft,
  );
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
      <div class="node-updates__advanced-filter-field node-updates__advanced-filter-field--party">
        <span>From Party ID</span>
        <div class="node-updates__advanced-filter-input-row">
          <input
            :value="fromDraft"
            type="text"
            placeholder="From Party ID"
            @input="handleFromDraftInput"
            @keydown.enter.prevent="$emit('addFromPartyFilter')"
          />
          <button
            type="button"
            class="node-updates__advanced-filter-add"
            aria-label="Add from party filter"
            @click="$emit('addFromPartyFilter')"
          >
            +
          </button>
        </div>
      </div>

      <div v-if="activeFromParties.length > 0" class="node-updates__advanced-filter-chips">
        <div
          v-for="party in activeFromParties"
          :key="party"
          class="node-updates__advanced-filter-chip"
        >
          <span>{{ party }}</span>
          <button
            type="button"
            class="node-updates__advanced-filter-chip-remove"
            :aria-label="`Remove from party filter ${party}`"
            @click="$emit('removeFromPartyFilter', party)"
          >
            ×
          </button>
        </div>
      </div>

      <div class="node-updates__advanced-filter-field node-updates__advanced-filter-field--party">
        <span>To Party ID</span>
        <div class="node-updates__advanced-filter-input-row">
          <input
            :value="toDraft"
            type="text"
            placeholder="To Party ID"
            @input="handleToDraftInput"
            @keydown.enter.prevent="$emit('addToPartyFilter')"
          />
          <button
            type="button"
            class="node-updates__advanced-filter-add"
            aria-label="Add to party filter"
            @click="$emit('addToPartyFilter')"
          >
            +
          </button>
        </div>
      </div>

      <div v-if="activeToParties.length > 0" class="node-updates__advanced-filter-chips">
        <div
          v-for="party in activeToParties"
          :key="party"
          class="node-updates__advanced-filter-chip"
        >
          <span>{{ party }}</span>
          <button
            type="button"
            class="node-updates__advanced-filter-chip-remove"
            :aria-label="`Remove to party filter ${party}`"
            @click="$emit('removeToPartyFilter', party)"
          >
            ×
          </button>
        </div>
      </div>

      <div class="node-updates__advanced-filter-field">
        <span>Movement Type</span>
        <div class="node-updates__advanced-filter-input-row">
          <div class="node-updates__advanced-filter-select-shell">
            <select
              class="node-updates__advanced-filter-select"
              :value="movementTypeDraft"
              aria-label="Movement Type"
              @input="handleMovementTypeDraftInput"
            >
              <option value="">All Movement Types</option>
              <option value="Transfer">Transfer</option>
              <option value="Create">Create</option>
              <option value="Mint">Mint</option>
            </select>
          </div>
          <button
            type="button"
            class="node-updates__advanced-filter-add"
            aria-label="Add movement type filter"
            @click="$emit('addMovementTypeFilter')"
          >
            +
          </button>
        </div>
      </div>

      <div v-if="activeMovementTypes.length > 0" class="node-updates__advanced-filter-chips">
        <div
          v-for="movementType in activeMovementTypes"
          :key="movementType"
          class="node-updates__advanced-filter-chip"
        >
          <span>{{ movementType }}</span>
          <button
            type="button"
            class="node-updates__advanced-filter-chip-remove"
            :aria-label="`Remove movement type filter ${movementType}`"
            @click="$emit('removeMovementTypeFilter', movementType)"
          >
            ×
          </button>
        </div>
      </div>

      <div class="node-updates__advanced-filter-field">
        <span>Greater Than Amount</span>
        <div class="node-updates__advanced-filter-input-row">
          <input
            :value="amountGtDraft"
            type="text"
            inputmode="decimal"
            placeholder="Greater Than Amount"
            @input="handleAmountGtDraftInput"
          />
        </div>
      </div>

      <div class="node-updates__advanced-filter-field">
        <span>Less Than Amount</span>
        <div class="node-updates__advanced-filter-input-row">
          <input
            :value="amountLtDraft"
            type="text"
            inputmode="decimal"
            placeholder="Less Than Amount"
            @input="handleAmountLtDraftInput"
          />
        </div>
      </div>
    </div>
  </section>
</template>
