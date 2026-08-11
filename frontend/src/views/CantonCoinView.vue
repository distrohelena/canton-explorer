<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { fetchCantonCoinHistory } from "../lib/api";
import {
  chartTicks as buildChartTicks,
  chartYForValue,
  filterCantonCoinRange,
  linePoints,
  medianCloseByUtcDay,
  type CantonCoinRange,
} from "../lib/canton-coin-history";
import type {
  CantonCoinCandle,
  CantonCoinHistoryResponse,
  CantonCoinVenue,
} from "../types/market";

const CHART_WIDTH = 640;
const CHART_HEIGHT = 220;
const CHART_PLOT = {
  left: 72,
  top: 12,
  width: 560,
  height: 196,
} as const;
const selectedRange = ref<CantonCoinRange>("all");
const history = ref<CantonCoinHistoryResponse | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const rangeOptions: Array<{ value: CantonCoinRange; label: string }> = [
  { value: "all", label: "All history" },
  { value: "1y", label: "1 year" },
  { value: "90d", label: "90 days" },
  { value: "30d", label: "30 days" },
];

const visibleVenues = computed(() =>
  (history.value?.venues ?? []).map((venue) => ({
    ...venue,
    candles: filterCantonCoinRange(venue.candles, selectedRange.value),
  })),
);

const medianCandles = computed<CantonCoinCandle[]>(() =>
  medianCloseByUtcDay(visibleVenues.value).map((point) => ({
    timestamp: point.timestamp,
    open: point.close,
    high: point.close,
    low: point.close,
    close: point.close,
    volumeQuote: 0,
  })),
);

const chartDomain = computed(() => {
  const values = [
    ...visibleVenues.value.flatMap((venue) =>
      venue.candles.map((candle) => candle.close),
    ),
    ...medianCandles.value.map((candle) => candle.close),
  ].filter((value) => Number.isFinite(value) && value >= 0);
  if (values.length === 0) {
    return null;
  }

  return {
    min: 0,
    max: Math.max(...values),
  };
});

const hasChartData = computed(() =>
  visibleVenues.value.some((venue) =>
    venue.candles.some(
      (candle) => Number.isFinite(candle.close) && candle.close >= 0,
    ),
  ),
);

const chartQuote = computed(() => {
  const quotes = new Set(
    visibleVenues.value
      .filter((venue) =>
        venue.candles.some(
          (candle) => Number.isFinite(candle.close) && candle.close >= 0,
        ),
      )
      .map((venue) => venue.quote),
  );

  return quotes.size === 1 ? [...quotes][0] : null;
});

const yAxisTicks = computed(() => {
  const domain = chartDomain.value;
  if (!domain) {
    return [];
  }

  return buildChartTicks(domain.max).map((value) => ({
    value,
    y: chartYForValue(value, domain, CHART_PLOT),
  }));
});

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    history.value = await fetchCantonCoinHistory("1D");
  } catch (caught) {
    history.value = null;
    error.value =
      caught instanceof Error
        ? caught.message
        : "Unable to load Canton Coin history.";
  } finally {
    loading.value = false;
  }
}

function venuePoints(venue: CantonCoinVenue): string {
  return linePoints(
    venue.candles,
    CHART_WIDTH,
    CHART_HEIGHT,
    chartDomain.value ?? undefined,
    CHART_PLOT,
  );
}

function medianPoints(): string {
  return linePoints(
    medianCandles.value,
    CHART_WIDTH,
    CHART_HEIGHT,
    chartDomain.value ?? undefined,
    CHART_PLOT,
  );
}

