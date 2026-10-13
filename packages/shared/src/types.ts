export type BetSide = "YES" | "NO";

export type MarketStatus =
  | "OPEN" // Accepting sealed bets
  | "CLOSED" // Betting closed, awaiting reveal & resolution
  | "REVEALING" // Window to submit side + secret
  | "RESOLVED" // Polymarket resolved outcome
  | "SETTLED" // Winners paid out
  | "REFUNDED"; // Void or 50/50 split triggers full refunds

export interface Market {
  id: string;
  polymarketId: string;
  title: string;
  slug: string;
  closeTime: string;
  status: MarketStatus;
  outcome?: BetSide | "VOID";
  potAddress: string;
  merkleRoot?: string;
  totalPotZec: number;
  yesPotZec?: number;
  noPotZec?: number;
}

export interface BetCommitmentData {
  side: BetSide;
  secret: string; // 32-byte hex string
  marketId: string;
}

export interface DecodedBetMemo {
  version: number;
  commitment: string; // 32-byte hex string
  returnAddress: string;
}

export interface PreparedBetReceipt {
  marketId: string;
  side: BetSide;
  amountZec: number;
  secret: string;
  commitment: string;
  returnAddress: string;
  potAddress: string;
  paymentUri: string;
  memoBase64url: string;
  createdAt: string;
}

export interface ParimutuelCalculation {
  stakeZec: number;
  totalPotZec: number;
  winningPotZec: number;
  grossPayoutZec: number;
  protocolFeeZec: number;
  networkFeeZec: number;
  netPayoutZec: number;
}

export const CHIP_SIZES_ZEC = [1, 5, 10] as const;
export type ChipSizeZec = (typeof CHIP_SIZES_ZEC)[number];
