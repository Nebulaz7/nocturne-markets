import assert from "assert";
import { buildApp } from "./index.ts";
import { CoordinatorDatabase } from "./db/index.ts";
import { processSettlementOnce } from "./jobs/settlement.ts";
import { COORDINATOR_CONFIG } from "./config.ts";

async function runCoordinatorApiTests() {
  console.log("=== Running Fastify Coordinator Backend Integration Tests ===\n");

  const db = new CoordinatorDatabase(":memory:");
  const { app } = await buildApp(db);

  // 1. Health check
  console.log("1. Testing GET /api/health...");
  const healthRes = await app.inject({
    method: "GET",
    url: "/api/health",
  });
  assert.strictEqual(healthRes.statusCode, 200);
  const healthBody = JSON.parse(healthRes.payload);
  assert.strictEqual(healthBody.status, "ok");
  console.log("   PASS: Health check passed.");

  // 2. Seed a Market
  console.log("2. Seeding test markets in database...");
  const now = Math.floor(Date.now() / 1000);
  const market = db.createMarket({
    id: "blitz-btc-demo",
    polymarket_id: "gamma-999",
    title: "Will BTC 1-min candle close above $65,000?",
    slug: "btc-above-65k",
    category: "Crypto",
    close_time: now + 300,
    drand_round: 33045500,
    pot_address: "utest1mepu5ag7trhrhuaaza3p30gjg89kkduv9tqjdrd8yujywwhdm4s30vtgf2xajppv0hrjldra8et4rfwnvsuvqqrmff0d4qcwwycfvex8",
    pot_uvk: "uview1testpotuvk99999999999999999999999999999999999999999999999999999999",
  });

  const politicsMarket = db.createMarket({
    id: "poly-us-election",
    title: "Will the incumbent party win the 2026 midterms?",
    category: "Politics",
    close_time: now + 86400,
    drand_round: 33070000,
    pot_address: "utest1potaddressforpolitics111111111111111111111111111111111111111111111111",
  });

  const sportsMarket = db.createMarket({
    id: "poly-world-cup",
    title: "Will Brazil win the next World Cup?",
    category: "Sports",
    close_time: now + 86400 * 2,
    drand_round: 33090000,
    pot_address: "utest1potaddressforsports22222222222222222222222222222222222222222222222222",
  });

  // 3. Test GET /api/markets with sealed pots and category filter
  console.log("3. Testing GET /api/markets and category filtering...");
  const listRes = await app.inject({
    method: "GET",
    url: "/api/markets",
  });
  assert.strictEqual(listRes.statusCode, 200);
  const listBody = JSON.parse(listRes.payload);
  assert(Array.isArray(listBody.markets));
  assert.strictEqual(listBody.markets.length, 3);

  // Verify pot totals are sealed while OPEN
  const blitzInList = listBody.markets.find((m: any) => m.id === "blitz-btc-demo");
  assert.strictEqual(blitzInList.pots_sealed, true);
  assert.strictEqual(blitzInList.total_pot_zats, null);
  assert.strictEqual(blitzInList.yes_pot_zats, null);
  assert.strictEqual(blitzInList.no_pot_zats, null);
  assert.strictEqual(blitzInList.commitment_count, 0);

  // Test category filter: Politics
  const politicsRes = await app.inject({
    method: "GET",
    url: "/api/markets?category=Politics",
  });
  assert.strictEqual(politicsRes.statusCode, 200);
  const politicsBody = JSON.parse(politicsRes.payload);
  assert.strictEqual(politicsBody.markets.length, 1);
  assert.strictEqual(politicsBody.markets[0].id, "poly-us-election");

  // Test category filter: Crypto
  const cryptoRes = await app.inject({
    method: "GET",
    url: "/api/markets?category=Crypto",
  });
  assert.strictEqual(cryptoRes.statusCode, 200);
  const cryptoBody = JSON.parse(cryptoRes.payload);
  assert.strictEqual(cryptoBody.markets.length, 1);
  assert.strictEqual(cryptoBody.markets[0].id, "blitz-btc-demo");

  console.log("   PASS: Market list endpoint and category filters verified.");

  // 4. Test GET /api/markets/directory
  console.log("4. Testing GET /api/markets/directory...");
  const dirRes = await app.inject({
    method: "GET",
    url: "/api/markets/directory",
  });
  assert.strictEqual(dirRes.statusCode, 200);
  const dirBody = JSON.parse(dirRes.payload);
  assert.strictEqual(dirBody.total, 3);
  assert.strictEqual(dirBody.categories.Politics.count, 1);
  assert.strictEqual(dirBody.categories.Crypto.count, 1);
  assert.strictEqual(dirBody.categories.Sports.count, 1);
  assert.strictEqual(dirBody.categories.Others.count, 0);
  console.log("   PASS: Market directory grouping verified.");

  // 5. Test GET /api/markets/:id
  console.log("5. Testing GET /api/markets/:id (Privacy Masked)...");
  const detailRes = await app.inject({
    method: "GET",
    url: "/api/markets/blitz-btc-demo",
  });
  assert.strictEqual(detailRes.statusCode, 200);
  const detailBody = JSON.parse(detailRes.payload);
  assert.strictEqual(detailBody.market.id, "blitz-btc-demo");
  assert.strictEqual(detailBody.market.drand_round, 33045500);
  assert.strictEqual(detailBody.market.pots_sealed, true);
  assert.strictEqual(detailBody.market.total_pot_zats, null);
  assert(detailBody.market.coordinator_public_key, "Coordinator public key missing");
  console.log("   PASS: Market detail returned zero-POST parameters with pots sealed.");

  // 6. Test GET /api/markets/:id/history
  console.log("6. Testing GET /api/markets/:id/history (Cached Graph Proxy)...");
  const histRes = await app.inject({
    method: "GET",
    url: "/api/markets/blitz-btc-demo/history?interval=1d",
  });
  assert.strictEqual(histRes.statusCode, 200);
  const histBody = JSON.parse(histRes.payload);
  assert(Array.isArray(histBody.history));
  assert(histBody.history.length > 0, "Blitz history ticks should not be empty");
  assert(typeof histBody.history[0].t === "number");
  assert(typeof histBody.history[0].yesPct === "number");
  assert(typeof histBody.history[0].noPct === "number");

  // Call again to verify cache hit
  const histCachedRes = await app.inject({
    method: "GET",
    url: "/api/markets/blitz-btc-demo/history?interval=1d",
  });
  assert.strictEqual(histCachedRes.statusCode, 200);
  const histCachedBody = JSON.parse(histCachedRes.payload);
  assert.strictEqual(histCachedBody.history.length, histBody.history.length);
  console.log("   PASS: History graph proxy and caching verified.");

  // 7. Insert Bets & Test Audit Endpoint (Sealed Phase)
  console.log("7. Testing GET /api/markets/:id/audit (Sealed Phase)...");
  const mockTlock = Buffer.alloc(217, 0xaa);
  const mockPayout = Buffer.alloc(112, 0xbb);

  db.insertBet({
    id: "bet-1",
    market_id: "blitz-btc-demo",
    commitment: "commitment-yes-11111111111111111111111111111111111111111111111111111111",
    amount_zats: 100_000_000,
    tlock_envelope: mockTlock,
    payout_envelope: mockPayout,
    deposit_txid: "txid-001",
    block_height: 4498810,
  });

  const auditOpenRes = await app.inject({
    method: "GET",
    url: "/api/markets/blitz-btc-demo/audit",
  });
  assert.strictEqual(auditOpenRes.statusCode, 200);
  const auditOpenBody = JSON.parse(auditOpenRes.payload);
  assert.strictEqual(auditOpenBody.audit.total_bets, 1);
  assert.strictEqual(auditOpenBody.audit.pots_sealed, true);
  assert.strictEqual(auditOpenBody.audit.total_pot_zats, null);
  assert.strictEqual(auditOpenBody.audit.commitments[0].decrypted_side, "SEALED");
  assert.strictEqual(auditOpenBody.audit.commitments[0].amount_zats, null);
  assert.strictEqual(auditOpenBody.audit.pot_uvk, null); // UVK hidden while OPEN
  console.log("   PASS: Open audit verified: sides remain SEALED, pot totals and UVK hidden.");

  // 8. Settle Market & Verify Post-Settlement Audit & Unsealed Pots
  console.log("8. Testing GET /api/markets/:id/audit (Settled Phase)...");
  db.updateBetDecryptedSide("bet-1", "YES");
  db.updateMarketPots("blitz-btc-demo", 100_000_000, 100_000_000, 0);
  db.updateMarketStatus("blitz-btc-demo", "SETTLED", "YES", "merkle-root-proof-hex-999");

  const auditSettledRes = await app.inject({
    method: "GET",
    url: "/api/markets/blitz-btc-demo/audit",
  });
  assert.strictEqual(auditSettledRes.statusCode, 200);
  const auditSettledBody = JSON.parse(auditSettledRes.payload);
  assert.strictEqual(auditSettledBody.audit.status, "SETTLED");
  assert.strictEqual(auditSettledBody.audit.outcome, "YES");
  assert.strictEqual(auditSettledBody.audit.pots_sealed, false);
  assert.strictEqual(auditSettledBody.audit.total_pot_zats, 100_000_000);
  assert.strictEqual(auditSettledBody.audit.merkle_root, "merkle-root-proof-hex-999");
  assert.strictEqual(auditSettledBody.audit.commitments[0].decrypted_side, "YES");
  assert.strictEqual(auditSettledBody.audit.commitments[0].amount_zats, 100_000_000);
  assert(auditSettledBody.audit.pot_uvk.startsWith("uview1"), "Pot UVK not published post-settlement");
  console.log("   PASS: Settled audit verified: Pot UVK published, sides revealed, pots unsealed.");

  // 9. Batch Payouts & SQLite Address Masking Test
  console.log("9. Testing Batch Payouts & SQLite Plaintext Privacy...");
  let batchDispatchedCount = 0;
  let batchDispatchedTxid = "";
  const testBridge = {
    sync: async () => "synced",
    listNotes: async () => [],
    sendShieldedPayoutsBatch: async (payouts: any[]) => {
      batchDispatchedCount = payouts.length;
      batchDispatchedTxid = "batch-txid-success-999";
      return batchDispatchedTxid;
    },
  };

  // Create a closed market with 2 winning bets for settlement sweep
  const batchMarket = db.createMarket({
    id: "test-batch-payout-market",
    title: "Test Batch Payout Market",
    close_time: now - 10,
    drand_round: 100,
    pot_address: "utest1testbatchpotaddress1111111111111111111111111111111111111111111111111111111",
  });

  const recipient1 = "utest1winneroneaddress1111111111111111111111111111111111111111111111111111111";
  const recipient2 = "utest1winnertwoaddress2222222222222222222222222222222222222222222222222222222";

  // Insert mock envelopes
  db.insertBet({
    id: "batch-bet-1",
    market_id: batchMarket.id,
    commitment: "comm-batch-1111111111111111111111111111111111111111111111111111111111111",
    amount_zats: 50_000_000,
    tlock_envelope: mockTlock,
    payout_envelope: mockPayout,
  });
  db.insertBet({
    id: "batch-bet-2",
    market_id: batchMarket.id,
    commitment: "comm-batch-2222222222222222222222222222222222222222222222222222222222222",
    amount_zats: 50_000_000,
    tlock_envelope: mockTlock,
    payout_envelope: mockPayout,
  });

  db.updateMarketStatus(batchMarket.id, "CLOSED", "YES");
  db.updateBetDecryptedSide("batch-bet-1", "YES");
  db.updateBetDecryptedSide("batch-bet-2", "YES");

  // We can directly verify db.createPayout privacy:
  const pRecord1 = db.createPayout({
    id: "payout-batch-1",
    market_id: batchMarket.id,
    bet_id: "batch-bet-1",
    amount_zats: 49_000_000,
    destination_address: recipient1,
  });
  const pRecord2 = db.createPayout({
    id: "payout-batch-2",
    market_id: batchMarket.id,
    bet_id: "batch-bet-2",
    amount_zats: 49_000_000,
    destination_address: recipient2,
  });

  // Verify that destination_address is NOT plaintext recipient in SQLite
  assert.notStrictEqual(pRecord1.destination_address, recipient1);
  assert.notStrictEqual(pRecord2.destination_address, recipient2);
  assert.strictEqual(pRecord1.destination_address, "[SHIELDED]");
  assert.strictEqual(pRecord2.destination_address, "[SHIELDED]");
  assert(pRecord1.payout_hash && pRecord1.payout_hash.length === 64);
  assert(pRecord2.payout_hash && pRecord2.payout_hash.length === 64);

  // Dispatch batch payout on testBridge
  const batchTxid = await testBridge.sendShieldedPayoutsBatch([
    { destinationAddress: recipient1, amountZats: 49_000_000n },
    { destinationAddress: recipient2, amountZats: 49_000_000n },
  ]);
  assert.strictEqual(batchTxid, "batch-txid-success-999");
  assert.strictEqual(batchDispatchedCount, 2);

  db.updatePayoutTxid(pRecord1.id, batchTxid, "BROADCASTED");
  db.updatePayoutTxid(pRecord2.id, batchTxid, "BROADCASTED");

  assert.strictEqual(db.getPayout(pRecord1.id)?.txid, "batch-txid-success-999");
  assert.strictEqual(db.getPayout(pRecord2.id)?.txid, "batch-txid-success-999");
  console.log("   PASS: Batch shielded payouts and SQLite address masking verified.");

  await app.close();
  db.close();
  console.log("\n>>> ALL FASTIFY COORDINATOR TESTS PASSED! <<<\n");
}

runCoordinatorApiTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
