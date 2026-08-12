<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  fetchActivityHistory,
  fetchCantonCoinHistory,
  fetchRecentActiveParties,
} from '../lib/api';
import {
  aggregateActivityPoints,
  dashboardRangeDays,
  preferredCantonCoinDailyPoints,
  type HomeDashboardActivityPoint,
  type HomeDashboardPricePoint,
  type HomeDashboardRange,
} from '../lib/home-dashboard';
import type { ActivityHistoryResponse } from '../types/activity';
import type { CantonCoinHistoryResponse } from '../types/market';
import type { RecentActivePartiesResponse } from '../types/active-parties';

const chartWidth = 520;
const chartHeight = 180;
const chartPadding = { top: 14, right: 18, bottom: 30, left: 18 };
const ranges: Array<{ value: HomeDashboardRange; label: string }> = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '31d', label: '31d' },
];

const selectedRange = ref<HomeDashboardRange>('24h');
const activity = ref<ActivityHistoryResponse | null>(null);
const activityLoading = ref(true);
const activityError = ref<string | null>(null);
const market = ref<CantonCoinHistoryResponse | null>(null);
const marketLoading = ref(true);
const marketError = ref<string | null>(null);
const recentParties = ref<RecentActivePartiesResponse | null>(null);
const recentPartiesLoading = ref(true);
const recentPartiesError = ref<string | null>(null);

const activityPoints = computed(() =>
  aggregateActivityPoints(activity.value?.nodes ?? []),
);
const pricePoints = computed(() => {
  const points = preferredCantonCoinDailyPoints(market.value?.venues ?? []);
  if (points.length === 0) {
    return [];
  }

  const latestTimestamp = Date.parse(points[points.length - 1].timestamp);
  const start = latestTimestamp - dashboardRangeDays(selectedRange.value) * 24 * 60 * 60 * 1000;
  return points.filter((point) => Date.parse(point.timestamp) >= start);
});
const latestPrice = computed(() => {
  const points = preferredCantonCoinDailyPoints(market.value?.venues ?? []);
  return points[points.length - 1] ?? null;
});

async function refreshActivity() {
  activityLoading.value = true;
  activityError.value = null;

  try {
    activity.value = await fetchActivityHistory(dashboardRangeDays(selectedRange.value));
  } catch (error) {
    activityError.value = error instanceof Error ? error.message : 'Unable to load transaction activity.';
  } finally {
    activityLoading.value = false;
  }
}

async function refreshMarket() {
  marketLoading.value = true;
  marketError.value = null;

  try {
    market.value = await fetchCantonCoinHistory('1D');
  } catch (error) {
    marketError.value = error instanceof Error ? error.message : 'Unable to load Canton Coin price history.';
  } finally {
    marketLoading.value = false;
  }
}

async function refreshRecentParties() {
  recentPartiesLoading.value = true;
  recentPartiesError.value = null;

  try {
    recentParties.value = await fetchRecentActiveParties(24);
    if (recentParties.value.status === 'error') {
      recentPartiesError.value = recentParties.value.error ?? 'Unable to load active parties.';
    }
  } catch (error) {
    recentPartiesError.value = error instanceof Error ? error.message : 'Unable to load active parties.';
  } finally {
    recentPartiesLoading.value = false;
  }
}

async function selectRange(range: HomeDashboardRange) {
  if (range === selectedRange.value) {
    return;
  }

  selectedRange.value = range;
  await refreshActivity();
}

function chartPoints(
  points: HomeDashboardActivityPoint[] | HomeDashboardPricePoint[],
): string {
  if (points.length === 0) {
    return '';
  }

  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const values = points.map((point) => ('value' in point ? point.value : point.close));
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const valueRange = max - min || 1;
  const firstTimestamp = Date.parse(points[0].timestamp);
  const lastTimestamp = Date.parse(points[points.length - 1].timestamp);
  const timeRange = lastTimestamp - firstTimestamp;

  return points
    .map((point) => {
      const timestamp = Date.parse(point.timestamp);
      const value = 'value' in point ? point.value : point.close;
      const x =
        points.length === 1 || !Number.isFinite(timeRange)
          ? chartPadding.left + plotWidth / 2
          : chartPadding.left + ((timestamp - firstTimestamp) / timeRange) * plotWidth;
      const y = chartPadding.top + plotHeight - ((value - min) / valueRange) * plotHeight;
      return `${round(x)},${round(y)}`;
    })
    .join(' ');
}

function dailyTicks(
  points: HomeDashboardActivityPoint[] | HomeDashboardPricePoint[],
): Array<{ label: string; position: string }> {
  if (points.length === 0) {
    return [];
  }

  const firstTimestamp = Date.parse(points[0].timestamp);
  const lastTimestamp = Date.parse(points[points.length - 1].timestamp);
  if (!Number.isFinite(firstTimestamp) || !Number.isFinite(lastTimestamp)) {
    return [];
  }

  const tickCount = Math.min(6, Math.max(2, Math.ceil((lastTimestamp - firstTimestamp) / (24 * 60 * 60 * 1000)) + 1));
  return Array.from({ length: tickCount }, (_, index) => {
    const ratio = index / Math.max(tickCount - 1, 1);
    const timestamp = firstTimestamp + ratio * (lastTimestamp - firstTimestamp);
    return {
      label: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
        new Date(timestamp),
      ),
      position: `${chartPadding.left + ratio * (chartWidth - chartPadding.left - chartPadding.right)}`,
    };
  });
}

