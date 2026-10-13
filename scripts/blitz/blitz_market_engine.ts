import crypto from "crypto";
import {
  generateCoordinatorKeypair,
  drandRoundForTimestamp,
  unpackTlockEnvelope,
  decryptPayoutEnvelope,
  type BetSide,
} from "../zcash/memo.ts";
import { prepareBetV2, type PreparedBetReceiptV2 } from "../zcash/02_prepare_bet_request.ts";
import {
  calculateParimutuelPayouts,
  zecToZats,
  zatsToZec,
  type BetPosition,
} from "../../packages/shared/src/parimutuel.ts";

export interface BlitzMarketConfig {
  marketId: string;
  title: string;
  targetPriceUsd: number;
  durationSeconds: number;
  accelerated: boolean;
}

export interface BlitzMarketState {
  marketId: string;
  status: "OPEN" | "CLOSED" | "RESOLVED" | "SETTLED";
  openTime: number;
  closeTime: number;
  drandCloseRound: bigint;
  totalPotZats: bigint;
  yesPotZats: bigint;
  noPotZats: bigint;
  outcome?: BetSide | "VOID";
  bets: Array<{
    receipt: PreparedBetReceiptV2;
    unpackedSide?: BetSide;
    unpackedSecret?: string;
    decryptedReturnAddress?: string;
  }>;
}

/**
 * Autonomous 5-minute Blitz Market Engine.
 * Simulates and executes the full lifecycle from open to settled:
 * 1. OPEN (Bettors place sealed bets via NOC2: dual-envelope)
 * 2. CLOSED (Drand Quicknet round reached)
 * 3. TIMELOCK DECRYPT (Coordinator recovers sides automatically without bettor POSTs)
 * 4. RESOLVED (Oracle resolves outcome)
 * 5. SETTLED (Coordinator decrypts return addresses and calculates fee-on-profit payouts)
 */
