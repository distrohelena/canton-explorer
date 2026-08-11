<script setup lang="ts">
import TokenTransfersBrowser from '../components/TokenTransfersBrowser.vue';
import UpdatesBrowser from '../components/UpdatesBrowser.vue';
</script>

<template>
  <section class="home-dashboard">
    <section class="home-dashboard__card">
      <UpdatesBrowser
        compact
        scope="global"
        path="/"
        title="Latest Updates"
        view-all-to="/updates"
        show-node-column
        :show-party-filters="false"
        source-tag="updates"
        advanced-filter-id="home-latest-updates-advanced-filter"
        loading-message="Loading latest updates..."
        empty-message="No updates available yet."
        table-aria-label="Latest updates"
        spinner-label="Updating latest updates"
      />
    </section>
    <section class="home-dashboard__card">
      <TokenTransfersBrowser
        compact
        scope="global"
        path="/"
        title="Latest Trades"
        view-all-to="/tokens"
        table-aria-label="Latest trades"
        spinner-label="Updating latest trades"
        loading-message="Loading latest trades..."
        empty-message="No token trades available yet."
      />
    </section>
  </section>
</template>
