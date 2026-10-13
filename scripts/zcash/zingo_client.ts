import { execFile } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
import { ZCASH_CONFIG } from "./config.ts";

export interface WalletBalance {
  orchardBalanceZats: bigint;
  saplingBalanceZats: bigint;
  transparentBalanceZats: bigint;
  totalBalanceZats: bigint;
}

export interface IncomingNote {
  txid: string;
  amountZats: bigint;
  memo: string;
  blockHeight: number;
  pool: "orchard" | "sapling";
}

/**
 * File-based lock for cross-process mutex synchronization.
 * Prevents concurrent zingo-cli executions across different Node processes.
 */
class FileMutex {
  private lockPath: string;

  constructor(lockPath?: string) {
    // Prefer /tmp on Unix, or os.tmpdir() cross-platform
    if (process.platform === "win32") {
      this.lockPath = lockPath || path.join(os.tmpdir(), "nocturne_zingo.lock");
    } else {
      this.lockPath = lockPath || "/tmp/nocturne_zingo.lock";
    }
  }

  public async acquire(timeoutMs = 60000, retryIntervalMs = 250): Promise<() => void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        // 'wx' flag fails if file already exists
        const fd = fs.openSync(this.lockPath, "wx");
        fs.writeSync(fd, `${process.pid}\n${Date.now()}`);
        fs.closeSync(fd);

        // Lock acquired; return release function
        return () => {
          try {
            if (fs.existsSync(this.lockPath)) {
              fs.unlinkSync(this.lockPath);
            }
          } catch {
            // Ignore unlock errors
          }
        };
      } catch (err: any) {
        if (err.code === "EEXIST") {
          // Check for stale lock (> 90 seconds old)
          try {
            const stats = fs.statSync(this.lockPath);
            if (Date.now() - stats.mtimeMs > 90000) {
              console.warn("[ZingoClient] Removing stale lock file older than 90s...");
              fs.unlinkSync(this.lockPath);
              continue;
            }
          } catch {
            // Stat failed, retry in next loop
          }

          // Wait and retry
          await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
        } else {
          throw err;
        }
      }
    }

    throw new Error(`[ZingoClient] Timed out waiting for file lock at ${this.lockPath} after ${timeoutMs}ms`);
  }
}

/**
 * Memory-safe singleton client for zingo-cli operations.
 * Protects 1 GiB Azure VM against OOM crashes through:
 * 1. In-process FIFO async queue (concurrency = 1)
 * 2. Filesystem mutex lock (/tmp/nocturne_zingo.lock)
 * 3. Non-blocking invocations (never calls hanging 'sync run')
 */
export class ZingoClient {
  private cliPath: string;
  private serverUrl: string;
  private backupServerUrl: string;
  private dataDir: string;
  private chain: string;
  private fileMutex: FileMutex;
  private queue: Array<() => Promise<void>> = [];
  private isProcessing = false;

