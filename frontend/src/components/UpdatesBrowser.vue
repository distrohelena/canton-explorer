<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { LocationQueryRaw } from 'vue-router';
import { fetchLatestUpdates, fetchNodeTemplates, fetchNodeUpdates, fetchPartyUpdates, fetchTemplates } from '../lib/api';
import { DEFAULT_PAGE_SIZE, normalizePageSize } from '../lib/pagination';
import type { GlobalUpdateEntry, GlobalUpdatesResponse, NodeUpdateEntry, NodeUpdatesResponse } from '../types/updates';
import UpdatesAdvancedFilter from './UpdatesAdvancedFilter.vue';
import UpdatesToolbar from './UpdatesToolbar.vue';

type FilterMode = 'or' | 'and';
type UpdateScope = 'global' | 'node' | 'party';
type HeadingTag = 'h2' | 'h3';
type UpdatesResponse = GlobalUpdatesResponse | NodeUpdatesResponse;
type UpdatesEntry = GlobalUpdateEntry | NodeUpdateEntry;

const props = withDefaults(
  defineProps<{
    scope: UpdateScope;
    path: string;
    title: string;
    showTitle?: boolean;
    eyebrow?: string;
    headingTag?: HeadingTag;
    nodeId?: string;
    partyId?: string;
    queryPrefix?: string;
    showNodeColumn?: boolean;
    showPartyFilters?: boolean;
    responseLabelTitle?: boolean;
    sourceTag: 'updates' | 'node' | 'party';
    advancedFilterId: string;
    loadingMessage?: string;
    emptyMessage?: string;
    tableAriaLabel?: string;
    spinnerLabel?: string;
    rowClass?: string;
  }>(),
  {
    eyebrow: 'Updates',
    showTitle: true,
    headingTag: 'h3',
    queryPrefix: '',
    showNodeColumn: false,
    showPartyFilters: true,
    responseLabelTitle: false,
    loadingMessage: 'Loading updates...',
    emptyMessage: 'No updates available yet.',
    tableAriaLabel: 'Updates',
    spinnerLabel: 'Updating updates',
    rowClass: '',
  },
);

const route = useRoute();
const router = useRouter();
const updatesResponse = ref<UpdatesResponse | null>(null);
const error = ref<string | null>(null);
const loading = ref(false);
const showAdvancedFilter = ref(false);
const partyFilterDraft = ref('');
const templateFilterDraft = ref('');
const templateOptions = ref<string[]>([]);
const templatesLoaded = ref(false);

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

const activePartyFilters = computed(() =>
  props.showPartyFilters ? uniqueValues(readQueryList(route.query[queryKey('party')])) : [],
);
const activeTemplateFilters = computed(() =>
  uniqueValues(readQueryList(route.query[queryKey('template')])),
);
const activeFilterMode = computed<FilterMode>(() => {
  const explicitMode = route.query[queryKey('partyMode')];
  if (explicitMode === 'and' || explicitMode === 'or') {
    return explicitMode;
  }

  if (!props.queryPrefix && activePartyFilters.value.length > 0) {
    return readFilterMode(route.query.mode);
  }

  return 'or';
});
const activeHideSplice = computed(() => readHideSplice(route.query[queryKey('hideSplice')]));
const activePageSize = computed(() => normalizePageSize(route.query[queryKey('limit')]));

