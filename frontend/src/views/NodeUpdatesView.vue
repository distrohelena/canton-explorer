<script setup lang="ts">
import UpdatesBrowser from '../components/UpdatesBrowser.vue';

const props = defineProps<{ id: string }>();
</script>

<template>
  <section class="node-updates">
    <div class="node-page">
      <div class="node-page__rail">
        <RouterLink class="node-detail__back" to="/" aria-label="Back to overview">←</RouterLink>
      </div>

      <div class="node-page__main node-updates__content">
        <UpdatesBrowser
          scope="node"
          :path="`/nodes/${props.id}/updates`"
          :node-id="props.id"
          title=" Updates"
          eyebrow="Recent Activity"
          heading-tag="h2"
          response-label-title
          source-tag="node"
          advanced-filter-id="node-updates-advanced-filter"
          loading-message="Loading node updates..."
          empty-message="No updates available yet."
          table-aria-label="Recent node updates"
          spinner-label="Updating node updates"
        />
      </div>
    </div>
  </section>
</template>
