# Nocturne Markets (Project Z): Implementation Plan

Domain: nocturnemarkets.cv (point an A record at the Azure VM, Caddy handles HTTPS automatically).

Companion to about.md. This is the build plan: architecture, structure, resources to check, and a day-by-day schedule.

Dates: today is Mon Oct 12, 2026. Deadline is Oct 28, 23:59 UTC (00:59 Oct 29 in Lagos). Aim to submit the evening of Oct 27.

---

## 1. MVP definition

One market working end to end, on testnet:

1. Mirrored Polymarket market shown in the UI
2. User bets with a commitment, pays shielded ZEC to the pot address with a memo
3. Coordinator detects the deposit and issues a signed receipt
4. After close, user reveals side + secret
5. Polymarket resolves, coordinator settles
6. Winners get shielded payouts, batched and delayed
7. Merkle root and totals published, receipts verifiable
8. README with a clear threat model, repo open source

Everything else is a stretch. If something is not on this list, it waits until the list works once.

---

## 2. Architecture

```
 Browser (Next.js - Zero-POST Client)         Backend / Coordinator (Azure VM, Node + pm2, Caddy)
 -----------------------------------         --------------------------------------------------
 - Fetches markets (Read-Only)      HTTPS    - Polymarket sync job (mirrors public events)
 - Generates local 16B secret     <-------   - ZingoClient singleton (mutex queue & lockfile)
 - Timelock encrypts (side || secret)        - Deposit watcher (scans pot Orchard UA)
   to drand Quicknet round                   - Automated Timelock Decryption (drand Quicknet beacon)
 - Encrypts return address via tweetnacl     - Private Settlement (Coordinator X25519 SK)
   to Coordinator settlement PK              - Parimutuel Settlement (fee-on-profit only)
 - Displays ZIP-321 QR / URI                 - Shielded Payout dispatcher
 - Receipt in localStorage ONLY              - SQLite (encrypted disk)
 (ZERO HTTP POSTs to server!)                         |
                                             +--------+--------+
                                             |                 |
                                   Polymarket Gamma API   Zcash testnet via lightwalletd
                                   (read-only market)     (testnet.zec.rocks / zaino failover)
```

Notes:

- No smart contracts anywhere.
- Zero-POST Client: Bettors NEVER submit bets, receipts, or reveal data over HTTP. The server learns zero bettor IPs!
- Memory-Safe VM execution: Single-concurrency mutex queue around `zingo-cli` + `/tmp/nocturne_zingo.lock` prevents OOM on the 1 GiB Azure VM.
- Safe Public IVK Auditing: Publishing the Pot IVK allows anyone to verify `tlock_envelope` and audit pot tallies, while the winner's return address remains securely encrypted inside `payout_envelope`.

---

## 3. Stack

| Part            | Choice                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Frontend        | Next.js, TypeScript, Tailwind, shadcn/ui, Framer Motion. Zero-POST bet preparation via WebCrypto                               |
| Backend         | Node + TypeScript, Fastify or Hono                                                                                             |
| DB              | SQLite with Drizzle or Prisma                                                                                                  |
| Process manager | pm2 (or systemd)                                                                                                               |
| Reverse proxy   | Caddy, access logs off or IP-stripped                                                                                          |
| Zcash Wallet    | `zingo-cli` singleton mutex queue (`ZingoClient`) + birthday guardrail (`tip_height - 100`)                                     |
| Timelock Crypto | `tlock-js` pinned to drand Quicknet (`52db9ba7...`, 3s period)                                                                 |
| Privacy Box     | `tweetnacl.box` with ephemeral X25519 keypair and deterministic nonce `SHA-256("NOC2_BOX_NONCE" \|\| ephem_pk \|\| market_id)`  |
| Compression     | `@scure/base` Bech32m address compression (compresses Orchard UAs from ~110 chars to 61 bytes)                                 |


---

## 4. Repo structure (proposed)

```
nocturne-markets/
  README.md                 threat model, setup, honest trust statement
  about.md
  plan.md
  apps/
    web/                    Next.js frontend
      app/                  routes: /, /market/[id], /bet, /status
      components/           market card, bet slip, reveal form, receipt view
      lib/                  commitment.ts, receipt.ts, api client
  services/
    coordinator/            backend
      src/
        index.ts            server bootstrap
        routes/             markets, bets, reveal, status
        jobs/
          polymarketSync.ts
          depositWatcher.ts
          settlement.ts
        zcash/              wallet wrapper: scan, decode memo, send shielded
        db/                 schema, queries (single module so DB can be swapped)
        crypto/             commitment check, receipt signing, merkle
        config.ts
  packages/
    shared/                 types, memo format, constants (chip sizes etc.)
  scripts/                  testnet helpers, seed, local simulation
  docs/                     threat model detail, diagrams
```

---

## 5. Data model (draft)

