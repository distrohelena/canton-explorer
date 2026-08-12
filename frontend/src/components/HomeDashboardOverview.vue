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
    recentParties.value = await fetchRecentActiveParties(
      dashboardRangeDays(selectedRange.value) * 24,
    );
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
  await Promise.all([refreshActivity(), refreshRecentParties()]);
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
  void refreshActivity();
  void refreshMarket();
  void refreshRecentParties();
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
        <strong v-if="!recentPartiesLoading && !recentPartiesError">{{ recentParties?.count ?? 0 }}</strong>
        <strong v-else-if="recentPartiesLoading">Loading…</strong>
        <strong v-else>—</strong>
        <span v-if="recentPartiesError" class="home-dashboard-overview__metric-error">{{ recentPartiesError }}</span>
        <span v-else>Unique parties seen in updates during the last {{ selectedRange }}</span>
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
