<script setup lang="ts">
import { onMounted, ref } from 'vue';
import TokenTransfersBrowser from '../components/TokenTransfersBrowser.vue';
import QuerySourcePill from '../components/QuerySourcePill.vue';
import { fetchTokens } from '../lib/api';
import type { TokensResponse } from '../types/tokens';

const tokensResponse = ref<TokensResponse | null>(null);
const tokensError = ref<string | null>(null);
const loadingTokens = ref(true);

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

function tokenDetailLink(tokenId: string): string {
  return `/tokens/${encodeURIComponent(tokenId)}`;
}

onMounted(async () => {
  await loadTokens();
});
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
        <RouterLink
          v-for="token in tokensResponse.tokens"
          :key="token.tokenId"
          class="tokens-page__known-card"
          :to="tokenDetailLink(token.tokenId)"
        >
          <div class="tokens-page__known-main">
            <h4>{{ token.name }}</h4>
            <p class="tokens-page__known-id">{{ token.tokenId }}</p>
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
