<script setup lang="ts">
import { ref, watch } from 'vue';
import type { LocationQueryRaw } from 'vue-router';
import { useRoute, useRouter } from 'vue-router';
import TokenTransfersBrowser from '../components/TokenTransfersBrowser.vue';
import QuerySourcePill from '../components/QuerySourcePill.vue';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, normalizePageSize } from '../lib/pagination';
import { fetchTokens } from '../lib/api';
import type { TokensResponse } from '../types/tokens';

const route = useRoute();
const router = useRouter();
const tokensResponse = ref<TokensResponse | null>(null);
const tokensError = ref<string | null>(null);
const loadingTokens = ref(true);

function readTokenCursor(key: 'tokensBefore' | 'tokensAfter'): string | undefined {
  const value = route.query[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function readTokenPageSize(): number {
  return normalizePageSize(route.query.tokensLimit);
}

function buildTokenQuery(options?: { before?: string; after?: string; limit?: number }): LocationQueryRaw {
  const nextQuery: LocationQueryRaw = { ...route.query };
  delete nextQuery.tokensBefore;
  delete nextQuery.tokensAfter;
  delete nextQuery.tokensLimit;

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
    tokensResponse.value = await fetchTokens({
      before,
      after,
      limit,
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

async function showPreviousTokens() {
  const cursor = tokensResponse.value?.nextAfter;
  if (!cursor) {
    return;
  }

  await pushTokenQuery(buildTokenQuery({ after: cursor, limit: readTokenPageSize() }));
}

async function showNextTokens() {
  const cursor = tokensResponse.value?.nextBefore;
  if (!cursor) {
    return;
  }

  await pushTokenQuery(buildTokenQuery({ before: cursor, limit: readTokenPageSize() }));
}

async function setTokenPageSize(limit: number) {
  await pushTokenQuery(buildTokenQuery({ limit }));
}

function handleTokenPageSizeChange(event: Event) {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) {
    return;
  }

  void setTokenPageSize(Number.parseInt(target.value, 10));
}

watch(
  () => [route.query.tokensBefore, route.query.tokensAfter, route.query.tokensLimit],
  () => {
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
          <div class="node-updates__pager">
            <label class="node-updates__page-size">
              <span class="node-updates__page-size-label">Show</span>
              <select
                class="node-updates__page-size-select"
                :value="readTokenPageSize()"
                aria-label="Known tokens per page"
                @change="handleTokenPageSizeChange"
              >
                <option
                  v-for="option in PAGE_SIZE_OPTIONS"
                  :key="option"
                  :value="option"
                >
                  {{ option }}
                </option>
              </select>
            </label>
            <button
              type="button"
              class="dashboard__refresh"
              :disabled="!tokensResponse.nextAfter || loadingTokens"
              @click="showPreviousTokens"
            >
              Newer
            </button>
            <button
              type="button"
              class="dashboard__refresh"
              :disabled="!tokensResponse.nextBefore || loadingTokens"
              @click="showNextTokens"
            >
              Older
            </button>
          </div>
        </div>
      </header>

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
            <h4>{{ token.name }}</h4>
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
