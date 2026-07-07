<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { LocationQueryRaw } from 'vue-router';
import { useRoute, useRouter } from 'vue-router';
import QuerySourcePill from './QuerySourcePill.vue';
import TokenTransfersAdvancedFilter from './TokenTransfersAdvancedFilter.vue';
import UpdatesToolbar from './UpdatesToolbar.vue';
import { fetchLatestTokenTransfers, fetchTokenTransfers } from '../lib/api';
import type { TokenTransfersResponse } from '../types/tokens';

type TokenTransferScope = 'global' | 'token';

const props = withDefaults(
  defineProps<{
    scope: TokenTransferScope;
    path: string;
    title: string;
    eyebrow?: string;
    tokenId?: string;
    queryPrefix?: string;
    advancedFilterId?: string;
    loadingMessage?: string;
    emptyMessage?: string;
    tableAriaLabel?: string;
    spinnerLabel?: string;
  }>(),
  {
    eyebrow: 'Transfers',
    queryPrefix: '',
    advancedFilterId: 'token-transfers-advanced-filter',
    loadingMessage: 'Loading latest token transfers...',
    emptyMessage: 'No token transfers available yet.',
    tableAriaLabel: 'Latest token transfers',
    spinnerLabel: 'Updating latest token transfers',
  },
);

const route = useRoute();
const router = useRouter();
const tokenTransfersResponse = ref<TokenTransfersResponse | null>(null);
const tokenTransfersError = ref<string | null>(null);
const loadingTransfers = ref(true);
const showAdvancedFilter = ref(false);
const fromPartyFilterDraft = ref('');
const toPartyFilterDraft = ref('');
const amountGtDraft = ref('');
const amountLtDraft = ref('');

function queryKey(
  base: 'before' | 'after' | 'fromParty' | 'toParty' | 'amountGt' | 'amountLt',
): string {
  if (!props.queryPrefix) {
    return base;
  }

  return `${props.queryPrefix}${base.charAt(0).toUpperCase()}${base.slice(1)}`;
}

