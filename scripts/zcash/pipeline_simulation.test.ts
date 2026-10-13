import assert from "assert";
import {
  generateCoordinatorKeypair,
  decodeBetMemoV2,
  unpackTlockEnvelope,
  decryptPayoutEnvelope,
  computeCommitment,
  decodeZip321Memo,
} from "./memo.ts";
import { prepareBetV2 } from "./02_prepare_bet_request.ts";
import {
  calculateParimutuelPayouts,
  zecToZats,
  zatsToZec,
  type BetPosition,
} from "../../packages/shared/src/parimutuel.ts";

async function testPipeline() {
  console.log("=== Testing Nocturne End-to-End Zero-POST Timelock Dual-Envelope Pipeline ===\n");

  const samplePotAddress =
    "utest1mepu5ag7trhrhuaaza3p30gjg89kkduv9tqjdrd8yujywwhdm4s30vtgf2xajppv0hrjldra8et4rfwnvsuvqqrmff0d4qcwwycfvex8";
  const sampleWinnerReturnAddress =
    "utest1mepu5ag7trhrhuaaza3p30gjg89kkduv9tqjdrd8yujywwhdm4s30vtgf2xajppv0hrjldra8et4rfwnvsuvqqrmff0d4qcwwycfvex8";
  const sampleLoserReturnAddress =
    "utest1mepu5ag7trhrhuaaza3p30gjg89kkduv9tqjdrd8yujywwhdm4s30vtgf2xajppv0hrjldra8et4rfwnvsuvqqrmff0d4qcwwycfvex8";

  const coordinatorKeypair = generateCoordinatorKeypair();
  const marketId = "btc-100k-blitz";

  // Step 1: Bet Preparation (Client Browser — Zero HTTP POSTs)
  console.log("1. Simulating client bet placements (Zero HTTP requests, localStorage only)...");

  // Bet 1: Winner bets 5.0 ZEC on YES
  const winnerReceipt = await prepareBetV2({
    marketId,
    side: "YES",
    amountZec: 5.0,
    potAddress: samplePotAddress,
    returnAddress: sampleWinnerReturnAddress,
    coordinatorPublicKey: coordinatorKeypair.publicKey,
    mock: true,
  });

  // Bet 2: Loser bets 15.0 ZEC on NO
  const loserReceipt = await prepareBetV2({
    marketId,
    side: "NO",
    amountZec: 15.0,
    potAddress: samplePotAddress,
    returnAddress: sampleLoserReturnAddress,
    coordinatorPublicKey: coordinatorKeypair.publicKey,
    mock: true,
  });

  console.log(`   - Bet 1 Commitment: ${winnerReceipt.commitment} (YES, 5 ZEC)`);
  console.log(`   - Bet 2 Commitment: ${loserReceipt.commitment} (NO, 15 ZEC)`);
  console.log(`   - Memo 1 Length:    ${winnerReceipt.memoUtf8.length} chars (<= 512, padded to 500)`);
  assert(winnerReceipt.memoUtf8.startsWith("NOC2:"));
  assert.strictEqual(winnerReceipt.memoUtf8.length, 500);

  // Step 2: On-chain Memo Decryption (Coordinator Deposit Watcher)
  console.log("\n2. Simulating Coordinator scanning incoming shielded notes...");
  const decodedWinnerMemo = decodeBetMemoV2(winnerReceipt.memoUtf8);
  const decodedLoserMemo = decodeBetMemoV2(loserReceipt.memoUtf8);

  assert.strictEqual(decodedWinnerMemo.version, 0x02);
  assert.strictEqual(decodedWinnerMemo.commitment, winnerReceipt.commitment);
  assert.strictEqual(decodedLoserMemo.commitment, loserReceipt.commitment);
  console.log("   >>> On-chain commitments match client receipts perfectly!");

  // Step 3: Automated Timelock Reveal after Market Close
  console.log("\n3. Simulating post-close automated Timelock decryption (No user reveal action)...");
  const revealedWinnerTlock = await unpackTlockEnvelope({
    envelope: decodedWinnerMemo.tlockEnvelope,
    mock: true,
  });
  const revealedLoserTlock = await unpackTlockEnvelope({
    envelope: decodedLoserMemo.tlockEnvelope,
    mock: true,
  });

  assert.strictEqual(revealedWinnerTlock.side, "YES");
  assert.strictEqual(revealedWinnerTlock.secret, winnerReceipt.secret);
  assert.strictEqual(revealedLoserTlock.side, "NO");
  assert.strictEqual(revealedLoserTlock.secret, loserReceipt.secret);

  const recomputedWinnerCommitment = computeCommitment(decodedWinnerMemo.tlockEnvelope);
  assert.strictEqual(recomputedWinnerCommitment, winnerReceipt.commitment);
  console.log("   >>> Automated Timelock revelation verified: Side & Secret match without user online!");

  // Step 4: Coordinator Decrypts Shielded Payout Address
  console.log("\n4. Simulating Coordinator private settlement envelope decryption...");
  const decryptedWinnerAddress = decryptPayoutEnvelope({
    payoutEnvelope: decodedWinnerMemo.payoutEnvelope,
    coordinatorSecretKey: coordinatorKeypair.secretKey,
    marketId,
  });
  assert.strictEqual(decryptedWinnerAddress, sampleWinnerReturnAddress);
  console.log(`   >>> Private return address decrypted for winner: ${decryptedWinnerAddress.slice(0, 20)}...`);

  // Step 5: Parimutuel Settlement Payout Calculation (Fee on profit only)
  console.log("\n5. Simulating Parimutuel Settlement (Fee-on-Profit & BigInt precision)...");
  const bets: BetPosition[] = [
    {
      id: "bet-winner",
      side: revealedWinnerTlock.side,
      stakeZats: zecToZats(winnerReceipt.amountZec),
      returnAddress: decryptedWinnerAddress,
    },
    {
      id: "bet-loser",
      side: revealedLoserTlock.side,
      stakeZats: zecToZats(loserReceipt.amountZec),
      returnAddress: sampleLoserReturnAddress,
    },
  ];

  const settlement = calculateParimutuelPayouts({
    bets,
    outcome: "YES",
  });

  assert.strictEqual(settlement.status, "SETTLED");
  assert.strictEqual(settlement.totalPotZats, zecToZats(20.0));
  assert.strictEqual(settlement.winningPotZats, zecToZats(5.0));
  assert.strictEqual(settlement.losingPotZats, zecToZats(15.0));

  // Losing pot is 15 ZEC. 2% fee = 0.3 ZEC taken from losing pot.
  // Distributable losing pot = 14.7 ZEC.
  // Winner gets 5.0 (principal) + 14.7 (profit) = 19.7 ZEC gross!
  assert.strictEqual(settlement.protocolFeeZats, zecToZats(0.3));
  const winnerPayout = settlement.payouts.find((p) => p.id === "bet-winner")!;
  assert.strictEqual(winnerPayout.grossPayoutZats, zecToZats(19.7));
  assert(winnerPayout.netPayoutZats > zecToZats(19.69)); // minus ZIP-317 tx fee

  console.log(`   - Winning Stake:  ${winnerReceipt.amountZec} ZEC`);
  console.log(`   - Total Pot:      ${zatsToZec(settlement.totalPotZats)} ZEC`);
  console.log(`   - Protocol Fee:   ${zatsToZec(settlement.protocolFeeZats)} ZEC (2% of losing pot)`);
  console.log(`   - Winner Gross:   ${zatsToZec(winnerPayout.grossPayoutZats)} ZEC`);
  console.log(`   - Winner Net:     ${zatsToZec(winnerPayout.netPayoutZats)} ZEC`);

  // Invariant assertion
  assert(
    settlement.totalDistributedZats + settlement.protocolFeeZats <= settlement.totalPotZats,
    "Parimutuel conservation failed!"
  );

  console.log("\n>>> FULL ZERO-POST TIMELOCK DUAL-ENVELOPE PIPELINE TEST PASSED! <<<\n");
}

testPipeline().catch((err) => {
  console.error(err);
  process.exit(1);
});
