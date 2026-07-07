<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import type { LocationQueryRaw } from 'vue-router';
import { useRoute, useRouter } from 'vue-router';
import QuerySourcePill from '../components/QuerySourcePill.vue';
import { fetchLatestTokenTransfers, fetchTokens } from '../lib/api';
import type { TokenTransfersResponse, TokensResponse } from '../types/tokens';

const route = useRoute();
const router = useRouter();

const tokensResponse = ref<TokensResponse | null>(null);
const tokenTransfersResponse = ref<TokenTransfersResponse | null>(null);
const tokensError = ref<string | null>(null);
const tokenTransfersError = ref<string | null>(null);
const loadingTokens = ref(true);
const loadingTransfers = ref(true);

function readQueryCursor(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function buildQuery(options?: { before?: string; after?: string }): LocationQueryRaw {
  const nextQuery: LocationQueryRaw = { ...route.query };
  delete nextQuery.before;
  delete nextQuery.after;

  if (options?.before) {
    nextQuery.before = options.before;
  }

  if (options?.after) {
    nextQuery.after = options.after;
  }

  return nextQuery;
}

async function pushQuery(query: LocationQueryRaw) {
  await router.push({
    path: '/tokens',
    query,
  });
}

async function loadTokens() {
  loadingTokens.value = true;
  tokensError.value = null;

  try {
    tokensResponse.value = await fetchTokens();
  } catch (err) {
    tokensError.value = err instanceof Error ? err.message : 'Unknown error';
  } finally {
    loadingTokens.value = false;
  }
}

async function loadTransfers() {
  loadingTransfers.value = true;
  tokenTransfersError.value = null;

  try {
    const before = readQueryCursor(route.query.before);
    const after = readQueryCursor(route.query.after);
    const options: Parameters<typeof fetchLatestTokenTransfers>[1] = {};

    if (before) {
      options.before = before;
    }

    if (after) {
      options.after = after;
    }

    tokenTransfersResponse.value = await fetchLatestTokenTransfers(25, options);
  } catch (err) {
    tokenTransfersError.value = err instanceof Error ? err.message : 'Unknown error';
  } finally {
    loadingTransfers.value = false;
  }
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
    date: new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(parsed),
    time: new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' }).format(parsed),
  };
}

const renderedTransfers = computed(() =>
  (tokenTransfersResponse.value?.transfers ?? []).map((transfer) => ({
    ...transfer,
    rowKey: JSON.stringify([
      transfer.updateId,
      transfer.tokenId,
      transfer.amount ?? '',
      transfer.sender ?? '',
      transfer.receiver ?? '',
      transfer.recordTime ?? '',
    ]),
    recordTimeLines: formatRecordTime(transfer.recordTime),
  })),
);

function partyLink(partyId: string): string {
  return `/parties/${encodeURIComponent(partyId)}`;
}

async function showOlder() {
  const cursor = tokenTransfersResponse.value?.nextBefore;
  if (!cursor) {
    return;
  }

  await pushQuery(buildQuery({ before: cursor }));
}

async function showNewer() {
  const cursor = tokenTransfersResponse.value?.nextAfter;
  if (!cursor) {
    return;
  }

  await pushQuery(buildQuery({ after: cursor }));
}

onMounted(async () => {
  await loadTokens();
});

