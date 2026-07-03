<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchNodeUpdates } from '../lib/api';
import type { NodeUpdatesResponse } from '../types/updates';

const props = defineProps<{ id: string }>();
type FilterMode = 'or' | 'and';

const route = useRoute();
const router = useRouter();
const updatesResponse = ref<NodeUpdatesResponse | null>(null);
const error = ref<string | null>(null);
const loading = ref(false);
const showAdvancedFilter = ref(false);
const partyFilterDraft = ref('');

function readQueryCursor(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readPartyFilters(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  return typeof value === 'string' && value.trim().length > 0 ? [value] : [];
}

function readFilterMode(value: unknown): FilterMode {
  return value === 'and' ? 'and' : 'or';
}

function uniqueParties(parties: string[]): string[] {
  return Array.from(
    new Set(
      parties
        .map((party) => party.trim())
        .filter((party) => party.length > 0),
    ),
  );
}

const activePartyFilters = computed(() => uniqueParties(readPartyFilters(route.query.party)));
const activeFilterMode = computed<FilterMode>(() => readFilterMode(route.query.mode));

function hasAdvancedFilterQuery(): boolean {
  return activePartyFilters.value.length > 0 || typeof route.query.mode === 'string';
}

async function loadUpdates() {
  loading.value = true;
  error.value = null;

  try {
    const before = readQueryCursor(route.query.before);
    const after = readQueryCursor(route.query.after);
    const parties = activePartyFilters.value;
    const mode = activeFilterMode.value;
    const options: Parameters<typeof fetchNodeUpdates>[1] = {};

    if (before) {
      options.before = before;
    }
    if (after) {
      options.after = after;
    }
    if (parties.length > 0) {
      options.parties = parties;
      options.mode = mode;
    }

    updatesResponse.value =
      options && Object.keys(options).length > 0
        ? await fetchNodeUpdates(props.id, options)
        : await fetchNodeUpdates(props.id);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
  } finally {
    loading.value = false;
  }
}

watch(
  () => route.fullPath,
  () => {
    void loadUpdates();
  },
  { immediate: true },
);

watch(
  () => [route.query.party, route.query.mode],
  () => {
    if (hasAdvancedFilterQuery()) {
      showAdvancedFilter.value = true;
    }
  },
  { immediate: true },
);

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

const renderedUpdates = computed(() =>
  (updatesResponse.value?.updates ?? []).map((update) => ({
    ...update,
    recordTimeLines: formatRecordTime(update.recordTime),
  })),
);

function buildUpdatesQuery(parties = activePartyFilters.value, mode = activeFilterMode.value) {
  const query: Record<string, string | string[] | undefined> = {};

  if (parties.length > 0) {
    query.party = parties;
    query.mode = mode;
  } else if (mode === 'and') {
    query.mode = 'and';
  }

  return query;
}

async function showOlder() {
  const cursor = updatesResponse.value?.nextBefore;
  if (!cursor) {
    return;
  }

  await router.push({
    path: `/nodes/${props.id}/updates`,
    query: {
      ...buildUpdatesQuery(),
      before: cursor,
    },
  });
}

async function showNewer() {
  const cursor = updatesResponse.value?.nextAfter;
  if (!cursor) {
    return;
  }

  await router.push({
    path: `/nodes/${props.id}/updates`,
    query: {
      ...buildUpdatesQuery(),
      after: cursor,
    },
  });
}

function toggleAdvancedFilter() {
  showAdvancedFilter.value = !showAdvancedFilter.value;
}

async function addPartyFilter() {
  const nextParty = partyFilterDraft.value.trim();
  if (!nextParty) {
    return;
  }

  const nextParties = uniqueParties([...activePartyFilters.value, nextParty]);
  partyFilterDraft.value = '';

  await router.push({
    path: `/nodes/${props.id}/updates`,
    query: buildUpdatesQuery(nextParties),
  });
}

async function removePartyFilter(party: string) {
  const nextParties = activePartyFilters.value.filter((candidate) => candidate !== party);

  await router.push({
    path: `/nodes/${props.id}/updates`,
    query: buildUpdatesQuery(nextParties),
  });
}

async function setFilterMode(mode: FilterMode) {
  await router.push({
    path: `/nodes/${props.id}/updates`,
    query: buildUpdatesQuery(activePartyFilters.value, mode),
  });
}
</script>

<template>
  <section class="node-updates">
    <p v-if="error" class="node-detail__message node-detail__message--error">{{ error }}</p>
    <p v-else-if="!updatesResponse && loading" class="node-detail__message">Loading node updates...</p>
    <div v-else-if="updatesResponse" class="node-page">
      <div class="node-page__rail">
        <RouterLink class="node-detail__back" to="/" aria-label="Back to overview">←</RouterLink>
      </div>

      <div class="node-page__main node-updates__content">
        <header class="node-detail__hero">
          <div>
            <p class="activity-home__eyebrow">Recent Activity</p>
            <h2>{{ updatesResponse.label }} Updates</h2>
          </div>
          <div class="node-updates__pager">
            <button
              type="button"
              class="dashboard__refresh"
              :aria-expanded="showAdvancedFilter"
              aria-controls="node-updates-advanced-filter"
              @click="toggleAdvancedFilter"
            >
              Advanced Filter
            </button>
            <button
              type="button"
              class="dashboard__refresh"
              :disabled="!updatesResponse.nextAfter || loading"
              @click="showNewer"
            >
              Newer
            </button>
            <button
              type="button"
              class="dashboard__refresh"
              :disabled="!updatesResponse.nextBefore || loading"
              @click="showOlder"
            >
              Older
            </button>
          </div>
        </header>

        <Transition name="node-updates-filter">
          <section
            v-if="showAdvancedFilter"
            id="node-updates-advanced-filter"
            class="node-updates__advanced-filter"
            aria-label="Advanced Search Parameters"
          >
            <h3 class="node-updates__advanced-filter-title">Advanced Search Parameters</h3>
            <div class="node-updates__advanced-filter-grid">
              <label class="node-updates__advanced-filter-field">
                <span>Party ID</span>
                <div class="node-updates__advanced-filter-input-row">
                  <input
                    v-model="partyFilterDraft"
                    type="text"
                    placeholder="Party ID"
                    @keydown.enter.prevent="addPartyFilter"
                  />
                  <button
                    type="button"
                    class="node-updates__advanced-filter-add"
                    aria-label="Add party filter"
                    @click="addPartyFilter"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    class="node-updates__advanced-filter-mode"
                    :class="{ 'node-updates__advanced-filter-mode--active': activeFilterMode === 'or' }"
                    aria-label="OR"
                    @click="setFilterMode('or')"
                  >
                    OR
                  </button>
                  <button
                    type="button"
                    class="node-updates__advanced-filter-mode"
                    :class="{ 'node-updates__advanced-filter-mode--active': activeFilterMode === 'and' }"
                    aria-label="AND"
                    @click="setFilterMode('and')"
                  >
                    AND
                  </button>
                </div>
              </label>

              <div v-if="activePartyFilters.length > 0" class="node-updates__advanced-filter-chips">
                <div
                  v-for="party in activePartyFilters"
                  :key="party"
                  class="node-updates__advanced-filter-chip"
                >
                  <span>{{ party }}</span>
                  <button
                    type="button"
                    class="node-updates__advanced-filter-chip-remove"
                    :aria-label="`Remove party filter ${party}`"
                    @click="removePartyFilter(party)"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          </section>
        </Transition>

        <section class="node-updates__section">
          <div class="node-updates__table" role="table" aria-label="Recent node updates">
            <div class="node-updates__row node-updates__row--head" role="row">
              <span role="columnheader">Event Offset</span>
              <span role="columnheader">Record Time</span>
              <span role="columnheader">Parties</span>
            </div>

            <RouterLink
              v-for="update in renderedUpdates"
              :key="update.eventOffset"
              class="node-updates__row node-updates__row--link"
              :to="`/nodes/${props.id}/updates/${update.eventOffset}`"
              role="row"
            >
              <span class="node-updates__id" role="cell">{{ update.eventOffset }}</span>
              <span class="node-updates__time" role="cell">
                <template v-if="update.recordTimeLines">
                  <span class="node-updates__time-date">{{ update.recordTimeLines.date }}</span>
                  <span class="node-updates__time-clock">{{ update.recordTimeLines.time }}</span>
                </template>
                <template v-else>n/a</template>
              </span>
              <span role="cell">{{
                update.parties.length > 0 ? update.parties.join(', ') : 'No parties'
              }}</span>
            </RouterLink>
          </div>
        </section>
      </div>
    </div>
  </section>
</template>
