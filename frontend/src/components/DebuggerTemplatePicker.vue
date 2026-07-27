<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { NodeMode } from '../types/nodes';
import type { NodeActiveContractSummary } from '../types/contracts';

export interface DebuggerTemplateOption {
  templateId: string;
  nodeId: string;
  nodeLabel: string;
  mode: NodeMode;
}

export type DebuggerSimulationKind = 'create' | 'exercise_new' | 'exercise_existing';

export interface DebuggerTemplateSelection {
  templateId: string | null;
  nodeId: string;
  nodeLabel: string;
  mode: NodeMode;
  simulationKind: DebuggerSimulationKind;
  contractId: string | null;
}

const props = withDefaults(
  defineProps<{
    modelValue?: DebuggerTemplateSelection | null;
    options: DebuggerTemplateOption[];
    activeContracts?: NodeActiveContractSummary[];
    activeContractsLoading?: boolean;
    activeContractsError?: string | null;
    loading?: boolean;
    error?: string | null;
  }>(),
  {
    modelValue: null,
    activeContracts: () => [],
    activeContractsLoading: false,
    activeContractsError: null,
    loading: false,
    error: null,
  },
);

const emit = defineEmits<{
  select: [selection: DebuggerTemplateSelection];
  nodeSelect: [nodeId: string, simulationKind: DebuggerSimulationKind];
}>();

const simulationOptions: Array<{ kind: DebuggerSimulationKind; label: string; description: string }> = [
  {
    kind: 'create',
    label: 'Create',
    description: 'Simulate creating a new contract from a template.',
  },
  {
    kind: 'exercise_existing',
    label: 'Exercise Existing',
    description: 'Exercise a choice on an active contract.',
  },
  {
    kind: 'exercise_new',
    label: 'Exercise New',
    description: 'Create a contract from a template, then exercise a choice.',
  },
];

const selectedSimulationKind = ref<DebuggerSimulationKind | null>(null);
const selectedNodeId = ref<string | null>(null);
const query = ref('');
const highlightedIndex = ref(0);

const nodeOptions = computed(() => {
  const nodes = new Map<string, Pick<DebuggerTemplateOption, 'nodeId' | 'nodeLabel' | 'mode'>>();

  for (const option of props.options) {
    if (!nodes.has(option.nodeId)) {
      nodes.set(option.nodeId, {
        nodeId: option.nodeId,
        nodeLabel: option.nodeLabel,
        mode: option.mode,
      });
    }
  }

  return [...nodes.values()];
});

const selectedNode = computed(() =>
  nodeOptions.value.find((node) => node.nodeId === selectedNodeId.value) ?? null,
);

const isExerciseExisting = computed(() => selectedSimulationKind.value === 'exercise_existing');

const resultTitle = computed(() => {
  if (isExerciseExisting.value) {
    return 'Select active contract';
  }

  return selectedSimulationKind.value === 'exercise_new'
    ? 'Choose template to create'
    : 'Choose a template';
});

const resultDescription = computed(() => {
  if (isExerciseExisting.value) {
    return selectedNode.value
      ? `Active contracts on ${selectedNode.value.nodeLabel}.`
      : 'Select a node first.';
  }

  return selectedNode.value
    ? `Templates available on ${selectedNode.value.nodeLabel}.`
    : 'Select a node first.';
});

const nodeTemplateOptions = computed(() =>
  props.options.filter((option) => option.nodeId === selectedNodeId.value),
);

const filteredOptions = computed(() => {
  const normalizedQuery = query.value.trim().toLowerCase();

  if (!normalizedQuery) {
    return nodeTemplateOptions.value;
  }

  return nodeTemplateOptions.value.filter((option) =>
    option.templateId.toLowerCase().includes(normalizedQuery),
  );
});

const filteredContracts = computed(() => {
  const normalizedQuery = query.value.trim().toLowerCase();

  if (!normalizedQuery) {
    return props.activeContracts;
  }

  return props.activeContracts.filter((contract) =>
    [contract.contractId, contract.templateId ?? ''].some((value) =>
      value.toLowerCase().includes(normalizedQuery),
    ),
  );
});

watch(
  () => [selectedNodeId.value, filteredOptions.value.length],
  () => {
    highlightedIndex.value = filteredOptions.value.length > 0 ? 0 : -1;
  },
);

function selectSimulationKind(kind: DebuggerSimulationKind) {
  selectedSimulationKind.value = kind;
  selectedNodeId.value = null;
  query.value = '';
}