export async function runBlitzMarket(options?: {
  accelerated?: boolean;
  marketId?: string;
}) {
  const accelerated = options?.accelerated ?? true;
  const marketId = options?.marketId ?? `blitz-btc-${Date.now().toString().slice(-4)}`;
  const durationSeconds = accelerated ? 4 : 300;

  console.log("===============================================================");
  console.log("⚡ NOCTURNE MARKETS: 5-MINUTE BLITZ ENGINE DEMO ⚡");
  console.log("===============================================================\n");
  console.log(`[Config] Mode: ${accelerated ? "Accelerated CI (4s)" : "Real-time Live (300s)"}`);
  console.log(`[Config] Market ID: ${marketId}`);
  console.log(`[Config] Title: Will BTC 1-min candle close above $65,000?`);

  // Coordinator setup
  const coordinator = generateCoordinatorKeypair();
  const potAddress =
    "utest1mepu5ag7trhrhuaaza3p30gjg89kkduv9tqjdrd8yujywwhdm4s30vtgf2xajppv0hrjldra8et4rfwnvsuvqqrmff0d4qcwwycfvex8";

  const nowSec = Math.floor(Date.now() / 1000);
  const closeTimeSec = nowSec + durationSeconds;
  const drandRound = drandRoundForTimestamp(closeTimeSec);

  const state: BlitzMarketState = {
    marketId,
    status: "OPEN",
    openTime: nowSec,
    closeTime: closeTimeSec,
    drandCloseRound: drandRound,
    totalPotZats: 0n,
    yesPotZats: 0n,
    noPotZats: 0n,
    bets: [],
  };

  console.log(`\n🟢 PHASE 1: MARKET OPEN`);
  console.log(`   - Close Timestamp: ${new Date(closeTimeSec * 1000).toLocaleTimeString()}`);
  console.log(`   - Timelock Round:  Drand Quicknet #${drandRound}`);
  console.log(`   - Status:          OPEN (Accepting Shielded Dual-Envelope Bets)\n`);

  // Simulate 3 Bettors depositing
  const sampleUsers = [
    {
      name: "Bettor A (Alice)",
      side: "YES" as BetSide,
      amountZec: 1.0,
      ua: "utest1mepu5ag7trhrhuaaza3p30gjg89kkduv9tqjdrd8yujywwhdm4s30vtgf2xajppv0hrjldra8et4rfwnvsuvqqrmff0d4qcwwycfvex8",
    },
    {
      name: "Bettor B (Bob)",
      side: "NO" as BetSide,
      amountZec: 2.0,
      ua: "utest1mepu5ag7trhrhuaaza3p30gjg89kkduv9tqjdrd8yujywwhdm4s30vtgf2xajppv0hrjldra8et4rfwnvsuvqqrmff0d4qcwwycfvex8",
    },
    {
      name: "Bettor C (Carol)",
      side: "YES" as BetSide,
      amountZec: 3.0,
      ua: "utest1mepu5ag7trhrhuaaza3p30gjg89kkduv9tqjdrd8yujywwhdm4s30vtgf2xajppv0hrjldra8et4rfwnvsuvqqrmff0d4qcwwycfvex8",
    },
  ];

  for (const user of sampleUsers) {
    const receipt = await prepareBetV2({
      marketId,
      side: user.side,
      amountZec: user.amountZec,
      potAddress,
      returnAddress: user.ua,
      coordinatorPublicKey: coordinator.publicKey,
      closeTimestamp: closeTimeSec,
      mock: true,
    });

    state.bets.push({ receipt });
    state.totalPotZats += zecToZats(user.amountZec);

    console.log(`📥 Deposit Detected: ${user.name}`);
    console.log(`   - Amount:     ${user.amountZec} ZEC`);
    console.log(`   - Commitment: ${receipt.commitment} (Stored on-chain via NOC2 memo)`);
    console.log(`   - Memo:       ${receipt.memoUtf8.slice(0, 30)}... [${receipt.memoUtf8.length}B valid UTF-8]`);
    console.log(`   - Secrecy:    Side is sealed until Round #${drandRound}; UA encrypted to Coordinator.\n`);
  }

  console.log(`📊 Pot Status at Close: Total = ${zatsToZec(state.totalPotZats)} ZEC across 3 deposits.`);

  // Wait for close
  if (!accelerated) {
    console.log(`⏳ Waiting for market close at ${new Date(closeTimeSec * 1000).toLocaleTimeString()}...`);
    const waitMs = Math.max(0, (closeTimeSec - Math.floor(Date.now() / 1000)) * 1000);
    await new Promise((r) => setTimeout(r, waitMs));
  } else {
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Phase 2: Market Close
  state.status = "CLOSED";
  console.log(`\n🛑 PHASE 2: MARKET CLOSED`);
  console.log(`   - drand Quicknet Round #${drandRound} published!`);
  console.log(`   - Zero-POST Reveal: Coordinator unlocks timelock envelopes automatically without user interaction.\n`);

  // Phase 3: Automatic Timelock Decryption
  console.log(`🔓 PHASE 3: AUTOMATIC TIMELOCK DECRYPTION`);
  for (const bet of state.bets) {
    // Unpack tlock envelope
    const decodedTlock = await unpackTlockEnvelope({
      envelope: Buffer.from(bet.receipt.memoUtf8.slice(5).split("~")[0], "base64").subarray(5, 5 + 217),
      mock: true,
    });

    bet.unpackedSide = decodedTlock.side;
    bet.unpackedSecret = decodedTlock.secret;

    if (decodedTlock.side === "YES") {
      state.yesPotZats += zecToZats(bet.receipt.amountZec);
    } else {
      state.noPotZats += zecToZats(bet.receipt.amountZec);
    }

    console.log(`   ✔ Commitment ${bet.receipt.commitment.slice(0, 16)}... -> Revealed Side: ${decodedTlock.side}`);
  }

  console.log(`\n   Verified Tally: YES Pot = ${zatsToZec(state.yesPotZats)} ZEC | NO Pot = ${zatsToZec(state.noPotZats)} ZEC`);

  // Phase 4: Resolution
  state.status = "RESOLVED";
  state.outcome = "YES"; // e.g. BTC finished at $65,120
  console.log(`\n⚖️ PHASE 4: ORACLE RESOLUTION`);
  console.log(`   - Index Price:   $65,120.40`);
  console.log(`   - Target Price:  $65,000.00`);
  console.log(`   - Final Outcome: ${state.outcome} (YES Wins!)\n`);

  // Phase 5: Parimutuel Settlement & Shielded Payouts
  state.status = "SETTLED";
  console.log(`💰 PHASE 5: PARIMUTUEL SETTLEMENT & AUTOMATED SHIELDED PAYOUTS`);

  // Decrypt user return addresses
  for (const bet of state.bets) {
    const rawBinary = Buffer.from(bet.receipt.memoUtf8.slice(5).split("~")[0], "base64");
    const payoutEnvelope = rawBinary.subarray(5 + 217);

    bet.decryptedReturnAddress = decryptPayoutEnvelope({
      payoutEnvelope,
      coordinatorSecretKey: coordinator.secretKey,
      marketId,
    });
  }

  // Calculate payouts using fee-on-profit math
  const betPositions: BetPosition[] = state.bets.map((b, idx) => ({
    id: `bet-${idx + 1}`,
    side: b.unpackedSide!,
    stakeZats: zecToZats(b.receipt.amountZec),
    returnAddress: b.decryptedReturnAddress!,
  }));

  const settlement = calculateParimutuelPayouts({
    bets: betPositions,
    outcome: state.outcome,
  });

  console.log(`   - Total Pot:         ${zatsToZec(settlement.totalPotZats)} ZEC`);
  console.log(`   - Winning (YES) Pot: ${zatsToZec(settlement.winningPotZats)} ZEC`);
  console.log(`   - Losing (NO) Pot:   ${zatsToZec(settlement.losingPotZats)} ZEC`);
  console.log(`   - Protocol Fee (2%): ${zatsToZec(settlement.protocolFeeZats)} ZEC (taken strictly from profit)`);
  console.log(`   - Total Distributed: ${zatsToZec(settlement.totalDistributedZats)} ZEC\n`);

  console.log("   --- Individual Shielded Payout Queue ---");
  for (const p of settlement.payouts) {
    if (p.grossPayoutZats > 0n) {
      console.log(
        `   [WINNER] ${p.id} -> Stake: ${zatsToZec(p.stakeZats)} ZEC | Net Payout: ${zatsToZec(
          p.netPayoutZats
        )} ZEC to ${p.returnAddress.slice(0, 15)}... (ZIP-317 tx fee deducted)`
      );
    } else {
      console.log(`   [LOSER]  ${p.id} -> Stake: ${zatsToZec(p.stakeZats)} ZEC | Payout: 0 ZEC`);
    }
  }

  console.log("\n===============================================================");
  console.log("✔ BLITZ 5-MINUTE MARKET LIFECYCLE COMPLETED SUCCESSFULLY!");
  console.log("===============================================================\n");

  return { state, settlement };
}

if (process.argv[1]?.endsWith("blitz_market_engine.ts")) {
  const isAccelerated = !process.argv.includes("--live");
  runBlitzMarket({ accelerated: isAccelerated }).catch((err) => {
    console.error("Blitz engine failure:", err);
    process.exit(1);
  });
}
