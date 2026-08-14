<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  fetchActivityHistory,
  fetchCantonCoinHistory,
  fetchRecentActiveParties,
} from '../lib/api';
import { useSectionLoad } from '../composables/useSectionLoad';
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
const chartPadding = { top: 14, right: 18, bottom: 30, left: 44 };
const chartTickRatios = [0, 0.25, 0.5, 0.75, 1] as const;
const chartGuideRatios = [0, 0.25, 0.5, 0.75, 1] as const;
const priceChartHeadroom = 1.2;
const ranges: Array<{ value: HomeDashboardRange; label: string }> = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
];

type HomeDashboardChartPoint = HomeDashboardActivityPoint | HomeDashboardPricePoint;
type HomeDashboardChartKind = 'activity' | 'price';
type HomeDashboardChartScale = { min: number; max: number; valueRange: number };

const selectedRange = ref<HomeDashboardRange>('24h');
const activitySection = useSectionLoad<ActivityHistoryResponse>(() =>
  fetchActivityHistory(dashboardRangeDays(selectedRange.value)),
);
const marketSection = useSectionLoad<CantonCoinHistoryResponse>(() =>
  fetchCantonCoinHistory('1D'),
);
const recentPartiesSection = useSectionLoad<RecentActivePartiesResponse>(async () => {
  const response = await fetchRecentActiveParties(
    dashboardRangeDays(selectedRange.value) * 24,
  );
  if (response.status === 'error') {
    throw new Error(response.error ?? 'Unable to load active parties.');
  }
  return response;
});

const activity = activitySection.data;
const activityLoading = activitySection.loading;
const activityError = activitySection.error;
const market = marketSection.data;
const marketLoading = marketSection.loading;
const marketError = marketSection.error;
const recentParties = recentPartiesSection.data;
const recentPartiesLoading = recentPartiesSection.loading;
const recentPartiesError = recentPartiesSection.error;

const activityPoints = computed(() =>
  aggregateActivityPoints(activity.value?.nodes ?? []),
);
const representativeActivitySeries = computed(() =>
  activity.value?.nodes.find(
    (node) => node.status === 'healthy'
      && typeof node.totalUpdateCount === 'number'
      && Number.isFinite(node.totalUpdateCount),
  ) ?? null,
);
const totalTransactions = computed(
  () => representativeActivitySeries.value?.totalUpdateCount ?? null,
);
const latestHourTps = computed(() => {
  const series = representativeActivitySeries.value;
  const generatedAt = Date.parse(activity.value?.generatedAt ?? '');
  if (!series || !Number.isFinite(generatedAt)) {
    return null;
  }

  const windowStart = generatedAt - 60 * 60 * 1000;
  const latestHourTransactions = series.samples.reduce((total, sample) => {
    const timestamp = Date.parse(sample.timestamp);
    return timestamp >= windowStart && timestamp <= generatedAt
      ? total + Math.max(sample.activityValue, 0)
      : total;
  }, 0);

  return latestHourTransactions / 3600;
});
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

function selectRange(range: HomeDashboardRange) {
  if (range === selectedRange.value) {
    return;
  }

  selectedRange.value = range;
  activitySection.reset();
  recentPartiesSection.reset();
  void activitySection.load();
  void recentPartiesSection.load();
}

function chartValue(point: HomeDashboardChartPoint): number {
  return 'value' in point ? point.value : point.close;
}

function chartScale(
  points: HomeDashboardChartPoint[],
  kind: HomeDashboardChartKind,
): HomeDashboardChartScale {
  const values = points.map(chartValue);
  const min = 0;
  const max = kind === 'price'
    ? Math.max(...values, 0) * priceChartHeadroom
    : Math.max(...values, 1);
  return { min, max, valueRange: max - min || 1 };
}

function chartPoints(points: HomeDashboardChartPoint[], kind: HomeDashboardChartKind): string {
  if (points.length === 0) {
    return '';
  }

  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const { min, valueRange } = chartScale(points, kind);
  const firstTimestamp = Date.parse(points[0].timestamp);
  const lastTimestamp = Date.parse(points[points.length - 1].timestamp);
  const timeRange = lastTimestamp - firstTimestamp;

  return points
    .map((point) => {
      const timestamp = Date.parse(point.timestamp);
      const value = chartValue(point);
      const x =
        points.length === 1 || !Number.isFinite(timeRange)
          ? chartPadding.left + plotWidth / 2
          : chartPadding.left + ((timestamp - firstTimestamp) / timeRange) * plotWidth;
      const y = chartPadding.top + plotHeight - ((value - min) / valueRange) * plotHeight;
      return `${round(x)},${round(y)}`;
    })
    .join(' ');
}