function selectNode(nodeId: string) {
  selectedNodeId.value = nodeId;
  query.value = '';
  if (selectedSimulationKind.value) {
    emit('nodeSelect', nodeId, selectedSimulationKind.value);
  }
}

function select(option: DebuggerTemplateOption) {
  if (!selectedSimulationKind.value) {
    return;
  }

  emit('select', {
    ...option,
    simulationKind: selectedSimulationKind.value,
    contractId: null,
  });
}

function selectContract(contract: NodeActiveContractSummary) {
  if (!selectedSimulationKind.value || !selectedNode.value) {
    return;
  }

  emit('select', {
    templateId: contract.templateId,
    nodeId: selectedNode.value.nodeId,
    nodeLabel: selectedNode.value.nodeLabel,
    mode: selectedNode.value.mode,
    simulationKind: selectedSimulationKind.value,
    contractId: contract.contractId,
  });
}

function handleSearchKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    if (filteredOptions.value.length > 0) {
      highlightedIndex.value = Math.min(
        filteredOptions.value.length - 1,
        Math.max(0, highlightedIndex.value + 1),
      );
    }
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    if (filteredOptions.value.length > 0) {
      highlightedIndex.value = Math.max(0, highlightedIndex.value - 1);
    }
    return;
  }

  if (event.key === 'Enter' && highlightedIndex.value >= 0) {
    event.preventDefault();
    const option = filteredOptions.value[highlightedIndex.value];
    if (option) {
      select(option);
    }
  }
}
</script>

