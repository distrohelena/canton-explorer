export interface TokenSummary {
  tokenId: string;
  name: string;
  symbol: string | null;
  source: 'pqs';
}

export interface TokensResponse {
  tokens: TokenSummary[];
}

export interface TokenDetailResponse {
  token: TokenSummary;
  transfers: TokenTransferSummary[];
}

export interface TokenHolderObservedNode {
  nodeId: string;
  label: string;
}

export interface TokenHolderSummary {
  partyId: string;
  amount: string | null;
  nodes: TokenHolderObservedNode[];
}

export interface TokenHoldersResponse {
  tokenId: string;
  holders: TokenHolderSummary[];
}

export interface TokenTransferObservedNode {
  nodeId: string;
  label: string;
  eventOffset: string;
}

export interface TokenTransferSummary {
  tokenId: string;
  tokenName: string;
  amount: string | null;
  sender: string | null;
  receiver: string | null;
  updateId: string;
  recordTime: string | null;
  nodes: TokenTransferObservedNode[];
}

export interface TokenTransfersResponse {
  limit: number;
  nextBefore: string | null;
  nextAfter: string | null;
  transfers: TokenTransferSummary[];
}
