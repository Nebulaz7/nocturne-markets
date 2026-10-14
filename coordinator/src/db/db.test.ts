import assert from "assert";
import { CoordinatorDatabase } from "./index.ts";

function runDatabaseTests() {
  console.log("=== Running Coordinator SQLite Database Unit Tests ===\n");

  const db = new CoordinatorDatabase(":memory:");

  // 1. Create a Market
  const now = Math.floor(Date.now() / 1000);
  const market = db.createMarket({
    id: "blitz-btc-100k",
    polymarket_id: "poly-12345",
    title: "Will BTC reach $100k before December 2026?",
    slug: "btc-100k-dec-2026",
    close_time: now + 300,
    drand_round: 33045000,
    pot_address: "utest1mepu5ag7trhrhuaaza3p30gjg89kkduv9tqjdrd8yujywwhdm4s30vtgf2xajppv0hrjldra8et4rfwnvsuvqqrmff0d4qcwwycfvex8",
  });

  assert.strictEqual(market.id, "blitz-btc-100k");
  assert.strictEqual(market.status, "OPEN");
  assert.strictEqual(market.total_pot_zats, 0);
  console.log("✔ Market created successfully in SQLite.");

  // 2. Insert Bets
  const mockTlock = Buffer.alloc(217, 0xaa);
  const mockPayout = Buffer.alloc(112, 0xbb);

  const bet1 = db.insertBet({
    id: "bet-1",
    market_id: market.id,
    commitment: "commit-hash-yes-11111111111111111111111111111111111111111111111111111111",
    amount_zats: 100_000_000, // 1 ZEC
    tlock_envelope: mockTlock,
    payout_envelope: mockPayout,
    deposit_txid: "txid-001",
    block_height: 4498800,
  });

  const bet2 = db.insertBet({
    id: "bet-2",
    market_id: market.id,
    commitment: "commit-hash-no-22222222222222222222222222222222222222222222222222222222",
    amount_zats: 200_000_000, // 2 ZEC
    tlock_envelope: mockTlock,
    payout_envelope: mockPayout,
    deposit_txid: "txid-002",
    block_height: 4498805,
  });

  assert.strictEqual(bet1.market_id, market.id);
  assert.strictEqual(bet1.amount_zats, 100_000_000);
  assert.strictEqual(bet2.amount_zats, 200_000_000);

  // Check market pot increment
  const updatedMarket = db.getMarket(market.id)!;
  assert.strictEqual(updatedMarket.total_pot_zats, 300_000_000);
  console.log("✔ Bets inserted and market total pot atomically incremented.");

  // 3. Querying Bets
  const bets = db.listBetsForMarket(market.id);
  assert.strictEqual(bets.length, 2);
  const fetchedByCommitment = db.getBetByCommitment(bet1.commitment)!;
  assert.strictEqual(fetchedByCommitment.id, bet1.id);
  assert.strictEqual(fetchedByCommitment.tlock_envelope.length, 217);
  console.log("✔ Querying bets by market and commitment verified.");

  // 4. Update Decrypted Sides & Market Status
  db.updateBetDecryptedSide(bet1.id, "YES");
  db.updateBetDecryptedSide(bet2.id, "NO");

  const revealedBet1 = db.getBet(bet1.id)!;
  assert.strictEqual(revealedBet1.decrypted_side, "YES");
  assert.strictEqual(revealedBet1.status, "REVEALED");

  db.updateMarketStatus(market.id, "RESOLVED", "YES", "merkle-root-abc123");
  const resolvedMarket = db.getMarket(market.id)!;
  assert.strictEqual(resolvedMarket.status, "RESOLVED");
  assert.strictEqual(resolvedMarket.outcome, "YES");
  assert.strictEqual(resolvedMarket.merkle_root, "merkle-root-abc123");
  console.log("✔ Bet decryption and market status transitions verified.");

  // 5. Payouts
  const payout = db.createPayout({
    id: "payout-1",
    market_id: market.id,
    bet_id: bet1.id,
    amount_zats: 295_000_000,
    destination_address: "utest1winneraddress999999999999999999999999999999999999999999999999999999",
  });
  assert.strictEqual(payout.status, "PENDING");

  db.updatePayoutTxid(payout.id, "payout-txid-777", "CONFIRMED");
  const confirmedPayout = db.getPayout(payout.id)!;
  assert.strictEqual(confirmedPayout.status, "CONFIRMED");
  assert.strictEqual(confirmedPayout.txid, "payout-txid-777");
  console.log("✔ Payout record creation and txid update verified.");

  // 6. Sync State
  db.setSyncState("zcash_scan_height", "4498850");
  assert.strictEqual(db.getSyncState("zcash_scan_height"), "4498850");
  assert.strictEqual(db.getSyncState("non_existent_key", "100"), "100");
  console.log("✔ Sync state key-value store verified.");

  db.close();
  console.log("\n>>> ALL COORDINATOR DATABASE UNIT TESTS PASSED! <<<\n");
}

runDatabaseTests();
