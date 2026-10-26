import { ZingoClient, defaultZingoClient, type WalletBalance, type IncomingNote } from "./zingo_client.ts";
export { type WalletBalance, type IncomingNote } from "./zingo_client.ts";

export interface WalletAddress {
  addressType: "unified" | "sapling" | "transparent";
  encodedAddress: string;
  hasOrchard?: boolean;
  hasSapling?: boolean;
  hasTransparent?: boolean;
}

/**
 * ZingoWalletBridge now routes all operations through the memory-safe ZingoClient mutex.
 */
export class ZingoWalletBridge {
  private client: ZingoClient;

  constructor(options?: {
    cliPath?: string;
    serverUrl?: string;
    backupServerUrl?: string;
    dataDir?: string;
    chain?: string;
  }) {
    if (options) {
      this.client = new ZingoClient(options);
    } else {
      this.client = defaultZingoClient;
    }
  }

  public execute(
    command: string,
    args: string[] = [],
    options?: { nosync?: boolean }
  ): Promise<string> {
    return this.client.execute(command, args, options);
  }

  public getPotAddress(): Promise<string> {
    return this.client.getPotAddress();
  }

  public sync(): Promise<string> {
    return this.client.sync();
  }

  public getBalance(): Promise<WalletBalance> {
    return this.client.getBalance();
  }

  public listNotes(): Promise<IncomingNote[]> {
    return this.client.listNotes();
  }

  public sendShieldedPayout(
    destinationAddress: string,
    amountZats: number | bigint,
    memo?: string
  ): Promise<string> {
    return this.client.sendShieldedPayout(destinationAddress, amountZats, memo);
  }

  public sendShieldedPayoutsBatch(
    payouts: Array<{ destinationAddress: string; amountZats: bigint | number; memo?: string }>
  ): Promise<string> {
    return this.client.sendShieldedPayoutsBatch(payouts);
  }
}