function formatChartAxisValue(value: number, kind: HomeDashboardChartKind): string {
  if (kind === 'activity') {
    return Math.round(value).toLocaleString('en-US');
  }

  return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function chartYAxisTicks(
  points: HomeDashboardChartPoint[],
  kind: HomeDashboardChartKind,
): Array<{ label: string; position: number }> {
  if (points.length === 0) {
    return [];
  }

  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const { min, valueRange } = chartScale(points, kind);
  return chartTickRatios.map((ratio) => ({
    label: formatChartAxisValue(min + valueRange * (1 - ratio), kind),
    position: chartPadding.top + ratio * plotHeight,
  }));
}

function dailyTicks(
  points: HomeDashboardChartPoint[],
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

function formatTransactionTotal(value: number | null): string {
  return value === null ? '—' : value.toLocaleString('en-US');
}

function formatTps(value: number | null): string {
  if (value === null) {
    return '—';
  }

  return value.toLocaleString('en-US', {
    minimumFractionDigits: value < 1 ? 4 : 2,
    maximumFractionDigits: 4,
  });
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

onMounted(() => {
  void activitySection.load();
  void marketSection.load();
  void recentPartiesSection.load();
});
</script>

<template>
  <section class="home-dashboard-overview" aria-labelledby="home-dashboard-overview-title">
    <div class="home-dashboard-overview__header">
      <div>
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
        <div v-if="activityLoading" class="home-dashboard-overview__state inline-loading" role="status">
          <span class="node-updates__spinner" aria-hidden="true"></span>
          <span>Loading transaction activity…</span>
        </div>
        <div
          v-else-if="activityError"
          class="home-dashboard-overview__state home-dashboard-overview__state--error"
          role="alert"
        >
          <span>{{ activityError }}</span>
          <button type="button" class="dashboard__refresh" @click="activitySection.retry">
            Retry activity
          </button>
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
              v-for="position in chartGuideRatios"
              :key="position"
              class="home-dashboard-overview__guide"
              :x1="chartPadding.left"
              :x2="chartWidth - chartPadding.right"
              :y1="chartPadding.top + position * (chartHeight - chartPadding.top - chartPadding.bottom)"
              :y2="chartPadding.top + position * (chartHeight - chartPadding.top - chartPadding.bottom)"
            />
            <text
              v-for="tick in chartYAxisTicks(activityPoints, 'activity')"
              :key="tick.position"
              class="home-dashboard-overview__y-tick"
              :x="chartPadding.left - 6"
              :y="tick.position"
              text-anchor="end"
              dominant-baseline="middle"
            >{{ tick.label }}</text>
            <polyline
              class="home-dashboard-overview__line"
              :points="chartPoints(activityPoints, 'activity')"
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
        <div v-if="marketLoading" class="home-dashboard-overview__state inline-loading" role="status">
          <span class="node-updates__spinner" aria-hidden="true"></span>
          <span>Loading Canton Coin price…</span>
        </div>
        <div
          v-else-if="marketError"
          class="home-dashboard-overview__state home-dashboard-overview__state--error"
          role="alert"
        >
          <span>{{ marketError }}</span>
          <button type="button" class="dashboard__refresh" @click="marketSection.retry">
            Retry market
          </button>
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
              v-for="position in chartGuideRatios"
              :key="position"
              class="home-dashboard-overview__guide"
              :x1="chartPadding.left"
              :x2="chartWidth - chartPadding.right"
              :y1="chartPadding.top + position * (chartHeight - chartPadding.top - chartPadding.bottom)"
              :y2="chartPadding.top + position * (chartHeight - chartPadding.top - chartPadding.bottom)"
            />
            <text
              v-for="tick in chartYAxisTicks(pricePoints, 'price')"
              :key="tick.position"
              class="home-dashboard-overview__y-tick"
              :x="chartPadding.left - 6"
              :y="tick.position"
              text-anchor="end"
              dominant-baseline="middle"
            >{{ tick.label }}</text>
            <polyline
              class="home-dashboard-overview__line home-dashboard-overview__line--price"
              :points="chartPoints(pricePoints, 'price')"
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

    <div class="home-dashboard-overview__metrics-heading">
      <div>
        <h3 id="home-dashboard-metrics-title">Current Snapshot</h3>
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
        <h4>Active Parties ({{ selectedRange }})</h4>
        <div v-if="recentPartiesLoading" class="inline-loading" role="status">
          <span class="node-updates__spinner" aria-hidden="true"></span>
          <span>Loading active parties…</span>
        </div>
        <template v-else-if="recentPartiesError">
          <strong>—</strong>
          <span class="home-dashboard-overview__metric-error" role="alert">{{ recentPartiesError }}</span>
          <button type="button" class="dashboard__refresh" @click="recentPartiesSection.retry">
            Retry recent parties
          </button>
        </template>
        <template v-else>
          <strong>{{ recentParties?.count ?? 0 }}</strong>
          <span>Unique parties seen in updates during the last {{ selectedRange }}</span>
        </template>
      </article>
      <article class="home-dashboard-overview__metric-panel">
        <h4>Transactions</h4>
        <strong v-if="activityLoading">Loading…</strong>
        <strong v-else>{{ formatTransactionTotal(totalTransactions) }}</strong>
        <span v-if="activityError" class="home-dashboard-overview__metric-error">{{ activityError }}</span>
        <span v-else-if="!activityLoading && latestHourTps !== null">
          {{ formatTps(latestHourTps) }} TPS in the last hour
        </span>
        <span v-else-if="!activityLoading">Transaction telemetry unavailable</span>
        <span v-else>Cumulative updates and latest-hour throughput</span>
      </article>
    </div>
  </section>
</template>
