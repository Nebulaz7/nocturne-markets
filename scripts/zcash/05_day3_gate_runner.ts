import { ZingoWalletBridge } from "./wallet_bridge.ts";
import { prepareBet, type PreparedBetReceipt } from "./02_prepare_bet_request.ts";
import { scanForBetDeposits, type VerifiedBetDeposit } from "./03_watch_deposits.ts";
import { sendPayout, type PayoutResult } from "./04_test_payout.ts";

/**
 * Master Day 3 Gate Certification Runner.
 * Executes the full loop:
 * Pot Address -> ZIP-321 Bet Request -> Deposit Detection -> Memo Decode -> Shielded Payout.
 */
async function runDay3GateCertification() {
  console.log("=========================================================");
  console.log("   NOCTURNE MARKETS: DAY 3 GATE CERTIFICATION RUNNER     ");
  console.log("=========================================================\n");

  const bridge = new ZingoWalletBridge();

  // Step 1: Initialize Pot Wallet and retrieve Unified Address
  console.log("[Step 1] Initializing Pot Wallet on Zcash Testnet...");
  let potAddress: string;
  try {
    potAddress = await bridge.getPotAddress();
    console.log(`>>> Pot Unified Address: ${potAddress}\n`);
  } catch (err: any) {
    console.error(`[FAIL] Could not retrieve Pot Address: ${err.message}`);
    process.exit(1);
  }

  // Step 2: Prepare a sealed bet with commitment
  console.log("[Step 2] Generating Client-Side Bet & ZIP-321 Payment Request...");
  const sampleReturnAddress =
    process.env.RETURN_ADDRESS ||
    "utest1bettorwinneraddress88888888888888888888888888888888888888888888888";

  const betReceipt: PreparedBetReceipt = prepareBet({
    marketId: "polymarket-gate-test-01",
    side: "YES",
    amountZec: 1.0,
    potAddress,
    returnAddress: sampleReturnAddress,
  });

  console.log(`>>> Bet Commitment Hash: ${betReceipt.commitment}`);
  console.log(`>>> Return Shielded Address: ${betReceipt.returnAddress}`);
  console.log(`>>> ZIP-321 Payment URI:\n    ${betReceipt.paymentUri}\n`);

  // Step 3: Scan for matching deposit
  console.log("[Step 3] Polling Testnet Pot Wallet for Matching Deposit Note...");
  const deposits: VerifiedBetDeposit[] = await scanForBetDeposits(bridge);

  const matchedDeposit = deposits.find((d) => d.commitment === betReceipt.commitment);

  if (!matchedDeposit) {
    console.log(
      "\n[Notice] No on-chain deposit found matching this specific commitment yet."
    );
    console.log("To complete manual deposit testing on Testnet:");
    console.log(`1. Send 1.0 TAZ to the Pot Address: ${potAddress}`);
    console.log(`2. Attach the ZIP-321 Memo:\n   ${betReceipt.memoBase64url}`);
    console.log("3. Once the transaction confirms, re-run this script to execute payout!\n");
    return;
  }

  console.log(`>>> [SUCCESS] Deposit confirmed in TX: ${matchedDeposit.txid}`);
  console.log(`>>> Decoded Commitment matches: ${matchedDeposit.commitment}`);
  console.log(`>>> Return Address verified: ${matchedDeposit.returnAddress}\n`);

  // Step 4: Execute automated settlement payout
  console.log("[Step 4] Executing Programmatic Shielded Payout to Return Address...");
  try {
    const payout: PayoutResult = await sendPayout({
      recipientAddress: matchedDeposit.returnAddress,
      amountZec: 0.95, // 1.0 stake - simulated fee
      memoMessage: "Nocturne: Day 3 Gate Payout Certification",
      bridge,
    });

    console.log("\n=========================================================");
    console.log(">>> DAY 3 GATE CERTIFICATION: PASSED SUCCESSFULLY! <<<");
    console.log(`Payout TXID: ${payout.txid}`);
    console.log(`Recipient:   ${payout.recipient}`);
    console.log(`Amount:      ${payout.amountZec} ZEC`);
    console.log("=========================================================\n");
  } catch (err: any) {
    console.error(`[FAIL] Payout execution failed: ${err.message}`);
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith("05_day3_gate_runner.ts")) {
  runDay3GateCertification().catch((err) => {
    console.error("Day 3 Gate runner error:", err.message);
  });
}
