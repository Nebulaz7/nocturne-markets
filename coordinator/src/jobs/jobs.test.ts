import assert from "node:assert";
import nacl from "tweetnacl";
import { CoordinatorDatabase } from "../db/index.ts";
import {
  encodeBetMemoV2,
  packTlockEnvelope,
  encryptPayoutEnvelope,
  drandRoundForTimestamp,
  computeCommitment,
} from "../../../packages/shared/src/memo.ts";
import {
  syncPolymarketMarketsOnce,
  ensureActiveBlitzMarket,
} from "./polymarketSync.ts";
import {
  pollDepositsOnce,
  type WalletBridgeLike,
} from "./depositWatcher.ts";
import {
  processSettlementOnce,
} from "./settlement.ts";
import { buildApp } from "../index.ts";
import type { IncomingNote } from "../../../scripts/zcash/wallet_bridge.ts";

async function runJobsIntegrationTest() {
  console.log("=== Running Phase 2 Step 2: Background Jobs & Workers Integration Tests ===\n");

  const db = new CoordinatorDatabase(":memory:");
  const coordinatorKeypair = nacl.box.keyPair();

  const testPotAddress =
    "utest1mepu5ag7trhrhuaaza3p30gjg89kkduv9tqjdrd8yujywwhdm4s30vtgf2xajppv0hrjldra8et4rfwnvsuvqqrmff0d4qcwwycfvex8";
  const user1Address =
    "utest1mepu5ag7trhrhuaaza3p30gjg89kkduv9tqjdrd8yujywwhdm4s30vtgf2xajppv0hrjldra8et4rfwnvsuvqqrmff0d4qcwwycfvex8";
  const user2Address =
    "utest1mepu5ag7trhrhuaaza3p30gjg89kkduv9tqjdrd8yujywwhdm4s30vtgf2xajppv0hrjldra8et4rfwnvsuvqqrmff0d4qcwwycfvex8";

  // --------------------------------------------------------------------------
  // 1. Test Polymarket Sync & Blitz Seeding
  // --------------------------------------------------------------------------
  console.log("1. Testing Polymarket Sync & 5-Minute Blitz Seeder...");
  const syncedCount = await syncPolymarketMarketsOnce(db, testPotAddress);
  assert.ok(syncedCount > 0, "Should have synced or seeded at least 1 market");

  const markets = db.listMarkets({ status: "OPEN" });
  assert.ok(markets.length >= 1, "Should have active open markets");

  // Ensure active blitz market
  const blitzId = await ensureActiveBlitzMarket(db, testPotAddress);
  const blitzMarket = db.getMarket(blitzId);
  assert.ok(blitzMarket, "Blitz market should exist in database");
  assert.strictEqual(blitzMarket?.status, "OPEN");
  assert.ok(blitzMarket.close_time > Math.floor(Date.now() / 1000), "Blitz close time must be in future");
  assert.ok(blitzMarket.drand_round > 0, "Blitz must have valid drand_round");
  console.log(`   ✔ Blitz market seeded: ${blitzId} (round: ${blitzMarket.drand_round})`);

  // --------------------------------------------------------------------------
  // 2. Prepare Valid NOC2 Memos for Deposit Watcher
  // --------------------------------------------------------------------------
  console.log("2. Generating valid NOC2: dual-envelope deposit notes...");

  // Bet 1: User 1 bets 2.0 ZEC (200_000_000 zats) on YES
  const bet1AmountZats = 200_000_000n;
  const bet1Secret = "11112222333344445555666677778888";
  const tlockEnvelope1 = await packTlockEnvelope({
    round: BigInt(blitzMarket.drand_round),
    side: "YES",
    secret: bet1Secret,
    mock: true,
  });
  const payoutEnvelope1 = encryptPayoutEnvelope({
    address: user1Address,
    coordinatorPublicKey: coordinatorKeypair.publicKey,
    marketId: blitzId,
  });
  const memo1 = encodeBetMemoV2({
    marketId: blitzId,
    tlockEnvelope: tlockEnvelope1,
    payoutEnvelope: payoutEnvelope1,
  });

  // Bet 2: User 2 bets 1.0 ZEC (100_000_000 zats) on NO
  const bet2AmountZats = 100_000_000n;
  const bet2Secret = "aaaabbbbccccddddeeeeffff00001111";
  const tlockEnvelope2 = await packTlockEnvelope({
    round: BigInt(blitzMarket.drand_round),
    side: "NO",
    secret: bet2Secret,
    mock: true,
  });
  const payoutEnvelope2 = encryptPayoutEnvelope({
    address: user2Address,
    coordinatorPublicKey: coordinatorKeypair.publicKey,
    marketId: blitzId,
  });
  const memo2 = encodeBetMemoV2({
    marketId: blitzId,
    tlockEnvelope: tlockEnvelope2,
    payoutEnvelope: payoutEnvelope2,
  });

  assert.strictEqual(memo1.length, 500, "Memo 1 should be exactly 500 chars UTF-8");
  assert.strictEqual(memo2.length, 500, "Memo 2 should be exactly 500 chars UTF-8");
  console.log("   ✔ Generated 2 test dual-envelope memos (padded to 500 bytes)");

  // --------------------------------------------------------------------------
  // 3. Test Deposit Watcher
  // --------------------------------------------------------------------------
  console.log("3. Testing Deposit Watcher note ingestion & pot tracking...");

  const mockNotes: IncomingNote[] = [
    {
      txid: "0101010101010101010101010101010101010101010101010101010101010101",
      amountZats: bet1AmountZats,
      memo: memo1,
      blockHeight: 3105001,
      pool: "orchard",
    },
    {
      txid: "0202020202020202020202020202020202020202020202020202020202020202",
      amountZats: bet2AmountZats,
      memo: memo2,
      blockHeight: 3105002,
      pool: "orchard",
    },
    {
      // Irrelevant note that should be ignored
      txid: "9999999999999999999999999999999999999999999999999999999999999999",
      amountZats: 50_000_000n,
      memo: "Hello from random transaction",
      blockHeight: 3105003,
      pool: "orchard",
    },
  ];

  let syncCalled = false;
  const mockBridge: WalletBridgeLike = {
    async sync() {
      syncCalled = true;
      return "Synced to height 3105003";
    },
    async listNotes() {
      return mockNotes;
    },
  };

  const watcherResult = await pollDepositsOnce(db, mockBridge);
  assert.strictEqual(syncCalled, true, "Bridge sync() should have been called");
  assert.strictEqual(watcherResult.notesScanned, 3, "Scanned 3 incoming notes");
  assert.strictEqual(watcherResult.newBetsInserted, 2, "Inserted exactly 2 valid NOC2 bets");

  // Verify market pots updated
  const marketAfterDeposits = db.getMarket(blitzId)!;
  assert.strictEqual(marketAfterDeposits.total_pot_zats, 300_000_000, "Total pot should be 3.0 ZEC (300m zats)");

  // Verify bets stored
  const betsInDb = db.listBetsForMarket(blitzId);
  assert.strictEqual(betsInDb.length, 2, "Should have 2 bets in database");
  assert.strictEqual(betsInDb[0].amount_zats, 200_000_000);
  assert.strictEqual(betsInDb[1].amount_zats, 100_000_000);
  assert.strictEqual(betsInDb[0].decrypted_side, null, "Side should remain sealed/null before close");

  // Test idempotency: re-polling should not duplicate bets or pot
  const watcherResult2 = await pollDepositsOnce(db, mockBridge);
  assert.strictEqual(watcherResult2.newBetsInserted, 0, "Re-polling must insert 0 duplicate bets");
  const marketAfterRepoll = db.getMarket(blitzId)!;
  assert.strictEqual(marketAfterRepoll.total_pot_zats, 300_000_000, "Pot must remain unchanged on repoll");
  console.log("   ✔ Deposit watcher successfully ingested bets with 100% idempotency");

  // --------------------------------------------------------------------------
  // 4. Test Automated Timelock Settlement Worker
  // --------------------------------------------------------------------------
  console.log("4. Testing Automated Settlement Worker (Timelock Decrypt + Payouts)...");

  // Fast-forward market close time to past
  db.updateMarketCloseTime(blitzId, Math.floor(Date.now() / 1000) - 10);

  const testPotUvk = "uviewtest1potuvkexamplemockauditkeyforverificationpurposes1234567890";
  const sentPayouts: Array<{ dest: string; zats: bigint; memo?: string }> = [];

  const mockPayoutBridge: WalletBridgeLike = {
    async sync() {
      return "ok";
    },
    async listNotes() {
      return [];
    },
    async sendShieldedPayout(dest, zats, memo) {
      sentPayouts.push({ dest, zats: BigInt(zats), memo });
      return `txid-payout-${sentPayouts.length}`;
    },
  };

  const settlementResult = await processSettlementOnce({
    db,
    coordinatorSecretKey: coordinatorKeypair.secretKey,
    potUvk: testPotUvk,
    bridge: mockPayoutBridge,
    mockDrand: true,
  });

  assert.strictEqual(settlementResult.marketsClosed, 1, "Market should have transitioned to CLOSED");
  assert.strictEqual(settlementResult.marketsSettled, 1, "Market should have transitioned to SETTLED");
  assert.strictEqual(settlementResult.payoutsCreated, 1, "Should create 1 winning payout (YES won)");

  // Verify market record in DB
  const settledMarket = db.getMarket(blitzId)!;
  assert.strictEqual(settledMarket.status, "SETTLED");
  assert.strictEqual(settledMarket.outcome, "YES");
  assert.strictEqual(settledMarket.yes_pot_zats, 200_000_000);
  assert.strictEqual(settledMarket.no_pot_zats, 100_000_000);
  assert.ok(settledMarket.merkle_root, "Merkle root must be computed and saved");
  assert.strictEqual(settledMarket.pot_uvk, testPotUvk, "Pot UVK must be published");

  // Verify bet decryption in DB
  const settledBets = db.listBetsForMarket(blitzId);
  const bet1 = settledBets.find((b) => b.amount_zats === 200_000_000)!;
  const bet2 = settledBets.find((b) => b.amount_zats === 100_000_000)!;
  assert.strictEqual(bet1.decrypted_side, "YES", "Bet 1 timelock side should decrypt to YES");
  assert.strictEqual(bet2.decrypted_side, "NO", "Bet 2 timelock side should decrypt to NO");

  // Verify parimutuel payout calculation:
  // Winning pot = 200m zats, Losing pot = 100m zats
  // Fee = 2% of losing pot = 2m zats. Net profit = 98m zats.
  // Payout = 200m (principal) + 98m (profit) - 10_000 (ZIP-317 fee) = 297_990_000 zats.
  assert.strictEqual(sentPayouts.length, 1, "Exactly 1 shielded payout sent");
  assert.strictEqual(sentPayouts[0].dest, user1Address, "Payout sent to user1 return address");
  assert.strictEqual(sentPayouts[0].zats, 297_990_000n, "Net payout matches fee-on-profit math");
  console.log(`   ✔ Shielded payout verified: ${Number(sentPayouts[0].zats) / 100_000_000} ZEC to winner`);

  // --------------------------------------------------------------------------
  // 5. Verify Public Audit Endpoint after Settlement
  // --------------------------------------------------------------------------
  console.log("5. Testing Fastify Audit Endpoint for Settled Market...");
  const { app } = await buildApp(db);
  const auditRes = await app.inject({
    method: "GET",
    url: `/api/markets/${blitzId}/audit`,
  });

  assert.strictEqual(auditRes.statusCode, 200);
  const data = JSON.parse(auditRes.payload);
  const audit = data.audit;
  assert.strictEqual(audit.status, "SETTLED");
  assert.strictEqual(audit.outcome, "YES");
  assert.strictEqual(audit.merkle_root, settledMarket.merkle_root);
  assert.strictEqual(audit.pot_uvk, testPotUvk);
  assert.strictEqual(audit.commitments.length, 2);
  assert.strictEqual(audit.commitments[0].decrypted_side, "YES");
  assert.strictEqual(audit.commitments[1].decrypted_side, "NO");
  console.log("   ✔ Public Audit endpoint exposes revealed commitments, Merkle root, and Pot UVK");

  console.log("\n>>> ALL PHASE 2 STEP 2 BACKGROUND JOBS INTEGRATION TESTS PASSED! <<<");
}

runJobsIntegrationTest().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
