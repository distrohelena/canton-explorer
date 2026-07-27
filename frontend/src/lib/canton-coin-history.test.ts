import { describe, expect, it } from "vitest";
import {
  chartTicks,
  chartYForValue,
  filterCantonCoinRange,
  linePoints,
  medianCloseByUtcDay,
} from "./canton-coin-history";
import type { CantonCoinCandle, CantonCoinVenue } from "../types/market";

function candle(timestamp: string, close: number): CantonCoinCandle {
  return {
    timestamp,
    open: close,
    high: close,
    low: close,
    close,
    volumeQuote: 10,
  };
}

function venue(overrides: Partial<CantonCoinVenue> = {}): CantonCoinVenue {
  return {
    id: "okx",
    label: "OKX",
    pair: "CC-USDT",
    quote: "USDT",
    status: "ok",
    coverageStart: null,
    coverageEnd: null,
    candles: [],
    message: null,
    ...overrides,
  };
}

describe("Canton Coin history helpers", () => {
  const now = new Date("2026-07-27T12:00:00.000Z");

  it("filters daily candles by a UTC range", () => {
    const candles = [
      candle("2026-07-26T00:00:00.000Z", 3),
      candle("2026-07-01T00:00:00.000Z", 2),
      candle("2026-06-26T00:00:00.000Z", 1),
    ];

    expect(
      filterCantonCoinRange(candles, "30d", now).map((item) => item.close),
    ).toEqual([3, 2]);
    expect(filterCantonCoinRange(candles, "all", now)).toEqual(candles);
  });

  it("calculates a median only for overlapping same-quote venue closes", () => {
    const points = medianCloseByUtcDay([
      venue({
        candles: [
          candle("2026-07-25T00:00:00.000Z", 1),
          candle("2026-07-26T00:00:00.000Z", 2),
        ],
      }),
      venue({
        id: "bybit",
        label: "Bybit",
        pair: "CCUSDT",
        candles: [candle("2026-07-25T00:00:00.000Z", 3)],
      }),
      venue({
        id: "other",
        label: "Other",
        pair: "CC-USD",
        quote: "USD",
        candles: [candle("2026-07-25T00:00:00.000Z", 99)],
      }),
    ]);

    expect(points).toEqual([
      { timestamp: "2026-07-25T00:00:00.000Z", close: 2, quote: "USDT" },
    ]);
  });

  it("generates stable SVG points for one-point and constant series", () => {
    expect(linePoints([candle("2026-07-25T00:00:00.000Z", 2)], 100, 100)).toBe(
      "0,50",
    );
    expect(
      linePoints(
        [
          candle("2026-07-25T00:00:00.000Z", 2),
          candle("2026-07-26T00:00:00.000Z", 2),
        ],
        100,
        100,
      ),
    ).toBe("0,50 100,50");
  });

  it("generates a zero-based five-tick scale and maps ticks to the plot", () => {
    expect(chartTicks(10)).toEqual([10, 7.5, 5, 2.5, 0]);

    const plot = { left: 10, top: 5, width: 80, height: 40 };
    const domain = { min: 0, max: 10 };

    expect(chartYForValue(10, domain, plot)).toBe(5);
    expect(chartYForValue(0, domain, plot)).toBe(45);
    expect(
      linePoints(
        [
          candle("2026-07-25T00:00:00.000Z", 0),
          candle("2026-07-26T00:00:00.000Z", 10),
        ],
        100,
        100,
        domain,
        plot,
      ),
    ).toBe("10,45 90,5");
  });

  it("collapses a zero-only scale to one baseline tick and ignores negative data", () => {
    expect(chartTicks(0)).toEqual([0]);
    expect(
      linePoints([candle("2026-07-25T00:00:00.000Z", -1)], 100, 100, {
        min: 0,
        max: 0,
      }),
    ).toBe("");
  });
});
