import assert from "assert";
import {
  calculateParimutuelPayouts,
  zecToZats,
  zatsToZec,
  ZEC_IN_ZATOSHIS,
  DEFAULT_FEE_BPS,
  ZIP317_BASE_FEE_ZATS,
  type BetPosition,
} from "../../packages/shared/src/parimutuel.ts";

function runParimutuelTests() {
  console.log("=== Running Parimutuel Settlement Math Unit Tests ===\n");

  // Test 1: Unit conversions
  assert.strictEqual(zecToZats(1.0), 100_000_000n);
  assert.strictEqual(zecToZats(0.0001), 10_000n);
  assert.strictEqual(zecToZats("5.5"), 550_000_000n);
  assert.strictEqual(zatsToZec(100_000_000n), 1.0);
  console.log("✔ Zatoshis <-> ZEC conversion precision verified.");

  // Test 2: Standard Settlement (Fee on Profit Only)
  // Bet 1: YES 5 ZEC
  // Bet 2: YES 3 ZEC (Total YES = 8 ZEC)
  // Bet 3: NO 12 ZEC (Total NO = 12 ZEC)
  // Outcome: YES
  // Total Pot: 20 ZEC. Winning Pot: 8 ZEC. Losing Pot: 12 ZEC.
  // Fee BPS: 200 (2%) -> Protocol Fee = 12 * 0.02 = 0.24 ZEC (24_000_000 zats)
  // Distributable Losing Pot = 12 - 0.24 = 11.76 ZEC (1_176_000_000 zats)
  // Bet 1 (5/8 of 11.76 = 7.35 ZEC profit) -> Gross = 5 + 7.35 = 12.35 ZEC
  // Bet 2 (3/8 of 11.76 = 4.41 ZEC profit) -> Gross = 3 + 4.41 = 7.41 ZEC
  console.log("Testing standard two-sided settlement...");
  const bets: BetPosition[] = [
    { id: "bet-1", side: "YES", stakeZats: zecToZats(5), returnAddress: "addr1" },
    { id: "bet-2", side: "YES", stakeZats: zecToZats(3), returnAddress: "addr2" },
    { id: "bet-3", side: "NO", stakeZats: zecToZats(12), returnAddress: "addr3" },
  ];

  const result = calculateParimutuelPayouts({ bets, outcome: "YES" });
  assert.strictEqual(result.status, "SETTLED");
  assert.strictEqual(result.totalPotZats, zecToZats(20));
  assert.strictEqual(result.winningPotZats, zecToZats(8));
  assert.strictEqual(result.losingPotZats, zecToZats(12));
  assert.strictEqual(result.protocolFeeZats, zecToZats(0.24));

  const p1 = result.payouts.find((p) => p.id === "bet-1")!;
  const p2 = result.payouts.find((p) => p.id === "bet-2")!;
  const p3 = result.payouts.find((p) => p.id === "bet-3")!;

  assert.strictEqual(p1.grossPayoutZats, zecToZats(12.35));
  assert.strictEqual(p1.netPayoutZats, zecToZats(12.35) - ZIP317_BASE_FEE_ZATS);
  assert.strictEqual(p2.grossPayoutZats, zecToZats(7.41));
  assert.strictEqual(p3.grossPayoutZats, 0n);

  // Invariant verification
  assert(
    result.totalDistributedZats + result.protocolFeeZats <= result.totalPotZats,
    "Conservation invariant failed"
  );
  console.log("✔ Standard settlement passed: fee taken strictly from profit, principal intact!");

  // Test 3: Single-Sided Market (e.g. Only 1 Judge bets YES, NO pot = 0)
  console.log("Testing single-sided market refund rule (no opponents)...");
  const singleSidedBets: BetPosition[] = [
    { id: "judge-1", side: "YES", stakeZats: zecToZats(1.0), returnAddress: "judge_addr" },
  ];
  const singleResult = calculateParimutuelPayouts({ bets: singleSidedBets, outcome: "YES" });
  assert.strictEqual(singleResult.status, "REFUNDED");
  assert.strictEqual(singleResult.protocolFeeZats, 0n);
  const judgePayout = singleResult.payouts[0];
  assert.strictEqual(judgePayout.isRefund, true);
  assert.strictEqual(judgePayout.grossPayoutZats, zecToZats(1.0));
  assert.strictEqual(judgePayout.netPayoutZats, zecToZats(1.0) - ZIP317_BASE_FEE_ZATS);
  console.log("✔ Single-sided market correctly triggers REFUNDED status with 100% principal returned minus tx fee!");

  // Test 4: Void Outcome
  console.log("Testing voided market refund rule...");
  const voidResult = calculateParimutuelPayouts({ bets, outcome: "VOID" });
  assert.strictEqual(voidResult.status, "REFUNDED");
  assert.strictEqual(voidResult.protocolFeeZats, 0n);
  for (const p of voidResult.payouts) {
    assert.strictEqual(p.isRefund, true);
    assert.strictEqual(p.grossPayoutZats, p.stakeZats);
    assert.strictEqual(p.netPayoutZats, p.stakeZats - ZIP317_BASE_FEE_ZATS);
  }
  console.log("✔ Void market refunded all bets correctly!");

  // Test 5: Rounding Dust Invariant with Odd Numbers
  console.log("Testing zero-dust invariant under prime/odd zatoshis stakes...");
  const oddBets: BetPosition[] = [
    { id: "odd-1", side: "YES", stakeZats: 333_333_333n, returnAddress: "o1" },
    { id: "odd-2", side: "YES", stakeZats: 777_777_777n, returnAddress: "o2" },
    { id: "odd-3", side: "NO", stakeZats: 1_234_567_891n, returnAddress: "o3" },
  ];
  const oddResult = calculateParimutuelPayouts({ bets: oddBets, outcome: "YES" });
  const totalOut = oddResult.totalDistributedZats + oddResult.protocolFeeZats;
  assert(
    totalOut <= oddResult.totalPotZats,
    `Dust leak detected: totalOut (${totalOut}) > totalPot (${oddResult.totalPotZats})`
  );
  console.log(`✔ Rounding dust invariant preserved: totalOut=${totalOut} <= totalPot=${oddResult.totalPotZats}`);

  console.log("\n>>> ALL PARIMUTUEL SETTLEMENT MATH TESTS PASSED! <<<\n");
}

runParimutuelTests();
