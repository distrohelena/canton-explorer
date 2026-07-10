<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { LocationQueryRaw } from 'vue-router';
import { useRoute, useRouter } from 'vue-router';
import TokenTransfersBrowser from '../components/TokenTransfersBrowser.vue';
import TokensAdvancedFilter from '../components/TokensAdvancedFilter.vue';
import QuerySourcePill from '../components/QuerySourcePill.vue';
import UpdatesToolbar from '../components/UpdatesToolbar.vue';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, normalizePageSize } from '../lib/pagination';
import { fetchTokens } from '../lib/api';
import type { TokensResponse } from '../types/tokens';

const route = useRoute();
const router = useRouter();
const tokensResponse = ref<TokensResponse | null>(null);
const tokensError = ref<string | null>(null);
const loadingTokens = ref(true);
const showAdvancedFilter = ref(false);
const nameFilterDraft = ref('');
const excludeNameFilterDraft = ref('');
const issuerFilterDraft = ref('');
const tokensAdvancedFilterId = 'tokens-advanced-filter';

function readTokenCursor(key: 'tokensBefore' | 'tokensAfter'): string | undefined {
  const value = route.query[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function readTokenQueryList(key: 'tokensName' | 'tokensExcludeName' | 'tokensIssuer'): string[] {
  const value = route.query[key];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  return typeof value === 'string' && value.trim().length > 0 ? [value] : [];
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

function readTokenPageSize(): number {
  return normalizePageSize(route.query.tokensLimit);
}

const activeNameFilters = computed(() => uniqueValues(readTokenQueryList('tokensName')));
const activeExcludeNameFilters = computed(() =>
  uniqueValues(readTokenQueryList('tokensExcludeName')),
);
const activeIssuerFilters = computed(() => uniqueValues(readTokenQueryList('tokensIssuer')));

function hasAdvancedFilterQuery(): boolean {
  return (
    activeNameFilters.value.length > 0
    || activeExcludeNameFilters.value.length > 0
    || activeIssuerFilters.value.length > 0
  );
}

function buildTokenQuery(options?: {
  before?: string;
  after?: string;
  limit?: number;
  names?: string[];
  excludeNames?: string[];
  issuers?: string[];
}): LocationQueryRaw {
  const nextQuery: LocationQueryRaw = { ...route.query };
  delete nextQuery.tokensBefore;
  delete nextQuery.tokensAfter;
  delete nextQuery.tokensLimit;
  delete nextQuery.tokensName;
  delete nextQuery.tokensExcludeName;
  delete nextQuery.tokensIssuer;

  if (options?.before) {
    nextQuery.tokensBefore = options.before;
  }

  if (options?.after) {
    nextQuery.tokensAfter = options.after;
  }

  const limit = normalizePageSize(options?.limit);
  if (limit !== DEFAULT_PAGE_SIZE) {
    nextQuery.tokensLimit = String(limit);
  }

  if ((options?.names?.length ?? 0) > 0) {
    nextQuery.tokensName = options?.names;
  }

  if ((options?.excludeNames?.length ?? 0) > 0) {
    nextQuery.tokensExcludeName = options?.excludeNames;
  }

  if ((options?.issuers?.length ?? 0) > 0) {
    nextQuery.tokensIssuer = options?.issuers;
  }

  return nextQuery;
}

async function pushTokenQuery(query: LocationQueryRaw) {
  await router.push({
    path: route.path,
    query,
  });
}

async function loadTokens() {
  loadingTokens.value = true;
  tokensError.value = null;

  try {
    const before = readTokenCursor('tokensBefore');
    const after = before ? undefined : readTokenCursor('tokensAfter');
    const limit = readTokenPageSize();
    const names = activeNameFilters.value;
    const excludeNames = activeExcludeNameFilters.value;
    const issuers = activeIssuerFilters.value;
    tokensResponse.value = await fetchTokens({
      before,
      after,
      limit,
      names,
      excludeNames,
      issuers,
    });
  } catch (err) {
    tokensError.value = err instanceof Error ? err.message : 'Unknown error';
  } finally {
    loadingTokens.value = false;
  }
}

function tokenDetailLink(tokenId: string): string {
  return `/tokens/${encodeURIComponent(tokenId)}`;
}

function displayTokenTitle(token: TokensResponse['tokens'][number]): string {
  const normalizedSymbol = token.symbol?.trim() ?? '';
  return normalizedSymbol.length > 0 ? normalizedSymbol : token.name;
}

async function showPreviousTokens() {
  const cursor = tokensResponse.value?.nextAfter;
  if (!cursor) {
    return;
  }

  await pushTokenQuery(buildTokenQuery({
    after: cursor,
    limit: readTokenPageSize(),
    names: activeNameFilters.value,
    excludeNames: activeExcludeNameFilters.value,
    issuers: activeIssuerFilters.value,
  }));
}

async function showNextTokens() {
  const cursor = tokensResponse.value?.nextBefore;
  if (!cursor) {
    return;
  }

  await pushTokenQuery(buildTokenQuery({
    before: cursor,
    limit: readTokenPageSize(),
    names: activeNameFilters.value,
    excludeNames: activeExcludeNameFilters.value,
    issuers: activeIssuerFilters.value,
  }));
}

async function setTokenPageSize(limit: number) {
  await pushTokenQuery(buildTokenQuery({
    limit,
    names: activeNameFilters.value,
    excludeNames: activeExcludeNameFilters.value,
    issuers: activeIssuerFilters.value,
  }));
}

function toggleAdvancedFilter() {
  showAdvancedFilter.value = !showAdvancedFilter.value;
}

async function setTokenFilters(options?: {
  names?: string[];
  excludeNames?: string[];
  issuers?: string[];
}) {
  await pushTokenQuery(buildTokenQuery({
    limit: readTokenPageSize(),
    names: options?.names ?? activeNameFilters.value,
    excludeNames: options?.excludeNames ?? activeExcludeNameFilters.value,
    issuers: options?.issuers ?? activeIssuerFilters.value,
  }));
}

async function addNameFilter() {
  const nextValue = nameFilterDraft.value.trim();
  if (!nextValue) {
    return;
  }

  nameFilterDraft.value = '';
  await setTokenFilters({
    names: uniqueValues([...activeNameFilters.value, nextValue]),
  });
}

async function addExcludeNameFilter() {
  const nextValue = excludeNameFilterDraft.value.trim();
  if (!nextValue) {
    return;
  }

  excludeNameFilterDraft.value = '';
  await setTokenFilters({
    excludeNames: uniqueValues([...activeExcludeNameFilters.value, nextValue]),
  });
}

async function addIssuerFilter() {
  const nextValue = issuerFilterDraft.value.trim();
  if (!nextValue) {
    return;
  }

  issuerFilterDraft.value = '';
  await setTokenFilters({
    issuers: uniqueValues([...activeIssuerFilters.value, nextValue]),
  });
}

async function removeNameFilter(value: string) {
  await setTokenFilters({
    names: activeNameFilters.value.filter((item) => item !== value),
  });
}

async function removeExcludeNameFilter(value: string) {
  await setTokenFilters({
    excludeNames: activeExcludeNameFilters.value.filter((item) => item !== value),
  });
}

async function removeIssuerFilter(value: string) {
  await setTokenFilters({
    issuers: activeIssuerFilters.value.filter((item) => item !== value),
  });
}

watch(
  () => [
    route.query.tokensBefore,
    route.query.tokensAfter,
    route.query.tokensLimit,
    route.query.tokensName,
    route.query.tokensExcludeName,
    route.query.tokensIssuer,
  ],
  () => {
    if (hasAdvancedFilterQuery()) {
      showAdvancedFilter.value = true;
    }
    void loadTokens();
  },
  { immediate: true },
);
</script>

<template>
  <section class="dashboard tokens-page">
    <header class="dashboard__hero">
      <div class="dashboard__hero-copy">
        <p class="activity-home__eyebrow">Tokens</p>
        <h2>Tokens</h2>
      </div>
    </header>

    <section class="node-detail__section tokens-page__section">
      <header class="node-detail__hero">
        <div>
          <p class="activity-home__eyebrow">Inventory</p>
          <h3>Known Tokens</h3>
        </div>
        <div v-if="tokensResponse" class="results-header__actions">
          <UpdatesToolbar
            :advanced-filter-expanded="showAdvancedFilter"
            :advanced-filter-controls="tokensAdvancedFilterId"
            :newer-disabled="!tokensResponse.nextAfter || loadingTokens"
            :older-disabled="!tokensResponse.nextBefore || loadingTokens"
            :page-size="readTokenPageSize()"
            :page-size-options="PAGE_SIZE_OPTIONS"
            page-size-aria-label="Known tokens per page"
            @toggle-advanced-filter="toggleAdvancedFilter"
            @newer="showPreviousTokens"
            @older="showNextTokens"
            @page-size-change="setTokenPageSize"
          />
        </div>
      </header>

      <TokensAdvancedFilter
        v-if="showAdvancedFilter"
        :id="tokensAdvancedFilterId"
        v-model:name-draft="nameFilterDraft"
        v-model:exclude-name-draft="excludeNameFilterDraft"
        v-model:issuer-draft="issuerFilterDraft"
        :active-names="activeNameFilters"
        :active-excluded-names="activeExcludeNameFilters"
        :active-issuers="activeIssuerFilters"
        @add-name-filter="addNameFilter"
        @add-exclude-name-filter="addExcludeNameFilter"
        @add-issuer-filter="addIssuerFilter"
        @remove-name-filter="removeNameFilter"
        @remove-exclude-name-filter="removeExcludeNameFilter"
        @remove-issuer-filter="removeIssuerFilter"
      />

      <p v-if="!tokensResponse && loadingTokens" class="dashboard__message">Loading tokens...</p>
      <p v-else-if="tokensError" class="dashboard__message dashboard__message--error">
        {{ tokensError }}
      </p>
      <p v-else-if="tokensResponse && tokensResponse.tokens.length === 0" class="dashboard__message">
        No tokens discovered yet.
      </p>

      <div v-else-if="tokensResponse" class="tokens-page__known-list">
        <RouterLink
          v-for="token in tokensResponse.tokens"
          :key="token.tokenId"
          class="tokens-page__known-card"
          :to="tokenDetailLink(token.tokenId)"
        >
          <div class="tokens-page__known-main">
            <h4>{{ displayTokenTitle(token) }}</h4>
            <p v-if="token.issuer" class="tokens-page__known-issuer">{{ token.issuer }}</p>
          </div>
          <QuerySourcePill :source="token.source" />
        </RouterLink>
      </div>
    </section>

    <TokenTransfersBrowser
      scope="global"
      path="/tokens"
      title="Latest Transfers"
      table-aria-label="Latest token transfers"
      spinner-label="Updating latest token transfers"
      loading-message="Loading latest token transfers..."
      empty-message="No token transfers available yet."
    />
  </section>
</template>