function readQueryCursor(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function readQueryList(value: unknown): string[] {
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

const activeFromPartyFilters = computed(() =>
  uniqueValues(readQueryList(route.query[queryKey('fromParty')])),
);
const activeToPartyFilters = computed(() =>
  uniqueValues(readQueryList(route.query[queryKey('toParty')])),
);
const activeAmountGt = computed(() => readQueryCursor(route.query[queryKey('amountGt')]) ?? '');
const activeAmountLt = computed(() => readQueryCursor(route.query[queryKey('amountLt')]) ?? '');

function hasAdvancedFilterQuery(): boolean {
  return (
    activeFromPartyFilters.value.length > 0 ||
    activeToPartyFilters.value.length > 0 ||
    activeAmountGt.value.length > 0 ||
    activeAmountLt.value.length > 0
  );
}

function buildQuery(options?: {
  before?: string;
  after?: string;
  fromParties?: string[];
  toParties?: string[];
  amountGt?: string;
  amountLt?: string;
}): LocationQueryRaw {
  const nextQuery: LocationQueryRaw = { ...route.query };
  delete nextQuery[queryKey('before')];
  delete nextQuery[queryKey('after')];
  delete nextQuery[queryKey('fromParty')];
  delete nextQuery[queryKey('toParty')];
  delete nextQuery[queryKey('amountGt')];
  delete nextQuery[queryKey('amountLt')];

  if (options?.before) {
    nextQuery[queryKey('before')] = options.before;
  }

  if (options?.after) {
    nextQuery[queryKey('after')] = options.after;
  }

  if ((options?.fromParties?.length ?? 0) > 0) {
    nextQuery[queryKey('fromParty')] = options?.fromParties;
  }

  if ((options?.toParties?.length ?? 0) > 0) {
    nextQuery[queryKey('toParty')] = options?.toParties;
  }

  if (options?.amountGt?.trim()) {
    nextQuery[queryKey('amountGt')] = options.amountGt.trim();
  }

  if (options?.amountLt?.trim()) {
    nextQuery[queryKey('amountLt')] = options.amountLt.trim();
  }

  return nextQuery;
}

async function pushQuery(query: LocationQueryRaw) {
  await router.push({
    path: props.path,
    query,
  });
}

async function loadTransfers() {
  loadingTransfers.value = true;
  tokenTransfersError.value = null;

  try {
    const before = readQueryCursor(route.query[queryKey('before')]);
    const after = readQueryCursor(route.query[queryKey('after')]);
    const fromParties = activeFromPartyFilters.value;
    const toParties = activeToPartyFilters.value;
    const amountGt = activeAmountGt.value;
    const amountLt = activeAmountLt.value;
    const options: {
      before?: string;
      after?: string;
      fromParties?: string[];
      toParties?: string[];
      amountGt?: string;
      amountLt?: string;
    } = {};

    if (before) {
      options.before = before;
    }

    if (after) {
      options.after = after;
    }

    if (fromParties.length > 0) {
      options.fromParties = fromParties;
    }

    if (toParties.length > 0) {
      options.toParties = toParties;
    }

    if (amountGt.length > 0) {
      options.amountGt = amountGt;
    }

    if (amountLt.length > 0) {
      options.amountLt = amountLt;
    }

    tokenTransfersResponse.value =
      props.scope === 'token' && props.tokenId
        ? await fetchTokenTransfers(props.tokenId, 25, options)
        : await fetchLatestTokenTransfers(25, options);
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

function transferDetailLink(updateId: string): string {
  return `/tokens/transfers/${encodeURIComponent(updateId)}`;
}

function tokenDetailLink(tokenId: string): string {
  return `/tokens/${encodeURIComponent(tokenId)}`;
}

async function openTransferDetail(updateId: string) {
  await router.push(transferDetailLink(updateId));
}

async function showOlder() {
  const cursor = tokenTransfersResponse.value?.nextBefore;
  if (!cursor) {
    return;
  }

  await pushQuery(
    buildQuery({
      before: cursor,
      fromParties: activeFromPartyFilters.value,
      toParties: activeToPartyFilters.value,
      amountGt: activeAmountGt.value,
      amountLt: activeAmountLt.value,
    }),
  );
}

async function showNewer() {
  const cursor = tokenTransfersResponse.value?.nextAfter;
  if (!cursor) {
    return;
  }

  await pushQuery(
    buildQuery({
      after: cursor,
      fromParties: activeFromPartyFilters.value,
      toParties: activeToPartyFilters.value,
      amountGt: activeAmountGt.value,
      amountLt: activeAmountLt.value,
    }),
  );
}

function toggleAdvancedFilter() {
  showAdvancedFilter.value = !showAdvancedFilter.value;
}

async function addFromPartyFilter() {
  const nextParty = fromPartyFilterDraft.value.trim();
  if (!nextParty) {
    return;
  }

  fromPartyFilterDraft.value = '';
  await pushQuery(
    buildQuery({
      fromParties: uniqueValues([...activeFromPartyFilters.value, nextParty]),
      toParties: activeToPartyFilters.value,
      amountGt: activeAmountGt.value,
      amountLt: activeAmountLt.value,
    }),
  );
}

async function addToPartyFilter() {
  const nextParty = toPartyFilterDraft.value.trim();
  if (!nextParty) {
    return;
  }

  toPartyFilterDraft.value = '';
  await pushQuery(
    buildQuery({
      fromParties: activeFromPartyFilters.value,
      toParties: uniqueValues([...activeToPartyFilters.value, nextParty]),
      amountGt: activeAmountGt.value,
      amountLt: activeAmountLt.value,
    }),
  );
}

async function removeFromPartyFilter(party: string) {
  await pushQuery(
    buildQuery({
      fromParties: activeFromPartyFilters.value.filter((candidate) => candidate !== party),
      toParties: activeToPartyFilters.value,
      amountGt: activeAmountGt.value,
      amountLt: activeAmountLt.value,
    }),
  );
}

async function removeToPartyFilter(party: string) {
  await pushQuery(
    buildQuery({
      fromParties: activeFromPartyFilters.value,
      toParties: activeToPartyFilters.value.filter((candidate) => candidate !== party),
      amountGt: activeAmountGt.value,
      amountLt: activeAmountLt.value,
    }),
  );
}

watch(
  () => [route.fullPath, props.scope, props.tokenId],
  () => {
    void loadTransfers();
  },
  { immediate: true },
);

watch(
  () => [
    route.query[queryKey('fromParty')],
    route.query[queryKey('toParty')],
    route.query[queryKey('amountGt')],
    route.query[queryKey('amountLt')],
  ],
  () => {
    amountGtDraft.value = activeAmountGt.value;
    amountLtDraft.value = activeAmountLt.value;
    if (hasAdvancedFilterQuery()) {
      showAdvancedFilter.value = true;
    }
  },
  { immediate: true },
);

watch([amountGtDraft, amountLtDraft], async ([nextAmountGt, nextAmountLt]) => {
  if (nextAmountGt === activeAmountGt.value && nextAmountLt === activeAmountLt.value) {
    return;
  }

  await pushQuery(
    buildQuery({
      fromParties: activeFromPartyFilters.value,
      toParties: activeToPartyFilters.value,
      amountGt: nextAmountGt,
      amountLt: nextAmountLt,
    }),
  );
});
</script>

<template>
  <section class="node-detail__section tokens-page__section">
    <header class="node-detail__hero">
      <div>
        <p class="activity-home__eyebrow">{{ eyebrow }}</p>
        <h3>{{ title }}</h3>
      </div>
      <div class="results-header__actions">
        <UpdatesToolbar
          :advanced-filter-expanded="showAdvancedFilter"
          :advanced-filter-controls="advancedFilterId"
          :newer-disabled="!tokenTransfersResponse?.nextAfter || loadingTransfers"
          :older-disabled="!tokenTransfersResponse?.nextBefore || loadingTransfers"
          @toggle-advanced-filter="toggleAdvancedFilter"
          @newer="showNewer"
          @older="showOlder"
        />
        <QuerySourcePill source="pqs" />
      </div>
    </header>

    <Transition name="filter-expand">
      <TokenTransfersAdvancedFilter
        v-if="showAdvancedFilter"
        :id="advancedFilterId"
        v-model:from-draft="fromPartyFilterDraft"
        v-model:to-draft="toPartyFilterDraft"
        v-model:amount-gt-draft="amountGtDraft"
        v-model:amount-lt-draft="amountLtDraft"
        :active-from-parties="activeFromPartyFilters"
        :active-to-parties="activeToPartyFilters"
        @add-from-party-filter="addFromPartyFilter"
        @add-to-party-filter="addToPartyFilter"
        @remove-from-party-filter="removeFromPartyFilter"
        @remove-to-party-filter="removeToPartyFilter"
      />
    </Transition>

    <p v-if="!tokenTransfersResponse && loadingTransfers" class="dashboard__message">
      {{ loadingMessage }}
    </p>
    <p v-else-if="tokenTransfersError" class="dashboard__message dashboard__message--error">
      {{ tokenTransfersError }}
    </p>
    <p v-else-if="tokenTransfersResponse && renderedTransfers.length === 0" class="dashboard__message">
      {{ emptyMessage }}
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
        :aria-label="spinnerLabel"
      >
        <span class="node-updates__spinner" aria-hidden="true"></span>
      </div>

      <div
        class="node-updates__table"
        :class="{ 'node-updates__table--loading': loadingTransfers }"
        role="table"
        :aria-label="tableAriaLabel"
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
          class="tokens-page__row node-updates__row--link"
          role="row"
          tabindex="0"
          @click="openTransferDetail(transfer.updateId)"
          @keydown.enter.prevent="openTransferDetail(transfer.updateId)"
          @keydown.space.prevent="openTransferDetail(transfer.updateId)"
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
            <RouterLink
              class="contract-detail__link tokens-page__token-link"
              :to="tokenDetailLink(transfer.tokenId)"
              @click.stop
            >
              <strong>{{ transfer.tokenName }}</strong>
              <span>{{ transfer.tokenId }}</span>
            </RouterLink>
          </span>
          <span class="tokens-page__cell" role="cell">{{ transfer.amount ?? 'n/a' }}</span>
          <span class="tokens-page__cell" role="cell">
            <RouterLink
              v-if="transfer.sender"
              class="contract-detail__link"
              :to="partyLink(transfer.sender)"
              @click.stop
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
              @click.stop
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
</template>