function formatPrice(point: HomeDashboardPricePoint | null): string {
  if (!point) {
    return '—';
  }

  return `${point.close.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })} ${point.quote}`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

onMounted(() => {
  void refreshActivity();
  void refreshMarket();
  void refreshRecentParties();
});
</script>

<template>
  <section class="home-dashboard-overview" aria-labelledby="home-dashboard-overview-title">
    <div class="home-dashboard-overview__header">
      <div>
        <p class="home-dashboard-overview__eyebrow">Network overview</p>
        <h2 id="home-dashboard-overview-title">Overview</h2>
      </div>
      <div class="home-dashboard-overview__ranges" aria-label="Overview time range">
        <button
          v-for="range in ranges"
          :key="range.value"
          class="home-dashboard-overview__range"
          type="button"
          :aria-pressed="selectedRange === range.value"
          @click="selectRange(range.value)"
        >
          {{ range.label }}
        </button>
      </div>
    </div>

    <div class="home-dashboard-overview__charts">
      <section class="home-dashboard-overview__chart-panel">
        <div class="home-dashboard-overview__panel-heading">
          <div>
            <p class="home-dashboard-overview__eyebrow">All nodes</p>
            <h3>Transactions over time</h3>
          </div>
          <span class="home-dashboard-overview__panel-unit">updates</span>
        </div>
        <div v-if="activityLoading" class="home-dashboard-overview__state">Loading transaction activity…</div>
        <div v-else-if="activityError" class="home-dashboard-overview__state home-dashboard-overview__state--error">
          {{ activityError }}
        </div>
        <div v-else-if="activityPoints.length === 0" class="home-dashboard-overview__state">
          No transaction activity available yet.
        </div>
        <div v-else class="home-dashboard-overview__chart-shell">
          <svg
            class="home-dashboard-overview__chart"
            :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
            role="img"
            aria-label="Transactions over time chart"
          >
            <line
              v-for="position in [0.25, 0.5, 0.75]"
              :key="position"
              class="home-dashboard-overview__guide"
              :x1="chartPadding.left"
              :x2="chartWidth - chartPadding.right"
              :y1="chartPadding.top + position * (chartHeight - chartPadding.top - chartPadding.bottom)"
              :y2="chartPadding.top + position * (chartHeight - chartPadding.top - chartPadding.bottom)"
            />
            <polyline
              class="home-dashboard-overview__line"
              :points="chartPoints(activityPoints)"
              fill="none"
            />
            <text
              v-for="tick in dailyTicks(activityPoints)"
              :key="tick.position"
              class="home-dashboard-overview__tick"
              :x="tick.position"
              :y="chartHeight - 8"
              text-anchor="middle"
            >{{ tick.label }}</text>
          </svg>
        </div>
      </section>

      <section class="home-dashboard-overview__chart-panel">
        <div class="home-dashboard-overview__panel-heading">
          <div>
            <p class="home-dashboard-overview__eyebrow">Daily closes</p>
            <h3>CC price over time</h3>
          </div>
          <span class="home-dashboard-overview__panel-unit">{{ latestPrice?.quote ?? '—' }}</span>
        </div>
        <div v-if="marketLoading" class="home-dashboard-overview__state">Loading Canton Coin price…</div>
        <div v-else-if="marketError" class="home-dashboard-overview__state home-dashboard-overview__state--error">
          {{ marketError }}
        </div>
        <div v-else-if="pricePoints.length === 0" class="home-dashboard-overview__state">
          No Canton Coin price data available yet.
        </div>
        <div v-else class="home-dashboard-overview__chart-shell">
          <svg
            class="home-dashboard-overview__chart"
            :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
            role="img"
            aria-label="Canton Coin price over time chart"
          >
            <line
              v-for="position in [0.25, 0.5, 0.75]"
              :key="position"
              class="home-dashboard-overview__guide"
              :x1="chartPadding.left"
              :x2="chartWidth - chartPadding.right"
              :y1="chartPadding.top + position * (chartHeight - chartPadding.top - chartPadding.bottom)"
              :y2="chartPadding.top + position * (chartHeight - chartPadding.top - chartPadding.bottom)"
            />
            <polyline
              class="home-dashboard-overview__line home-dashboard-overview__line--price"
              :points="chartPoints(pricePoints)"
              fill="none"
            />
            <text
              v-for="tick in dailyTicks(pricePoints)"
              :key="tick.position"
              class="home-dashboard-overview__tick"
              :x="tick.position"
              :y="chartHeight - 8"
              text-anchor="middle"
            >{{ tick.label }}</text>
          </svg>
        </div>
      </section>
    </div>

    <section class="home-dashboard-overview__metrics" aria-labelledby="home-dashboard-metrics-title">
      <div class="home-dashboard-overview__metrics-heading">
        <div>
          <p class="home-dashboard-overview__eyebrow">Network metrics</p>
          <h3 id="home-dashboard-metrics-title">Current snapshot</h3>
        </div>
      </div>
      <div class="home-dashboard-overview__metric-grid">
        <article class="home-dashboard-overview__metric-panel">
          <h4>Latest Canton Coin Price</h4>
          <strong v-if="!marketLoading">{{ formatPrice(latestPrice) }}</strong>
          <strong v-else>Loading…</strong>
          <span v-if="marketError" class="home-dashboard-overview__metric-error">{{ marketError }}</span>
          <span v-else>Latest available daily close</span>
        </article>
        <article class="home-dashboard-overview__metric-panel">
          <h4>Active Parties (24h)</h4>
          <strong v-if="!recentPartiesLoading && !recentPartiesError">{{ recentParties?.count ?? 0 }}</strong>
          <strong v-else-if="recentPartiesLoading">Loading…</strong>
          <strong v-else>—</strong>
          <span v-if="recentPartiesError" class="home-dashboard-overview__metric-error">{{ recentPartiesError }}</span>
          <span v-else>Unique parties seen in updates during the last 24 hours</span>
        </article>
      </div>
    </section>
  </section>
</template>
