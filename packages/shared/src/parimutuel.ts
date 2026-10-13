import { ParimutuelCalculation } from "./types.ts";

export const DEFAULT_PROTOCOL_FEE_RATE = 0.02; // 2% protocol fee
export const CONVENTIONAL_NETWORK_FEE_ZEC = 0.0001; // ZIP-317 base fee (10,000 zats)

/**
 * Calculates the exact parimutuel payout for a winning bet stake.
 */
export function calculateParimutuelPayout(params: {
  stakeZec: number;
  totalPotZec: number;
  winningPotZec: number;
  protocolFeeRate?: number;
  networkFeeZec?: number;
}): ParimutuelCalculation {
  const {
    stakeZec,
    totalPotZec,
    winningPotZec,
    protocolFeeRate = DEFAULT_PROTOCOL_FEE_RATE,
    networkFeeZec = CONVENTIONAL_NETWORK_FEE_ZEC,
  } = params;

  if (stakeZec <= 0) {
    throw new Error("Stake must be greater than 0");
  }

  // Edge case: if no winning pot exists or winning pot is zero, fallback to refund
  if (winningPotZec <= 0) {
    return {
      stakeZec,
      totalPotZec,
      winningPotZec: 0,
      grossPayoutZec: stakeZec,
      protocolFeeZec: 0,
      networkFeeZec,
      netPayoutZec: Math.max(0, stakeZec - networkFeeZec),
    };
  }

  // Standard Parimutuel Formula
  const grossPayoutZec = stakeZec * (totalPotZec / winningPotZec);
  const protocolFeeZec = grossPayoutZec * protocolFeeRate;
  const netPayoutZec = Math.max(0, grossPayoutZec - protocolFeeZec - networkFeeZec);

  return {
    stakeZec,
    totalPotZec,
    winningPotZec,
    grossPayoutZec,
    protocolFeeZec,
    networkFeeZec,
    netPayoutZec,
  };
}

/**
 * Calculates refund for a voided market or unrevealed bet policy.
 */
export function calculateRefund(params: {
  stakeZec: number;
  networkFeeZec?: number;
}): number {
  const networkFee = params.networkFeeZec ?? CONVENTIONAL_NETWORK_FEE_ZEC;
  return Math.max(0, params.stakeZec - networkFee);
}