<template>
  <div class="debugger-template-picker" data-testid="debugger-template-picker">
    <div class="debugger-template-picker__steps">
      <section class="debugger-template-picker__step" data-testid="debugger-template-step-simulation">
        <header class="debugger-template-picker__step-header">
          <span class="debugger-template-picker__step-number">01</span>
          <div>
            <h2>Choose simulation</h2>
            <p>Choose what you want to simulate.</p>
          </div>
        </header>
        <div class="debugger-template-picker__options" role="listbox" aria-label="Simulation actions">
          <button
            v-for="simulation in simulationOptions"
            :key="simulation.kind"
            type="button"
            class="debugger-template-picker__option"
            :class="{ 'debugger-template-picker__option--selected': simulation.kind === selectedSimulationKind }"
            role="option"
            :aria-selected="simulation.kind === selectedSimulationKind ? 'true' : 'false'"
            @click="selectSimulationKind(simulation.kind)"
          >
            <span class="debugger-template-picker__option-template">{{ simulation.label }}</span>
            <span class="debugger-template-picker__option-meta">{{ simulation.description }}</span>
          </button>
        </div>
      </section>

      <section
        class="debugger-template-picker__step"
        :class="{ 'debugger-template-picker__step--disabled': !selectedSimulationKind }"
        data-testid="debugger-template-step-node"
      >
        <header class="debugger-template-picker__step-header">
          <span class="debugger-template-picker__step-number">02</span>
          <div>
            <h2>Select a node</h2>
            <p>{{ selectedSimulationKind ? 'Choose where to run the simulation.' : 'Choose a simulation first.' }}</p>
          </div>
        </header>
        <div class="debugger-template-picker__options" role="listbox" aria-label="Available nodes">
          <button
            v-for="node in nodeOptions"
            :key="node.nodeId"
            type="button"
            class="debugger-template-picker__option"
            :class="{ 'debugger-template-picker__option--selected': node.nodeId === selectedNodeId }"
            role="option"
            :aria-selected="node.nodeId === selectedNodeId ? 'true' : 'false'"
            :disabled="!selectedSimulationKind"
            @click="selectNode(node.nodeId)"
          >
            <span class="debugger-template-picker__option-template">{{ node.nodeLabel }}</span>
            <span class="debugger-template-picker__option-meta">
              <span>{{ node.nodeId }}</span>
              <span class="debugger-template-picker__option-mode">
                {{ node.mode === 'pqs_only' ? 'PQS only' : 'PQS + gRPC' }}
              </span>
            </span>
          </button>
          <p v-if="!loading && !error && nodeOptions.length === 0" class="debugger-template-picker__state">
            No nodes available.
          </p>
        </div>
      </section>

      <section
        class="debugger-template-picker__step"
        :class="{ 'debugger-template-picker__step--disabled': !selectedNode }"
        data-testid="debugger-template-step-template"
      >
        <header class="debugger-template-picker__step-header">
          <span class="debugger-template-picker__step-number">03</span>
          <div>
            <h2>{{ resultTitle }}</h2>
            <p>{{ resultDescription }}</p>
          </div>
        </header>
        <div v-if="!isExerciseExisting" class="debugger-template-picker__search-wrap">
          <label for="debugger-template-search">Search templates</label>
          <input
            id="debugger-template-search"
            v-model="query"
            class="debugger-template-picker__search"
            type="search"
            role="searchbox"
            aria-label="Search templates"
            autocomplete="off"
            :disabled="!selectedNode"
            :placeholder="selectedNode ? 'Search templates' : 'Select a node first'"
            @keydown="handleSearchKeydown"
          />
        </div>
        <div v-if="isExerciseExisting" class="debugger-template-picker__options debugger-template-picker__options--templates" role="listbox" aria-label="Active contracts">
          <button
            v-for="contract in filteredContracts"
            :key="contract.contractId"
            type="button"
            class="debugger-template-picker__option"
            :class="{ 'debugger-template-picker__option--selected': modelValue?.contractId === contract.contractId }"
            role="option"
            :aria-selected="modelValue?.contractId === contract.contractId ? 'true' : 'false'"
            :disabled="!selectedNode || activeContractsLoading"
            @click="selectContract(contract)"
          >
            <span class="debugger-template-picker__option-template">{{ contract.contractId }}</span>
            <span class="debugger-template-picker__option-meta">
              <span>{{ contract.templateId ?? 'Unknown template' }}</span>
              <span v-if="contract.createdRecordTime">{{ contract.createdRecordTime }}</span>
            </span>
          </button>
          <p v-if="activeContractsLoading" class="debugger-template-picker__state">Loading active contracts...</p>
          <p v-else-if="activeContractsError" class="debugger-template-picker__state debugger-template-picker__state--error">
            {{ activeContractsError }}
          </p>
          <p v-else-if="!selectedNode" class="debugger-template-picker__state">Select a node to see its active contracts.</p>
          <p v-else-if="filteredContracts.length === 0" class="debugger-template-picker__state">
            {{ props.activeContracts.length === 0 ? 'No active contracts on this node.' : 'No active contracts match your search.' }}
          </p>
        </div>

        <div v-else class="debugger-template-picker__options debugger-template-picker__options--templates" role="listbox" aria-label="Available templates">
          <button
            v-for="(option, index) in filteredOptions"
            :key="`${option.nodeId}:${option.templateId}`"
            type="button"
            class="debugger-template-picker__option"
            :class="{ 'debugger-template-picker__option--selected': modelValue?.nodeId === option.nodeId && modelValue?.templateId === option.templateId, 'debugger-template-picker__option--highlighted': index === highlightedIndex }"
            role="option"
            :aria-selected="modelValue?.nodeId === option.nodeId && modelValue?.templateId === option.templateId ? 'true' : 'false'"
            :disabled="!selectedNode"
            @mouseenter="highlightedIndex = index"
            @click="select(option)"
          >
            <span class="debugger-template-picker__option-template">{{ option.templateId }}</span>
            <span class="debugger-template-picker__option-meta">
              <span>{{ option.nodeLabel }}</span>
              <span>{{ option.nodeId }}</span>
              <span class="debugger-template-picker__option-mode">
                {{ option.mode === 'pqs_only' ? 'PQS only' : 'PQS + gRPC' }}
              </span>
            </span>
          </button>
          <p v-if="!loading && !error && !selectedNode" class="debugger-template-picker__state">
            Select a node to see its templates.
          </p>
          <p v-else-if="!loading && !error && filteredOptions.length === 0" class="debugger-template-picker__state">
            {{ nodeTemplateOptions.length === 0 ? 'No templates available on this node.' : 'No templates match your search.' }}
          </p>
        </div>
        <p v-if="!isExerciseExisting && loading" class="debugger-template-picker__state">Loading available templates...</p>
        <p v-else-if="!isExerciseExisting && error" class="debugger-template-picker__state debugger-template-picker__state--error">{{ error }}</p>
      </section>
    </div>

    <p
      v-if="modelValue"
      class="debugger-template-picker__selection"
      data-testid="debugger-template-picker-selection"
    >
      {{ modelValue.simulationKind === 'exercise_existing'
        ? 'Exercise Existing'
        : modelValue.simulationKind === 'exercise_new'
          ? 'Exercise New'
          : 'Create' }}
      <span aria-hidden="true">·</span>
      {{ modelValue.contractId ?? modelValue.templateId ?? 'Unknown template' }}
      <span aria-hidden="true">·</span>
      {{ modelValue.nodeLabel }}
    </p>
  </div>
</template>
