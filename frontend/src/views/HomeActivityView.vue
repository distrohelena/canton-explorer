<script setup lang="ts">
import { computed } from 'vue';
import { useActivityHistory } from '../composables/useActivityHistory';
import type { ActivitySeries } from '../types/activity';

const { history, loading, error, refresh, selectedDays, selectDays } = useActivityHistory();
const windowOptions = [1, 7, 30] as const;

const nodes = computed(() => history.value?.nodes ?? []);
const windowMinutesLabel = computed(() => history.value?.windowMinutes ?? 0);
const chartWidth = 320;
const chartHeight = 96;

interface ChartDomain {
  startMs: number;
  endMs: number;
  durationMs: number;
}

function chartDomain(series: ActivitySeries, windowMinutes: number): ChartDomain | null {
  if (series.samples.length === 0) {
    return null;
  }

  const latestTimestamp = Date.parse(series.samples[series.samples.length - 1].timestamp);
  const windowDurationMs = Math.max(windowMinutes, 1) * 60 * 1000;

  if (!Number.isFinite(latestTimestamp)) {
    return null;
  }

  return {
    startMs: latestTimestamp - windowDurationMs,
    endMs: latestTimestamp,
    durationMs: windowDurationMs,
  };
}

function linePoints(series: ActivitySeries, windowMinutes: number): string {
  if (series.samples.length === 0) {
    return '';
  }

  const domain = chartDomain(series, windowMinutes);
  const maxValue = Math.max(...series.samples.map((sample) => sample.activityValue), 1);

  if (series.samples.length === 1) {
    const onlySample = series.samples[0];
    const y = chartHeight - (onlySample.activityValue / maxValue) * (chartHeight - 10) - 5;
    return `${chartWidth - 8},${y} ${chartWidth},${y}`;
  }

  return series.samples
    .map((sample, index) => {
      const sampleTimestamp = Date.parse(sample.timestamp);
      const hasTimeAxis =
        Number.isFinite(sampleTimestamp) &&
        domain !== null;
      const x = hasTimeAxis
        ? Math.max(
            0,
            Math.min(
              chartWidth,
              ((sampleTimestamp - domain.startMs) / domain.durationMs) * chartWidth,
            ),
          )
        : series.samples.length === 1
          ? chartWidth / 2
          : (index / (series.samples.length - 1)) * chartWidth;
      const y = chartHeight - (sample.activityValue / maxValue) * (chartHeight - 10) - 5;
      return `${x},${y}`;
    })
    .join(' ');
}

function guidePositions(days: 1 | 7 | 30): number[] {
  const count: number = days === 1 ? 24 : days;

  return Array.from({ length: count }, (_, index) =>
    (index / Math.max(count - 1, 1)) * chartWidth,
  );
}

function formatAxisLabel(timestampMs: number, mode: 'start' | 'end', days: 1 | 7 | 30): string {
  if (days === 1 && mode === 'end') {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(timestampMs));
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestampMs));
}

function latestOffset(series: ActivitySeries): string {
  return series.samples.at(-1)?.latestOffset ?? 'Unavailable';
}

function statusLabel(status: ActivitySeries['status']): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function peakActivity(series: ActivitySeries): number {
  return Math.max(...series.samples.map((sample) => sample.activityValue), 0);
}
</script>

<template>
  <section class="activity-home">
    <div class="activity-home__hero">
      <div class="activity-home__copy">
        <p class="activity-home__eyebrow">Overview</p>
        <h2>Network Activity</h2>
      </div>
      <div class="activity-home__controls">
        <div class="activity-home__selector" aria-label="Activity window selector">
          <button
            v-for="days in windowOptions"
            :key="days"
            type="button"
            class="activity-home__selector-button"
            :class="{ 'activity-home__selector-button--active': selectedDays === days }"
            :aria-pressed="selectedDays === days"
            @click="selectDays(days)"
          >
            {{ days }}
          </button>
        </div>
        <button type="button" class="dashboard__refresh" @click="refresh">Refresh</button>
      </div>
    </div>

    <p v-if="loading" class="dashboard__message">Loading activity history...</p>
    <p v-else-if="error" class="dashboard__message dashboard__message--error">{{ error }}</p>

    <template v-else-if="nodes.length > 0">
      <div class="activity-home__grid">
        <RouterLink
          v-for="series in nodes"
          :key="series.nodeId"
          class="activity-panel-link"
          :to="`/nodes/${series.nodeId}/updates`"
          :aria-label="`${series.label} activity history`"
        >
          <article class="activity-panel">
            <div class="activity-panel__header">
              <div>
                <h3>{{ series.label }}</h3>
                <p class="activity-panel__meta">
                  {{ series.latestActiveContractCount }} active contracts
                </p>
              </div>
              <span class="activity-panel__status" :data-status="series.status">
                {{ statusLabel(series.status) }}
              </span>
            </div>

            <svg
              class="activity-panel__chart"
              viewBox="0 0 320 96"
              role="img"
              :aria-label="`${series.label} activity history`"
            >
              <line
                v-for="position in guidePositions(selectedDays)"
                :key="`${series.nodeId}-${selectedDays}-${position}`"
                class="activity-panel__guide"
                :x1="position"
                y1="0"
                :x2="position"
                y2="96"
              />
              <polyline
                class="activity-panel__line"
                fill="none"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="3"
                :points="linePoints(series, windowMinutesLabel)"
              />
            </svg>

            <div
              v-if="chartDomain(series, windowMinutesLabel)"
              class="activity-panel__axis"
            >
              <span class="activity-panel__axis-label activity-panel__axis-label--start">
                {{ formatAxisLabel(chartDomain(series, windowMinutesLabel)!.startMs, 'start', selectedDays) }}
              </span>
              <span class="activity-panel__axis-label activity-panel__axis-label--end">
                {{ formatAxisLabel(chartDomain(series, windowMinutesLabel)!.endMs, 'end', selectedDays) }}
              </span>
            </div>

            <div class="activity-panel__footer">
              <p>Peak activity {{ peakActivity(series) }}</p>
              <p>Latest offset {{ latestOffset(series) }}</p>
            </div>
          </article>
        </RouterLink>
      </div>

    </template>

    <p v-else class="dashboard__message">No activity samples available yet.</p>
  </section>
</template>
