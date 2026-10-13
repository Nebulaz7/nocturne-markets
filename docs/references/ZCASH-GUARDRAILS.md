# Zcash Development Guardrails & Anti-Hallucination Policy

> **MANDATORY POLICY FOR ALL AI AGENTS & DEVELOPERS WORKING ON NOCTURNE MARKETS**

Zcash has unique cryptographic primitives (Halo 2, Jubjub/Pallas curves, Orchard/Sapling note commitments, nullifiers, encrypted memos) and fewer public npm packages than Ethereum or Solana. AI agents are known to hallucinate nonexistent JavaScript libraries or obsolete Sprout-era methods.

Follow these strict rules without exception:

---

### Rule 1: No Invented JS/TS Zcash SDKs
* **DO NOT** assume packages like `@zcash/wallet`, `zcash-web3`, or `ethers-zcash` exist or support Orchard shielded operations in Node.js.
* **DO NOT** try to generate Halo 2 proofs or decrypt shielded notes directly in pure TypeScript unless using a verified, tested WASM/Rust bridge.
* **Standard Tool**: Use verified Rust-based tools (`zingo-cli`, `zcash-devtool`, or compiled `librustzcash` binaries) driving light client operations over gRPC.

---

### Rule 2: Protocol Grounding Against ZIPs
* **Memos**: Maximum 512 bytes unencoded. Encoded in URIs as **base64url without padding (`=`)** per [ZIP 321](ZIP-321.md).
* **Addresses**: Testnet unified addresses start with `utest1...` per [ZIP 316](ZIP-316.md).
* **Fees**: Conventional base fee is 10,000 zatoshis (0.0001 ZEC) per [ZIP 317](ZIP-317.md).

---

### Rule 3: Testnet Execution-First Validation (The Iron Law)
* **Never commit Zcash integration code that has not been executed on testnet.**
* If writing a script to detect deposits, read memos, or send payouts:
  1. Write the isolated script in `scripts/`.
  2. Run it against `testnet.lightwalletd.com:9067` or `zaino.testnet.unsafe.zec.rocks:443`.
  3. Verify the actual returned transaction ID or decrypted memo bytes before integrating into the backend coordinator.

---

### Rule 4: Key Isolation
* **Incoming Viewing Keys (IVK)**: Can be used by the scanning process to detect deposits and decrypt memos without the ability to spend funds.
* **Spending Keys**: Only used during settlement payout execution. Never log spending keys, seed phrases, or private viewing keys in application logs or git commits.
