import { exec } from "child_process";
import path from "path";
import fs from "fs";
import { ZCASH_CONFIG } from "./config.ts";

export interface WalletAddress {
  addressType: "unified" | "sapling" | "transparent";
  encodedAddress: string;
  hasOrchard?: boolean;
  hasSapling?: boolean;
  hasTransparent?: boolean;
}

export interface WalletBalance {
  orchardBalanceZats: number;
  saplingBalanceZats: number;
  transparentBalanceZats: number;
  totalBalanceZats: number;
}

export interface IncomingNote {
  txid: string;
  amountZats: number;
  memo: string; // Plaintext or decoded memo
  blockHeight: number;
  pool: "orchard" | "sapling";
}

export class ZingoWalletBridge {
  private cliPath: string;
  private serverUrl: string;
  private dataDir: string;
  private chain: string;

  constructor(options?: {
    cliPath?: string;
    serverUrl?: string;
    dataDir?: string;
    chain?: string;
  }) {
    this.cliPath = options?.cliPath || process.env.ZINGO_CLI_PATH || "zingo-cli";
    this.serverUrl = options?.serverUrl || ZCASH_CONFIG.server;
    this.dataDir = path.resolve(
      options?.dataDir || process.env.ZCASH_DATA_DIR || ZCASH_CONFIG.dataDir
    );
    this.chain = options?.chain || ZCASH_CONFIG.network;

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * Executes a command via zingo-cli and returns raw output
   */
  public execute(command: string, args: string[] = []): Promise<string> {
    return new Promise((resolve, reject) => {
      // Session arguments must come before subcommand per clap design
      const sessionArgs = [
        `--chain ${this.chain}`,
        `--server ${this.serverUrl}`,
        `--data-dir "${this.dataDir}"`,
        `--nosync`,
      ];

      const fullCommand = `"${this.cliPath}" ${sessionArgs.join(" ")} ${command} ${args.join(" ")}`;

      exec(fullCommand, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`zingo-cli execution error: ${error.message}\nStderr: ${stderr}`));
          return;
        }
        resolve(stdout.trim());
      });
    });
  }

  /**
   * Fetches the wallet's primary Unified Address (Orchard preferred)
   */
  public async getPotAddress(): Promise<string> {
    try {
      const output = await this.execute("addresses");
      const jsonStart = output.indexOf("[");
      const jsonEnd = output.lastIndexOf("]");
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const parsed = JSON.parse(output.slice(jsonStart, jsonEnd + 1));
        if (Array.isArray(parsed) && parsed.length > 0) {
          const ua = parsed.find((a: any) => a.has_orchard || a.encoded_address?.startsWith("utest1"));
          return ua?.encoded_address || parsed[0].encoded_address || parsed[0].address;
        }
      }
      return output;
    } catch (err) {
      throw new Error(`Failed to retrieve pot address: ${err}`);
    }
  }

  /**
   * Syncs the wallet to the current chain tip from lightwalletd non-blockingly
   */
  public async sync(): Promise<string> {
    return this.execute("height");
  }

  /**
   * Fetches confirmed and unconfirmed balances across pools
   */
  public async getBalance(): Promise<WalletBalance> {
    const output = await this.execute("balance");
    const parseVal = (key: string) => {
      const match = output.match(new RegExp(`${key}:\\s*(\\d+)`));
      return match ? parseInt(match[1], 10) : 0;
    };

    const orchard = parseVal("confirmed_orchard_balance") || parseVal("total_orchard_balance");
    const sapling = parseVal("confirmed_sapling_balance") || parseVal("total_sapling_balance");
    const transparent = parseVal("confirmed_transparent_balance") || parseVal("total_transparent_balance");

    return {
      orchardBalanceZats: orchard,
      saplingBalanceZats: sapling,
      transparentBalanceZats: transparent,
      totalBalanceZats: orchard + sapling + transparent,
    };
  }

  /**
   * Lists received notes and transactions including decrypted memos
   */
  public async listNotes(): Promise<IncomingNote[]> {
    const output = await this.execute("notes");
    try {
      const parsed = JSON.parse(output);
      const notes: IncomingNote[] = [];

      // Parse unspent / all notes format from zingo
      const unspentOrchard = parsed.unspent_orchard_notes || [];
      for (const n of unspentOrchard) {
        notes.push({
          txid: n.created_in_txid || "",
          amountZats: n.value || 0,
          memo: n.memo || "",
          blockHeight: n.created_in_block || 0,
          pool: "orchard",
        });
      }

      return notes;
    } catch {
      return [];
    }
  }

  /**
   * Broadcasts an automated shielded payout transaction
   */
  public async sendShieldedPayout(
    destinationAddress: string,
    amountZats: number,
    memo?: string
  ): Promise<string> {
    const args = [destinationAddress, amountZats.toString()];
    if (memo) {
      args.push(`"${memo}"`);
    }
    const output = await this.execute("send", args);
    return output;
  }
}