function hasAdvancedFilterQuery(): boolean {
  return (
    activePartyFilters.value.length > 0 ||
    activeTemplateFilters.value.length > 0 ||
    typeof route.query[queryKey('partyMode')] === 'string' ||
    (!props.queryPrefix &&
      activePartyFilters.value.length > 0 &&
      typeof route.query.mode === 'string') ||
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

  if (props.showPartyFilters && (options?.parties?.length ?? 0) > 0) {
    nextQuery[queryKey('party')] = options?.parties;
    nextQuery[queryKey('partyMode')] = options?.mode ?? 'or';
  }

  if ((options?.templates?.length ?? 0) > 0) {
    nextQuery[queryKey('template')] = options?.templates;
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

function formatRecordTime(recordTime: string | null): { date: string; time: string } | null {
  if (!recordTime) {
    return null;
  }

  const parsed = new Date(recordTime);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return {
    date: new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
    }).format(parsed),
    time: new Intl.DateTimeFormat(undefined, {
      timeStyle: 'medium',
    }).format(parsed),
  };
}

function resolveNodeId(update: UpdatesEntry): string | null {
  if ('nodeId' in update && typeof update.nodeId === 'string') {
    return update.nodeId;
  }

  return props.nodeId ?? null;
}

function resolveNodeLabel(update: UpdatesEntry): string | null {
  return 'label' in update && typeof update.label === 'string' ? update.label : null;
}

const renderedUpdates = computed(() =>
  (updatesResponse.value?.updates ?? []).map((update) => ({
    ...update,
    nodeId: resolveNodeId(update),
    label: resolveNodeLabel(update),
    recordTimeLines: formatRecordTime(update.recordTime),
  })),
);

const rowClassList = computed(() => [
  props.rowClass,
  props.showNodeColumn ? 'node-updates__row--with-node' : '',
]);

const headingText = computed(() => {
  if (
    props.responseLabelTitle &&
    updatesResponse.value &&
    'label' in updatesResponse.value &&
    typeof updatesResponse.value.label === 'string'
  ) {
    return `${updatesResponse.value.label}${props.title}`;
  }

  return props.title;
});

async function loadTemplateOptions() {
  if (templatesLoaded.value) {
    return;
  }

  try {
    const response =
      props.scope === 'node' && props.nodeId
        ? await fetchNodeTemplates(props.nodeId)
        : await fetchTemplates();
    templateOptions.value = response.templates.map((template) => template.templateId);
  } catch {
    templateOptions.value = [];
  } finally {
    templatesLoaded.value = true;
  }
}

async function loadUpdates() {
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

    if (props.scope === 'global') {
      const options: Parameters<typeof fetchLatestUpdates>[1] = {};
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

      updatesResponse.value = await fetchLatestUpdates(limit, options);
      return;
    }

    if (props.scope === 'node' && props.nodeId) {
      const options: NonNullable<Parameters<typeof fetchNodeUpdates>[1]> = { limit };
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

      updatesResponse.value = await fetchNodeUpdates(props.nodeId, options);
      return;
    }

    if (props.scope === 'party' && props.partyId) {
      const options: NonNullable<Parameters<typeof fetchPartyUpdates>[1]> = { limit };
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

      updatesResponse.value = await fetchPartyUpdates(props.partyId, options);
      return;
    }

    throw new Error('Invalid updates browser configuration');
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
  } finally {
    loading.value = false;
  }
}

defineExpose({
  reload: loadUpdates,
});

watch(
  () => route.fullPath,
  () => {
    void loadUpdates();
  },
  { immediate: true },
);

