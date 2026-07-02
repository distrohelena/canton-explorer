<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { fetchNodeUpdateDetail } from '../lib/api';
import type { NodeUpdateDetailResponse } from '../types/updates';

const props = defineProps<{ id: string; updateId: string }>();

const updateDetail = ref<NodeUpdateDetailResponse | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    updateDetail.value = await fetchNodeUpdateDetail(props.id, props.updateId);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
  }
});

function formatUpdateId(updateId: string): string {
  const normalized = updateId.startsWith('\\x') ? updateId.slice(2) : updateId;

  if (/^1220[0-9a-f]{64}$/i.test(normalized)) {
    return normalized.slice(4);
  }

  return normalized;
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
    date: new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
    }).format(parsed),
    time: new Intl.DateTimeFormat(undefined, {
      timeStyle: 'medium',
    }).format(parsed),
  };
}

const displayUpdateId = computed(() =>
  updateDetail.value ? formatUpdateId(updateDetail.value.updateId) : '',
);
const recordTimeLines = computed(() =>
  updateDetail.value ? formatRecordTime(updateDetail.value.recordTime) : null,
);
const metaJson = computed(() =>
  updateDetail.value ? JSON.stringify(updateDetail.value.meta, null, 2) : '',
);
</script>

<template>
  <section class="update-detail">
    <p v-if="error" class="node-detail__message node-detail__message--error">{{ error }}</p>
    <p v-else-if="!updateDetail" class="node-detail__message">Loading update detail...</p>
    <div v-else class="node-page">
      <div class="node-page__rail">
        <RouterLink
          class="node-detail__back"
          :to="`/nodes/${props.id}/updates`"
          aria-label="Back to overview"
        >
          ←
        </RouterLink>
      </div>

      <div class="node-page__main update-detail__content">
        <header class="node-detail__hero">
          <div>
            <p class="activity-home__eyebrow">Recent Activity</p>
            <h2>{{ updateDetail.label }} Update</h2>
          </div>
          <p class="activity-home__window">Update Detail</p>
        </header>

        <div class="node-detail__sections">
          <section class="node-detail__section">
            <h3>Summary</h3>
            <dl class="detail-grid">
              <div>
                <dt>Update ID</dt>
                <dd class="update-detail__id">{{ displayUpdateId }}</dd>
              </div>
              <div>
                <dt>Canonical Update ID</dt>
                <dd class="update-detail__canonical">{{ updateDetail.updateId }}</dd>
              </div>
              <div>
                <dt>Record Time</dt>
                <dd v-if="recordTimeLines" class="update-detail__time">
                  <span class="update-detail__time-date">{{ recordTimeLines.date }}</span>
                  <span class="update-detail__time-clock">{{ recordTimeLines.time }}</span>
                </dd>
                <dd v-else>n/a</dd>
              </div>
              <div>
                <dt>Parties</dt>
                <dd>{{ updateDetail.parties.length > 0 ? updateDetail.parties.join(', ') : 'No parties' }}</dd>
              </div>
            </dl>
          </section>

          <section class="node-detail__section">
            <h3>Raw Metadata</h3>
            <pre class="update-detail__meta">{{ metaJson }}</pre>
          </section>
        </div>
      </div>
    </div>
  </section>
</template>
