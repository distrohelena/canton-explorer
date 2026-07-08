<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { LocationQueryRaw } from 'vue-router';
import {
  fetchLatestContracts,
  fetchNodeContracts,
  fetchNodeTemplates,
  fetchPartyContracts,
  fetchTemplates,
} from '../lib/api';
import { DEFAULT_PAGE_SIZE, normalizePageSize } from '../lib/pagination';
import type { GlobalContractsResponse, NodeContractsResponse } from '../types/contracts';
import type { PartyContractsResponse } from '../types/parties';
import ContractsTable from './ContractsTable.vue';
import QuerySourcePill from './QuerySourcePill.vue';
import UpdatesAdvancedFilter from './UpdatesAdvancedFilter.vue';
import UpdatesToolbar from './UpdatesToolbar.vue';

type FilterMode = 'or' | 'and';
type ContractScope = 'global' | 'node' | 'party';

const props = withDefaults(
  defineProps<{
    scope: ContractScope;
    path: string;
    title: string;
    eyebrow?: string;
    nodeId?: string;
    partyId?: string;
    queryPrefix?: string;
    showNodeColumn?: boolean;
    showPartyFilters?: boolean;
    advancedFilterId: string;
    loadingMessage?: string;
    emptyMessage?: string;
    tableAriaLabel?: string;
    spinnerLabel?: string;
  }>(),
  {
    queryPrefix: '',
    showNodeColumn: false,
    showPartyFilters: true,
    eyebrow: 'Contracts',
    loadingMessage: 'Loading contracts...',
    emptyMessage: 'No active contracts found for this node.',
    tableAriaLabel: 'Contracts',
    spinnerLabel: 'Updating contracts',
  },
);

const route = useRoute();
const router = useRouter();
const contractsResponse = ref<GlobalContractsResponse | NodeContractsResponse | PartyContractsResponse | null>(null);
const error = ref<string | null>(null);
const loading = ref(false);
const showAdvancedFilter = ref(false);
const partyFilterDraft = ref('');
const templateFilterDraft = ref('');
const templateOptions = ref<string[]>([]);
const templatesLoaded = ref(false);
const activePartyFilters = ref<string[]>([]);
const activeTemplateFilters = ref<string[]>([]);
const activeFilterMode = ref<FilterMode>('or');
const activeHideSplice = ref(false);

function queryKey(base: 'before' | 'after' | 'party' | 'template' | 'partyMode' | 'hideSplice' | 'limit'): string {
  if (!props.queryPrefix) {
    return base;
  }

  return `${props.queryPrefix}${base.charAt(0).toUpperCase()}${base.slice(1)}`;
}

function uniqueValues(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );
}

function readQueryCursor(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readQueryList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  return typeof value === 'string' && value.trim().length > 0 ? [value] : [];
}

function readFilterMode(value: unknown): FilterMode {
  return value === 'and' ? 'and' : 'or';
}

function readHideSplice(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.includes('true');
  }

  return value === 'true';
}

function syncFiltersFromRoute() {
  activePartyFilters.value = props.showPartyFilters
    ? uniqueValues(readQueryList(route.query[queryKey('party')]))
    : [];
  activeTemplateFilters.value = uniqueValues(readQueryList(route.query[queryKey('template')]));

  const explicitMode = route.query[queryKey('partyMode')];
  if (explicitMode === 'and' || explicitMode === 'or') {
    activeFilterMode.value = explicitMode;
  } else if (!props.queryPrefix && activePartyFilters.value.length > 0) {
    activeFilterMode.value = readFilterMode(route.query.mode);
  } else {
    activeFilterMode.value = 'or';
  }

  activeHideSplice.value = readHideSplice(route.query[queryKey('hideSplice')]);
}

const renderedContracts = computed(() => {
  const response = contractsResponse.value;
  const fallbackLabel =
    response && 'label' in response && typeof response.label === 'string'
      ? response.label
      : props.title;

  return (response?.contracts ?? []).map((contract) => ({
    ...contract,
    nodeId:
      'nodeId' in contract && typeof contract.nodeId === 'string' ? contract.nodeId : (props.nodeId ?? ''),
    label:
      'label' in contract && typeof contract.label === 'string'
        ? contract.label
        : fallbackLabel,
  }));
});
const activePageSize = computed(() => normalizePageSize(route.query[queryKey('limit')]));

