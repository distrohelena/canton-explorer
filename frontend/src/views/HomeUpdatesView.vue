<script setup lang="ts">
import UpdatesBrowser from '../components/UpdatesBrowser.vue';
</script>

<template>
  <section class="activity-home">
    <section class="activity-home__updates-section">
      <UpdatesBrowser
        scope="global"
        path="/"
        title="Updates"
        eyebrow="Updates"
        show-node-column
        source-tag="updates"
        advanced-filter-id="home-updates-advanced-filter"
        loading-message="Loading latest updates..."
        empty-message="No updates available yet."
        table-aria-label="Latest updates across all nodes"
        spinner-label="Updating latest updates"
        row-class="activity-home__updates-row"
      />
    </section>

  </section>
</template>