  constructor(options?: {
    cliPath?: string;
    serverUrl?: string;
    backupServerUrl?: string;
    dataDir?: string;
    chain?: string;
    lockPath?: string;
  }) {
    this.cliPath = options?.cliPath || process.env.ZINGO_CLI_PATH || "zingo-cli";
    this.serverUrl = options?.serverUrl || ZCASH_CONFIG.server;
    this.backupServerUrl = options?.backupServerUrl || ZCASH_CONFIG.backupServer;
    this.dataDir = path.resolve(
      options?.dataDir || process.env.ZCASH_DATA_DIR || ZCASH_CONFIG.dataDir
    );
    this.chain = options?.chain || ZCASH_CONFIG.network;
    this.fileMutex = new FileMutex(options?.lockPath);

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * Enqueues an execution task into the in-process FIFO mutex queue.
   */
  public execute(command: string, args: string[] = []): Promise<string> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        let releaseLock: (() => void) | null = null;
        try {
          releaseLock = await this.fileMutex.acquire();
          const result = await this.execCommandInternal(command, args, this.serverUrl);
          resolve(result);
        } catch (err: any) {
          // If connection failed to primary server, attempt backup server
          if (
            this.backupServerUrl &&
            (err.message.includes("connection") || err.message.includes("timeout") || err.message.includes("Unavailable"))
          ) {
            console.warn(`[ZingoClient] Primary server failed, failing over to backup: ${this.backupServerUrl}`);
            try {
              const backupResult = await this.execCommandInternal(command, args, this.backupServerUrl);
              resolve(backupResult);
              return;
            } catch (backupErr) {
              reject(backupErr);
              return;
            }
          }
          reject(err);
        } finally {
          if (releaseLock) {
            releaseLock();
          }
        }
      });

      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        try {
          await task();
        } catch {
          // Task error handled in promise
        }
      }
    }

    this.isProcessing = false;
  }

  private execCommandInternal(
    command: string,
    args: string[],
    serverUrl: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const fullArgs = [
        "--chain",
        this.chain,
        "--server",
        serverUrl,
        "--data-dir",
        this.dataDir,
        "--nosync",
        command,
        ...args,
      ];

      execFile(
        this.cliPath,
        fullArgs,
        { maxBuffer: 10 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error) {
            reject(
              new Error(
                `zingo-cli execution error: ${error.message}\nStderr: ${stderr}\nStdout: ${stdout}`
              )
            );
            return;
          }
          resolve(stdout.trim());
        }
      );
    });
  }

  public async getPotAddress(): Promise<string> {
    try {
      const output = await this.execute("addresses");
      const jsonStart = output.indexOf("[");
      const jsonEnd = output.lastIndexOf("]");
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const parsed = JSON.parse(output.slice(jsonStart, jsonEnd + 1));
        if (Array.isArray(parsed) && parsed.length > 0) {
          const ua = parsed.find(
            (a: any) => a.has_orchard || a.encoded_address?.startsWith("utest1")
          );
          return ua?.encoded_address || parsed[0].encoded_address || parsed[0].address;
        }
      }
      return output;
    } catch (err: any) {
      throw new Error(`Failed to retrieve pot address: ${err.message}`);
    }
  }

  public async sync(): Promise<string> {
    // Non-blocking sync check
    return this.execute("height");
  }

  public async getBalance(): Promise<WalletBalance> {
    const output = await this.execute("balance");
    const parseVal = (key: string): bigint => {
      const match = output.match(new RegExp(`${key}:\\s*(\\d+)`));
      return match ? BigInt(match[1]) : 0n;
    };

    const orchard = parseVal("confirmed_orchard_balance") || parseVal("total_orchard_balance");
    const sapling = parseVal("confirmed_sapling_balance") || parseVal("total_sapling_balance");
    const transparent =
      parseVal("confirmed_transparent_balance") || parseVal("total_transparent_balance");

    return {
      orchardBalanceZats: orchard,
      saplingBalanceZats: sapling,
      transparentBalanceZats: transparent,
      totalBalanceZats: orchard + sapling + transparent,
    };
  }

  public async listNotes(): Promise<IncomingNote[]> {
    const output = await this.execute("notes");
    try {
      const parsed = JSON.parse(output);
      const notes: IncomingNote[] = [];

      const unspentOrchard = parsed.unspent_orchard_notes || [];
      for (const n of unspentOrchard) {
        notes.push({
          txid: n.created_in_txid || "",
          amountZats: BigInt(n.value || 0),
          memo: n.memo || "",
          blockHeight: n.created_in_block || 0,
          pool: "orchard",
        });
      }

      const unspentSapling = parsed.unspent_sapling_notes || [];
      for (const n of unspentSapling) {
        notes.push({
          txid: n.created_in_txid || "",
          amountZats: BigInt(n.value || 0),
          memo: n.memo || "",
          blockHeight: n.created_in_block || 0,
          pool: "sapling",
        });
      }

      return notes;
    } catch {
      return [];
    }
  }

  public async sendShieldedPayout(
    destinationAddress: string,
    amountZats: bigint | number,
    memo?: string
  ): Promise<string> {
    const args = [destinationAddress, amountZats.toString()];
    if (memo) {
      args.push(`"${memo}"`);
    }
    return this.execute("quicksend", args);
  }
}

export const defaultZingoClient = new ZingoClient();
