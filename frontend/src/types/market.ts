export type CantonCoinProviderStatus = "ok" | "empty" | "error";
export type CantonCoinDataStatus = "ready" | "partial" | "empty" | "error";

export interface CantonCoinCandle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volumeQuote: number;
}

export interface CantonCoinVenue {
  id: string;
  label: string;
  pair: string;
  quote: string;
  status: CantonCoinProviderStatus;
  coverageStart: string | null;
  coverageEnd: string | null;
  candles: CantonCoinCandle[];
  message: string | null;
}

export interface CantonCoinHistoryResponse {
  asset: {
    name: "Canton Coin";
    symbol: "CC";
    canonicalId: "canton-network";
    network: "Canton Network";
    kind: "native";
  };
  interval: "1D";
  dataStatus: CantonCoinDataStatus;
  venues: CantonCoinVenue[];
}