watch(
  () => route.fullPath,
  () => {
    void loadTransfers();
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
      </header>

      <p v-if="!tokensResponse && loadingTokens" class="dashboard__message">Loading tokens...</p>
      <p v-else-if="tokensError" class="dashboard__message dashboard__message--error">
        {{ tokensError }}
      </p>
      <p v-else-if="tokensResponse && tokensResponse.tokens.length === 0" class="dashboard__message">
        No tokens discovered yet.
      </p>

      <div v-else-if="tokensResponse" class="tokens-page__known-list">
        <article
          v-for="token in tokensResponse.tokens"
          :key="token.tokenId"
          class="tokens-page__known-card"
        >
          <div class="tokens-page__known-main">
            <h4>{{ token.name }}</h4>
            <p class="tokens-page__known-id">{{ token.tokenId }}</p>
          </div>
          <QuerySourcePill :source="token.source" />
        </article>
      </div>
    </section>

    <section class="node-detail__section tokens-page__section">
      <header class="node-detail__hero">
        <div>
          <p class="activity-home__eyebrow">Transfers</p>
          <h3>Latest Transfers</h3>
        </div>
        <div class="results-header__actions">
          <div class="node-updates__pager">
            <button
              type="button"
              class="dashboard__refresh"
              :disabled="!tokenTransfersResponse?.nextAfter || loadingTransfers"
              @click="showNewer"
            >
              Newer
            </button>
            <button
              type="button"
              class="dashboard__refresh"
              :disabled="!tokenTransfersResponse?.nextBefore || loadingTransfers"
              @click="showOlder"
            >
              Older
            </button>
          </div>
          <QuerySourcePill source="pqs" />
        </div>
      </header>

      <p v-if="!tokenTransfersResponse && loadingTransfers" class="dashboard__message">
        Loading latest token transfers...
      </p>
      <p v-else-if="tokenTransfersError" class="dashboard__message dashboard__message--error">
        {{ tokenTransfersError }}
      </p>
      <p
        v-else-if="tokenTransfersResponse && renderedTransfers.length === 0"
        class="dashboard__message"
      >
        No token transfers available yet.
      </p>

      <section
        v-else-if="tokenTransfersResponse"
        class="node-updates__section"
        :aria-busy="loadingTransfers ? 'true' : 'false'"
      >
        <div
          v-if="loadingTransfers"
          class="node-updates__overlay"
          role="status"
          aria-label="Updating latest token transfers"
        >
          <span class="node-updates__spinner" aria-hidden="true"></span>
        </div>

        <div
          class="node-updates__table"
          :class="{ 'node-updates__table--loading': loadingTransfers }"
          role="table"
          aria-label="Latest token transfers"
        >
          <div class="tokens-page__row tokens-page__row--head" role="row">
            <span role="columnheader">Nodes</span>
            <span role="columnheader">Token</span>
            <span role="columnheader">Amount</span>
            <span role="columnheader">From</span>
            <span role="columnheader">To</span>
            <span role="columnheader">Record Time</span>
          </div>

          <div
            v-for="transfer in renderedTransfers"
            :key="transfer.rowKey"
            class="tokens-page__row"
            role="row"
          >
            <span class="tokens-page__cell tokens-page__nodes" role="cell">
              <span
                v-for="node in transfer.nodes"
                :key="`${node.nodeId}:${node.eventOffset}`"
                class="tokens-page__nodes-item"
              >
                {{ node.label }}
              </span>
            </span>
            <span class="tokens-page__cell tokens-page__token" role="cell">
              <strong>{{ transfer.tokenName }}</strong>
              <span>{{ transfer.tokenId }}</span>
            </span>
            <span class="tokens-page__cell" role="cell">{{ transfer.amount ?? 'n/a' }}</span>
            <span class="tokens-page__cell" role="cell">
              <RouterLink
                v-if="transfer.sender"
                class="contract-detail__link"
                :to="partyLink(transfer.sender)"
              >
                {{ transfer.sender }}
              </RouterLink>
              <template v-else>n/a</template>
            </span>
            <span class="tokens-page__cell" role="cell">
              <RouterLink
                v-if="transfer.receiver"
                class="contract-detail__link"
                :to="partyLink(transfer.receiver)"
              >
                {{ transfer.receiver }}
              </RouterLink>
              <template v-else>n/a</template>
            </span>
            <span class="tokens-page__cell tokens-page__time" role="cell">
              <template v-if="transfer.recordTimeLines">
                <span class="node-updates__time-date">{{ transfer.recordTimeLines.date }}</span>
                <span class="node-updates__time-clock">{{ transfer.recordTimeLines.time }}</span>
              </template>
              <template v-else>n/a</template>
            </span>
          </div>
        </div>
      </section>
    </section>
  </section>
</template>
