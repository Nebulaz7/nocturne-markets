import assert from "assert";
import { buildApp } from "./index.ts";
import { CoordinatorDatabase } from "./db/index.ts";

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
  console.log("   ✔ Health check passed.");

  // 2. Seed a Market
  console.log("2. Seeding test market in database...");
  const now = Math.floor(Date.now() / 1000);
  const market = db.createMarket({
    id: "blitz-btc-demo",
    polymarket_id: "gamma-999",
    title: "Will BTC 1-min candle close above $65,000?",
    slug: "btc-above-65k",
    close_time: now + 300,
    drand_round: 33045500,
    pot_address: "utest1mepu5ag7trhrhuaaza3p30gjg89kkduv9tqjdrd8yujywwhdm4s30vtgf2xajppv0hrjldra8et4rfwnvsuvqqrmff0d4qcwwycfvex8",
    pot_uvk: "uview1testpotuvk99999999999999999999999999999999999999999999999999999999",
  });

  // 3. Test GET /api/markets
  console.log("3. Testing GET /api/markets...");
  const listRes = await app.inject({
    method: "GET",
    url: "/api/markets",
  });
  assert.strictEqual(listRes.statusCode, 200);
  const listBody = JSON.parse(listRes.payload);
  assert(Array.isArray(listBody.markets));
  assert.strictEqual(listBody.markets.length, 1);
  assert.strictEqual(listBody.markets[0].id, "blitz-btc-demo");
  console.log("   ✔ Market list endpoint returned active market.");

  // 4. Test GET /api/markets/:id
  console.log("4. Testing GET /api/markets/:id...");
  const detailRes = await app.inject({
    method: "GET",
    url: "/api/markets/blitz-btc-demo",
  });
  assert.strictEqual(detailRes.statusCode, 200);
  const detailBody = JSON.parse(detailRes.payload);
  assert.strictEqual(detailBody.market.id, "blitz-btc-demo");
  assert.strictEqual(detailBody.market.drand_round, 33045500);
  assert(detailBody.market.coordinator_public_key, "Coordinator public key missing");
  console.log("   ✔ Market detail returned zero-POST parameters (coordinator PK + drand round).");

  // 5. Insert Bets & Test Audit Endpoint
  console.log("5. Testing GET /api/markets/:id/audit (Sealed Phase)...");
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
  assert.strictEqual(auditOpenBody.audit.commitments[0].decrypted_side, "SEALED");
  assert.strictEqual(auditOpenBody.audit.pot_uvk, null); // UVK hidden while OPEN
  console.log("   ✔ Open audit verified: sides remain SEALED and pot UVK hidden.");

  // 6. Settle Market & Verify Post-Settlement Audit
  console.log("6. Testing GET /api/markets/:id/audit (Settled Phase)...");
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
  assert.strictEqual(auditSettledBody.audit.merkle_root, "merkle-root-proof-hex-999");
  assert.strictEqual(auditSettledBody.audit.commitments[0].decrypted_side, "YES");
  assert(auditSettledBody.audit.pot_uvk.startsWith("uview1"), "Pot UVK not published post-settlement");
  console.log("   ✔ Settled audit verified: Pot UVK published, sides revealed, Merkle root verifiable.");

  await app.close();
  db.close();
  console.log("\n>>> ALL FASTIFY COORDINATOR TESTS PASSED! <<<\n");
}

runCoordinatorApiTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