function hasAdvancedFilterQuery(): boolean {
  return (
    activePartyFilters.value.length > 0 ||
    activeTemplateFilters.value.length > 0 ||
    (activePartyFilters.value.length > 0 && activeFilterMode.value !== 'or') ||
    activeHideSplice.value
  );
}

function clearManagedKeys(query: LocationQueryRaw) {
  delete query[queryKey('before')];
  delete query[queryKey('after')];
  delete query[queryKey('party')];
  delete query[queryKey('template')];
  delete query[queryKey('partyMode')];
  delete query[queryKey('hideSplice')];
  delete query[queryKey('limit')];
  if (!props.queryPrefix) {
    delete query.mode;
  }
}

function buildQuery(
  options?: {
    before?: string;
    after?: string;
    parties?: string[];
    templates?: string[];
    mode?: FilterMode;
    hideSplice?: boolean;
    limit?: number;
  },
): LocationQueryRaw {
  const nextQuery: LocationQueryRaw = { ...route.query };
  clearManagedKeys(nextQuery);

  if (options?.before) {
    nextQuery[queryKey('before')] = options.before;
  }
  if (options?.after) {
    nextQuery[queryKey('after')] = options.after;
  }
  const parties = options?.parties;
  if (props.showPartyFilters && (parties?.length ?? 0) > 0) {
    nextQuery[queryKey('party')] = parties;
    nextQuery[queryKey('partyMode')] = options?.mode ?? 'or';
  }
  const templates = options?.templates;
  if ((templates?.length ?? 0) > 0) {
    nextQuery[queryKey('template')] = templates;
  }
  if (options?.hideSplice) {
    nextQuery[queryKey('hideSplice')] = 'true';
  }

  const limit = normalizePageSize(options?.limit);
  if (limit !== DEFAULT_PAGE_SIZE) {
    nextQuery[queryKey('limit')] = String(limit);
  }

  return nextQuery;
}

async function loadTemplateOptions() {
  if (templatesLoaded.value) {
    return;
  }

  try {
    const response =
      props.scope === 'node' && props.nodeId ? await fetchNodeTemplates(props.nodeId) : await fetchTemplates();
    templateOptions.value = response.templates.map((template) => template.templateId);
  } catch {
    templateOptions.value = [];
  } finally {
    templatesLoaded.value = true;
  }
}

async function loadContracts() {
  loading.value = true;
  error.value = null;

  try {
    const before = readQueryCursor(route.query[queryKey('before')]);
    const after = readQueryCursor(route.query[queryKey('after')]);
    const parties = activePartyFilters.value;
    const templates = activeTemplateFilters.value;
    const partyMode = activeFilterMode.value;
    const hideSplice = activeHideSplice.value;
    const limit = activePageSize.value;

    if (props.scope === 'node' && props.nodeId) {
      const options: NonNullable<Parameters<typeof fetchNodeContracts>[1]> = { limit };

      if (before) {
        options.before = before;
      }
      if (after) {
        options.after = after;
      }
      if (parties.length > 0) {
        options.parties = parties;
        options.partyMode = partyMode;
      }
      if (templates.length > 0) {
        options.templates = templates;
      }
      if (hideSplice) {
        options.hideSplice = true;
      }

      contractsResponse.value = await fetchNodeContracts(props.nodeId, options);
      return;
    }

    if (props.scope === 'global') {
      const options: Parameters<typeof fetchLatestContracts>[1] = {};

      if (before) {
        options.before = before;
      }
      if (after) {
        options.after = after;
      }
      if (parties.length > 0) {
        options.parties = parties;
        options.partyMode = partyMode;
      }
      if (templates.length > 0) {
        options.templates = templates;
      }
      if (hideSplice) {
        options.hideSplice = true;
      }

      contractsResponse.value = await fetchLatestContracts(limit, options);
      return;
    }

    if (props.scope === 'party' && props.partyId) {
      const options: NonNullable<Parameters<typeof fetchPartyContracts>[1]> = { limit };

      if (before) {
        options.before = before;
      }
      if (after) {
        options.after = after;
      }
      if (templates.length > 0) {
        options.templates = templates;
      }
      if (hideSplice) {
        options.hideSplice = true;
      }

      contractsResponse.value = await fetchPartyContracts(props.partyId, options);
      return;
    }

    throw new Error('Invalid contracts browser configuration');
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
  } finally {
    loading.value = false;
  }
}

