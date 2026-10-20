import assert from "assert";
import { buildApp } from "../../coordinator/src/index.ts";
import { CoordinatorDatabase } from "../../coordinator/src/db/index.ts";
import {
  fetchMarkets,
  fetchMarketsDirectory,
  fetchMarketHistory,
  generateAndSaveBetReceipt,
  verifyLocalReceipts,
} from "./market_api.ts";
import { getBetReceipts, deleteBetReceipt } from "./vault.ts";

// In Node testing environment, mock browser localStorage & window
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}
if (typeof globalThis.window === "undefined") {
  (globalThis as any).window = {
    dispatchEvent: () => true,
  };
}

async function runMarketApiTests() {
  console.log("=== Running Client Market API & Vault Hooks Tests ===\n");

  const db = new CoordinatorDatabase(":memory:");
  const { app } = await buildApp(db);

  // Start coordinator on local port for test
  const testPort = 3948;
  const baseUrl = `http://127.0.0.1:${testPort}`;
  await app.listen({ port: testPort, host: "127.0.0.1" });

  try {
    // 1. Seed Markets in Coordinator
    const now = Math.floor(Date.now() / 1000);
    const cryptoMarket = db.createMarket({
      id: "blitz-btc-1",
      title: "Blitz: Will BTC close above $65k?",
      category: "Crypto",
      close_time: now + 300,
      drand_round: 33000000,
      pot_address: "utest1mepu5ag7trhrhuaaza3p30gjg89kkduv9tqjdrd8yujywwhdm4s30vtgf2xajppv0hrjldra8et4rfwnvsuvqqrmff0d4qcwwycfvex8",
    });

    const politicsMarket = db.createMarket({
      id: "poly-politics-1",
      title: "Will the Senate pass the budget?",
      category: "Politics",
      close_time: now + 3600,
      drand_round: 33001000,
      pot_address: "utest1potaddressforpolitics111111111111111111111111111111111111111111111111",
    });

    // 2. Test fetchMarkets
    console.log("1. Testing fetchMarkets hook...");
    const all = await fetchMarkets({ category: "All", baseUrl });
    assert.strictEqual(all.length, 2);

    const cryptoOnly = await fetchMarkets({ category: "Crypto", baseUrl });
    assert.strictEqual(cryptoOnly.length, 1);
    assert.strictEqual(cryptoOnly[0].id, "blitz-btc-1");

    const politicsOnly = await fetchMarkets({ category: "Politics", baseUrl });
    assert.strictEqual(politicsOnly.length, 1);
    assert.strictEqual(politicsOnly[0].id, "poly-politics-1");
    console.log("   PASS: fetchMarkets returns properly filtered markets.");

    // 3. Test fetchMarketsDirectory
    console.log("2. Testing fetchMarketsDirectory hook...");
    const dir = await fetchMarketsDirectory(baseUrl);
    assert.strictEqual(dir.total, 2);
    assert.strictEqual(dir.categories.Crypto.count, 1);
    assert.strictEqual(dir.categories.Politics.count, 1);
    assert.strictEqual(dir.categories.Sports.count, 0);
    console.log("   PASS: fetchMarketsDirectory returns properly categorized directory.");

    // 4. Test fetchMarketHistory
    console.log("3. Testing fetchMarketHistory hook...");
    const history = await fetchMarketHistory("blitz-btc-1", "1d", baseUrl);
    assert(Array.isArray(history));
    assert(history.length > 0);
    assert(typeof history[0].t === "number");
    assert(typeof history[0].yesPct === "number");
    assert(typeof history[0].noPct === "number");
    console.log("   PASS: fetchMarketHistory returns graph ticks via backend proxy.");

    // 5. Test generateAndSaveBetReceipt
    console.log("4. Testing generateAndSaveBetReceipt (Zero-POST Offline Bet Slip)...");
    const testSecret = "0123456789abcdef0123456789abcdef";
    const receipt = await generateAndSaveBetReceipt({
      marketId: cryptoMarket.id,
      side: "YES",
      amountZec: 1.5,
      potAddress: cryptoMarket.pot_address,
      returnAddress: "utest1mepu5ag7trhrhuaaza3p30gjg89kkduv9tqjdrd8yujywwhdm4s30vtgf2xajppv0hrjldra8et4rfwnvsuvqqrmff0d4qcwwycfvex8",
      coordinatorPublicKeyHex: "c01c36ab117e1c4d4a057cc9f01f64b9b794878ebc0317e0fbcd2dcd4ed9db64",
      drandRound: cryptoMarket.drand_round,
      mock: true,
    });

    assert(receipt.id.startsWith("bet-"));
    assert(receipt.commitment.length === 64);
    assert(receipt.paymentUri.startsWith("zcash:"));
    assert(receipt.memoUtf8.startsWith("NOC2:"));

    // Verify receipt was saved in localStorage
    const savedReceipts = getBetReceipts();
    assert.strictEqual(savedReceipts.length, 1);
    assert.strictEqual(savedReceipts[0].commitment, receipt.commitment);
    console.log("   PASS: generateAndSaveBetReceipt created payment URI and stored in vault.");

    // 6. Test verifyLocalReceipts against Coordinator Audit
    console.log("5. Testing verifyLocalReceipts in browser memory against Audit...");
    // First, test when bet is not yet indexed in audit
    const unindexedResults = await verifyLocalReceipts(cryptoMarket.id, baseUrl);
    assert.strictEqual(unindexedResults.length, 1);
    assert.strictEqual(unindexedResults[0].foundInAudit, false);

    // Now insert the bet into Coordinator and close/settle with Merkle root
    const mockTlock = Buffer.alloc(217, 0xaa);
    const mockPayout = Buffer.alloc(112, 0xbb);
    db.insertBet({
      id: "bet-audit-1",
      market_id: cryptoMarket.id,
      commitment: receipt.commitment,
      amount_zats: 150_000_000,
      tlock_envelope: mockTlock,
      payout_envelope: mockPayout,
    });

    // Close and settle market with Merkle Root
    const { computeMerkleRoot } = await import("../../packages/shared/src/memo.ts");
    const expectedRoot = computeMerkleRoot([receipt.commitment]);
    db.updateBetDecryptedSide("bet-audit-1", "YES");
    db.updateMarketStatus(cryptoMarket.id, "SETTLED", "YES", expectedRoot);

    const verifiedResults = await verifyLocalReceipts(cryptoMarket.id, baseUrl);
    assert.strictEqual(verifiedResults.length, 1);
    assert.strictEqual(verifiedResults[0].foundInAudit, true);
    assert.strictEqual(verifiedResults[0].proofValid, true);
    assert.strictEqual(verifiedResults[0].merkleRoot, expectedRoot);

    console.log("   PASS: verifyLocalReceipts verified Merkle inclusion proof in memory.");

    // Clean up
    deleteBetReceipt(receipt.id);
    assert.strictEqual(getBetReceipts().length, 0);
  } finally {
    await app.close();
    db.close();
  }

  console.log("\n>>> ALL CLIENT MARKET API TESTS PASSED! <<<\n");
}

runMarketApiTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
