# Zcash Testnet Infrastructure & Endpoints

**Applicability**: Network configuration for coordinator light client sync, CLI testing, and faucet funding.

---

## 1. Verified Public `lightwalletd` Endpoints (Testnet)

| Host / URL | Port | Protocol | Status (Verified 2026-10-13) |
| :--- | :--- | :--- | :--- |
| `testnet.zec.rocks` | `443` | gRPC / TLS | **ONLINE / PRIMARY** (Tested & Active) |
| `zaino.testnet.unsafe.zec.rocks` | `443` | gRPC / TLS | **ONLINE / FAILOVER** (Zaino fallback) |
| `testnet.lightwalletd.com` | `9067` | gRPC | Offline / DNS unresolvable |

### Birthday Height & Memory Guardrails
* To avoid OOM issues on 1 GiB RAM nodes, always initialize wallets with `--birthday <tip_height - 100>`.
* All `zingo-cli` operations MUST pass through `ZingoClient` mutex queue (`/tmp/nocturne_zingo.lock`) to enforce single-concurrency execution.

---

## 2. Testnet Coin (TAZ) Faucets

1. **Jinolabs Faucet**:
   * URL: [https://zcashfaucet.jinolabs.xyz](https://zcashfaucet.jinolabs.xyz)
   * Mechanism: Browser proof-of-work drip directly to shielded or transparent testnet addresses.
2. **Community Discord / Forum**:
   * Official Zcash Community Discord: `#testnet` channel for manual developer drips if web faucets are dry.

---

## 3. Standard Testnet Addresses & Parameters

* **Address HRP**: `utest1...` (Unified), `ztestsapling1...` (Sapling), `tm...` (Transparent).
* **Consensus Network ID**: `testnet` (never `mainnet` in dev scripts).
* **Base Currency Unit**: 1 ZEC (TAZ) = 100,000,000 zatoshis (`zats`).
