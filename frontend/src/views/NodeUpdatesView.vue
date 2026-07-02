<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { fetchNodeUpdates } from '../lib/api';
import type { NodeUpdatesResponse } from '../types/updates';

const props = defineProps<{ id: string }>();

const updatesResponse = ref<NodeUpdatesResponse | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    updatesResponse.value = await fetchNodeUpdates(props.id);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
  }
});

function formatRecordTime(recordTime: string | null): { date: string; time: string } | null {
  if (!recordTime) {
    return null;
  }

  const parsed = new Date(recordTime);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return {
    date: new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
    }).format(parsed),
    time: new Intl.DateTimeFormat(undefined, {
      timeStyle: 'medium',
    }).format(parsed),
  };
}

const renderedUpdates = computed(() =>
  (updatesResponse.value?.updates ?? []).map((update) => ({
    ...update,
    recordTimeLines: formatRecordTime(update.recordTime),
  })),
);
</script>

<template>
  <section class="node-updates">
    <p v-if="error" class="node-detail__message node-detail__message--error">{{ error }}</p>
    <p v-else-if="!updatesResponse" class="node-detail__message">Loading node updates...</p>
    <div v-else class="node-page">
      <div class="node-page__rail">
        <RouterLink class="node-detail__back" to="/" aria-label="Back to overview">←</RouterLink>
      </div>

      <div class="node-page__main node-updates__content">
        <header class="node-detail__hero">
          <div>
            <p class="activity-home__eyebrow">Recent Activity</p>
            <h2>{{ updatesResponse.label }} Updates</h2>
          </div>
          <p class="activity-home__window">Latest {{ updatesResponse.limit }} updates</p>
        </header>

        <section class="node-updates__section">
          <div class="node-updates__table" role="table" aria-label="Recent node updates">
            <div class="node-updates__row node-updates__row--head" role="row">
              <span role="columnheader">Event Offset</span>
              <span role="columnheader">Record Time</span>
              <span role="columnheader">Parties</span>
            </div>

            <RouterLink
              v-for="update in renderedUpdates"
              :key="update.eventOffset"
              class="node-updates__row node-updates__row--link"
              :to="`/nodes/${props.id}/updates/${update.eventOffset}`"
              role="row"
            >
              <span class="node-updates__id" role="cell">{{ update.eventOffset }}</span>
              <span class="node-updates__time" role="cell">
                <template v-if="update.recordTimeLines">
                  <span class="node-updates__time-date">{{ update.recordTimeLines.date }}</span>
                  <span class="node-updates__time-clock">{{ update.recordTimeLines.time }}</span>
                </template>
                <template v-else>n/a</template>
              </span>
              <span role="cell">{{
                update.parties.length > 0 ? update.parties.join(', ') : 'No parties'
              }}</span>
            </RouterLink>
          </div>
        </section>
      </div>
    </div>
  </section>
</template>