- `markets`: id, polymarket_id, title, close_time, status, outcome, pot_address, merkle_root
- `bets`: id, market_id, commitment, amount, return_address, deposit_txid, confirmed_at, receipt_sig, revealed_side, revealed_at, status
- `payouts`: id, bet_id, amount, address, scheduled_at, sent_at, txid
- `sync_state`: last scanned height, last Polymarket poll

Never log commitments, memos or return addresses in plaintext application logs.

### Memo Format (Finalized V2 Dual-Envelope Specification)

Valid ASCII UTF-8 string format (`NOC2:<base64url>~....`) padded to exactly 500 characters (strictly `<= 512 bytes` per ZIP-302):

1. **`version` (1B)**: `0x02`
2. **`market_id` (4B)**: `UInt32BE` (numeric ID or SHA-256 slug prefix)
3. **`tlock_envelope` (217B - Public Audit Envelope)**:
   - Encrypted via `tlock-js` pinned to drand Quicknet (`52db9ba7...`, 3-sec period).
   - Plaintext inside: `side (1B: 0x01=YES, 0x00=NO) || secret (16B random)`.
   - Deterministic binary packing: `round_number (8B) || cipher_ibe (128B) || header_mac (32B) || stream_body (49B)`.
   - `commitment = SHA-256(tlock_envelope)` (binds bet without wasting 32B in memo).
4. **`payout_envelope` (110–130B - Private Settlement Envelope)**:
   - User's Orchard UA compressed via `@scure/base` Bech32m to raw bytes (`~61 bytes`).
   - Encrypted with `tweetnacl.box` using ephemeral X25519 keypair and Coordinator settlement public key.
   - Nonce derived deterministically: `SHA-256("NOC2_BOX_NONCE" || ephem_pk || market_id_bytes)[0..24]`.
   - Store: `ephem_pk (32B) || cipher_length (1B) || boxed_address (16B MAC + N bytes)`.

### Parimutuel Payout Formula (Fee-on-Profit Only)

All calculations executed in exact `BigInt` zatoshis (`1 ZEC = 100_000_000n zats`):
1. **Single-Sided or Void Refund Rule**:
   If `yesPot === 0n` OR `noPot === 0n` OR `outcome === 'VOID'`, market status becomes `REFUNDED`. Every bettor receives `stake - zip317TxFee`. Protocol fee is `0`.
2. **Fee-on-Profit Settlement**:
   - `distributableLosingPot = (losingPot * (10000n - feeBps)) / 10000n`
   - `grossPayout_i = stake_i + (stake_i * distributableLosingPot) / winningPot`
   - `netPayout_i = grossPayout_i - zip317FeePerRecipient`
   - Conservation Invariant: `sum(grossPayout_i) + protocolFee <= totalPot`.

### API (Zero-POST Design)

- `GET /api/markets`: Cached list of mirrored Polymarket events.
- `GET /api/markets/:id`: Market details, close time, drand round, coordinator public key, and pot address.
- `GET /api/markets/:id/audit`: (Post-close) Pot totals, commitments list, drand beacon, and Merkle root.
- **ZERO WRITE ENDPOINTS**: No `/api/bets`, no `/api/reveal`, no HTTP receipts. Bettors generate URIs locally and pay on-chain!

---

## 6. Resources to check (find current versions yourself)

I cannot verify exact URLs or package states, so search for these and trust the hackathon Resources page first.

- ZECATHON site, Resources section: https://thezecathon.com (testnet faucet, lightwalletd endpoints, starter docs)
- Polymarket public Gamma API docs (markets, events, outcomes, resolution fields)
- Zcash developer docs: shielded transactions, Orchard, unified addresses, memos, payment URIs (ZIP-321 style)
- lightwalletd and the light client protocol docs
- librustzcash repo and examples (reference for scanning and memo decryption)
- Any maintained JS/TS or WASM Zcash wallet library (check last commit date and testnet support)
- A Zcash CLI wallet that supports testnet and scripted sends (check what the Resources page recommends)
- Zcash testnet faucet
- For stretch: FROST for Zcash (ZF FROST repo), and Azure confidential VM docs or a managed TEE platform docs
- Merkle tree library for TS
- Public Zcash repos for shielded payment or point-of-sale demos to read as examples

AI usage rules for this project:

- Paste real docs or example code into the prompt and make it code against them.
- Run every Zcash call on testnet immediately. Never trust unrun generated Zcash code.
- Ask AI to explain any crypto step before accepting it. A subtle bug here is a privacy leak.

---

## 7. Day-by-day plan

Total: 17 calendar days including today and deadline day.

### Day 1: Mon Oct 12 (today)

- Register on the ZECATHON site, choose the Private Markets track, read the rules and Resources page
- Set up the repo (monorepo above), install tooling, create the VM user and Node, pm2, Caddy
- Find the testnet faucet and lightwalletd endpoints, get test ZEC
- Pull the Polymarket market list in a script, confirm fields (id, title, close time, outcome, resolved flag)

