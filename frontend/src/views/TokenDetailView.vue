<script setup lang="ts">
import { onMounted, ref } from 'vue';
import TokenTransfersBrowser from '../components/TokenTransfersBrowser.vue';
import QuerySourcePill from '../components/QuerySourcePill.vue';
import { fetchTokenDetail, fetchTokenHolders } from '../lib/api';
import type { TokenDetailResponse, TokenHoldersResponse } from '../types/tokens';

const props = defineProps<{ tokenId: string }>();

const tokenDetail = ref<TokenDetailResponse | null>(null);
const tokenHolders = ref<TokenHoldersResponse | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    const [detail, holders] = await Promise.all([
      fetchTokenDetail(props.tokenId),
      fetchTokenHolders(props.tokenId),
    ]);
    tokenDetail.value = detail;
    tokenHolders.value = holders;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
  }
});

function partyLink(partyId: string): string {
  return `/parties/${encodeURIComponent(partyId)}`;
}
</script>

<template>
  <section class="contract-detail">
    <p v-if="error" class="node-detail__message node-detail__message--error">{{ error }}</p>
    <p v-else-if="!tokenDetail || !tokenHolders" class="node-detail__message">Loading token detail...</p>
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
              <QuerySourcePill source="pqs" />
            </header>

            <p v-if="tokenHolders.holders.length === 0" class="dashboard__message">
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
