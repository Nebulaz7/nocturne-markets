import type { BetSide } from "./types.ts";

export const ZEC_IN_ZATOSHIS = 100_000_000n;
export const DEFAULT_FEE_BPS = 200n; // 2% protocol fee
export const ZIP317_BASE_FEE_ZATS = 10_000n; // 0.0001 ZEC

export interface BetPosition {
  id: string;
  side: BetSide;
  stakeZats: bigint;
  returnAddress: string;
}

export interface PayoutResult {
  id: string;
  returnAddress: string;
  side: BetSide;
  stakeZats: bigint;
  grossPayoutZats: bigint;
  netPayoutZats: bigint;
  isRefund: boolean;
}

export interface SettlementSummary {
  status: "SETTLED" | "REFUNDED";
  outcome: BetSide | "VOID";
  totalPotZats: bigint;
  yesPotZats: bigint;
  noPotZats: bigint;
  winningPotZats: bigint;
  losingPotZats: bigint;
  protocolFeeZats: bigint;
  totalDistributedZats: bigint;
  payouts: PayoutResult[];
}

/**
 * Converts ZEC decimal float/string to exact zatoshis (bigint).
 */
export function zecToZats(zec: number | string): bigint {
  const zecStr = typeof zec === "number" ? zec.toFixed(8) : zec.trim();
  const parts = zecStr.split(".");
  const whole = BigInt(parts[0] || "0");
  let fractionStr = parts[1] || "";
  if (fractionStr.length > 8) {
    fractionStr = fractionStr.substring(0, 8);
  } else {
    fractionStr = fractionStr.padEnd(8, "0");
  }
  const fraction = BigInt(fractionStr);
  return whole * ZEC_IN_ZATOSHIS + fraction;
}

/**
 * Converts zatoshis (bigint) to ZEC floating point number for display.
 */
export function zatsToZec(zats: bigint): number {
  return Number(zats) / Number(ZEC_IN_ZATOSHIS);
}

/**
 * Calculates parimutuel settlement payouts using exact BigInt zatoshis.
 *
 * Rules:
 * 1. Single-Sided or Void: If yesPot == 0, noPot == 0, or outcome == 'VOID', status is REFUNDED.
 *    Every bettor gets back (stake - zip317TxFee). Protocol fee is 0.
 * 2. Fee-on-Profit-Only:
 *    - distributableLosingPot = (losingPot * (10000n - feeBps)) / 10000n
 *    - grossPayout_i = stake_i + (stake_i * distributableLosingPot) / winningPot
 *    - netPayout_i = grossPayout_i - zip317FeePerRecipient
 * 3. Invariant: sum(grossPayout_i) + protocolFee <= totalPot (zero dust exploitation).
 */