### Day 2: Tue Oct 13

- Get a Zcash testnet wallet running (CLI or library), generate a shielded pot address
- Send yourself a shielded tx with a memo from another wallet
- Detect that deposit programmatically and decode the memo
- Finalize the memo format

### Day 3: Wed Oct 14 (GATE)

- Send a shielded payout from the pot wallet to a return address, programmatically
- **Gate: deposit detected + memo decoded + payout sent, all on testnet, all scripted.**
- If this works, continue. If not, simplify the Zcash approach (different wallet library, or a CLI wrapper) now. Do not push forward without it.

### Day 4: Thu Oct 15

- SQLite schema and db module
- Deposit watcher job writes bets to the DB, with confirmations
- Receipt signer and receipt verification

### Day 5: Fri Oct 16

- Commitment scheme: browser generates secret, hash, receipt code
- Reveal endpoint and checker
- Unit tests for commitment, reveal, receipt

### Day 6: Sat Oct 17

- Polymarket sync job and cached market API
- Market lifecycle states: open, closed, revealing, resolved, settled, refunded

### Day 7: Sun Oct 18

- Settlement logic: pots, payout formula, Merkle root, void/50-50 refund path
- Simulation script with fake bets to test settlement math

### Day 8: Mon Oct 19

- Payout sender: batching, random delays, fresh addresses, retries
- End-to-end backend test on testnet with 3 to 5 bets (the whole flow once, without UI)

### Day 9: Tue Oct 20

- Frontend: market list and market detail, Polymarket reference price line
- Pot sizes hidden until close

### Day 10: Wed Oct 21

- Frontend: bet slip, chip sizes, payment request QR, receipt code with backup export
- Return address input and validation

### Day 11: Thu Oct 22

- Frontend: status page by receipt code, reveal flow (auto-reveal prompt after close)
- Results page: totals, Merkle root, formula, verification helper

### Day 12: Fri Oct 23

- Full end-to-end run through the UI on testnet
- Fix everything that breaks
- Deploy backend to the VM with pm2 and Caddy, frontend deployed

### Day 13: Sat Oct 24

- Privacy hardening pass: no IP logs, no plaintext logs, padded memos, shielded-only warnings, cached Polymarket data, headers and analytics removed
- Review the leak map in about.md line by line and tick each item

### Day 14: Sun Oct 25

- Stretch day (choose one only if the full flow is stable): TEE, FROST, or in-browser wallet. Otherwise polish and bug fixing
- Mainnet shielded wallet set up to receive the prize

### Day 15: Mon Oct 26

- README: problem, solution, architecture diagram, honest threat model table, setup steps, testnet demo notes
- Record the demo video (full flow, plus a short explanation of what is private and what is not)

### Day 16: Tue Oct 27

- Final test run from scratch on a clean checkout
- Make the repo public, double check no keys in git history
- Submit on the ZECATHON site: pick the Private Markets track, add the shielded prize address, demo link, repo, video

### Day 17: Wed Oct 28 (deadline day, buffer only)

- Fix only critical issues. Edits are allowed until the deadline but avoid risky changes
- Deadline: 23:59 UTC Oct 28 (00:59 Oct 29 Lagos). Do not rely on the last hour

---

## 8. Gates and cut list

Gates:

- **Day 3**: shielded deposit detection, memo decode, and payout all scripted on testnet. If this fails, change approach the same day.
- **Day 8**: full backend flow works without UI. If late, cut the stretch day and shorten polish.
- **Day 12**: full UI flow works once. If late, drop everything except the single demo market.

Cut order if time runs short (cut from the top first):

1. Stretch options (TEE, FROST, in-browser wallet)
2. Viewing-key audit publication
3. Multiple markets (keep one demo market)
4. Fancy animations
5. Payout batching complexity (keep a simple delayed batch)

Never cut: commit-reveal, shielded-only flow, receipts and Merkle root, threat model README, working demo.

---

## 9. Testing checklist

- Commitment mismatch on reveal is rejected
- Duplicate deposit, wrong chip size, wrong memo format are handled
- Unrevealed bet policy works
- Payout math matches a standalone script
- Void or 50/50 triggers refunds
- Restarting the backend mid-scan does not double-count a deposit
- No secrets or keys in the repo or git history
- Logs contain no IPs, memos, commitments or return addresses
- Fresh clone setup works from the README

---

## 10. Submission checklist

- [ ] Registered on the ZECATHON site
- [ ] Track chosen: Private Markets (one submission, one track)
- [ ] All code written inside the build window
- [ ] Repo public, open source license added
- [ ] README with threat model and setup
- [ ] Demo video
- [ ] Live demo link (testnet) running on the VM
- [ ] Mainnet shielded address ready for the prize payout
- [ ] Submitted before Oct 28, 23:59 UTC (aim: evening of Oct 27)