watch(
  () => [
    route.query[queryKey('party')],
    route.query[queryKey('template')],
    route.query[queryKey('partyMode')],
    route.query[queryKey('hideSplice')],
    props.queryPrefix ? undefined : route.query.mode,
  ],
  () => {
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
  const cursor = updatesResponse.value?.nextBefore;
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
  const cursor = updatesResponse.value?.nextAfter;
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

function updateLink(update: (typeof renderedUpdates.value)[number]): string | null {
  if (!update.nodeId) {
    return null;
  }

  const params = new URLSearchParams();
  params.set('from', props.sourceTag);

  if (props.sourceTag === 'party' && props.partyId) {
    params.set('partyId', props.partyId);
  }

  return `/nodes/${update.nodeId}/updates/${update.eventOffset}?${params.toString()}`;
}

function navigateToUpdate(update: (typeof renderedUpdates.value)[number]) {
  const target = updateLink(update);
  if (!target) {
    return;
  }

  void router.push(target);
}

function partyLink(party: string): string {
  return `/parties/${encodeURIComponent(party)}`;
}
</script>

<template>
  <section class="node-updates">
    <header class="node-detail__hero">
      <div v-if="showTitle">
        <p class="activity-home__eyebrow">{{ eyebrow }}</p>
        <component :is="headingTag">{{ headingText }}</component>
      </div>
      <UpdatesToolbar
        :advanced-filter-expanded="showAdvancedFilter"
        :advanced-filter-controls="advancedFilterId"
        :newer-disabled="!updatesResponse?.nextAfter || loading"
        :older-disabled="!updatesResponse?.nextBefore || loading"
        :page-size="activePageSize"
        @toggle-advanced-filter="toggleAdvancedFilter"
        @page-size-change="setPageSize"
        @newer="showNewer"
        @older="showOlder"
      />
    </header>

    <div
      class="node-updates-filter-shell"
      :class="{ 'node-updates-filter-shell--open': showAdvancedFilter }"
      :aria-hidden="!showAdvancedFilter"
      :inert="!showAdvancedFilter"
    >
      <UpdatesAdvancedFilter
        :id="advancedFilterId"
        v-model:party-draft="partyFilterDraft"
        v-model:template-draft="templateFilterDraft"
        :active-parties="activePartyFilters"
        :active-templates="activeTemplateFilters"
        :template-options="templateOptions"
        :filter-mode="activeFilterMode"
        :hide-splice="activeHideSplice"
        :show-party-filters="showPartyFilters"
        @add-party-filter="addPartyFilter"
        @add-template-filter="addTemplateFilter"
        @remove-party-filter="removePartyFilter"
        @remove-template-filter="removeTemplateFilter"
        @set-filter-mode="setFilterMode"
        @set-hide-splice="setHideSplice"
      />
    </div>

    <p v-if="!updatesResponse && loading" class="dashboard__message">{{ loadingMessage }}</p>
    <p v-else-if="error" class="dashboard__message dashboard__message--error">{{ error }}</p>
    <p v-else-if="updatesResponse && renderedUpdates.length === 0" class="dashboard__message">
      {{ emptyMessage }}
    </p>

    <section
      v-if="updatesResponse && renderedUpdates.length > 0"
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

      <div
        class="node-updates__table"
        :class="{ 'node-updates__table--loading': loading }"
        role="table"
        :aria-label="tableAriaLabel"
      >
        <div class="node-updates__row node-updates__row--head" :class="rowClassList" role="row">
          <span v-if="showNodeColumn" role="columnheader">Node</span>
          <span role="columnheader">Event Offset</span>
          <span role="columnheader">Record Time</span>
          <span role="columnheader">Parties</span>
        </div>

        <div
          v-for="update in renderedUpdates"
          :key="`${update.nodeId ?? 'node'}-${update.eventOffset}`"
          class="node-updates__row node-updates__row--link"
          :class="rowClassList"
          role="row"
          tabindex="0"
          @click="navigateToUpdate(update)"
          @keydown.enter.prevent="navigateToUpdate(update)"
          @keydown.space.prevent="navigateToUpdate(update)"
        >
          <span v-if="showNodeColumn" class="activity-home__updates-node" role="cell">
            {{ update.label ?? 'Unknown node' }}
          </span>
          <span class="node-updates__id" role="cell">
            <RouterLink
              v-if="updateLink(update)"
              class="contract-detail__link"
              :to="updateLink(update) ?? '#'"
              @click.stop
            >
              {{ update.eventOffset }}
            </RouterLink>
            <template v-else>{{ update.eventOffset }}</template>
          </span>
          <span class="node-updates__time" role="cell">
            <template v-if="update.recordTimeLines">
              <span class="node-updates__time-date">{{ update.recordTimeLines.date }}</span>
              <span class="node-updates__time-clock">{{ update.recordTimeLines.time }}</span>
            </template>
            <template v-else>n/a</template>
          </span>
          <span class="node-updates__parties" role="cell">
            <template v-if="update.parties.length > 0">
              <RouterLink
                v-for="party in update.parties"
                :key="party"
                class="node-updates__party contract-detail__link"
                :to="partyLink(party)"
                @click.stop
              >
                {{ party }}
              </RouterLink>
            </template>
            <template v-else>No parties</template>
          </span>
        </div>
      </div>
    </section>
  </section>
</template>
