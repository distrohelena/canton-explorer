<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { fetchSearchResults } from '../lib/api';
import type { SearchResultGroup, SearchResultsResponse } from '../types/search';

const route = useRoute();
const results = ref<SearchResultsResponse | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const trimmedQuery = computed(() => {
  const rawQuery = Array.isArray(route.query.q) ? route.query.q[0] : route.query.q;
  return typeof rawQuery === 'string' ? rawQuery.trim() : '';
});

const hasAnyMatches = computed(() => {
  if (!results.value) {
    return false;
  }

  return (
    results.value.updates.items.length > 0 ||
    results.value.contracts.items.length > 0 ||
    results.value.parties.items.length > 0 ||
    results.value.packages.packageIds.items.length > 0 ||
    results.value.packages.packageNames.items.length > 0
  );
});

const hasAnyWarnings = computed(() => {
  if (!results.value) {
    return false;
  }

  return (
    results.value.updates.warnings.length > 0 ||
    results.value.contracts.warnings.length > 0 ||
    results.value.parties.warnings.length > 0 ||
    results.value.packages.packageIds.warnings.length > 0 ||
    results.value.packages.packageNames.warnings.length > 0
  );
});

function groupSummary<T>(group: SearchResultGroup<T>): string {
  if (group.truncated) {
    return `${group.displayedCount}+`;
  }

  return String(group.displayedCount);
}

async function loadResults(query: string) {
  if (!query) {
    results.value = null;
    error.value = null;
    loading.value = false;
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    results.value = await fetchSearchResults(query);
  } catch (loadError) {
    results.value = null;
    error.value = loadError instanceof Error ? loadError.message : 'Failed to load search results.';
  } finally {
    loading.value = false;
  }
}

watch(trimmedQuery, (query) => {
  void loadResults(query);
}, { immediate: true });
</script>

<template>
  <section class="search-results-view">
    <header class="search-results-view__header">
      <h2>Search Results</h2>
      <p v-if="trimmedQuery" class="search-results-view__query">
        Query: <strong>{{ trimmedQuery }}</strong>
      </p>
    </header>

    <div v-if="!trimmedQuery" class="search-results-view__empty">
      Enter a search query to begin.
    </div>
    <div v-else-if="loading" class="search-results-view__loading">Loading search results...</div>
    <div v-else-if="error" class="search-results-view__error">{{ error }}</div>
    <div v-else-if="results" class="search-results-view__content">
      <div v-if="!hasAnyMatches && !hasAnyWarnings" class="search-results-view__empty">
        No matches found for "{{ trimmedQuery }}".
      </div>

      <template v-else>
        <section class="search-results-group">
          <div class="search-results-group__heading">
            <h3>Updates</h3>
            <span>{{ groupSummary(results.updates) }}</span>
          </div>
          <p v-for="warning in results.updates.warnings" :key="warning" class="search-results-group__warning">
            {{ warning }}
          </p>
          <RouterLink
            v-for="update in results.updates.items"
            :key="`${update.nodeId}:${update.eventOffset}`"
            class="search-results-row"
            :to="`/nodes/${update.nodeId}/updates/${update.eventOffset}`"
          >
            <span class="search-results-row__primary">{{ update.eventOffset }}</span>
            <span>{{ update.label }}</span>
            <span>{{ update.recordTime ?? 'n/a' }}</span>
          </RouterLink>
        </section>

        <section class="search-results-group">
          <div class="search-results-group__heading">
            <h3>Contracts</h3>
            <span>{{ groupSummary(results.contracts) }}</span>
          </div>
          <p v-for="warning in results.contracts.warnings" :key="warning" class="search-results-group__warning">
            {{ warning }}
          </p>
          <RouterLink
            v-for="contract in results.contracts.items"
            :key="`${contract.nodeId}:${contract.contractId}`"
            class="search-results-row"
            :to="`/nodes/${contract.nodeId}/contracts/${contract.contractId}`"
          >
            <span class="search-results-row__primary">{{ contract.contractId }}</span>
            <span>{{ contract.label }}</span>
            <span>{{ contract.templateId ?? 'n/a' }}</span>
          </RouterLink>
        </section>

        <section class="search-results-group">
          <div class="search-results-group__heading">
            <h3>Parties</h3>
            <span>{{ groupSummary(results.parties) }}</span>
          </div>
          <p v-for="warning in results.parties.warnings" :key="warning" class="search-results-group__warning">
            {{ warning }}
          </p>
          <RouterLink
            v-for="party in results.parties.items"
            :key="party.partyId"
            class="search-results-row"
            :to="`/parties/${encodeURIComponent(party.partyId)}`"
            :aria-label="party.partyId"
          >
            <span class="search-results-row__primary">{{ party.partyId }}</span>
            <span aria-hidden="true">{{ party.nodeIds.join(', ') }}</span>
          </RouterLink>
        </section>

        <section class="search-results-group">
          <div class="search-results-group__heading">
            <h3>Packages</h3>
            <span>{{
              results.packages.packageIds.displayedCount + results.packages.packageNames.displayedCount
            }}</span>
          </div>

          <div class="search-results-group__subheading">Package IDs</div>
          <p
            v-for="warning in results.packages.packageIds.warnings"
            :key="`package-id-${warning}`"
            class="search-results-group__warning"
          >
            {{ warning }}
          </p>
          <RouterLink
            v-for="pkg in results.packages.packageIds.items"
            :key="pkg.packageId"
            class="search-results-row"
            :to="`/packages/${pkg.packageId}`"
          >
            <span class="search-results-row__primary">{{ pkg.packageId }}</span>
            <span>{{ pkg.name ?? 'Unnamed package' }}</span>
            <span>{{ pkg.version ?? 'n/a' }}</span>
          </RouterLink>

          <div class="search-results-group__subheading">Package Names</div>
          <p
            v-for="warning in results.packages.packageNames.warnings"
            :key="`package-name-${warning}`"
            class="search-results-group__warning"
          >
            {{ warning }}
          </p>
          <RouterLink
            v-for="pkg in results.packages.packageNames.items"
            :key="pkg.name"
            class="search-results-row"
            :to="`/packages/by-name/${encodeURIComponent(pkg.name)}`"
            :aria-label="pkg.name"
          >
            <span class="search-results-row__primary">{{ pkg.name }}</span>
            <span aria-hidden="true">{{ pkg.packages.length }} version(s)</span>
          </RouterLink>
        </section>
      </template>
    </div>
  </section>
</template>
