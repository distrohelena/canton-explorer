import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCantonCoinHistory } from "../lib/api";
import type { CantonCoinHistoryResponse } from "../types/market";
import CantonCoinView from "./CantonCoinView.vue";

vi.mock("../lib/api", () => ({
  fetchCantonCoinHistory: vi.fn(),
}));

const history: CantonCoinHistoryResponse = {
  asset: {
    name: "Canton Coin",
    symbol: "CC",
    canonicalId: "canton-network",
    network: "Canton Network",
    kind: "native",
  },
  interval: "1D",
  dataStatus: "ready",
  venues: [
    {
      id: "okx",
      label: "OKX",
      pair: "CC-USDT",
      quote: "USDT",
      status: "ok",
      coverageStart: "2026-07-25T00:00:00.000Z",
      coverageEnd: "2026-07-26T00:00:00.000Z",
      candles: [
        {
          timestamp: "2026-07-25T00:00:00.000Z",
          open: 0.1,
          high: 0.11,
          low: 0.09,
          close: 0.105,
          volumeQuote: 100,
        },
        {
          timestamp: "2026-07-26T00:00:00.000Z",
          open: 0.11,
          high: 0.12,
          low: 0.1,
          close: 0.115,
          volumeQuote: 110,
        },
      ],
      message: null,
    },
    {
      id: "bybit",
      label: "Bybit",
      pair: "CCUSDT",
      quote: "USDT",
      status: "ok",
      coverageStart: "2026-07-25T00:00:00.000Z",
      coverageEnd: "2026-07-26T00:00:00.000Z",
      candles: [
        {
          timestamp: "2026-07-25T00:00:00.000Z",
          open: 0.1,
          high: 0.12,
          low: 0.09,
          close: 0.11,
          volumeQuote: 200,
        },
      ],
      message: null,
    },
  ],
};

describe("CantonCoinView", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders native CC source history and the overlap median", async () => {
    vi.mocked(fetchCantonCoinHistory).mockResolvedValue(history);

    const { container } = render(CantonCoinView);

    expect(
      await screen.findByRole("heading", { name: "Canton Coin" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("OKX")).toBeInTheDocument();
    expect(screen.getByText("Bybit")).toBeInTheDocument();
    expect(screen.getByText("CC-USDT")).toBeInTheDocument();
    expect(screen.getByText("CCUSDT")).toBeInTheDocument();
    expect(screen.getByText("Cross-venue median")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Canton Coin daily close price chart" }),
    ).toBeInTheDocument();
    const axisTicks = Array.from(
      container.querySelectorAll("[data-chart-axis-tick]"),
    );
    expect(axisTicks).toHaveLength(5);
    const axisValues = axisTicks.map((tick) =>
      Number(tick.getAttribute("data-value")),
    );
    [0.115, 0.08625, 0.0575, 0.02875, 0].forEach((expected, index) => {
      expect(axisValues[index]).toBeCloseTo(expected, 12);
    });
    expect(axisTicks.at(-1)?.textContent).toContain("0 USDT");
    expect(
      screen.queryByText("Native CC · WCC is excluded"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Network", { exact: true }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Canton Network", { exact: true }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Daily exchange market data", { exact: true }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Prices shown in each venue’s quote currency.", {
        exact: true,
      }),
    ).not.toBeInTheDocument();
    expect(fetchCantonCoinHistory).toHaveBeenCalledWith("1D");
  });

  it("changes the selected range without refetching", async () => {
    vi.mocked(fetchCantonCoinHistory).mockResolvedValue(history);

    render(CantonCoinView);
    await screen.findByText("OKX");
    await fireEvent.click(screen.getByRole("button", { name: "30 days" }));

    expect(screen.getByRole("button", { name: "30 days" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(fetchCantonCoinHistory).toHaveBeenCalledTimes(1);
  });

  it("renders one baseline tick for a zero-only range", async () => {
    vi.mocked(fetchCantonCoinHistory).mockResolvedValue({
      ...history,
      venues: history.venues.map((venue) => ({
        ...venue,
        candles: venue.candles.map((candle) => ({ ...candle, close: 0 })),
      })),
    });

    const { container } = render(CantonCoinView);

    const axisTicks = await waitFor(() => {
      const ticks = Array.from(
        container.querySelectorAll("[data-chart-axis-tick]"),
      );
      expect(ticks).toHaveLength(1);
      return ticks;
    });
    expect(axisTicks[0].getAttribute("data-value")).toBe("0");
    expect(axisTicks[0].textContent).toContain("0 USDT");
  });

  it("shows the empty range state when only invalid or negative closes remain", async () => {
    vi.mocked(fetchCantonCoinHistory).mockResolvedValue({
      ...history,
      venues: history.venues.map((venue) => ({
        ...venue,
        candles: venue.candles.map((candle) => ({ ...candle, close: -1 })),
      })),
    });

    render(CantonCoinView);

    expect(
      await screen.findByText("No candles in this range."),
    ).toBeInTheDocument();
  });

  it("omits a quote suffix when visible venues use mixed quote currencies", async () => {
    vi.mocked(fetchCantonCoinHistory).mockResolvedValue({
      ...history,
      venues: history.venues.map((venue, index) =>
        index === 0 ? venue : { ...venue, quote: "USD", pair: "CC-USD" },
      ),
    });

    const { container } = render(CantonCoinView);

    const axisTicks = await waitFor(() => {
      const ticks = Array.from(
        container.querySelectorAll("[data-chart-axis-tick]"),
      );
      expect(ticks).toHaveLength(5);
      return ticks;
    });
    expect(axisTicks.every((tick) => !tick.textContent?.includes("USDT"))).toBe(
      true,
    );
  });

  it("renders partial provider warnings and source error messages", async () => {
    vi.mocked(fetchCantonCoinHistory).mockResolvedValue({
      ...history,
      dataStatus: "partial",
      venues: [
        history.venues[0],
        {
          ...history.venues[1],
          status: "error",
          candles: [],
          coverageStart: null,
          coverageEnd: null,
          message: "Bybit market history is unavailable.",
        },
      ],
    });

    render(CantonCoinView);

    expect(
      await screen.findByText("Some market sources are unavailable."),
    ).toBeInTheDocument();
    const bybitCard = screen.getByRole("article", { name: "Bybit CCUSDT" });
    expect(
      within(bybitCard).getByText("Bybit market history is unavailable."),
    ).toBeInTheDocument();
  });

  it("renders an empty state from a successful response with no candles", async () => {
    vi.mocked(fetchCantonCoinHistory).mockResolvedValue({
      ...history,
      dataStatus: "empty",
      venues: history.venues.map((venue) => ({
        ...venue,
        status: "empty" as const,
        candles: [],
        coverageStart: null,
        coverageEnd: null,
      })),
    });

    render(CantonCoinView);

    expect(
      await screen.findByText("No public CC price history is available."),
    ).toBeInTheDocument();
  });

  it("can retry after the request fails", async () => {
    vi.mocked(fetchCantonCoinHistory)
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce(history);

    render(CantonCoinView);

    expect(
      await screen.findByText("Unable to load Canton Coin history."),
    ).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByText("OKX")).toBeInTheDocument());
    expect(fetchCantonCoinHistory).toHaveBeenCalledTimes(2);
  });
});