defineExpose({
  reload: loadContracts,
});

watch(
  () => [props.scope, props.nodeId, props.partyId],
  () => {
    templateOptions.value = [];
    templatesLoaded.value = false;
    if (showAdvancedFilter.value) {
      void loadTemplateOptions();
    }
  },
);

watch(
  () => [route.fullPath, props.scope, props.nodeId, props.partyId],
  () => {
    syncFiltersFromRoute();
    void loadContracts();
  },
  { immediate: true },
);

watch(
  () => route.fullPath,
  () => {
    syncFiltersFromRoute();
    if (hasAdvancedFilterQuery()) {
      showAdvancedFilter.value = true;
    }
  },
  { immediate: true },
);

watch(
  () => showAdvancedFilter.value,
  (visible) => {
    if (visible) {
      void loadTemplateOptions();
    }
  },
  { immediate: true },
);

async function pushQuery(query: LocationQueryRaw) {
  await router.push({
    path: props.path,
    query,
  });
}

function toggleAdvancedFilter() {
  showAdvancedFilter.value = !showAdvancedFilter.value;
}

async function showOlder() {
  const cursor = contractsResponse.value?.nextBefore;
  if (!cursor) {
    return;
  }

  await pushQuery(
    buildQuery({
      before: cursor,
      parties: activePartyFilters.value,
      templates: activeTemplateFilters.value,
      mode: activeFilterMode.value,
      hideSplice: activeHideSplice.value,
      limit: activePageSize.value,
    }),
  );
}

async function showNewer() {
  const cursor = contractsResponse.value?.nextAfter;
  if (!cursor) {
    return;
  }

  await pushQuery(
    buildQuery({
      after: cursor,
      parties: activePartyFilters.value,
      templates: activeTemplateFilters.value,
      mode: activeFilterMode.value,
      hideSplice: activeHideSplice.value,
      limit: activePageSize.value,
    }),
  );
}

async function setPageSize(limit: number) {
  await pushQuery(
    buildQuery({
      parties: activePartyFilters.value,
      templates: activeTemplateFilters.value,
      mode: activeFilterMode.value,
      hideSplice: activeHideSplice.value,
      limit,
    }),
  );
}

async function addPartyFilter() {
  const nextParty = partyFilterDraft.value.trim();
  if (!nextParty || !props.showPartyFilters) {
    return;
  }

  const nextParties = uniqueValues([...activePartyFilters.value, nextParty]);
  partyFilterDraft.value = '';
  activePartyFilters.value = nextParties;

  await pushQuery(
    buildQuery({
      parties: nextParties,
      templates: activeTemplateFilters.value,
      mode: activeFilterMode.value,
      hideSplice: activeHideSplice.value,
      limit: activePageSize.value,
    }),
  );
}

async function removePartyFilter(party: string) {
  const nextParties = activePartyFilters.value.filter((candidate) => candidate !== party);
  activePartyFilters.value = nextParties;

  await pushQuery(
    buildQuery({
      parties: nextParties,
      templates: activeTemplateFilters.value,
      mode: activeFilterMode.value,
      hideSplice: activeHideSplice.value,
      limit: activePageSize.value,
    }),
  );
}