function formatPrice(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

function formatAxisPrice(value: number): string {
  const formatted = formatPrice(value);
  return chartQuote.value ? `${formatted} ${chartQuote.value}` : formatted;
}

function formatCoverage(value: string | null): string {
  if (!value) {
    return "No coverage";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

function venueStatusLabel(venue: CantonCoinVenue): string {
  if (venue.status === "error") {
    return "Unavailable";
  }
  if (venue.status === "empty") {
    return "No data";
  }
  return `${venue.candles.length.toLocaleString()} daily candles`;
}

onMounted(() => {
  void load();
});
</script>

<template>
  <section class="canton-coin-page" aria-labelledby="canton-coin-heading">
    <header class="canton-coin-page__header">
      <div>
        <h2 id="canton-coin-heading">Canton Coin</h2>
      </div>
    </header>

    <div v-if="loading" class="canton-coin-page__state inline-loading" role="status">
      <span class="node-updates__spinner" aria-hidden="true"></span>
      <span>Loading Canton Coin history…</span>
    </div>

    <div
      v-else-if="error"
      class="canton-coin-page__state canton-coin-page__state--error"
      role="alert"
    >
      <strong>Unable to load Canton Coin history.</strong>
      <span>{{ error }}</span>
      <button type="button" class="button button--secondary" @click="load">
        Retry
      </button>
    </div>

    <template v-else-if="history">
      <div
        v-if="history.dataStatus === 'partial'"
        class="canton-coin-page__notice"
        role="status"
      >
        Some market sources are unavailable.
      </div>

      <div
        v-if="history.dataStatus === 'empty' || history.dataStatus === 'error'"
        class="canton-coin-page__state"
        role="status"
      >
        No public CC price history is available.
      </div>

      <template v-else>
        <section
          class="canton-coin-page__chart-card"
          aria-labelledby="canton-coin-chart-heading"
        >
          <header class="canton-coin-page__section-heading">
            <div>
              <h3 id="canton-coin-chart-heading">Daily close</h3>
            </div>
            <div class="canton-coin-page__chart-actions">
              <div
                class="canton-coin-page__ranges"
                role="group"
                aria-label="Price range"
              >
                <button
                  v-for="option in rangeOptions"
                  :key="option.value"
                  type="button"
                  class="canton-coin-page__range-button"
                  :class="{
                    'canton-coin-page__range-button--active':
                      selectedRange === option.value,
                  }"
                  :aria-pressed="selectedRange === option.value"
                  @click="selectedRange = option.value"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>
          </header>

          <div v-if="hasChartData" class="canton-coin-page__chart-shell">
            <svg
              class="canton-coin-page__chart"
              viewBox="0 0 640 220"
              role="img"
              aria-label="Canton Coin daily close price chart"
            >
              <g
                v-for="tick in yAxisTicks"
                :key="tick.value"
                data-chart-axis-tick
                :data-value="tick.value"
              >
                <line
                  :x1="CHART_PLOT.left"
                  :y1="tick.y"
                  :x2="CHART_PLOT.left + CHART_PLOT.width"
                  :y2="tick.y"
                  class="canton-coin-page__guide"
                />
                <text
                  :x="CHART_PLOT.left - 8"
                  :y="tick.y + 4"
                  class="canton-coin-page__axis-label"
                  text-anchor="end"
                >
                  {{ formatAxisPrice(tick.value) }}
                </text>
              </g>
              <polyline
                v-for="venue in visibleVenues.filter(
                  (item) => item.candles.length > 0,
                )"
                :key="venue.id"
                :points="venuePoints(venue)"
                class="canton-coin-page__line"
                :class="`canton-coin-page__line--${venue.id}`"
                fill="none"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="3"
              />
              <polyline
                v-if="medianCandles.length > 0"
                :points="medianPoints()"
                class="canton-coin-page__line canton-coin-page__line--median"
                fill="none"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="4"
                stroke-dasharray="8 6"
              />
            </svg>
          </div>
          <p v-else class="canton-coin-page__state">
            No candles in this range.
          </p>

          <div class="canton-coin-page__legend" aria-label="Chart series">
            <span
              v-for="venue in visibleVenues.filter(
                (item) => item.status === 'ok',
              )"
              :key="`legend-${venue.id}`"
            >
              <i
                class="canton-coin-page__legend-swatch"
                :class="`canton-coin-page__legend-swatch--${venue.id}`"
              />
              {{ venue.label }} · {{ venue.quote }}
            </span>
            <span v-if="medianCandles.length > 0">
              <i
                class="canton-coin-page__legend-swatch canton-coin-page__legend-swatch--median"
              />
              Cross-venue median
            </span>
          </div>
        </section>
      </template>

      <section
        class="canton-coin-page__sources"
        aria-labelledby="canton-coin-sources-heading"
      >
        <header class="canton-coin-page__section-heading">
          <div>
            <h3 id="canton-coin-sources-heading">Venue coverage</h3>
          </div>
        </header>
        <div class="canton-coin-page__source-grid">
          <article
            v-for="venue in visibleVenues"
            :key="venue.id"
            class="canton-coin-page__source-card"
            :aria-label="`${venue.label} ${venue.pair}`"
          >
            <div class="canton-coin-page__source-heading">
              <div>
                <h4>{{ venue.label }}</h4>
                <p>{{ venue.pair }}</p>
              </div>
              <span
                class="canton-coin-page__source-status"
                :data-status="venue.status"
              >
                {{ venueStatusLabel(venue) }}
              </span>
            </div>
            <p v-if="venue.message" class="canton-coin-page__source-error">
              {{ venue.message }}
            </p>
            <dl>
              <div>
                <dt>First candle</dt>
                <dd>{{ formatCoverage(venue.coverageStart) }}</dd>
              </div>
              <div>
                <dt>Latest candle</dt>
                <dd>{{ formatCoverage(venue.coverageEnd) }}</dd>
              </div>
            </dl>
          </article>
        </div>
      </section>
    </template>
  </section>
</template>
