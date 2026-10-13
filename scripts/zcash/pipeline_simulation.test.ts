import { prepareBet } from "./02_prepare_bet_request.ts";
import { decodeZip321Memo, unpackBetMemo, computeCommitment } from "./memo.ts";
import { ZCASH_CONFIG } from "./config.ts";

async function testPipeline() {
  console.log("=== Testing Nocturne End-to-End Bet-Deposit-Payout Pipeline ===\n");

  const samplePotAddress =
    "utest1potmarketdemo99999999999999999999999999999999999999999999999999999";
  const sampleReturnAddress =
    "utest1bettorwinneraddress88888888888888888888888888888888888888888888888";

  // Step 1: Bet Preparation (Client Browser)
  console.log("1. Simulating client bet placement...");
  const receipt = prepareBet({
    marketId: "polymarket-btc-100k-2026",
    side: "YES",
    amountZec: 5.0,
    potAddress: samplePotAddress,
    returnAddress: sampleReturnAddress,
  });

  console.log(`   - Market:     ${receipt.marketId}`);
  console.log(`   - Side:       ${receipt.side}`);
  console.log(`   - Commitment: ${receipt.commitment}`);
  console.log(`   - Chip Size:  ${receipt.amountZec} ZEC`);

  // Step 2: On-chain Memo Decryption (Coordinator Deposit Watcher)
  console.log("\n2. Simulating coordinator receiving shielded deposit note...");
  const rawMemoBytes = decodeZip321Memo(receipt.memoBase64url);
  const unpacked = unpackBetMemo(rawMemoBytes);

  console.log(`   - Decoded Commitment: ${unpacked.commitment}`);
  console.log(`   - Decoded Return UA:  ${unpacked.returnAddress}`);

  if (unpacked.commitment !== receipt.commitment) {
    throw new Error("Pipeline Failure: Decoded commitment does not match receipt!");
  }
  if (unpacked.returnAddress !== sampleReturnAddress) {
    throw new Error("Pipeline Failure: Decoded return address does not match!");
  }
  console.log("   >>> Commitment and Return Address MATCHED perfectly!");

  // Step 3: Reveal Verification (Client reveals side + secret after close)
  console.log("\n3. Simulating post-close reveal phase...");
  const recomputedCommitment = computeCommitment({
    side: receipt.side,
    secret: receipt.secret,
    marketId: receipt.marketId,
  }).toString("hex");

  if (recomputedCommitment !== unpacked.commitment) {
    throw new Error("Pipeline Failure: Reveal recomputed hash did not match commitment!");
  }
  console.log("   >>> Reveal verified successfully: side is confirmed as 'YES'!");

  // Step 4: Parimutuel Payout Calculation
  console.log("\n4. Simulating Parimutuel Settlement Payout...");
  const simulatedWinningStake = 5.0;
  const simulatedTotalPot = 20.0;
  const simulatedWinningPot = 8.0;
  const feeRate = 0.02; // 2% protocol fee

  const grossPayout = simulatedWinningStake * (simulatedTotalPot / simulatedWinningPot);
  const protocolFee = grossPayout * feeRate;
  const networkTxFeeZec = ZCASH_CONFIG.baseFeeZats / 100_000_000;
  const netPayoutZec = grossPayout - protocolFee - networkTxFeeZec;

  console.log(`   - Stake:          ${simulatedWinningStake} ZEC`);
  console.log(`   - Total Pot:      ${simulatedTotalPot} ZEC`);
  console.log(`   - Winning Pot:    ${simulatedWinningPot} ZEC`);
  console.log(`   - Gross Payout:   ${grossPayout.toFixed(4)} ZEC`);
  console.log(`   - Network Fee:    ${networkTxFeeZec} ZEC (${ZCASH_CONFIG.baseFeeZats} zats)`);
  console.log(`   - Net Payout:     ${netPayoutZec.toFixed(4)} ZEC to ${unpacked.returnAddress}`);

  console.log("\n>>> FULL END-TO-END PIPELINE SIMULATION PASSED! <<<\n");
}

testPipeline().catch((err) => {
  console.error(err);
  process.exit(1);
});