async function addTemplateFilter() {
  const nextTemplate = templateFilterDraft.value.trim();
  if (!nextTemplate) {
    return;
  }

  const nextTemplates = uniqueValues([...activeTemplateFilters.value, nextTemplate]);
  templateFilterDraft.value = '';
  activeTemplateFilters.value = nextTemplates;

  await pushQuery(
    buildQuery({
      parties: activePartyFilters.value,
      templates: nextTemplates,
      mode: activeFilterMode.value,
      hideSplice: activeHideSplice.value,
      limit: activePageSize.value,
    }),
  );
}

async function removeTemplateFilter(templateId: string) {
  const nextTemplates = activeTemplateFilters.value.filter((candidate) => candidate !== templateId);
  activeTemplateFilters.value = nextTemplates;

  await pushQuery(
    buildQuery({
      parties: activePartyFilters.value,
      templates: nextTemplates,
      mode: activeFilterMode.value,
      hideSplice: activeHideSplice.value,
      limit: activePageSize.value,
    }),
  );
}

async function setFilterMode(mode: FilterMode) {
  activeFilterMode.value = mode;

  await pushQuery(
    buildQuery({
      parties: activePartyFilters.value,
      templates: activeTemplateFilters.value,
      mode,
      hideSplice: activeHideSplice.value,
      limit: activePageSize.value,
    }),
  );
}

async function setHideSplice(hidden: boolean) {
  activeHideSplice.value = hidden;

  await pushQuery(
    buildQuery({
      parties: activePartyFilters.value,
      templates: activeTemplateFilters.value,
      mode: activeFilterMode.value,
      hideSplice: hidden,
      limit: activePageSize.value,
    }),
  );
}
</script>

<template>
  <section class="node-updates">
    <header class="node-detail__hero">
      <div>
        <p class="activity-home__eyebrow">{{ eyebrow }}</p>
        <h3>{{ title }}</h3>
      </div>
      <div class="results-header__actions">
        <UpdatesToolbar
          :advanced-filter-expanded="showAdvancedFilter"
          :advanced-filter-controls="advancedFilterId"
          :newer-disabled="!contractsResponse?.nextAfter || loading"
          :older-disabled="!contractsResponse?.nextBefore || loading"
          :page-size="activePageSize"
          @toggle-advanced-filter="toggleAdvancedFilter"
          @page-size-change="setPageSize"
          @newer="showNewer"
          @older="showOlder"
        />
        <QuerySourcePill source="pqs" />
      </div>
    </header>

    <Transition name="node-updates-filter">
      <UpdatesAdvancedFilter
        v-if="showAdvancedFilter"
        :id="advancedFilterId"
        v-model:party-draft="partyFilterDraft"
        v-model:template-draft="templateFilterDraft"
        :active-parties="activePartyFilters"
        :active-templates="activeTemplateFilters"
        :template-options="templateOptions"
        :filter-mode="activeFilterMode"
        :hide-splice="activeHideSplice"
        :show-party-filters="showPartyFilters"
        hide-splice-label="Hide Splice Templates"
        @add-party-filter="addPartyFilter"
        @add-template-filter="addTemplateFilter"
        @remove-party-filter="removePartyFilter"
        @remove-template-filter="removeTemplateFilter"
        @set-filter-mode="setFilterMode"
        @set-hide-splice="setHideSplice"
      />
    </Transition>

    <p v-if="!contractsResponse && loading" class="dashboard__message">{{ loadingMessage }}</p>
    <p v-else-if="error" class="dashboard__message dashboard__message--error">{{ error }}</p>
    <p v-else-if="contractsResponse && renderedContracts.length === 0" class="dashboard__message">
      {{ emptyMessage }}
    </p>

    <section
      v-if="contractsResponse && renderedContracts.length > 0"
      class="node-updates__section"
      :aria-busy="loading ? 'true' : 'false'"
    >
      <div
        v-if="loading"
        class="node-updates__overlay"
        role="status"
        :aria-label="spinnerLabel"
      >
        <span class="node-updates__spinner" aria-hidden="true"></span>
      </div>

      <ContractsTable
        :class="{ 'node-updates__table--loading': loading }"
        :contracts="renderedContracts"
        :show-node-column="showNodeColumn"
        :aria-label="tableAriaLabel"
      />
    </section>
  </section>
</template>
