import { ZingoWalletBridge } from "./wallet_bridge.ts";
import { ZCASH_CONFIG } from "./config.ts";

export interface PayoutResult {
  recipient: string;
  amountZec: number;
  amountZats: bigint;
  feeZats: bigint;
  txid: string;
  timestamp: string;
}

/**
 * Dispatches an automated shielded payout transaction from the pot to a winning return address.
 */
export async function sendPayout(params: {
  recipientAddress: string;
  amountZec: number;
  memoMessage?: string;
  bridge?: ZingoWalletBridge;
}): Promise<PayoutResult> {
  const { recipientAddress, amountZec, memoMessage } = params;
  const bridge = params.bridge || new ZingoWalletBridge();

  if (
    !recipientAddress.startsWith("utest1") &&
    !recipientAddress.startsWith("u1") &&
    !recipientAddress.startsWith("ztestsapling1") &&
    !recipientAddress.startsWith("zs1")
  ) {
    throw new Error(
      `Recipient address ${recipientAddress} is not a valid shielded address (must start with utest1, u1, ztestsapling1, or zs1)`
    );
  }

  const amountZats = BigInt(Math.round(amountZec * 100_000_000));
  const feeZats = BigInt(ZCASH_CONFIG.baseFeeZats);

  console.log(`Checking pot balance for payout of ${amountZec} ZEC (+ ${feeZats} zats fee)...`);
  const balance = await bridge.getBalance();

  const totalRequired = amountZats + feeZats;
  if (balance.totalBalanceZats < totalRequired) {
    throw new Error(
      `Insufficient pot balance: ${Number(balance.totalBalanceZats) / 100_000_000} ZEC available, ${
        Number(totalRequired) / 100_000_000
      } ZEC required.`
    );
  }

  console.log(`Sending shielded payout to ${recipientAddress}...`);
  const rawTxid = await bridge.sendShieldedPayout(recipientAddress, amountZats, memoMessage);

  return {
    recipient: recipientAddress,
    amountZec,
    amountZats,
    feeZats,
    txid: rawTxid,
    timestamp: new Date().toISOString(),
  };
}

if (process.argv[1]?.endsWith("04_test_payout.ts")) {
  async function main() {
    const testRecipient =
      process.argv[2] ||
      "utest1mepu5ag7trhrhuaaza3p30gjg89kkduv9tqjdrd8yujywwhdm4s30vtgf2xajppv0hrjldra8et4rfwnvsuvqqrmff0d4qcwwycfvex8";
    const testAmount = parseFloat(process.argv[3] || "0.001");

    console.log("=== Nocturne Markets: Automated Shielded Payout ===");
    console.log(`Recipient: ${testRecipient}`);
    console.log(`Amount:    ${testAmount} ZEC\n`);

    const result = await sendPayout({
      recipientAddress: testRecipient,
      amountZec: testAmount,
      memoMessage: "Nocturne Markets Settlement Payout (Testnet)",
    });

    console.log("Payout successfully broadcasted!");
    console.dir(result, { depth: null });
  }

  main().catch((err) => {
    console.error("Payout failed:", err.message);
  });
}