export function calculateParimutuelPayouts(params: {
  bets: BetPosition[];
  outcome: BetSide | "VOID";
  feeBps?: bigint;
  zip317FeeZats?: bigint;
}): SettlementSummary {
  const { bets, outcome } = params;
  const feeBps = params.feeBps ?? DEFAULT_FEE_BPS;
  const zip317Fee = params.zip317FeeZats ?? ZIP317_BASE_FEE_ZATS;

  let yesPotZats = 0n;
  let noPotZats = 0n;

  for (const bet of bets) {
    if (bet.stakeZats <= 0n) {
      throw new Error(`Bet stake must be positive: got ${bet.stakeZats} zats`);
    }
    if (bet.side === "YES") {
      yesPotZats += bet.stakeZats;
    } else if (bet.side === "NO") {
      noPotZats += bet.stakeZats;
    }
  }

  const totalPotZats = yesPotZats + noPotZats;

  // Single-Sided or VOID Outcome -> REFUND RULE
  if (outcome === "VOID" || yesPotZats === 0n || noPotZats === 0n) {
    const payouts: PayoutResult[] = bets.map((bet) => {
      const netPayout = bet.stakeZats > zip317Fee ? bet.stakeZats - zip317Fee : 0n;
      return {
        id: bet.id,
        returnAddress: bet.returnAddress,
        side: bet.side,
        stakeZats: bet.stakeZats,
        grossPayoutZats: bet.stakeZats,
        netPayoutZats: netPayout,
        isRefund: true,
      };
    });

    const totalDistributed = payouts.reduce((acc, p) => acc + p.grossPayoutZats, 0n);

    return {
      status: "REFUNDED",
      outcome,
      totalPotZats,
      yesPotZats,
      noPotZats,
      winningPotZats: 0n,
      losingPotZats: 0n,
      protocolFeeZats: 0n,
      totalDistributedZats: totalDistributed,
      payouts,
    };
  }

  // STANDARD RESOLUTION: Outcome is YES or NO
  const winningPotZats = outcome === "YES" ? yesPotZats : noPotZats;
  const losingPotZats = outcome === "YES" ? noPotZats : yesPotZats;

  const protocolFeeZats = (losingPotZats * feeBps) / 10000n;
  const distributableLosingPotZats = losingPotZats - protocolFeeZats;

  let totalGrossDistributed = 0n;
  const payouts: PayoutResult[] = [];

  for (const bet of bets) {
    if (bet.side === outcome) {
      // Winning bet: principal stake + proportional share of distributable losing pot
      const profitShare = (bet.stakeZats * distributableLosingPotZats) / winningPotZats;
      const grossPayout = bet.stakeZats + profitShare;
      const netPayout = grossPayout > zip317Fee ? grossPayout - zip317Fee : 0n;

      totalGrossDistributed += grossPayout;

      payouts.push({
        id: bet.id,
        returnAddress: bet.returnAddress,
        side: bet.side,
        stakeZats: bet.stakeZats,
        grossPayoutZats: grossPayout,
        netPayoutZats: netPayout,
        isRefund: false,
      });
    } else {
      // Losing bet: gross payout 0
      payouts.push({
        id: bet.id,
        returnAddress: bet.returnAddress,
        side: bet.side,
        stakeZats: bet.stakeZats,
        grossPayoutZats: 0n,
        netPayoutZats: 0n,
        isRefund: false,
      });
    }
  }

  // Strict Conservation Assertion: sum(grossPayout) + protocolFee <= totalPot
  if (totalGrossDistributed + protocolFeeZats > totalPotZats) {
    throw new Error(
      `Parimutuel Conservation Invariant Violated! Distributed (${totalGrossDistributed}) + Fee (${protocolFeeZats}) > TotalPot (${totalPotZats})`
    );
  }

  return {
    status: "SETTLED",
    outcome,
    totalPotZats,
    yesPotZats,
    noPotZats,
    winningPotZats,
    losingPotZats,
    protocolFeeZats,
    totalDistributedZats: totalGrossDistributed,
    payouts,
  };
}

/**
 * Backward compatibility wrapper for single bet calculation
 */
export function calculateParimutuelPayout(params: {
  stakeZec: number;
  totalPotZec: number;
  winningPotZec: number;
  protocolFeeRate?: number;
  networkFeeZec?: number;
}) {
  const stakeZats = zecToZats(params.stakeZec);
  const totalPotZats = zecToZats(params.totalPotZec);
  const winningPotZats = zecToZats(params.winningPotZec);
  const losingPotZats = totalPotZats > winningPotZats ? totalPotZats - winningPotZats : 0n;

  if (winningPotZats === 0n || losingPotZats === 0n) {
    const net = stakeZats > ZIP317_BASE_FEE_ZATS ? stakeZats - ZIP317_BASE_FEE_ZATS : 0n;
    return {
      stakeZec: params.stakeZec,
      totalPotZec: params.totalPotZec,
      winningPotZec: 0,
      grossPayoutZec: params.stakeZec,
      protocolFeeZec: 0,
      networkFeeZec: zatsToZec(ZIP317_BASE_FEE_ZATS),
      netPayoutZec: zatsToZec(net),
    };
  }

  const feeBps = BigInt(Math.round((params.protocolFeeRate ?? 0.02) * 10000));
  const protocolFeeZats = (losingPotZats * feeBps) / 10000n;
  const distributableLosing = losingPotZats - protocolFeeZats;
  const profitZats = (stakeZats * distributableLosing) / winningPotZats;
  const grossZats = stakeZats + profitZats;
  const netZats = grossZats > ZIP317_BASE_FEE_ZATS ? grossZats - ZIP317_BASE_FEE_ZATS : 0n;

  return {
    stakeZec: params.stakeZec,
    totalPotZec: params.totalPotZec,
    winningPotZec: params.winningPotZec,
    grossPayoutZec: zatsToZec(grossZats),
    protocolFeeZec: zatsToZec(protocolFeeZats),
    networkFeeZec: zatsToZec(ZIP317_BASE_FEE_ZATS),
    netPayoutZec: zatsToZec(netZats),
  };
}
