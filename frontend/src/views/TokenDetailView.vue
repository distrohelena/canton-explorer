<script setup lang="ts">
import { ref, watch } from 'vue';
import type { LocationQueryRaw } from 'vue-router';
import { useRoute, useRouter } from 'vue-router';
import TokenTransfersBrowser from '../components/TokenTransfersBrowser.vue';
import QuerySourcePill from '../components/QuerySourcePill.vue';
import { fetchTokenDetail, fetchTokenHolders } from '../lib/api';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, normalizePageSize } from '../lib/pagination';
import type { TokenDetailResponse, TokenHoldersResponse } from '../types/tokens';

const props = defineProps<{ tokenId: string }>();

const route = useRoute();
const router = useRouter();
const tokenDetail = ref<TokenDetailResponse | null>(null);
const tokenHolders = ref<TokenHoldersResponse | null>(null);
const error = ref<string | null>(null);
const loadingTokenDetail = ref(true);
const loadingTokenHolders = ref(true);

async function loadTokenDetail() {
  loadingTokenDetail.value = true;
  error.value = null;

  try {
    const detail = await fetchTokenDetail(props.tokenId);
    tokenDetail.value = detail;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
  } finally {
    loadingTokenDetail.value = false;
  }
}

function readHolderCursor(key: 'holdersBefore' | 'holdersAfter'): string | undefined {
  const value = route.query[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function readHolderPageSize(): number {
  return normalizePageSize(route.query.holdersLimit);
}

function buildHolderQuery(options?: { before?: string; after?: string; limit?: number }): LocationQueryRaw {
  const nextQuery: LocationQueryRaw = { ...route.query };
  delete nextQuery.holdersBefore;
  delete nextQuery.holdersAfter;
  delete nextQuery.holdersLimit;

  if (options?.before) {
    nextQuery.holdersBefore = options.before;
  }

  if (options?.after) {
    nextQuery.holdersAfter = options.after;
  }

  const limit = normalizePageSize(options?.limit);
  if (limit !== DEFAULT_PAGE_SIZE) {
    nextQuery.holdersLimit = String(limit);
  }

  return nextQuery;
}

async function pushHolderQuery(query: LocationQueryRaw) {
  await router.push({
    path: route.path,
    query,
  });
}

async function loadTokenHolders() {
  loadingTokenHolders.value = true;
  error.value = null;

  try {
    const before = readHolderCursor('holdersBefore');
    const after = before ? undefined : readHolderCursor('holdersAfter');
    const limit = readHolderPageSize();
    const options: { before?: string; after?: string } = {};

    if (before) {
      options.before = before;
    }

    if (after) {
      options.after = after;
    }

    tokenHolders.value = await fetchTokenHolders(props.tokenId, limit, options);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
  } finally {
    loadingTokenHolders.value = false;
  }
}

async function showPreviousHolders() {
  const cursor = tokenHolders.value?.nextAfter;
  if (!cursor) {
    return;
  }

  await pushHolderQuery(buildHolderQuery({ after: cursor, limit: readHolderPageSize() }));
}

async function showNextHolders() {
  const cursor = tokenHolders.value?.nextBefore;
  if (!cursor) {
    return;
  }

  await pushHolderQuery(buildHolderQuery({ before: cursor, limit: readHolderPageSize() }));
}

async function setHolderPageSize(limit: number) {
  await pushHolderQuery(buildHolderQuery({ limit }));
}

function handleHolderPageSizeChange(event: Event) {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) {
    return;
  }

  void setHolderPageSize(Number.parseInt(target.value, 10));
}

function partyLink(partyId: string): string {
  return `/parties/${encodeURIComponent(partyId)}`;
}

watch(
  () => props.tokenId,
  () => {
    void loadTokenDetail();
  },
  { immediate: true },
);

watch(
  () => [props.tokenId, route.query.holdersBefore, route.query.holdersAfter, route.query.holdersLimit],
  () => {
    void loadTokenHolders();
  },
  { immediate: true },
);
</script>

<template>
  <section class="contract-detail">
    <p v-if="error" class="node-detail__message node-detail__message--error">{{ error }}</p>
    <p v-else-if="loadingTokenDetail || !tokenDetail || !tokenHolders" class="node-detail__message">Loading token detail...</p>
    <div v-else class="node-page">
      <div class="node-page__rail">
        <RouterLink class="node-detail__back" to="/tokens" aria-label="Back to overview">
          ←
        </RouterLink>
      </div>

      <div class="node-page__main contract-detail__content">
        <header class="node-detail__hero">
          <div>
            <p class="activity-home__eyebrow">Tokens</p>
            <h2>{{ tokenDetail.token.name }}</h2>
          </div>
          <QuerySourcePill :source="tokenDetail.token.source" />
        </header>

        <div class="node-detail__sections token-detail__sections">
          <section class="node-detail__section contract-detail__section--summary">
            <h3>Overview</h3>
            <dl class="detail-grid contract-detail__summary-grid">
              <div class="contract-detail__summary-item contract-detail__summary-item--full-row">
                <dt>Token ID</dt>
                <dd class="update-detail__id">{{ tokenDetail.token.tokenId }}</dd>
              </div>
              <div class="contract-detail__summary-item">
                <dt>Symbol</dt>
                <dd>{{ tokenDetail.token.symbol ?? 'n/a' }}</dd>
              </div>
              <div class="contract-detail__summary-item">
                <dt>Top Holders</dt>
                <dd>{{ tokenHolders.holders.length }}</dd>
              </div>
              <div class="contract-detail__summary-item">
                <dt>Latest Transfers</dt>
                <dd>{{ tokenDetail.transfers.length }}</dd>
              </div>
            </dl>
          </section>

          <section class="node-detail__section token-detail__section">
            <header class="node-detail__hero">
              <div>
                <p class="activity-home__eyebrow">Balances</p>
                <h3>Top Holders</h3>
              </div>
              <div class="results-header__actions">
                <div class="node-updates__pager">
                  <label class="node-updates__page-size">
                    <span class="node-updates__page-size-label">Show</span>
                    <select
                      class="node-updates__page-size-select"
                      :value="readHolderPageSize()"
                      aria-label="Items per page"
                      @change="handleHolderPageSizeChange"
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
                    :disabled="!tokenHolders?.nextAfter || loadingTokenHolders"
                    @click="showPreviousHolders"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    class="dashboard__refresh"
                    :disabled="!tokenHolders?.nextBefore || loadingTokenHolders"
                    @click="showNextHolders"
                  >
                    Next
                  </button>
                </div>
                <QuerySourcePill source="pqs" />
              </div>
            </header>

            <p v-if="loadingTokenHolders" class="dashboard__message">
              Loading token holders...
            </p>

            <p v-else-if="tokenHolders.holders.length === 0" class="dashboard__message">
              No holders observed for this token yet.
            </p>

            <div
              v-else
              class="token-detail__holders-table"
              role="table"
              aria-label="Top token holders"
            >
              <div class="token-detail__holders-row token-detail__holders-row--head" role="row">
                <span role="columnheader">Party</span>
                <span role="columnheader">Amount</span>
                <span role="columnheader">Nodes</span>
              </div>

              <div
                v-for="holder in tokenHolders.holders"
                :key="holder.partyId"
                class="token-detail__holders-row"
                role="row"
              >
                <span class="token-detail__cell token-detail__party" role="cell">
                  <RouterLink
                    class="contract-detail__link token-detail__party-link"
                    :to="partyLink(holder.partyId)"
                    :title="holder.partyId"
                  >
                    {{ holder.partyId }}
                  </RouterLink>
                </span>
                <span class="token-detail__cell token-detail__amount" role="cell">
                  {{ holder.amount ?? 'n/a' }}
                </span>
                <span class="token-detail__cell token-detail__nodes" role="cell">
                  <span
                    v-for="node in holder.nodes"
                    :key="node.nodeId"
                    class="tokens-page__nodes-item"
                  >
                    {{ node.label }}
                  </span>
                </span>
              </div>
            </div>
          </section>

          <TokenTransfersBrowser
            class="token-detail__section"
            scope="token"
            :path="`/tokens/${encodeURIComponent(props.tokenId)}`"
            :token-id="props.tokenId"
            query-prefix="transfers"
            title="Latest Transfers"
            table-aria-label="Latest token transfers"
            spinner-label="Updating latest token transfers"
            loading-message="Loading latest token transfers..."
            empty-message="No token transfers observed for this token yet."
          />
        </div>
      </div>
    </div>
  </section>
</template>
